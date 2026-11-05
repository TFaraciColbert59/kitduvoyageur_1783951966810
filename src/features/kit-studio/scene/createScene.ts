// Scène principale du Kit Studio (SPEC-3D ; maquette l.906-1110). Importé uniquement par chargement dynamique
// (`dynamic(() => import(...), { ssr: false })`), jamais depuis le rendu serveur. Aucun import React, aucun accès au
// store : l'état courant est passé à createKitScene() puis à update().
import {
  ACESFilmicToneMapping, BoxGeometry, DirectionalLight, HemisphereLight, MathUtils, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PCFShadowMap, PlaneGeometry, Scene, SRGBColorSpace, WebGLRenderer,
} from 'three';
import type { Camera, PerspectiveCamera, ShadowMapType, ToneMapping } from 'three';
import { LIGHT_HEMI_GROUND, LIGHT_HEMI_SKY, LIGHT_RIM, LIGHT_SUN, WOOD_TINT } from '../domain/palette.scene';
import { currentConfig, currentKit } from '../domain/state';
import type { PartNameId, ZoneId } from '../domain/catalog';
import type { KitState } from '../domain/types';
import { createBag } from './bagBuilder';
import type { BagHandle } from './bagBuilder';
import { createCameraRig } from './camera';
import type { CameraRig } from './camera';
import { makeColor } from './color';
import { attachGestures } from './gestures';
import type { GestureCallbacks, GestureTarget, ScenePick } from './gestures';
import { createObjectLayer } from './objects';
import type { ObjectFrame, ObjectLayer } from './objects';
import { GROUND_Y, TABLE } from './layout';
import { createFrameMeter, createLifecycle } from './lifecycle';
import { clamp } from './math';
import { ResourceTracker } from './resources';
import type { ResourceCounts } from './resources';
import { createTextureBank } from './textures';

/** Sous-ensemble de WebGLRenderer utilisé par la scène : permet d'injecter un faux renderer en test (pas de WebGL en Node). */
export interface RendererLike {
  readonly domElement: HTMLCanvasElement;
  readonly shadowMap: { enabled: boolean; type: ShadowMapType };
  toneMapping: ToneMapping;
  toneMappingExposure: number;
  outputColorSpace: WebGLRenderer['outputColorSpace'];
  readonly capabilities: { getMaxAnisotropy(): number };
  readonly info: { readonly memory: { readonly geometries: number; readonly textures: number } };
  setPixelRatio(ratio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: Scene, camera: Camera): void;
  setAnimationLoop(callback: ((time: number) => void) | null): void;
  dispose(): void;
}

export interface RendererOptions {
  readonly antialias: boolean;
  readonly pixelRatio: number;
}
export type RendererFactory = (canvas: HTMLCanvasElement, options: RendererOptions) => RendererLike;

const defaultRendererFactory: RendererFactory = (canvas, o) =>
  new WebGLRenderer({ canvas, antialias: o.antialias, alpha: true, powerPreference: 'high-performance' });

/** Mode de la vue : Gestion (zones, objets, fantômes) ou Apparence (pièces du sac). */
export type SceneMode = 'gestion' | 'apparence';

export interface KitSceneOptions extends GestureCallbacks {
  readonly state: KitState;
  readonly reducedMotion: boolean;
  /** Geste de la scène activé (défaut : oui). Désactivé, aucun écouteur n'est posé sur le canvas. */
  readonly gestures?: boolean;
  /** Ordonnée (px client) au-dessus de laquelle un objet soulevé est armé : le haut du tiroir. */
  readonly armY?: () => number;
  /** Marge haute libre (px) pour l'arc d'objets (encoche, pilule). */
  readonly safeTop?: () => number;
  /** La zone la plus proche de la caméra a changé. */
  readonly onZoneChange?: (zone: ZoneId) => void;
  /** Fabrique de renderer (tests) ; défaut : WebGLRenderer. */
  readonly rendererFactory?: RendererFactory;
  /** Perte (true) ou retour (false) du contexte WebGL : l'interface peut afficher une image fixe en attendant. */
  readonly onContextChange?: (lost: boolean) => void;
}

export interface SceneInfo {
  readonly running: boolean;
  readonly frozen: boolean;
  readonly paused: boolean;
  readonly shadows: boolean;
  /** Dernière moyenne sur 30 images, en ms (null tant qu'aucune fenêtre complète). */
  readonly avgFrameMs: number | null;
  /** Ressources vivantes comptées par la scène. */
  readonly resources: ResourceCounts;
  /** Mémoire vue par le renderer (renderer.info.memory). */
  readonly gpu: { readonly geometries: number; readonly textures: number };
  /** Caméra : zone la plus proche, position continue, azimut (rad), inclinaison (rad), pièces séparées (0..1). */
  readonly view: {
    readonly zone: ZoneId;
    readonly position: number;
    readonly angle: number;
    readonly tilt: number;
    readonly exploded: number;
    readonly explodedTarget: number;
  };
  /** Objets rangés vivants, fantômes, objets en train de sortir. */
  readonly objects: { readonly items: number; readonly ghosts: number; readonly dying: number };
}

export interface KitScene {
  /** Aligne la scène sur l'état (jamais modifié). */
  update(state: KitState): void;
  setDrawerOpen(open: boolean): void;
  /** Mode Gestion ou Apparence : zones et fantômes d'un côté, pièces du sac de l'autre. */
  setMode(mode: SceneMode): void;
  /** Pièce sélectionnée en mode Apparence (null : aucune). */
  setPart(part: PartNameId | null): void;
  /** Caméra de zone : va à une zone (animé ; immédiat en mouvement réduit). */
  setZone(zone: ZoneId): void;
  /** Recentre : vue du sac, sans inclinaison, pièces rassemblées. */
  recenter(): void;
  /** Éclaire une zone du sac (cible d'un glisser de carte) ; null l'éteint. */
  highlightZone(zone: ZoneId | null): void;
  /** Position écran (px, repère du canvas) de l'ancre d'une zone, pour la carte qui vole vers le sac. */
  projectZone(zone: ZoneId, out?: { x: number; y: number }): { x: number; y: number };
  /** Position écran d'un objet rangé ; null s'il n'est pas dans la scène. */
  projectItem(id: string, out?: { x: number; y: number }): { x: number; y: number } | null;
  /** Zone du sac sous un point écran (px client), null si le point est hors du sac. */
  zoneAt(clientX: number, clientY: number): ZoneId | null;
  /** Pièces séparées : 0..1 (ou booléen), animé. */
  setExploded(value: number | boolean): void;
  resize(): void;
  dispose(): void;
  info(): SceneInfo;
}

export const SHADOW_BUDGET_MS = 24;
const SHADOW_MAP_SIZE = 1024;

interface World {
  readonly scene: Scene;
  readonly tr: ResourceTracker;
  readonly bag: BagHandle;
  readonly objects: ObjectLayer;
  readonly sun: DirectionalLight;
  fitBackdrop(): void;
  syncBackdrop(): void;
  dispose(): void;
}

interface WorldOptions {
  readonly rig: CameraRig;
  readonly maxAnisotropy: number;
  readonly reducedMotion: boolean;
  readonly shadows: boolean;
  readonly safeTop?: () => number;
}

function buildWorld({ rig, maxAnisotropy, reducedMotion, shadows, safeTop }: WorldOptions): World {
  const camera: PerspectiveCamera = rig.camera;
  const tr = new ResourceTracker();
  const tex = createTextureBank(tr, maxAnisotropy);
  const scene = new Scene();

  // Lumières : intensités × π pour retrouver le rendu de la maquette (three r149, éclairage non physique).
  scene.add(new HemisphereLight(makeColor(LIGHT_HEMI_SKY), makeColor(LIGHT_HEMI_GROUND), 0.72 * Math.PI));
  const sun = new DirectionalLight(makeColor(LIGHT_SUN), 1.65 * Math.PI);
  sun.position.set(2.6, 4.6, 3.0);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  Object.assign(sun.shadow.camera, { left: -3.4, right: 3.4, top: 3.4, bottom: -3.4, near: 0.5, far: 16 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  scene.add(sun);
  const rim = new DirectionalLight(makeColor(LIGHT_RIM), 0.35 * Math.PI);
  rim.position.set(-3, 2, -3);
  scene.add(rim);

  // Toile de fond : panorama flou attaché à la caméra ; il défile plus lentement que le sac (paysage lointain).
  const pano = tex.panorama();
  const backdrop = new Mesh(
    tr.geometry(new PlaneGeometry(1, 1)),
    tr.material(new MeshBasicMaterial({ map: pano, depthTest: false, depthWrite: false, fog: false, toneMapped: false })),
  );
  backdrop.renderOrder = -10;
  backdrop.frustumCulled = false;
  camera.add(backdrop);
  scene.add(camera);
  const BD = { rx: 0.16, ry: 0.56, cx: 0, cy: 0 };

  // Table en chêne clair : le sac est posé dessus.
  const woodMat = tr.material(new MeshStandardMaterial({ map: tex.wood(), roughness: 0.6, metalness: 0, color: makeColor(WOOD_TINT) }));
  const top = new Mesh(tr.geometry(new BoxGeometry(TABLE.w, 0.08, TABLE.d)), woodMat);
  top.position.set(TABLE.x, GROUND_Y - 0.04, 0);
  top.receiveShadow = true;
  top.castShadow = true;
  scene.add(top);
  const legGeo = tr.geometry(new BoxGeometry(0.09, 0.7, 0.09));
  for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const leg = new Mesh(legGeo, woodMat);
    leg.position.set(TABLE.x + i * (TABLE.w / 2 - 0.18), GROUND_Y - 0.08 - 0.35, j * (TABLE.d / 2 - 0.18));
    leg.castShadow = true;
    leg.receiveShadow = true;
    scene.add(leg);
  }

  const bag = createBag(tr, tex, reducedMotion);
  scene.add(bag.group);
  const objects = createObjectLayer({
    root: scene, tr, bag, camera, viewport: () => rig.viewport(), fabric: tex.fabric('ripstop'), reducedMotion, safeTop,
  });

  return {
    scene, tr, bag, objects, sun,
    fitBackdrop() {
      const D = 40;
      const hh = 2 * D * Math.tan(MathUtils.degToRad(camera.fov / 2));
      const ww = hh * camera.aspect;
      const K = 1.7;
      backdrop.position.set(0, 0, -D);
      backdrop.scale.set(ww * K, hh * K, 1);
      BD.rx = clamp((0.16 * camera.aspect) / 0.46, 0.16, 0.42) * K;
      BD.ry = 0.56 * K;
      pano.repeat.set(BD.rx, BD.ry);
      BD.cx = (((K - 1) / 2) * BD.rx) / K;
      BD.cy = (((K - 1) / 2) * BD.ry) / K;
    },
    syncBackdrop() {
      const th = Math.atan2(camera.position.x, camera.position.z);
      pano.offset.x = 0.12 - th / (Math.PI * 2) - BD.cx;
      const ph = Math.acos(clamp((camera.position.y - bag.group.position.y) / Math.max(0.1, camera.position.length()), -1, 1));
      pano.offset.y = clamp((ph - 1.2) * 0.12, -0.02, 0.06) - BD.cy;
    },
    dispose() {
      camera.remove(backdrop);
      objects.dispose();
      bag.dispose();
      scene.clear();
      sun.shadow.dispose();
      tex.dispose();
      tr.disposeAll();
    },
  };
}

/**
 * Crée la scène sur `canvas`. Lève une exception si WebGL est indisponible : l'appelant bascule alors sur son repli.
 * Le canvas est dimensionné par l'interface (CSS plein écran) ; resize() relit sa taille.
 */
export function createKitScene(canvas: HTMLCanvasElement, options: KitSceneOptions): KitScene {
  const win = canvas.ownerDocument.defaultView ?? window;
  const dpr = win.devicePixelRatio || 1;
  const factory = options.rendererFactory ?? defaultRendererFactory;
  const renderer = factory(canvas, { antialias: dpr <= 2, pixelRatio: Math.min(dpr, 2) });
  renderer.setPixelRatio(Math.min(dpr, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const rig = createCameraRig({ reducedMotion: options.reducedMotion });
  const meter = createFrameMeter();
  let state = options.state;
  let shadows = true;
  let disposed = false;
  let lastTime: number | null = null;
  let mode: SceneMode = 'gestion';
  let part: PartNameId | null = null;
  let highlighted: ZoneId | null = null;
  const worldOptions = (): WorldOptions => ({
    rig, maxAnisotropy: renderer.capabilities.getMaxAnisotropy(), reducedMotion: options.reducedMotion, shadows, safeTop: options.safeTop,
  });
  let world = buildWorld(worldOptions());
  rig.setWorld({
    anchor: (zone, out) => world.objects.anchor(zone, out),
    center: (out) => world.bag.group.localToWorld(out.set(0, 0, 0)),
  });
  rig.onZoneChange(options.onZoneChange ?? null);
  const objectFrame: ObjectFrame = { focus: 'bag', arcAmt: 0, ex: 0, pos: 1, ghostsOn: true };

  const disableShadows = (): void => {
    if (!shadows) return;
    shadows = false;
    renderer.shadowMap.enabled = false;
    world.sun.castShadow = false;
    world.tr.markMaterialsDirty();
  };

  /** Caméra, sac puis objets, dans l'ordre : l'ancre des zones dépend du sac, les objets de la caméra. */
  const frame = (time: number): boolean => {
    const dt = lastTime === null || time - lastTime > 100 ? 1 / 60 : Math.min(0.05, Math.max(0, (time - lastTime) / 1000));
    lastTime = time;
    const camMoving = rig.advance(dt);
    const gestion = mode === 'gestion';
    const fx = world.bag.fx;
    fx.focus = rig.zoneId();
    fx.focusAmt = rig.arcAmount();
    fx.exploded = gestion ? rig.exploded() : 0;
    fx.separation = gestion ? 0 : rig.exploded();
    fx.gestion = gestion;
    fx.highlight = highlighted;
    fx.part = part;
    const bagMoving = world.bag.step(dt);
    world.bag.group.updateMatrixWorld();
    rig.place();
    objectFrame.focus = fx.focus;
    objectFrame.arcAmt = fx.focusAmt;
    objectFrame.ex = rig.exploded();
    objectFrame.pos = rig.position();
    objectFrame.ghostsOn = gestion;
    const objMoving = world.objects.step(dt, objectFrame);
    world.syncBackdrop();
    renderer.render(world.scene, rig.camera);
    const avg = meter.push(time);
    if (avg !== null && avg > SHADOW_BUDGET_MS) disableShadows();
    return bagMoving || camMoving || objMoving;
  };

  /** Pose initiale ou après changement d'état : matrices du sac et caméra à jour avant tout rendu (projections, picks). */
  const refreshPose = (): void => {
    world.bag.group.updateMatrixWorld();
    rig.place();
  };

  const lifecycle = createLifecycle({
    renderer,
    canvas,
    step: frame,
    onContextLost: () => { options.onContextChange?.(true); },
    onContextRestored: () => {
      // Reconstruction complète depuis l'état : les ressources GPU d'avant la perte ne servent plus.
      world.dispose();
      world = buildWorld(worldOptions());
      applyViewport();
      world.bag.sync(currentKit(state).bag, currentConfig(state));
      world.objects.sync(state);
      refreshPose();
      lastTime = null;
      options.onContextChange?.(false);
    },
  });

  function applyViewport(): void {
    const w = canvas.clientWidth || win.innerWidth;
    const h = canvas.clientHeight || win.innerHeight;
    renderer.setSize(w, h, false);
    rig.setViewport(w, h);
    world.fitBackdrop();
  }

  applyViewport();
  world.bag.sync(currentKit(state).bag, currentConfig(state));
  world.objects.sync(state);
  refreshPose();
  lifecycle.invalidate();

  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { if (!disposed) { applyViewport(); lifecycle.invalidate(); } });
  observer?.observe(canvas);

  // ───── Picking et gestes ─────
  const toNdc = (clientX: number, clientY: number, out: { x: number; y: number }): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    const vp = rig.viewport();
    const w = r.width || vp.width;
    const h = r.height || vp.height;
    out.x = ((clientX - r.left) / w) * 2 - 1;
    out.y = -((clientY - r.top) / h) * 2 + 1;
    return out;
  };
  const ndcTmp = { x: 0, y: 0 };
  const pickAt = (clientX: number, clientY: number): ScenePick | null => {
    if (disposed) return null;
    const n = toNdc(clientX, clientY, ndcTmp);
    const raw = world.objects.pick(n.x, n.y);
    if (!raw) return null;
    if (raw.type === 'item') return { kind: 'item', id: raw.id };
    if (raw.type === 'ghost') return { kind: 'ghost', id: raw.fn };
    return mode === 'gestion' ? { kind: 'zone', id: raw.zone } : { kind: 'part', id: raw.part, zone: raw.zone };
  };
  const zoneOfPick = (pk: ScenePick | null): ZoneId | null => (pk === null ? null : pk.kind === 'zone' ? pk.id : pk.kind === 'part' ? pk.zone : null);

  const target: GestureTarget = {
    rig,
    pick: pickAt,
    canLift: (id) => world.objects.canLift(id),
    liftBegin: (id) => world.objects.liftBegin(id),
    liftMove: (x, y) => { const n = toNdc(x, y, ndcTmp); world.objects.liftMove(n.x, n.y); },
    liftEnd: (keep) => { world.objects.liftEnd(keep); },
    invalidate: () => { lifecycle.invalidate(); },
  };
  const gestures = options.gestures === false ? null : attachGestures(canvas, target, {
    armY: options.armY,
    callbacks: {
      onPick: options.onPick,
      onBackground: options.onBackground,
      onLongPress: options.onLongPress,
      onZoneHover: options.onZoneHover,
      onExplodedChange: options.onExplodedChange,
      onLift: options.onLift,
      onHaptic: options.onHaptic,
    },
  });

  return {
    update(next) {
      if (disposed || next === state) return;
      state = next;
      if (lifecycle.isFrozen()) return; // appliqué à la reconstruction, au retour du contexte
      const bagChanged = world.bag.sync(currentKit(next).bag, currentConfig(next));
      const objChanged = world.objects.sync(next);
      if (bagChanged || objChanged) { refreshPose(); lifecycle.invalidate(); }
    },
    setDrawerOpen(open) {
      if (disposed) return;
      rig.setDrawerOpen(open);
      lifecycle.invalidate();
    },
    setMode(next) {
      if (disposed || next === mode) return;
      mode = next;
      rig.setArcEnabled(next === 'gestion');
      rig.setLowestZone(next === 'gestion' ? 0 : 1);
      lifecycle.invalidate();
    },
    setPart(next) {
      if (disposed || next === part) return;
      part = next;
      lifecycle.invalidate();
    },
    setZone(zone) {
      if (disposed) return;
      rig.goZone(zone);
      lifecycle.invalidate();
    },
    recenter() {
      if (disposed) return;
      rig.recenter();
      lifecycle.invalidate();
    },
    highlightZone(zone) {
      if (disposed || zone === highlighted) return;
      highlighted = zone;
      lifecycle.invalidate();
    },
    projectZone(zone, out = { x: 0, y: 0 }) {
      refreshPose();
      return world.objects.projectZone(zone, out);
    },
    projectItem(id, out = { x: 0, y: 0 }) {
      return world.objects.projectItem(id, out);
    },
    zoneAt(clientX, clientY) {
      return zoneOfPick(pickAt(clientX, clientY));
    },
    setExploded(value) {
      if (disposed) return;
      rig.setExploded(typeof value === 'boolean' ? (value ? 1 : 0) : value);
      lifecycle.invalidate();
    },
    resize() {
      if (disposed) return;
      applyViewport();
      lifecycle.invalidate();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      gestures?.dispose();
      observer?.disconnect();
      lifecycle.dispose();
      world.dispose();
      // Pas de forceContextLoss : un canvas à contexte perdu ne peut plus être réutilisé (remontage React).
      renderer.dispose();
    },
    info() {
      return {
        running: lifecycle.isRunning(),
        frozen: lifecycle.isFrozen(),
        paused: lifecycle.isPaused(),
        shadows,
        avgFrameMs: meter.lastAverage(),
        resources: world.tr.counts(),
        gpu: { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures },
        view: {
          zone: rig.zoneId(),
          position: rig.position(),
          angle: rig.angle(),
          tilt: rig.tilt(),
          exploded: rig.exploded(),
          explodedTarget: rig.explodedTarget(),
        },
        objects: world.objects.counts(),
      };
    },
  };
}
