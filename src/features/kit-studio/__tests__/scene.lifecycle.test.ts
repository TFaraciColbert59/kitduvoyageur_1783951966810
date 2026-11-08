// @vitest-environment jsdom
// Cycle de vie de la scène sans WebGL : un faux renderer est injecté (rendererFactory).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PCFShadowMap, ACESFilmicToneMapping } from 'three';
import { createInitialState } from '../domain/state';
import type { KitState } from '../domain/types';
import { createKitScene } from '../scene/createScene';
import type { RendererFactory, RendererLike } from '../scene/createScene';
import { createFrameMeter } from '../scene/lifecycle';
import { createCameraRig, DRAWER_OPEN, viewOffsetFraction, zoomFor } from '../scene/camera';

interface FakeRenderer extends RendererLike {
  loop: ((t: number) => void) | null;
  loopCalls: (boolean)[];
  renders: number;
  disposed: boolean;
}

function fakeFactory(created: FakeRenderer[]): RendererFactory {
  return (canvas) => {
    const r: FakeRenderer = {
      domElement: canvas,
      shadowMap: { enabled: false, type: PCFShadowMap },
      toneMapping: ACESFilmicToneMapping,
      toneMappingExposure: 1,
      outputColorSpace: 'srgb',
      capabilities: { getMaxAnisotropy: () => 4 },
      info: { memory: { geometries: 0, textures: 0 } },
      loop: null,
      loopCalls: [],
      renders: 0,
      disposed: false,
      setPixelRatio() {},
      setSize() {},
      render() { r.renders += 1; },
      setAnimationLoop(cb) { r.loop = cb; r.loopCalls.push(cb !== null); },
      dispose() { r.disposed = true; },
    };
    created.push(r);
    return r;
  };
}

function withConfig(base: KitState, mutate: (s: KitState) => KitState): KitState {
  return mutate(base);
}

/** Variante de configuration : change des formes (reconstruit des pièces) et des accessoires. */
function variant(base: KitState, n: number): KitState {
  const bag = base.kits[base.kitId].bag;
  const cfg = base.config[bag];
  const shapes = [
    { body: 'classic', lid: 'std', front: 'zip', sides: 'std', hip: 'padded', harness: 'std', acc: [] as const },
    { body: 'roll', lid: 'xl', front: 'stretch', sides: 'tall', hip: 'wide', harness: 'mesh', acc: ['cover', 'reflect', 'daisy'] as const },
    { body: 'slim', lid: 'none', front: 'shove', sides: 'none', hip: 'web', harness: 'vest', acc: ['axe', 'compress', 'spocket', 'sbottle', 'biner'] as const },
  ] as const;
  const s = shapes[n % shapes.length];
  return withConfig(base, (st) => ({
    ...st,
    config: {
      ...st.config,
      [bag]: {
        ...cfg,
        body: { ...cfg.body, shape: s.body },
        lid: { ...cfg.lid, shape: s.lid },
        front: { ...cfg.front, shape: s.front },
        sides: { ...cfg.sides, shape: s.sides },
        hip: { ...cfg.hip, shape: s.hip },
        harness: { ...cfg.harness, shape: s.harness },
        acc: [...s.acc],
      },
    },
  }));
}

let renderers: FakeRenderer[];
let canvas: HTMLCanvasElement;

beforeEach(() => {
  vi.useFakeTimers();
  // Pas de contexte 2D en jsdom : les textures procédurales restent vides, sans bruit.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  renderers = [];
  canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  canvas.remove();
});

const make = (state = createInitialState('tmb')) => {
  const scene = createKitScene(canvas, { state, reducedMotion: false, rendererFactory: fakeFactory(renderers) });
  return { scene, r: renderers[0] };
};

describe('boucle à la demande', () => {
  it('démarre à la création puis s\'arrête 600 ms après le repos', () => {
    const { scene, r } = make();
    expect(r.loop).not.toBeNull();
    expect(scene.info().running).toBe(true);
    // Le sac et la caméra convergent : on joue des images jusqu'au repos.
    let t = 0;
    for (let i = 0; i < 400 && r.loop; i++) { t += 16; vi.advanceTimersByTime(0); r.loop?.(t); if (!scene.info().running) break; }
    vi.advanceTimersByTime(599);
    expect(r.loop).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(r.loop).toBeNull();
    expect(scene.info().running).toBe(false);
    scene.dispose();
  });

  it('un invalidate (update ou tiroir) relance la boucle', () => {
    const { scene, r } = make();
    vi.advanceTimersByTime(600);
    expect(r.loop).toBeNull();
    scene.setDrawerOpen(true);
    expect(r.loop).not.toBeNull();
    vi.advanceTimersByTime(600);
    expect(r.loop).toBeNull();
    scene.update(variant(createInitialState('tmb'), 1));
    expect(r.loop).not.toBeNull();
    scene.dispose();
  });

  it('visibilitychange et pagehide coupent la boucle, le retour la relance', () => {
    const { scene, r } = make();
    expect(r.loop).not.toBeNull();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(r.loop).toBeNull();
    scene.setDrawerOpen(true);
    expect(r.loop).toBeNull(); // caché : pas de rendu
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(r.loop).not.toBeNull();
    window.dispatchEvent(new Event('pagehide'));
    expect(r.loop).toBeNull();
    scene.dispose();
  });
});

describe('perte de contexte', () => {
  it('contextlost : preventDefault et gel ; contextrestored : reconstruction depuis l\'état', () => {
    const changes: boolean[] = [];
    const scene = createKitScene(canvas, {
      state: createInitialState('tmb'), reducedMotion: false, rendererFactory: fakeFactory(renderers),
      onContextChange: (lost) => changes.push(lost),
    });
    const r = renderers[0];
    const before = scene.info().resources;
    const lost = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(r.loop).toBeNull();
    expect(scene.info().frozen).toBe(true);
    const rendersFrozen = r.renders;
    const next = variant(createInitialState('tmb'), 1);
    scene.update(next);
    scene.setDrawerOpen(true);
    expect(r.loop).toBeNull();
    expect(r.renders).toBe(rendersFrozen);

    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(scene.info().frozen).toBe(false);
    expect(r.loop).not.toBeNull();
    expect(changes).toEqual([true, false]);
    // L'ancien monde est libéré : pas de doublon de ressources, et la config reçue pendant le gel est appliquée.
    const after = scene.info().resources;
    expect(after.textures).toBeGreaterThanOrEqual(before.textures);
    r.loop?.(16);
    expect(r.renders).toBeGreaterThan(rendersFrozen);
    scene.dispose();
    expect(scene.info().resources).toEqual({ geometries: 0, materials: 0, textures: 0, renderTargets: 0 });
  });
});

describe('libération des ressources', () => {
  it('20 cycles update(config différente) ramènent les ressources vivantes à la valeur de départ, dispose les met à zéro', () => {
    const base = createInitialState('tmb');
    const { scene, r } = make(variant(base, 0));
    // Une première boucle complète installe les textures de tissu utilisées : valeur de référence stable.
    const start = scene.info().resources;
    expect(start.geometries).toBeGreaterThan(0);
    expect(start.materials).toBeGreaterThan(0);
    expect(start.textures).toBeGreaterThan(0);
    const texturesSeen = new Set<number>();
    for (let i = 1; i <= 20; i++) {
      scene.update(variant(base, i % 3));
      r.loop?.(i * 16);
      scene.update(variant(base, 0));
      texturesSeen.add(scene.info().resources.textures);
    }
    const end = scene.info().resources;
    // Géométries et matériaux : exactement ceux de départ (partagées comptées par référence).
    expect(end.geometries).toBe(start.geometries);
    expect(end.materials).toBe(start.materials);
    // Textures : banque partagée, bornée (au plus les 9 tissus + les 4 cartes de relief des matières
    // relevées + panorama + bois), sans croissance au fil des cycles.
    expect(end.textures).toBeLessThanOrEqual(15);
    expect(Math.max(...texturesSeen)).toBe(end.textures);
    expect(end.renderTargets).toBe(0);
    scene.dispose();
    expect(scene.info().resources).toEqual({ geometries: 0, materials: 0, textures: 0, renderTargets: 0 });
    expect(r.disposed).toBe(true);
  });

  it('changer de sac (b42 vers b28) ne laisse aucune pièce de l\'ancien sac', () => {
    const base = createInitialState('tmb');
    const { scene } = make(base);
    const start = scene.info().resources;
    const small = { ...base, kits: { ...base.kits, tmb: { ...base.kits.tmb, bag: 'b28' as const } } };
    for (let i = 0; i < 10; i++) {
      scene.update(small);
      scene.update(base);
    }
    const end = scene.info().resources;
    expect(end.geometries).toBe(start.geometries);
    expect(end.materials).toBe(start.materials);
    scene.dispose();
    expect(scene.info().resources.geometries).toBe(0);
  });

  it('dispose retire les écouteurs : plus de relance après démontage', () => {
    const { scene, r } = make();
    scene.dispose();
    const calls = r.loopCalls.length;
    document.dispatchEvent(new Event('visibilitychange'));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    scene.update(variant(createInitialState('tmb'), 2));
    scene.setDrawerOpen(true);
    expect(r.loopCalls.length).toBe(calls);
    expect(r.loop).toBeNull();
  });
});

describe('mesure de fluidité', () => {
  it('moyenne sur 30 images, ignore le repos entre deux rafales', () => {
    const m = createFrameMeter();
    let t = 0;
    let avg: number | null = null;
    for (let i = 0; i < 31; i++) { t += 30; avg = m.push(t); }
    expect(avg).toBeCloseTo(30);
    expect(m.push(t + 5000)).toBeNull(); // redémarrage de boucle : fenêtre remise à zéro
  });
});

describe('caméra liée au tiroir', () => {
  it('dk rejoint 1,7 à l\'ouverture ; mouvement réduit : quasi immédiat', () => {
    const rig = createCameraRig({ reducedMotion: false });
    rig.setViewport(402, 874);
    rig.setDrawerOpen(true);
    rig.step(1 / 60);
    expect(rig.dk()).toBeGreaterThan(0);
    expect(rig.dk()).toBeLessThan(1.7);
    for (let i = 0; i < 600; i++) rig.step(1 / 60);
    expect(rig.dk()).toBe(1.7);
    expect(rig.camera.zoom).toBeCloseTo(zoomFor(1.7));
    const reduced = createCameraRig({ reducedMotion: true });
    reduced.setViewport(402, 874);
    reduced.setDrawerOpen(true);
    for (let i = 0; i < 10; i++) reduced.step(1 / 60);
    expect(reduced.dk()).toBe(1.7);
  });

  it('formules du décalage et du zoom', () => {
    // `viewOffsetFraction` reçoit `dk`, qui va de 0 (tiroir fermé) à DRAWER_OPEN (1,7), et non une
    // fraction 0–1 : les deux bornes du décalage se lisent donc à 0 et à DRAWER_OPEN. Sans cette
    // normalisation, dk = 1,7 extrapolait à 0,126 au lieu de 0,035 et poussait la vue vers le bas.
    expect(viewOffsetFraction(0)).toBeCloseTo(-0.095);
    expect(viewOffsetFraction(DRAWER_OPEN)).toBeCloseTo(0.035);
    expect(viewOffsetFraction(2 * DRAWER_OPEN)).toBeCloseTo(0.035);
    expect(zoomFor(0)).toBeCloseTo(1.05);
    expect(zoomFor(1)).toBe(1);
  });
});

describe('rechargement du maillage', () => {
  /** Compte les chargements réellement demandés : un manifeste par tentative. */
  function sceneComptee(etat: KitState) {
    const demandes: string[] = [];
    const scene = createKitScene(canvas, {
      state: etat,
      reducedMotion: false,
      rendererFactory: fakeFactory(renderers),
      bagAssetProvider: {
        // Un manifeste vide fait échouer le chargement proprement : le test ne mesure que le
        // déclenchement, et rien ne reste en suspens après la fin du fichier.
        fetchManifest: async (id: string) => {
          demandes.push(id);
          return {} as never;
        },
        fetchGlb: async () => new ArrayBuffer(0),
      },
    });
    return { scene, demandes };
  }

  it("un changement de teinte ne relance pas le chargement du maillage", () => {
    const depart = createInitialState('tmb');
    const corps = depart.kits[depart.kitId].bag;
    const { scene, demandes } = sceneComptee(depart);
    const auDepart = demandes.length;

    // Le sac procédural est reconstruit à chaque changement d'apparence ; s'en servir comme signal
    // de rechargement relançait un chargement complet par couleur. Trois d'affilée s'annulaient
    // l'une l'autre et le Studio restait bloqué sur « chargement », sans couleur ni point d'accroche.
    const teinte: KitState = {
      ...depart,
      config: {
        ...depart.config,
        [corps]: { ...depart.config[corps], body: { ...depart.config[corps].body, col: 'm-b5aba0' } },
      },
    };
    scene.update(teinte);
    expect(demandes.length).toBe(auDepart);
    scene.dispose();
  });

  it('un changement de corps relance le chargement, une seule fois', () => {
    const depart = createInitialState('tmb');
    const { scene, demandes } = sceneComptee(depart);
    const auDepart = demandes.length;

    const autreCorps: KitState = {
      ...depart,
      kits: {
        ...depart.kits,
        [depart.kitId]: { ...depart.kits[depart.kitId], bag: 'lkdv-one-80' },
      },
    };
    scene.update(autreCorps);
    expect(demandes.length).toBe(auDepart + 1);
    expect(demandes[demandes.length - 1]).toBe('lkdv-one-80');

    // Rejouer le même corps ne redemande rien : la source n'a pas changé.
    scene.update({ ...autreCorps });
    expect(demandes.length).toBe(auDepart + 1);
    scene.dispose();
  });
});
