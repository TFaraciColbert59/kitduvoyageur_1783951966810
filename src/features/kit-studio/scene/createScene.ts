// Scène principale du Kit Studio (SPEC-3D ; maquette l.906-1110). Importé uniquement par chargement dynamique
// (`dynamic(() => import(...), { ssr: false })`), jamais depuis le rendu serveur. Aucun import React, aucun accès au
// store : l'état courant est passé à createKitScene() puis à update().
import {
  ACESFilmicToneMapping, Box3, DirectionalLight, MathUtils, Mesh, MeshBasicMaterial,
  PCFShadowMap, PlaneGeometry, PMREMGenerator, Scene, SRGBColorSpace, WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Camera, PerspectiveCamera, ShadowMapType, ToneMapping } from 'three';
import { createWorkshop } from './workshop';
import { currentConfig, currentKit } from '../domain/state';
import { BAGS } from '../domain/catalog';
import type { PartNameId, ZoneId } from '../domain/catalog';
import type { KitState } from '../domain/types';
import { createBag } from './bagBuilder';
import type { BagHandle } from './bagBuilder';
import { createBagModelLayer, selectBagRenderSource } from './bag/modelLayer';
import type { BagModelLayer, BagModelRuntimeInfo } from './bag/modelLayer';
import type { BagAssetProvider } from './bag/loader';
import { createCameraRig } from './camera';
import type { CameraRig } from './camera';
import { attachGestures } from './gestures';
import type { GestureCallbacks, GestureTarget, ScenePick } from './gestures';
import { createObjectLayer } from './objects';
import type { ObjectFrame, ObjectLayer } from './objects';
import { BAG_HALF_HEIGHT } from './layout';
import { createFrameMeter, createLifecycle } from './lifecycle';
import { clamp } from './math';
import { ResourceTracker } from './resources';
import type { ResourceCounts } from './resources';
import { createTextureBank } from './textures';
import type { BagAnchorId } from '../domain/bagModel';
import type { AttachModuleResult, LoadedModuleAsset, ModuleAttachmentController } from './bag/moduleLoader';
import { loadModuleAsset } from './bag/moduleLoader';
import { notifySceneUpdate } from './sceneRef';

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
  /**
   * Force un modèle GLB (lien profond / donnée serveur à venir / test). `null` ou absent :
   * la source est décidée par le mapping corps → maillage, puis repli procédural.
   */
  readonly bagModelId?: string | null;
  /** État du sac maillé : chargé, dégradé (repli procédural), ou personnalisation indisponible. */
  readonly onBagModel?: (info: BagModelRuntimeInfo) => void;
  /** Source des fichiers de sacs (tests, assets hors réseau) ; défaut : `/assets/bags/`. */
  readonly bagAssetProvider?: BagAssetProvider;
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
  /** Sac affiché : maillage GLB ou repli procédural, parties et ancrages réels. */
  readonly bagModel: BagModelRuntimeInfo;
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
  /** Attache un module 3D sur une ancre libre (ou ciblée). */
  attachModule(moduleId: string, anchorId?: BagAnchorId): Promise<AttachModuleResult>;
  /** Détache le module monté sur l'ancre ou correspondant au moduleId. */
  detachModule(anchorOrModuleId?: string): LoadedModuleAsset | null;
  /** Contrôleur d'accroche actif sur le maillage courant. */
  getAttachments(): ModuleAttachmentController | null;
}

export const SHADOW_BUDGET_MS = 24;

/**
 * Hauteur de composition du sac procédural courant, en mètres : sert uniquement à mettre un
 * maillage GLB à l'échelle de la table (les GLB livrés sont à l'échelle réelle du produit,
 * la scène de la maquette est stylisée). Les UV restent en mètres : la trame physique des
 * textures n'est pas modifiée par cette adaptation de composition.
 */
function proceduralBagHeightM(state: KitState): number {
  const bag = currentKit(state).bag;
  const scaleY = BAGS[bag]?.sc?.[1] ?? 1;
  return 2 * BAG_HALF_HEIGHT * scaleY;
}

interface World {
  readonly scene: Scene;
  readonly tr: ResourceTracker;
  readonly bag: BagHandle;
  readonly bagModel: BagModelLayer;
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
  /** Modèle GLB forcé (null = décidé par le mapping corps → maillage). */
  readonly bagModelId?: string | null;
  /** Notre sac courant, pour l'échelle de composition et le rechargement. */
  readonly state: KitState;
  readonly onBagModel?: (info: BagModelRuntimeInfo) => void;
  readonly bagAssetProvider?: BagAssetProvider;
  readonly renderer?: RendererLike;
}

function buildWorld({ rig, maxAnisotropy, reducedMotion, shadows, safeTop, bagModelId, state, onBagModel, bagAssetProvider, renderer }: WorldOptions): World {
  const camera: PerspectiveCamera = rig.camera;
  const tr = new ResourceTracker();
  const tex = createTextureBank(tr, maxAnisotropy);
  const scene = new Scene();

  // Avenant §4 : Carte d'environnement procédurale (RoomEnvironment + PMREMGenerator)
  // apporte les reflets naturels pour les matériaux PBR, particulièrement sur la zone B (boucles rigides).
  let pmrem: PMREMGenerator | null = null;
  let roomEnv: Scene | null = null;
  let envTexture: import('three').Texture | null = null;
  if (renderer && typeof (renderer as any).getRenderTarget === 'function') {
    try {
      pmrem = new PMREMGenerator(renderer as any);
      roomEnv = new RoomEnvironment();
      envTexture = pmrem.fromScene(roomEnv).texture;
      scene.environment = envTexture;
    } catch {
      // Ignoré en environnement headless / tests sans WebGL
    }
  }

  const { sun, syncContact } = createWorkshop(scene, tr, tex, shadows, Boolean(envTexture));

  // Mur neutre attaché à la caméra ; le gradient reste continu pendant les orbites.
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

  const bag = createBag(tr, tex, reducedMotion);
  scene.add(bag.group);
  const objects = createObjectLayer({
    root: scene, tr, bag, camera, viewport: () => rig.viewport(), fabric: tex.fabric('ripstop'), reducedMotion, safeTop,
  });

  // Le sac maillé (GLB) recouvre le sac procédural quand un modèle existe ; sinon le
  // procédural reste seul en scène. Le chargement est asynchrone : aucune exception.
  const selected = selectBagRenderSource(bagModelId, currentKit(state).bag);
  const bagModel = createBagModelLayer({
    scene,
    textures: tex,
    proceduralBag: bag.group,
    targetHeightM: () => proceduralBagHeightM(state),
    onChange: onBagModel,
    provider: bagAssetProvider,
    reducedMotion,
  });
  void bagModel.load(selected.kind === 'glb' ? selected.modelId : null);
  bagModel.setAppearance(currentConfig(state));

  return {
    scene, tr, bag, bagModel, objects, sun,
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
      syncContact(bag.group.scale, bagModel.info());
      const th = Math.atan2(camera.position.x, camera.position.z);
      pano.offset.x = 0.12 - th / (Math.PI * 2) - BD.cx;
      const ph = Math.acos(clamp((camera.position.y - bag.group.position.y) / Math.max(0.1, camera.position.length()), -1, 1));
      pano.offset.y = clamp((ph - 1.2) * 0.12, -0.02, 0.06) - BD.cy;
    },
    dispose() {
      camera.remove(backdrop);
      objects.dispose();
      bagModel.dispose();
      bag.dispose();
      scene.clear();
      if (envTexture) {
        envTexture.dispose();
        envTexture = null;
      }
      if (pmrem) {
        pmrem.dispose();
        pmrem = null;
      }
      if (roomEnv) {
        roomEnv.clear();
        roomEnv = null;
      }
      scene.environment = null;
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
    bagModelId: options.bagModelId, state, onBagModel: options.onBagModel, bagAssetProvider: options.bagAssetProvider, renderer,
  });
  let world = buildWorld(worldOptions());
  rig.setWorld({
    anchor: (zone, out) => world.objects.anchor(zone, out),
    center: (out) => {
      const box = new Box3();
      world.bagModel.getBounds(box);
      if (!box.isEmpty()) return box.getCenter(out);
      return world.bag.group.localToWorld(out.set(0, 0.35, 0));
    },
    bounds: (out) => world.bagModel.getBounds(out),
    bodyBounds: (out) => world.bagModel.getBodyBounds(out),
  });
  rig.onZoneChange(options.onZoneChange ?? null);
  const objectFrame: ObjectFrame = { focus: 'bag', arcAmt: 0, ex: 0, pos: 1, ghostsOn: true };

  /** Source de rendu pour l'état courant (GLB déclaré, sinon procédural). */
  const renderSource = (current: KitState) => selectBagRenderSource(options.bagModelId, currentKit(current).bag);

  /** Identité d'une source, pour ne recharger que lorsqu'elle change réellement. */
  const sourceKey = (source: ReturnType<typeof renderSource>): string =>
    source.kind === 'glb' ? source.modelId : 'procedural';

  let lastSourceKey = sourceKey(renderSource(state));

  /** Recharge le maillage quand la source a changé (changement de corps, retour de contexte). */
  const reloadBagModel = (): void => {
    if (disposed) return;
    const source = renderSource(state);
    void world.bagModel.load(source.kind === 'glb' ? source.modelId : null).then(() => {
      if (disposed) return;
      // Le maillage réel n'a pas la taille du procédural affiché pendant le chargement : sans ce
      // replacement, la caméra garde le cadrage de l'ancien et le sac arrive hors champ, jusqu'au
      // premier geste de l'utilisateur.
      rig.place();
      lifecycle.invalidate();
      // Le sac est posé : les vignettes peuvent aller chercher leurs propres maillages. Avant,
      // leurs téléchargements retardaient celui-ci de plus de vingt secondes.
      void import('./thumbAssets').then(
        (m) => m.ouvrirChargementsVignettes(),
        () => {
          // Les vignettes se débloqueront d'elles-mêmes au bout de leur délai de secours.
        },
      );
    });
  };

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
    const attachMoving = world.bagModel.attachments()?.advance?.(dt) ?? false;
    world.syncBackdrop();
    renderer.render(world.scene, rig.camera);
    const avg = meter.push(time);
    if (avg !== null && avg > SHADOW_BUDGET_MS) disableShadows();
    return bagMoving || camMoving || objMoving || attachMoving;
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
      reloadBagModel();
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
      // La configuration d'apparence s'applique au maillage chargé (couleurs, matière, finition).
      world.bagModel.setAppearance(currentConfig(next));
      // `bag.sync` dit que le sac procédural a été reconstruit, ce qu'un simple changement de
      // teinte provoque aussi. S'en servir pour recharger le maillage relançait un chargement
      // complet à chaque couleur ; trois d'affilée s'annulaient l'un l'autre et le Studio restait
      // bloqué sur « chargement ». Seule l'identité de la source décide d'un rechargement.
      const cleSource = sourceKey(renderSource(state));
      if (cleSource !== lastSourceKey) {
        lastSourceKey = cleSource;
        reloadBagModel();
      }
      if (bagChanged || objChanged) refreshPose();
      // Un changement de teinte ne modifie ni le corps ni les objets : sans ce rendu, la couleur
      // était bien posée sur la matière mais aucune image n'était redessinée, et l'écran ne
      // bougeait pas tant que l'utilisateur ne touchait à rien d'autre.
      lifecycle.invalidate();
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
          subjectRect: rig.subjectRect(),
        },
        objects: world.objects.counts(),
        bagModel: world.bagModel.info(),
      };
    },
    async attachModule(moduleId: string, anchorId?: BagAnchorId): Promise<AttachModuleResult> {
      const ctrl = world.bagModel.attachments();
      if (!ctrl) {
        return {
          ok: false,
          anchorId: anchorId ?? 'facade',
          reason: 'anchor-not-found',
          userMessage: 'Aucun point d’accroche disponible sur ce sac.',
        };
      }
      const freeAnchor = ctrl.listAnchors().find((a) => !ctrl.isOccupied(a.id));
      const targetAnchor =
        anchorId ??
        freeAnchor?.id ??
        ctrl.listAnchors()[0]?.id ??
        'facade';

      // Si l'ancre ciblée est déjà occupée, détacher l'ancien module pour accueillir le nouveau
      if (ctrl.isOccupied(targetAnchor)) {
        ctrl.detach(targetAnchor);
      }

      const provider = options.bagAssetProvider
        ? {
            fetchManifest: async (id: string) => {
              if (options.bagAssetProvider?.fetchManifest) {
                try {
                  return await options.bagAssetProvider.fetchManifest(id);
                } catch {
                  // fallback
                }
              }
              const { defaultModuleProvider } = await import('./bag/moduleLoader');
              return defaultModuleProvider.fetchManifest(id);
            },
            fetchGlb: async (id: string, url?: string) => {
              if (options.bagAssetProvider?.fetchGlb) {
                try {
                  return await options.bagAssetProvider.fetchGlb(id);
                } catch {
                  // fallback
                }
              }
              const { defaultModuleProvider } = await import('./bag/moduleLoader');
              return defaultModuleProvider.fetchGlb(id, url);
            },
          }
        : undefined;

      const loaded = await loadModuleAsset(moduleId, provider);
      if (loaded.status !== 'ready') {
        return {
          ok: false,
          anchorId: targetAnchor,
          reason: 'anchor-not-found',
          userMessage: `Impossible de charger le module ${moduleId}.`,
        };
      }
      const res = ctrl.attach(loaded, targetAnchor);
      if (res.ok) {
        refreshPose();
        lifecycle.invalidate();
      }
      notifySceneUpdate();
      return res;
    },
    detachModule(anchorOrModuleId?: string): LoadedModuleAsset | null {
      const ctrl = world.bagModel.attachments();
      if (!ctrl) return null;
      let targetAnchor: BagAnchorId | undefined;
      for (const a of ctrl.listAnchors()) {
        const mounted = ctrl.getMountedModule(a.id);
        if (mounted && (a.id === anchorOrModuleId || mounted.moduleId === anchorOrModuleId)) {
          targetAnchor = a.id;
          break;
        }
      }
      if (!targetAnchor && anchorOrModuleId && ctrl.isOccupied(anchorOrModuleId as BagAnchorId)) {
        targetAnchor = anchorOrModuleId as BagAnchorId;
      }
      targetAnchor ??= ctrl.listAnchors().find((a) => ctrl.isOccupied(a.id))?.id;
      if (!targetAnchor) return null;
      const detached = ctrl.detach(targetAnchor);
      if (detached) {
        refreshPose();
        lifecycle.invalidate();
      }
      notifySceneUpdate();
      return detached;
    },
    getAttachments(): ModuleAttachmentController | null {
      return world.bagModel.attachments();
    },
  };
}
