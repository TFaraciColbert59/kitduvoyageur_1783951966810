// @vitest-environment jsdom
// Gestes, caméra de zone, objets de la scène — sans WebGL (faux renderer injecté).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACESFilmicToneMapping, PCFShadowMap } from 'three';
import { pack, unpack } from '../domain/packing';
import { createInitialState } from '../domain/state';
import type { KitState } from '../domain/types';
import { createCameraRig } from '../scene/camera';
import { createKitScene } from '../scene/createScene';
import type { KitScene, KitSceneOptions, RendererFactory, RendererLike } from '../scene/createScene';
import type { LiftEvent, ScenePick } from '../scene/gestures';

interface FakeRenderer extends RendererLike { loop: ((t: number) => void) | null; renders: number }

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
      renders: 0,
      setPixelRatio() {},
      setSize() {},
      render() { r.renders += 1; },
      setAnimationLoop(cb) { r.loop = cb; },
      dispose() {},
    };
    created.push(r);
    return r;
  };
}

let renderers: FakeRenderer[];
let canvas: HTMLCanvasElement;
let clock = 0;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  renderers = [];
  clock = 0;
  canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  canvas.remove();
});

function make(extra: Partial<KitSceneOptions> = {}, state: KitState = createInitialState('tmb')): { scene: KitScene; r: FakeRenderer } {
  const scene = createKitScene(canvas, { state, reducedMotion: false, rendererFactory: fakeFactory(renderers), ...extra });
  return { scene, r: renderers[renderers.length - 1] };
}

/** Joue n images de 16 ms sur la boucle (sans attendre le temps réel). */
function play(r: FakeRenderer, frames: number): void {
  for (let i = 0; i < frames && r.loop; i++) { clock += 16; r.loop(clock); }
}

/** Faux PointerEvent : PointerEvent si jsdom le fournit, sinon MouseEvent portant les mêmes champs. */
function ptr(type: string, id: number, x: number, y: number, pointerType = 'touch'): Event {
  const init = { clientX: x, clientY: y, bubbles: true, cancelable: true };
  const e = typeof PointerEvent === 'function' ? new PointerEvent(type, { ...init, pointerId: id, pointerType }) : new MouseEvent(type, init);
  if (typeof PointerEvent !== 'function') {
    Object.defineProperty(e, 'pointerId', { value: id });
    Object.defineProperty(e, 'pointerType', { value: pointerType });
  }
  return e;
}
const down = (id: number, x: number, y: number): void => { canvas.dispatchEvent(ptr('pointerdown', id, x, y)); };
const move = (id: number, x: number, y: number): void => { canvas.dispatchEvent(ptr('pointermove', id, x, y)); };
const up = (id: number, x: number, y: number): void => { canvas.dispatchEvent(ptr('pointerup', id, x, y)); };
const key = (k: string): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  canvas.dispatchEvent(e);
  return e;
};

/** Gèle récursivement : toute écriture dans l'état passé à la scène lèverait une erreur (modules ESM stricts). */
function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}

describe('orbite et inclinaison', () => {
  it('un doigt qui glisse horizontalement change l\'angle de la caméra', () => {
    const picks: ScenePick[] = [];
    const { scene, r } = make({ onPick: (p) => picks.push(p) });
    const before = scene.info().view;
    down(1, 200, 400);
    move(1, 160, 402);
    move(1, 60, 405);
    play(r, 2);
    const during = scene.info().view;
    expect(during.angle).not.toBeCloseTo(before.angle, 3);
    expect(during.position).toBeGreaterThan(before.position);
    up(1, 60, 405);
    play(r, 300);
    const after = scene.info().view;
    expect(after.position).toBe(Math.round(after.position)); // se pose sur une zone
    expect(picks).toHaveLength(0); // un glissement n'est pas un toucher
    scene.dispose();
  });

  it('un glissement vertical incline la vue, relâché elle revient', () => {
    const { scene, r } = make();
    down(1, 200, 400);
    move(1, 202, 330);
    play(r, 60);
    expect(scene.info().view.tilt).toBeLessThan(0);
    up(1, 202, 330);
    play(r, 200);
    expect(scene.info().view.tilt).toBe(0);
    scene.dispose();
  });

  it('touch-action: none sur le canvas, restauré au démontage', () => {
    const { scene } = make();
    expect(canvas.style.touchAction).toBe('none');
    scene.dispose();
    expect(canvas.style.touchAction).toBe('');
  });
});

describe('pincement = pièces séparées', () => {
  it('deux pointeurs qui s\'écartent ouvrent, qui se rapprochent referment', () => {
    const changes: boolean[] = [];
    const { scene, r } = make({ onExplodedChange: (v) => changes.push(v) });
    down(1, 150, 300);
    down(2, 250, 300);
    move(2, 450, 300);
    expect(scene.info().view.explodedTarget).toBe(1);
    up(2, 450, 300);
    up(1, 150, 300);
    expect(changes).toEqual([true]);
    play(r, 200);
    expect(scene.info().view.exploded).toBe(1);

    down(1, 100, 300);
    down(2, 400, 300);
    move(2, 150, 300);
    up(2, 150, 300);
    up(1, 100, 300);
    expect(scene.info().view.explodedTarget).toBe(0);
    expect(changes).toEqual([true, false]);
    play(r, 200);
    expect(scene.info().view.exploded).toBe(0);
    scene.dispose();
  });

  it('un pincement à moitié se range sur 0 ou 1 au relâchement', () => {
    const { scene } = make();
    down(1, 150, 300);
    down(2, 250, 300);
    move(2, 280, 300); // 130 / 100 : 0,3 × 1,6 = 0,48 > 0,45
    up(2, 280, 300);
    up(1, 150, 300);
    expect(scene.info().view.explodedTarget).toBe(1);
    scene.dispose();
  });
});

describe('double toucher = recentrer', () => {
  it('revient à la vue du sac, sans inclinaison, et n\'émet aucune sélection', () => {
    const picks: ScenePick[] = [];
    let backgrounds = 0;
    const { scene, r } = make({ onPick: (p) => picks.push(p), onBackground: () => { backgrounds += 1; } });
    const home = scene.info().view.angle;
    scene.setZone('hip');
    scene.setExploded(true);
    play(r, 300);
    expect(scene.info().view.angle).not.toBeCloseTo(home, 2);
    down(1, 3, 3);
    up(1, 3, 3);
    down(1, 4, 4);
    up(1, 4, 4);
    play(r, 400);
    vi.advanceTimersByTime(500);
    const v = scene.info().view;
    expect(v.zone).toBe('bag');
    expect(v.angle).toBeCloseTo(home, 3);
    expect(v.exploded).toBe(0);
    expect(picks).toHaveLength(0);
    expect(backgrounds).toBe(0);
    scene.dispose();
  });

  it('un toucher simple dans le vide appelle onBackground après un court délai', () => {
    let backgrounds = 0;
    const { scene } = make({ onBackground: () => { backgrounds += 1; } });
    down(1, 3, 3);
    up(1, 3, 3);
    expect(backgrounds).toBe(0);
    vi.advanceTimersByTime(320);
    expect(backgrounds).toBe(1);
    scene.dispose();
  });
});

describe('clavier', () => {
  it('flèches : orbite zone par zone ; + / − : pièces séparées', () => {
    const { scene, r } = make();
    const start = scene.info().view;
    expect(key('ArrowRight').defaultPrevented).toBe(true);
    play(r, 300);
    const next = scene.info().view;
    expect(next.zone).toBe('lid');
    expect(next.angle).not.toBeCloseTo(start.angle, 3);
    key('ArrowLeft');
    key('ArrowLeft');
    play(r, 300);
    expect(scene.info().view.zone).toBe('worn');
    key('ArrowLeft'); // butée
    play(r, 300);
    expect(scene.info().view.zone).toBe('worn');

    key('+');
    expect(scene.info().view.explodedTarget).toBe(1);
    key('-');
    expect(scene.info().view.explodedTarget).toBe(0);
    key('ArrowUp');
    expect(Math.abs(scene.info().view.tilt) + 1).toBeGreaterThan(0);
    expect(key('a').defaultPrevented).toBe(false);
    scene.dispose();
  });

  it('mouvement réduit : la caméra arrive sans amortissement', () => {
    const { scene, r } = make({ reducedMotion: true });
    key('ArrowRight');
    play(r, 1);
    expect(scene.info().view.position).toBe(2);
    scene.setExploded(true);
    play(r, 3);
    expect(scene.info().view.exploded).toBe(1);
    const rig = createCameraRig({ reducedMotion: true });
    rig.setViewport(402, 874);
    rig.goZone('hip');
    rig.step(1 / 60);
    expect(rig.position()).toBe(rig.zoneIndex());
    scene.dispose();
  });
});

describe('caméra de zone', () => {
  it('setZone ne sort jamais de la liste ; mode Apparence : pas de « Sur toi »', () => {
    const zones: string[] = [];
    const { scene, r } = make({ onZoneChange: (z) => zones.push(z) });
    scene.setZone('back');
    play(r, 400);
    expect(scene.info().view.zone).toBe('back');
    expect(zones).toContain('back');
    scene.setMode('apparence');
    scene.setZone('worn');
    play(r, 400);
    expect(scene.info().view.zone).toBe('bag');
    scene.dispose();
  });

  it('projectZone donne un point écran fini, différent d\'une zone à l\'autre', () => {
    const { scene } = make();
    const a = scene.projectZone('lid');
    const b = scene.projectZone('hip');
    for (const p of [a, b]) { expect(Number.isFinite(p.x)).toBe(true); expect(Number.isFinite(p.y)).toBe(true); }
    expect(a.y).toBeLessThan(b.y);
    scene.dispose();
  });

  it('highlightZone relance le rendu et reste sans effet sur l\'état', () => {
    const { scene, r } = make();
    vi.advanceTimersByTime(700);
    expect(r.loop).toBeNull();
    scene.highlightZone('main');
    expect(r.loop).not.toBeNull();
    scene.highlightZone(null);
    scene.dispose();
  });
});

describe('objets, fantômes et sélection', () => {
  // Règle produit du 09/11/2026 : aucun maillage publié pour les objets, donc aucun objet 3D, ni fantôme.
  // Les anciens tests « toucher / soulever un objet séparé » vérifiaient un objet dessiné par code : interdit.
  it('sans maillage publié, aucun objet n\'est projeté ni touchable, même en pièces séparées', () => {
    const picks: ScenePick[] = [];
    const lifts: LiftEvent[] = [];
    const { scene, r } = make({ onPick: (p) => picks.push(p), onLift: (e) => lifts.push(e), armY: () => 700 });
    scene.setExploded(true);
    play(r, 300);
    expect(scene.projectItem('bladder')).toBeNull();
    // Geste de soulevé sur le sac : jamais un objet ni un début de soulevé.
    const c = scene.projectZone('main');
    down(1, c.x, c.y);
    move(1, c.x + 1, c.y + 30);
    move(1, c.x + 2, c.y + 330);
    play(r, 3);
    up(1, c.x + 2, c.y + 330);
    vi.advanceTimersByTime(400);
    expect(lifts).toEqual([]);
    expect(picks.some((p) => p.kind === 'item')).toBe(false);
    scene.dispose();
  });

  it('au repos les objets rangés sont invisibles : un toucher sur le sac donne une zone, pas un objet', () => {
    const picks: ScenePick[] = [];
    const { scene, r } = make({ onPick: (p) => picks.push(p) });
    play(r, 100);
    const c = scene.projectZone('main');
    down(1, c.x, c.y);
    up(1, c.x, c.y);
    vi.advanceTimersByTime(400);
    expect(picks).toHaveLength(1);
    expect(picks[0].kind).toBe('zone');
    expect(scene.zoneAt(c.x, c.y)).not.toBeNull();
    scene.setMode('apparence');
    down(1, c.x, c.y);
    up(1, c.x, c.y);
    vi.advanceTimersByTime(400);
    expect(picks[1].kind).toBe('part');
    scene.dispose();
  });

  it('ni objet ni fantôme dans la scène (aucun maillage publié) ; tout est libéré au démontage', () => {
    const { scene } = make();
    expect(scene.info().objects).toEqual({ items: 0, dying: 0 });
    scene.dispose();
    expect(scene.info().resources).toEqual({ geometries: 0, materials: 0, textures: 0, renderTargets: 0 });
  });
});

describe('ressources et état', () => {
  it('20 cycles pack / unpack via update(state) ne fuient pas', () => {
    const base = deepFreeze(createInitialState('tmb'));
    const { scene, r } = make({}, base);
    play(r, 30);
    const start = scene.info().resources;
    const startObjects = scene.info().objects.items; // 0 : aucun maillage d'objet publié
    for (let i = 0; i < 20; i++) {
      const out = unpack(base, 'stove');
      scene.update(out);
      expect(scene.info().objects.items).toBe(startObjects);
      play(r, 12);
      const back = pack(out, 'stove', 'main');
      expect(back.ok).toBe(true);
      scene.update(back.state);
      play(r, 3);
      scene.update(base);
      play(r, 40); // laisse finir les sorties animées (0,45 s) avant de compter
    }
    play(r, 60);
    const end = scene.info().resources;
    expect(end.geometries).toBe(start.geometries);
    expect(end.materials).toBe(start.materials);
    expect(end.textures).toBe(start.textures);
    expect(end.renderTargets).toBe(0);
    expect(scene.info().objects.dying).toBe(0);
    expect(scene.info().objects.items).toBe(startObjects);
    scene.dispose();
    expect(scene.info().resources).toEqual({ geometries: 0, materials: 0, textures: 0, renderTargets: 0 });
  });

  it('changer de kit puis revenir ne laisse ni objet ni fantôme de l\'ancien kit', () => {
    const base = deepFreeze(createInitialState('tmb'));
    const { scene, r } = make({}, base);
    play(r, 30);
    const start = scene.info().resources;
    for (let i = 0; i < 6; i++) {
      scene.update({ ...base, kitId: 'vercors' });
      play(r, 50);
      scene.update(base);
      play(r, 50);
    }
    const end = scene.info().resources;
    expect(end.geometries).toBe(start.geometries);
    expect(end.materials).toBe(start.materials);
    expect(end.textures).toBe(start.textures);
    scene.dispose();
    expect(scene.info().resources.geometries).toBe(0);
  });

  it('ni la scène ni les gestes ne modifient l\'état reçu', () => {
    const state = deepFreeze(createInitialState('tmb'));
    const snapshot = JSON.stringify(state);
    const { scene, r } = make({ onPick: () => {}, onLift: () => {} }, state);
    scene.update(deepFreeze(unpack(state, 'stove')));
    scene.setExploded(true);
    play(r, 100);
    down(1, 200, 400);
    move(1, 100, 420);
    up(1, 100, 420);
    key('ArrowRight');
    scene.highlightZone('front');
    play(r, 100);
    expect(JSON.stringify(state)).toBe(snapshot);
    scene.dispose();
  });

  it('la boucle s\'arrête 600 ms après un geste, 0 rendu au repos', () => {
    const { scene, r } = make();
    down(1, 200, 400);
    move(1, 100, 402);
    up(1, 100, 402);
    for (let i = 0; i < 500 && scene.info().running; i++) { play(r, 1); vi.advanceTimersByTime(16); }
    vi.advanceTimersByTime(700);
    expect(r.loop).toBeNull();
    const rendered = r.renders;
    vi.advanceTimersByTime(2000);
    expect(r.renders).toBe(rendered);
    scene.dispose();
  });

  it('dispose retire les écouteurs : plus aucun rappel après démontage', () => {
    const picks: ScenePick[] = [];
    const { scene } = make({ onPick: (p) => picks.push(p), onBackground: () => picks.push({ kind: 'zone', id: 'bag' }) });
    scene.dispose();
    down(1, 3, 3);
    up(1, 3, 3);
    key('ArrowRight');
    vi.advanceTimersByTime(1000);
    expect(picks).toHaveLength(0);
    expect(canvas.hasAttribute('tabindex')).toBe(false);
  });
});
