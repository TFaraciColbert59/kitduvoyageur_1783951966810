// @vitest-environment jsdom
// Moteur de vignettes sans WebGL : un faux renderer, un encodeur et un ordonnanceur sont injectés.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACESFilmicToneMapping, Group, Mesh, PCFShadowMap } from 'three';
import { BAGS, COLORWAYS, SWATCHES } from '../domain/catalog';
import { createThumbnailEngine, registerBuilder, THUMB_PRIORITY } from '../scene/thumbnails';
import type { ThumbnailEngine, ThumbnailEngineOptions, ThumbRendererLike, ItemThumbSpec } from '../scene/thumbnails';
import { ballThumb, bagThumb, bagThumbScale, colorwayThumb, itemThumb, swatchThumb } from '../scene/thumbSpecs';
import type { ThumbItemLike } from '../scene/thumbSpecs';

interface FakeRenderer extends ThumbRendererLike {
  renders: number;
  disposed: boolean;
  contextLost: boolean;
}

interface Rig {
  readonly engine: ThumbnailEngine;
  readonly renderers: FakeRenderer[];
  readonly made: string[];
  readonly revoked: string[];
  readonly drawn: string[];
  /** Exécute le prochain créneau d'ordonnancement ; false s'il n'y en a pas. */
  step(): boolean;
  pendingSlots(): number;
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function makeRig(extra: Partial<ThumbnailEngineOptions> = {}, opts: { noWebgl?: boolean } = {}): Rig {
  const renderers: FakeRenderer[] = [];
  const made: string[] = [];
  const revoked: string[] = [];
  const drawn: string[] = [];
  const slots: (() => void)[] = [];
  const engine = createThumbnailEngine({
    rendererFactory: (canvas) => {
      if (opts.noWebgl) throw new Error('WebGL indisponible');
      const r: FakeRenderer = {
        domElement: canvas,
        shadowMap: { enabled: false, type: PCFShadowMap },
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1,
        outputColorSpace: 'srgb',
        capabilities: { getMaxAnisotropy: () => 4 },
        renders: 0,
        disposed: false,
        contextLost: false,
        setPixelRatio() {},
        setSize() {},
        setClearColor() {},
        render() { r.renders += 1; },
        dispose() { r.disposed = true; },
        forceContextLoss() { r.contextLost = true; },
      };
      renderers.push(r);
      return r;
    },
    encode: () => Promise.resolve(new Blob(['png'], { type: 'image/png' })),
    createUrl: () => { const u = `blob:fake/${made.length}`; made.push(u); return u; },
    revokeUrl: (u) => { revoked.push(u); },
    schedule: (run) => {
      slots.push(run);
      return () => { const i = slots.indexOf(run); if (i >= 0) slots.splice(i, 1); };
    },
    builders: {
      i: (spec: ItemThumbSpec, res) => {
        drawn.push(spec.id);
        const g = new Group();
        g.add(new Mesh(res.roundedBox(0.6, 0.4, 0.3, 0.05, 4), res.material(spec.color)));
        return g;
      },
    },
    ...extra,
  });
  return {
    engine, renderers, made, revoked, drawn,
    step() { const run = slots.shift(); if (!run) return false; run(); return true; },
    pendingSlots: () => slots.length,
  };
}

const sleeping: ThumbItemLike = { id: 'sleep0', sh: 'bag', gl: 'moon', color: 'm-2d482a', L: 3 };
const item = (id: string) => itemThumb({ ...sleeping, id });

const engines: ThumbnailEngine[] = [];
function rig(extra: Partial<ThumbnailEngineOptions> = {}, opts: { noWebgl?: boolean } = {}): Rig {
  const r = makeRig(extra, opts);
  engines.push(r.engine);
  return r;
}
// jsdom n'a pas de contexte 2D : les textures procédurales se replient sur un canvas vide, sans bruit.
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { for (const e of engines.splice(0)) e.dispose(); vi.restoreAllMocks(); });

describe('clés et descriptions', () => {
  it('suit le format i:<id>:<forme>:<couleur>, b:<sac>:<couleurs>, c:<couleur>', () => {
    expect(itemThumb(sleeping).key).toBe('i:sleep0:bag:m-2d482a');
    expect(itemThumb(sleeping, undefined, true).key).toBe('i:sleep0:bag:m-2d482a:plan');
    const cw = COLORWAYS.foret;
    expect(colorwayThumb(cw, 'b42').key).toBe(`b:b42:${cw.body}:${cw.pocket}:${cw.trim}`);
    expect(ballThumb('m-5b7f55').key).toBe('c:m-5b7f55');
    expect(swatchThumb(SWATCHES[0]).key).toBe(`c:${SWATCHES[0][1]}`);
  });

  it('dessine un sac à s = min(0,8 ; 0,8 × L/42)', () => {
    expect(bagThumbScale(42)).toBeCloseTo(0.8);
    expect(bagThumbScale(60)).toBeCloseTo(0.8);
    expect(bagThumbScale(BAGS.b28.L)).toBeCloseTo((0.8 * BAGS.b28.L) / 42);
    const t = bagThumb('b28', COLORWAYS.nuit);
    expect(t.spec.scale).toBeCloseTo(bagThumbScale(BAGS.b28.L));
  });

  it('résout les couleurs par la palette (jamais de littéral dans la clé)', () => {
    const t = ballThumb('m-5b7f55', (n) => (n === '--lkv-sage-500' ? 'rgb(1, 2, 3)' : undefined));
    expect(t.spec.color).toBe('rgb(1, 2, 3)');
    expect(t.key).not.toContain('#');
  });
});

describe('moteur de vignettes', () => {
  it('une même clé ne produit qu’un seul rendu', async () => {
    const r = rig();
    const t = item('a');
    r.engine.request(t.key, { spec: t.spec });
    r.engine.request(t.key, { spec: t.spec });
    while (r.step()) { /* vide la file */ }
    await flush();
    r.engine.request(t.key);
    r.engine.request(t.key, { spec: t.spec });
    expect(r.pendingSlots()).toBe(0);
    expect(r.drawn).toEqual(['a']);
    expect(r.renderers[0].renders).toBe(1);
    expect(r.engine.get(t.key)).toBe('blob:fake/0');
    expect(r.engine.stats().renders).toBe(1);
  });

  it('un seul renderer pour toutes les vignettes', async () => {
    const r = rig();
    for (const id of ['a', 'b', 'c']) { const t = item(id); r.engine.request(t.key, { spec: t.spec }); }
    while (r.step()) { /* */ }
    await flush();
    expect(r.renderers).toHaveLength(1);
    expect(r.renderers[0].renders).toBe(3);
  });

  it('rend une vignette par tick', () => {
    const r = rig();
    for (const id of ['a', 'b', 'c']) { const t = item(id); r.engine.request(t.key, { spec: t.spec }); }
    expect(r.pendingSlots()).toBe(1);
    r.step();
    expect(r.engine.stats().renders).toBe(1);
    expect(r.engine.stats().queued).toBe(2);
    r.step();
    expect(r.engine.stats().renders).toBe(2);
    r.step();
    expect(r.engine.stats().renders).toBe(3);
    expect(r.step()).toBe(false);
  });

  it('sert les cartes visibles d’abord, y compris celles promues après coup', () => {
    const r = rig();
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(item);
    r.engine.request(a.key, { spec: a.spec, priority: THUMB_PRIORITY.low });
    r.engine.request(b.key, { spec: b.spec, priority: THUMB_PRIORITY.low });
    r.engine.request(c.key, { spec: c.spec, priority: THUMB_PRIORITY.visible });
    r.engine.request(d.key, { spec: d.spec, priority: THUMB_PRIORITY.low });
    r.engine.request(b.key, { priority: THUMB_PRIORITY.visible });
    while (r.step()) { /* */ }
    // b (promue) et c sont visibles, b a été demandée la première ; a et d suivent dans l'ordre d'arrivée.
    expect(r.drawn).toEqual(['b', 'c', 'a', 'd']);
  });

  it('retire de la file une carte démontée que personne n’écoute', () => {
    const r = rig();
    const [a, b] = ['a', 'b'].map(item);
    r.engine.request(a.key, { spec: a.spec });
    r.engine.request(b.key, { spec: b.spec });
    const off = r.engine.subscribe(b.key, () => {});
    r.engine.cancel(a.key);
    r.engine.cancel(b.key);
    expect(r.engine.stats().queued).toBe(1);
    off();
    r.engine.cancel(b.key);
    expect(r.engine.stats().queued).toBe(0);
  });

  it('prévient les abonnés de l’URL', async () => {
    const r = rig();
    const t = item('a');
    const seen: (string | null | undefined)[] = [];
    r.engine.subscribe(t.key, (v) => seen.push(v));
    r.engine.request(t.key, { spec: t.spec });
    r.step();
    await flush();
    expect(seen).toEqual(['blob:fake/0']);
  });

  it('repli : sans WebGL, tout vaut null (le pictogramme SVG prend la place)', () => {
    const r = rig({}, { noWebgl: true });
    const [a, b] = ['a', 'b'].map(item);
    const seen: (string | null | undefined)[] = [];
    r.engine.subscribe(a.key, (v) => seen.push(v));
    r.engine.request(a.key, { spec: a.spec });
    r.engine.request(b.key, { spec: b.spec });
    r.step();
    expect(r.engine.get(a.key)).toBeNull();
    expect(r.engine.get(b.key)).toBeNull();
    expect(seen).toEqual([null]);
    expect(r.engine.stats().available).toBe(false);
    expect(r.renderers).toHaveLength(0);
  });

  it('repli : un constructeur qui échoue donne null sans bloquer la file', async () => {
    const r = rig({
      builders: {
        i: (spec: ItemThumbSpec, res) => {
          if (spec.id === 'bad') throw new Error('mesh cassé');
          const g = new Group();
          g.add(new Mesh(res.roundedBox(0.5, 0.5, 0.5, 0.05, 2), res.material(spec.color)));
          return g;
        },
      },
    });
    const [bad, ok] = ['bad', 'ok'].map(item);
    r.engine.request(bad.key, { spec: bad.spec, priority: 1 });
    r.engine.request(ok.key, { spec: ok.spec });
    while (r.step()) { /* */ }
    await flush();
    expect(r.engine.get(bad.key)).toBeNull();
    expect(typeof r.engine.get(ok.key)).toBe('string');
  });

  it('repli : un encodage sans résultat donne null', async () => {
    const r = rig({ encode: () => Promise.resolve(null) });
    const t = item('a');
    r.engine.request(t.key, { spec: t.spec });
    r.step();
    await flush();
    expect(r.engine.get(t.key)).toBeNull();
  });

  it('un constructeur absent ne fige rien : registerBuilder permet de réessayer', async () => {
    const r = rig({ builders: {} });
    const t = item('late');
    r.engine.request(t.key, { spec: t.spec });
    r.step();
    await flush();
    expect(r.engine.get(t.key)).toBeUndefined();
    expect(r.renderers[0].renders).toBe(0);
    registerBuilder('i', (spec, res) => {
      const g = new Group();
      g.add(new Mesh(res.roundedBox(0.5, 0.5, 0.5, 0.05, 2), res.material(spec.color)));
      return g;
    });
    r.engine.request(t.key, { spec: t.spec });
    while (r.step()) { /* */ }
    await flush();
    expect(typeof r.engine.get(t.key)).toBe('string');
  });

  it('rend les sacs et boules avec les constructeurs fournis, sans fuite de matériaux', async () => {
    const r = rig();
    const refs = [
      ...Object.values(COLORWAYS).map((cw) => colorwayThumb(cw, 'b42')),
      ...Object.values(COLORWAYS).map((cw) => colorwayThumb(cw, 'b28')),
      ...SWATCHES.map((s) => swatchThumb(s)),
    ];
    for (const t of refs) r.engine.request(t.key, { spec: t.spec });
    while (r.step()) { await flush(); }
    await flush();
    const unique = new Set(refs.map((t) => t.key)).size;
    expect(r.engine.stats().cached).toBe(unique);
    expect(r.engine.stats().renders).toBe(unique);
    const res = r.engine.stats().resources;
    // Seul le matériau du sol (ombre) survit : ceux des sacs et boules sont libérés après chaque rendu.
    expect(res.materials).toBe(1);
    expect(res.textures).toBe(1);
    // Géométries : uniquement les formes partagées (boîtes du sac, sphère, sol), indépendamment du nombre de vignettes.
    const afterFirst = res.geometries;
    for (const t of refs) r.engine.request(t.key, { spec: t.spec });
    expect(r.engine.stats().resources.geometries).toBe(afterFirst);
    expect(afterFirst).toBeLessThan(20);
  });

  it('dispose révoque toutes les URL et libère le renderer', async () => {
    const r = rig();
    for (const id of ['a', 'b', 'c']) { const t = item(id); r.engine.request(t.key, { spec: t.spec }); }
    while (r.step()) { /* */ }
    await flush();
    expect(r.made).toHaveLength(3);
    r.engine.dispose();
    expect([...r.revoked].sort()).toEqual([...r.made].sort());
    expect(r.renderers[0].disposed).toBe(true);
    expect(r.renderers[0].contextLost).toBe(true);
    expect(r.engine.get(item('a').key)).toBeUndefined();
    expect(r.engine.stats().resources).toEqual({ geometries: 0, materials: 0, textures: 0 });
    // Après dispose, plus rien ne se met en file.
    const t = item('z');
    r.engine.request(t.key, { spec: t.spec });
    expect(r.pendingSlots()).toBe(0);
  });

  it('revokeAll vide le cache et prévient les cartes encore affichées', async () => {
    const r = rig();
    const t = item('a');
    const seen: (string | null | undefined)[] = [];
    r.engine.request(t.key, { spec: t.spec });
    r.step();
    await flush();
    r.engine.subscribe(t.key, (v) => seen.push(v));
    r.engine.revokeAll();
    expect(r.revoked).toEqual(['blob:fake/0']);
    expect(r.engine.get(t.key)).toBeUndefined();
    expect(seen).toEqual([undefined]);
    r.engine.request(t.key, { spec: t.spec });
    r.step();
    await flush();
    expect(r.engine.get(t.key)).toBe('blob:fake/1');
  });

  it('suspend la file pendant une perte de contexte et reprend au retour', async () => {
    const r = rig();
    const [a, b] = ['a', 'b'].map(item);
    r.engine.request(a.key, { spec: a.spec });
    r.step();
    await flush();
    const canvas = r.renderers[0].domElement;
    const lost = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(r.engine.stats().lost).toBe(true);
    r.engine.request(b.key, { spec: b.spec });
    r.step();
    expect(r.engine.stats().renders).toBe(1);
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(r.engine.stats().lost).toBe(false);
    while (r.step()) { /* */ }
    await flush();
    expect(r.engine.stats().renders).toBe(2);
  });

  it('mesure : 12 vignettes en moins de 600 ms (faux renderer, ordonnanceur par défaut)', async () => {
    // Ordonnanceur et encodeur du moteur par défaut ; seuls le renderer et l'URL sont simulés.
    const renderers: FakeRenderer[] = [];
    const engine = createThumbnailEngine({
      rendererFactory: (canvas) => {
        const r: FakeRenderer = {
          domElement: canvas, shadowMap: { enabled: false, type: PCFShadowMap }, toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1, outputColorSpace: 'srgb', capabilities: { getMaxAnisotropy: () => 4 },
          renders: 0, disposed: false, contextLost: false,
          setPixelRatio() {}, setSize() {}, setClearColor() {}, render() { r.renders += 1; }, dispose() {},
        };
        renderers.push(r);
        return r;
      },
      encode: () => Promise.resolve(new Blob(['png'])),
      createUrl: () => 'blob:fake/perf',
      revokeUrl: () => {},
    });
    engines.push(engine);
    const refs = [
      ...Object.values(COLORWAYS).map((cw) => colorwayThumb(cw, 'b42')),
      ...Object.values(COLORWAYS).map((cw) => colorwayThumb(cw, 'b28')),
      ...SWATCHES.slice(0, 4).map((s) => swatchThumb(s)),
    ];
    expect(refs).toHaveLength(12);
    const t0 = performance.now();
    await new Promise<void>((resolve, reject) => {
      let done = 0;
      const timer = setTimeout(() => reject(new Error('délai dépassé')), 5000);
      for (const t of refs) {
        engine.subscribe(t.key, (v) => {
          if (typeof v === 'string' && ++done === refs.length) { clearTimeout(timer); resolve(); }
        });
        engine.request(t.key, { spec: t.spec, priority: THUMB_PRIORITY.visible });
      }
    });
    const elapsed = performance.now() - t0;
    expect(renderers).toHaveLength(1);
    expect(renderers[0].renders).toBe(12);
    expect(elapsed).toBeLessThan(600);
  });
});
