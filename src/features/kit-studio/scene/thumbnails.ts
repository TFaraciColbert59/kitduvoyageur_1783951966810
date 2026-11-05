// Vignettes 3D des cartes (SPEC-3D §Vignettes ; maquette l.1195-1236) : UN renderer hors écran partagé (256 px à dpr 2,
// fond transparent), un cache clé → Blob URL, une file d'attente à une vignette par tick (requestIdleCallback), les cartes
// visibles d'abord. Sans WebGL, tout résout à `null` : l'interface affiche alors le pictogramme SVG de la carte.
// Importé par chargement dynamique uniquement (three reste hors du chunk de l'interface).
import {
  ACESFilmicToneMapping, Box3, DirectionalLight, Group, HemisphereLight, Mesh, MeshStandardMaterial, PCFShadowMap,
  PerspectiveCamera, PlaneGeometry, Scene, ShadowMaterial, SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import type { BufferGeometry, ColorRepresentation, Material, Object3D, ShadowMapType, Texture, ToneMapping } from 'three';
import { LIGHT_SUN, THUMB_FILL, THUMB_HEMI_GROUND, THUMB_HEMI_SKY } from '../domain/palette.scene';
import { roundedBox } from './bagBuilder';
import { makeColor } from './color';
import { ResourceTracker } from './resources';
import { createTextureBank } from './textures';
import type { TextureBank } from './textures';

/* ───────────── Spécifications : ce qu'une clé de cache décrit ───────────── */

/** Objet du catalogue (clé `i:<id>:<forme>:<couleur>`). Le mesh est fourni par un constructeur injecté (voir registerBuilder). */
export interface ItemThumbSpec {
  readonly kind: 'i';
  readonly id: string;
  readonly shape: string;
  readonly glyph: string;
  /** Couleur résolue (palette.ts → resolveMaterial). */
  readonly color: string;
  readonly liters: number;
  readonly planned: boolean;
}
/** Sac miniature (clé `b:<sac>:<corps>:<poche>:<liseré>`). `scale` = min(0,8 ; 0,8 × L/42). */
export interface BagThumbSpec {
  readonly kind: 'b';
  readonly body: string;
  readonly pocket: string;
  readonly trim: string;
  readonly scale: number;
}
/** Boule de couleur (clé `c:<couleur>`). */
export interface BallThumbSpec {
  readonly kind: 'c';
  readonly color: string;
}
export type ThumbSpec = ItemThumbSpec | BagThumbSpec | BallThumbSpec;
export type ThumbKind = ThumbSpec['kind'];

/** null = vignette indisponible (repli SVG) ; undefined = pas encore rendue. */
export type ThumbValue = string | null | undefined;

/* ───────────── Ressources offertes aux constructeurs de mesh ───────────── */

export interface ThumbResources {
  readonly tracker: ResourceTracker;
  /** Texture de tissu partagée (nom inconnu : ripstop). */
  fabric(name: string): Texture;
  /** Géométrie partagée par clé : vit autant que le moteur, ne jamais la disposer. */
  geometry(key: string, factory: () => BufferGeometry): BufferGeometry;
  /** Boîte arrondie partagée (mêmes formes que la scène). */
  roundedBox(w: number, h: number, d: number, radius: number, seg?: number): BufferGeometry;
  /** Matériau propre à la vignette : libéré après le rendu. `color` est une couleur résolue (jamais un littéral). */
  material(color: string, roughness?: number, map?: Texture | null): MeshStandardMaterial;
}

export type ThumbBuilder<S extends ThumbSpec = ThumbSpec> = (spec: S, res: ThumbResources) => Object3D;

interface Builders {
  i?: ThumbBuilder<ItemThumbSpec>;
  b?: ThumbBuilder<BagThumbSpec>;
  c?: ThumbBuilder<BallThumbSpec>;
}

function ballBuilder(spec: BallThumbSpec, res: ThumbResources): Object3D {
  const mesh = new Mesh(
    res.geometry('ball', () => new SphereGeometry(0.5, 48, 32)),
    res.material(spec.color, 0.62, res.fabric('ripstop')),
  );
  mesh.castShadow = true;
  const g = new Group();
  g.add(mesh);
  return g;
}

/** Sac miniature aux couleurs d'un coloris (maquette l.1212-1221). */
function bagBuilder(spec: BagThumbSpec, res: ThumbResources): Object3D {
  const g = new Group();
  const H = 1.1 + 0.4 * spec.scale;
  const fabric = res.fabric('ripstop');
  const add = (geo: BufferGeometry, color: string, rough: number, x: number, y: number, z: number): void => {
    const m = new Mesh(geo, res.material(color, rough, fabric));
    m.castShadow = true;
    m.position.set(x, y, z);
    g.add(m);
  };
  add(res.roundedBox(0.92, H, 0.56, 0.2, 6), spec.body, 0.78, 0, 0, 0);
  add(res.roundedBox(0.88, 0.3, 0.62, 0.14, 5), spec.body, 0.78, 0, H / 2 + 0.1, 0.02);
  add(res.roundedBox(0.9, 0.07, 0.64, 0.03, 3), spec.trim, 0.6, 0, H / 2 - 0.04, 0.02);
  add(res.roundedBox(0.68, H * 0.42, 0.16, 0.09, 4), spec.pocket, 0.78, 0, -H * 0.17, 0.33);
  for (const x of [-0.5, 0.5]) add(res.roundedBox(0.2, H * 0.4, 0.3, 0.08, 4), spec.pocket, 0.78, x, -H * 0.25, 0.05);
  return g;
}

const BUILDERS: Builders = { b: bagBuilder, c: ballBuilder };

/**
 * Enregistre le constructeur de mesh d'un type de vignette (les objets 'i' sont fournis par itemMesh, injecté ici).
 * S'applique à tous les moteurs, y compris déjà créés.
 */
export function registerBuilder(kind: 'i', builder: ThumbBuilder<ItemThumbSpec>): void;
export function registerBuilder(kind: 'b', builder: ThumbBuilder<BagThumbSpec>): void;
export function registerBuilder(kind: 'c', builder: ThumbBuilder<BallThumbSpec>): void;
export function registerBuilder(kind: ThumbKind, builder: ThumbBuilder<never>): void {
  if (kind === 'i') BUILDERS.i = builder as ThumbBuilder<ItemThumbSpec>;
  else if (kind === 'b') BUILDERS.b = builder as ThumbBuilder<BagThumbSpec>;
  else BUILDERS.c = builder as ThumbBuilder<BallThumbSpec>;
}

function runBuilder(builders: Builders, spec: ThumbSpec, res: ThumbResources): Object3D | null {
  switch (spec.kind) {
    case 'i': return builders.i ? builders.i(spec, res) : null;
    case 'b': return builders.b ? builders.b(spec, res) : null;
    case 'c': return builders.c ? builders.c(spec, res) : null;
  }
}

/* ───────────── Renderer injectable ───────────── */

/** Sous-ensemble de WebGLRenderer utilisé ici : permet d'injecter un faux renderer en test (pas de WebGL en Node). */
export interface ThumbRendererLike {
  readonly domElement: HTMLCanvasElement;
  readonly shadowMap: { enabled: boolean; type: ShadowMapType };
  toneMapping: ToneMapping;
  toneMappingExposure: number;
  outputColorSpace: WebGLRenderer['outputColorSpace'];
  readonly capabilities: { getMaxAnisotropy(): number };
  setPixelRatio(ratio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setClearColor(color: ColorRepresentation, alpha?: number): void;
  render(scene: Scene, camera: PerspectiveCamera): void;
  dispose(): void;
  forceContextLoss?(): void;
}
export interface ThumbRendererOptions { readonly size: number; readonly pixelRatio: number }
export type ThumbRendererFactory = (canvas: HTMLCanvasElement, options: ThumbRendererOptions) => ThumbRendererLike;

const defaultRendererFactory: ThumbRendererFactory = (canvas) =>
  new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });

/** Canvas → Blob PNG, jamais de lecture synchrone des pixels. */
export function encodeCanvas(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      if (typeof canvas.toBlob === 'function') { canvas.toBlob((b) => resolve(b), 'image/png'); return; }
      const off = canvas as unknown as { convertToBlob?: (o?: { type: string }) => Promise<Blob> };
      if (typeof off.convertToBlob === 'function') { off.convertToBlob({ type: 'image/png' }).then(resolve, () => resolve(null)); return; }
    } catch { /* repli ci-dessous */ }
    resolve(null);
  });
}

type Cancel = () => void;
/** Une exécution par créneau libre : requestIdleCallback, sinon une image (~16 ms). */
export function scheduleIdle(run: () => void): Cancel {
  const w = globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(() => run(), { timeout: 250 });
    return () => { w.cancelIdleCallback?.(id); };
  }
  const id = setTimeout(run, 16);
  return () => { clearTimeout(id); };
}

/* ───────────── Plateau : lumières, sol à ombre, pivot (maquette l.1195-1209 et l.1222-1226) ───────────── */

interface Stage {
  readonly renderer: ThumbRendererLike;
  readonly tracker: ResourceTracker;
  readonly textures: TextureBank;
  renderObject(object: Object3D): void;
  dispose(): void;
}

const FIT = 1.45;

function createStage(renderer: ThumbRendererLike): Stage {
  const tracker = new ResourceTracker();
  const textures = createTextureBank(tracker, renderer.capabilities.getMaxAnisotropy());
  const scene = new Scene();
  const camera = new PerspectiveCamera(24, 1, 0.1, 30);
  camera.position.set(0, 0.55, 5.2);
  camera.lookAt(0, 0, 0);

  // Intensités × π : même éclairage « non physique » que la maquette (three r149) et que la scène principale.
  scene.add(new HemisphereLight(makeColor(THUMB_HEMI_SKY), makeColor(THUMB_HEMI_GROUND), 0.95 * Math.PI));
  const key = new DirectionalLight(makeColor(LIGHT_SUN), 1.9 * Math.PI);
  key.position.set(-2.4, 4.2, 3.4);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.5, far: 12 });
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.01;
  key.shadow.radius = 3;
  scene.add(key);
  const fill = new DirectionalLight(makeColor(THUMB_FILL), 0.45 * Math.PI);
  fill.position.set(3, 1, 2);
  scene.add(fill);

  const floor = new Mesh(tracker.geometry(new PlaneGeometry(8, 8)), tracker.material(new ShadowMaterial({ opacity: 0.2 })));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const pivot = new Group();
  scene.add(pivot);

  const box = new Box3();
  const center = new Vector3();
  const size = new Vector3();

  return {
    renderer, tracker, textures,
    renderObject(object) {
      pivot.clear();
      object.traverse((o) => { if (o instanceof Mesh) o.castShadow = true; });
      box.setFromObject(object);
      box.getCenter(center);
      box.getSize(size);
      const m = Math.max(size.x, size.y, size.z) || 1;
      object.position.sub(center);
      pivot.add(object);
      // 3/4 avant, légèrement vu de dessous le plan de visée : même pose que la maquette.
      pivot.scale.setScalar(FIT / m);
      pivot.rotation.set(0.34, -0.62, 0, 'YXZ');
      pivot.updateMatrixWorld(true);
      floor.position.y = box.setFromObject(pivot).min.y - 0.015;
      renderer.render(scene, camera);
      pivot.remove(object);
    },
    dispose() {
      pivot.clear();
      key.shadow.dispose();
      scene.clear();
      textures.dispose();
      tracker.disposeAll();
    },
  };
}

/* ───────────── Moteur ───────────── */

export const THUMB_PRIORITY = { low: 0, visible: 10 } as const;

export interface ThumbRequestOptions {
  /** Plus grand = plus tôt. Cartes visibles : THUMB_PRIORITY.visible. */
  readonly priority?: number;
  /** Description à rendre (mémorisée pour les demandes suivantes de la même clé). */
  readonly spec?: ThumbSpec;
}

export interface ThumbStats {
  readonly renders: number;
  readonly queued: number;
  readonly cached: number;
  /** null tant que le renderer n'a pas été tenté. */
  readonly available: boolean | null;
  readonly lost: boolean;
  readonly resources: { readonly geometries: number; readonly materials: number; readonly textures: number };
}

export interface ThumbnailEngine {
  register(key: string, spec: ThumbSpec): void;
  request(key: string, options?: ThumbRequestOptions): void;
  get(key: string): ThumbValue;
  subscribe(key: string, listener: (value: ThumbValue) => void): () => void;
  /** Retire la demande de la file si plus personne n'écoute cette clé. */
  cancel(key: string): void;
  /** Révoque toutes les Blob URL et vide le cache et la file. */
  revokeAll(): void;
  /** revokeAll + libère le renderer et toutes les ressources. Le moteur est inutilisable ensuite. */
  dispose(): void;
  stats(): ThumbStats;
}

export interface ThumbnailEngineOptions {
  readonly size?: number;
  readonly pixelRatio?: number;
  readonly rendererFactory?: ThumbRendererFactory;
  readonly encode?: (canvas: HTMLCanvasElement) => Promise<Blob | null>;
  readonly createUrl?: (blob: Blob) => string;
  readonly revokeUrl?: (url: string) => void;
  readonly schedule?: (run: () => void) => Cancel;
  /** Constructeurs propres à ce moteur, prioritaires sur ceux de registerBuilder. */
  readonly builders?: Builders;
}

interface Job { readonly key: string; spec: ThumbSpec; priority: number; seq: number }

export const THUMB_SIZE = 256;
export const THUMB_DPR = 2;

export function createThumbnailEngine(options: ThumbnailEngineOptions = {}): ThumbnailEngine {
  const size = options.size ?? THUMB_SIZE;
  const pixelRatio = options.pixelRatio ?? THUMB_DPR;
  const factory = options.rendererFactory ?? defaultRendererFactory;
  const encode = options.encode ?? encodeCanvas;
  const createUrl = options.createUrl ?? ((b: Blob) => URL.createObjectURL(b));
  const revokeUrl = options.revokeUrl ?? ((u: string) => { URL.revokeObjectURL(u); });
  const schedule = options.schedule ?? scheduleIdle;

  const cache = new Map<string, string | null>();
  const specs = new Map<string, ThumbSpec>();
  const queue = new Map<string, Job>();
  const encoding = new Set<string>();
  const listeners = new Map<string, Set<(v: ThumbValue) => void>>();
  const sharedGeos = new Map<string, BufferGeometry>();

  let stage: Stage | null = null;
  let available: boolean | null = null;
  let lost = false;
  let disposed = false;
  let cancelTick: Cancel | null = null;
  let seq = 0;
  let renders = 0;
  let detachCanvas: (() => void) | null = null;

  const notify = (key: string, value: ThumbValue): void => {
    const set = listeners.get(key);
    if (!set) return;
    for (const l of [...set]) l(value);
  };

  const settle = (key: string, url: string | null): void => {
    encoding.delete(key);
    cache.set(key, url);
    notify(key, url);
  };

  function ensureStage(): Stage | null {
    if (stage) return stage;
    if (available === false) return null;
    available = false;
    try {
      if (typeof document === 'undefined') return null;
      const canvas = document.createElement('canvas');
      canvas.width = size * pixelRatio;
      canvas.height = size * pixelRatio;
      const renderer = factory(canvas, { size, pixelRatio });
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(size, size, false);
      renderer.setClearColor(0, 0);
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFShadowMap;
      stage = createStage(renderer);
      const el = renderer.domElement;
      const onLost = (e: Event): void => { e.preventDefault(); lost = true; };
      const onRestored = (): void => { lost = false; pump(); };
      el.addEventListener('webglcontextlost', onLost);
      el.addEventListener('webglcontextrestored', onRestored);
      detachCanvas = () => {
        el.removeEventListener('webglcontextlost', onLost);
        el.removeEventListener('webglcontextrestored', onRestored);
      };
      available = true;
      return stage;
    } catch {
      stage = null;
      return null;
    }
  }

  function resources(s: Stage): { res: ThumbResources; cleanup(object: Object3D | null): void } {
    const mats: Material[] = [];
    const geo = (key: string, make: () => BufferGeometry): BufferGeometry => {
      const hit = sharedGeos.get(key);
      if (hit) return hit;
      const g = s.tracker.geometry(make());
      sharedGeos.set(key, g);
      return g;
    };
    const res: ThumbResources = {
      tracker: s.tracker,
      fabric: (name) => s.textures.fabric(name),
      geometry: geo,
      roundedBox: (w, h, d, r, seg = 8) => geo(`rbox:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}:${r.toFixed(3)}:${seg}`, () => roundedBox(w, h, d, r, seg)),
      material(color, roughness = 0.78, map = null) {
        const m = s.tracker.material(new MeshStandardMaterial({ color: makeColor(color), roughness, map }));
        mats.push(m);
        return m;
      },
    };
    return {
      res,
      cleanup(object) {
        for (const m of mats) m.dispose();
        object?.traverse((o) => {
          if (!(o instanceof Mesh)) return;
          const g: BufferGeometry = o.geometry;
          if (!isShared(g)) g.dispose();
          const mm: Material | Material[] = o.material;
          for (const m of Array.isArray(mm) ? mm : [mm]) m.dispose();
        });
      },
    };
  }

  const isShared = (g: BufferGeometry): boolean => {
    for (const v of sharedGeos.values()) if (v === g) return true;
    return false;
  };

  function pickNext(): Job | null {
    let best: Job | null = null;
    for (const j of queue.values()) {
      if (!best || j.priority > best.priority || (j.priority === best.priority && j.seq < best.seq)) best = j;
    }
    return best;
  }

  function process(job: Job): void {
    queue.delete(job.key);
    const s = ensureStage();
    if (!s) { settle(job.key, null); return; }
    const { res, cleanup } = resources(s);
    let object: Object3D | null = null;
    try {
      object = runBuilder({ ...BUILDERS, ...options.builders }, job.spec, res);
      if (!object) {
        // Constructeur pas encore enregistré : rien n'est mémorisé, une demande ultérieure réessaiera.
        cleanup(null);
        return;
      }
      s.renderObject(object);
      renders += 1;
    } catch {
      cleanup(object);
      settle(job.key, null);
      return;
    }
    // La capture du canvas se fait dans la même tâche que le rendu ; l'encodage, lui, est asynchrone.
    encoding.add(job.key);
    const pending = encode(s.renderer.domElement);
    cleanup(object);
    const key = job.key;
    pending.then(
      (blob) => {
        if (disposed || !encoding.has(key)) { return; }
        settle(key, blob ? createUrl(blob) : null);
      },
      () => { if (!disposed && encoding.has(key)) settle(key, null); },
    );
  }

  function tick(): void {
    cancelTick = null;
    if (disposed || lost) return;
    // Sans WebGL, tout est résolu d'un coup : il n'y a rien à rendre.
    if (ensureStage() === null) {
      for (const job of [...queue.values()]) { queue.delete(job.key); settle(job.key, null); }
      return;
    }
    const next = pickNext();
    if (next) process(next);
    pump();
  }

  function pump(): void {
    if (disposed || lost || cancelTick || queue.size === 0) return;
    cancelTick = schedule(tick);
  }

  function revokeAll(): void {
    cancelTick?.();
    cancelTick = null;
    const keys = [...cache.keys(), ...queue.keys(), ...encoding];
    for (const url of cache.values()) if (url) revokeUrl(url);
    cache.clear();
    queue.clear();
    encoding.clear();
    for (const k of new Set(keys)) notify(k, undefined);
  }

  return {
    register(key, spec) { specs.set(key, spec); },

    request(key, opts = {}) {
      if (disposed) return;
      if (opts.spec) specs.set(key, opts.spec);
      if (cache.has(key) || encoding.has(key)) return;
      const priority = opts.priority ?? THUMB_PRIORITY.low;
      const queued = queue.get(key);
      if (queued) {
        if (priority > queued.priority) queued.priority = priority;
        return;
      }
      const spec = specs.get(key);
      if (!spec) return;
      queue.set(key, { key, spec, priority, seq: seq++ });
      pump();
    },

    get(key) { return cache.get(key); },

    subscribe(key, listener) {
      let set = listeners.get(key);
      if (!set) { set = new Set(); listeners.set(key, set); }
      set.add(listener);
      return () => {
        const cur = listeners.get(key);
        if (!cur) return;
        cur.delete(listener);
        if (cur.size === 0) listeners.delete(key);
      };
    },

    cancel(key) {
      if (!listeners.has(key)) queue.delete(key);
    },

    revokeAll,

    dispose() {
      if (disposed) return;
      revokeAll();
      disposed = true;
      listeners.clear();
      specs.clear();
      detachCanvas?.();
      detachCanvas = null;
      sharedGeos.clear();
      if (stage) {
        const r = stage.renderer;
        stage.dispose();
        r.dispose();
        r.forceContextLoss?.();
        stage = null;
      }
    },

    stats() {
      return {
        renders,
        queued: queue.size,
        cached: cache.size,
        available,
        lost,
        resources: stage ? stage.tracker.counts() : { geometries: 0, materials: 0, textures: 0 },
      };
    },
  };
}

/* ───────────── Moteur partagé par toutes les cartes ───────────── */

let shared: ThumbnailEngine | null = null;

export function getThumbnailEngine(): ThumbnailEngine {
  if (!shared) shared = createThumbnailEngine();
  return shared;
}

/** À appeler au démontage du Kit Studio : révoque les URL et rend le contexte WebGL. */
export function disposeThumbnailEngine(): void {
  shared?.dispose();
  shared = null;
}
