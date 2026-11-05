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
import type { KitState } from '../domain/types';
import { createBag } from './bagBuilder';
import type { BagHandle } from './bagBuilder';
import { createCameraRig } from './camera';
import { makeColor } from './color';
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

export interface KitSceneOptions {
  readonly state: KitState;
  readonly reducedMotion: boolean;
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
}

export interface KitScene {
  update(state: KitState): void;
  setDrawerOpen(open: boolean): void;
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
  readonly sun: DirectionalLight;
  fitBackdrop(): void;
  syncBackdrop(): void;
  dispose(): void;
}

function buildWorld(camera: PerspectiveCamera, maxAnisotropy: number, reducedMotion: boolean, shadows: boolean): World {
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

  return {
    scene, tr, bag, sun,
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
  let world = buildWorld(rig.camera, renderer.capabilities.getMaxAnisotropy(), options.reducedMotion, shadows);

  const disableShadows = (): void => {
    if (!shadows) return;
    shadows = false;
    renderer.shadowMap.enabled = false;
    world.sun.castShadow = false;
    world.tr.markMaterialsDirty();
  };

  const frame = (time: number): boolean => {
    const dt = lastTime === null || time - lastTime > 100 ? 1 / 60 : Math.min(0.05, Math.max(0, (time - lastTime) / 1000));
    lastTime = time;
    const bagMoving = world.bag.step(dt);
    rig.setFocus(0, world.bag.group.position.y, 0);
    const camMoving = rig.step(dt);
    world.syncBackdrop();
    renderer.render(world.scene, rig.camera);
    const avg = meter.push(time);
    if (avg !== null && avg > SHADOW_BUDGET_MS) disableShadows();
    return bagMoving || camMoving;
  };

  const lifecycle = createLifecycle({
    renderer,
    canvas,
    step: frame,
    onContextLost: () => { options.onContextChange?.(true); },
    onContextRestored: () => {
      // Reconstruction complète depuis l'état : les ressources GPU d'avant la perte ne servent plus.
      world.dispose();
      world = buildWorld(rig.camera, renderer.capabilities.getMaxAnisotropy(), options.reducedMotion, shadows);
      applyViewport();
      world.bag.sync(currentKit(state).bag, currentConfig(state));
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
  lifecycle.invalidate();

  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { if (!disposed) { applyViewport(); lifecycle.invalidate(); } });
  observer?.observe(canvas);

  return {
    update(next) {
      if (disposed || next === state) return;
      state = next;
      if (lifecycle.isFrozen()) return; // appliqué à la reconstruction, au retour du contexte
      if (world.bag.sync(currentKit(next).bag, currentConfig(next))) lifecycle.invalidate();
    },
    setDrawerOpen(open) {
      if (disposed) return;
      rig.setDrawerOpen(open);
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
      };
    },
  };
}
