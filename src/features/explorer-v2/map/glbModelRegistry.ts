/**
 * Explorer v2 — Three.js r186 GLB + Draco Asset Registry & Cache.
 *
 * Loads optimized Meshy AI Neopolis-style stylized 3D diorama GLBs from
 * `/models/explorer/<key>.glb` with a self-hosted offline Draco WASM decoder
 * (`/draco/`), normalizes every model to uniform diorama proportions
 * (centered X/Z, base resting at Y=0, height ~2.15 units), shares GPU geometries
 * and materials across cloned instances, and disposes deterministically.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import type { Floating3DEntityKind } from './explorerThree3DLayer';

/**
 * Maps canonical 3D entity kinds to their optimized static GLB file under `public/models/explorer/`.
 * Every real POI subtype, Pokédex taxonomic group, community entity, and core hazard has its own
 * bespoke Meshy AI Neopolis-style miniature diorama GLB (Draco + WebP 512px, ~30–80 KB each).
 * Kinds not listed here (or while a GLB is still streaming) seamlessly render our procedural 3D models.
 */
export const GLB_ASSET_BY_KIND: Partial<Record<Floating3DEntityKind, string>> = {
  // 1. Relief & Panorama
  summit: '/models/explorer/peak.glb',
  saddle: '/models/explorer/saddle.glb',
  viewpoint: '/models/explorer/viewpoint.glb',

  // 2. Eau & Hydrologie
  water: '/models/explorer/drinking_water.glb',
  spring: '/models/explorer/spring.glb',

  // 3. Refuges, Cabanes, Abris & Bivouac
  refuge: '/models/explorer/alpine_hut.glb',
  wilderness_hut: '/models/explorer/wilderness_hut.glb',
  shelter: '/models/explorer/shelter.glb',
  bivouac: '/models/explorer/camp_site.glb',

  // 4. Accès, Sentiers, Mobilité & Villes
  trailhead: '/models/explorer/trailhead.glb',
  parking: '/models/explorer/parking.glb',
  bus_stop: '/models/explorer/bus_stop.glb',
  train_station: '/models/explorer/train_station.glb',
  village: '/models/explorer/village.glb',
  city: '/models/explorer/city.glb',

  // 5. Vélo / VTT & Favoris
  bike_shop: '/models/explorer/bike_shop.glb',
  bike_repair: '/models/explorer/bike_repair.glb',
  ebike_charging: '/models/explorer/ebike_charging.glb',
  saved_place: '/models/explorer/saved_place.glb',

  // 6. Pokédex Faune & Flore (taxonomie complète)
  pokedex: '/models/explorer/pokedex_flora.glb',
  pokedex_flora: '/models/explorer/pokedex_flora.glb',
  pokedex_bird: '/models/explorer/pokedex_bird.glb',
  pokedex_mammal: '/models/explorer/pokedex_mammal.glb',
  pokedex_fungi: '/models/explorer/pokedex_fungi.glb',
  pokedex_insect: '/models/explorer/pokedex_insect.glb',
  pokedex_aqua: '/models/explorer/pokedex_aqua.glb',

  // 7. Communauté & Social
  carnet: '/models/explorer/carnet.glb',
  bottle: '/models/explorer/bottle.glb',
  club: '/models/explorer/club.glb',
  club_event: '/models/explorer/club_event.glb',
  story: '/models/explorer/story.glb',
  friend: '/models/explorer/friend.glb',

  // 8. Risques & Secours
  fire: '/models/explorer/fire.glb',
  flood: '/models/explorer/flood.glb',
  rescue: '/models/explorer/rescue.glb',
};

const TARGET_HEIGHT_UNITS = 2.15;

const KIND_SCALE_MULTIPLIER: Partial<Record<Floating3DEntityKind, number>> = {
  train_station: 1.14,
  village: 1.12,
  city: 1.14,
  saddle: 1.12,
  bike_shop: 1.1,
  club_event: 1.08,
};

export interface ExplorerGlbRegistry {
  getCached: (kind: Floating3DEntityKind) => THREE.Group | null;
  requestModel: (kind: Floating3DEntityKind, onReady: () => void) => void;
  createInstance: (kind: Floating3DEntityKind) => THREE.Group | null;
  preloadCoreModels: () => void;
  setPaused: (paused: boolean) => void;
  getPendingCount: () => number;
  onPendingChange: (cb: (count: number) => void) => () => void;
  dispose: () => void;
}

const CORE_PRELOAD_KINDS: readonly Floating3DEntityKind[] = [
  'summit',
  'water',
  'refuge',
  'bivouac',
  'bus_stop',
  'parking',
  'village',
  'carnet',
  'bottle',
  'pokedex_flora',
];

function normalizeGlbScene(raw: THREE.Object3D, kind: Floating3DEntityKind): THREE.Group {
  const wrapper = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.add(raw);
  // Stand flat-lying hardcover journal upright at a dynamic showcase angle
  if (kind === 'carnet') {
    pivot.rotation.x = 0.92;
    pivot.rotation.z = -0.18;
  }
  wrapper.add(pivot);
  wrapper.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(pivot);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxAxis = Math.max(size.y, size.x * 0.85, size.z * 0.85, 0.001);
  const scale = (TARGET_HEIGHT_UNITS * (KIND_SCALE_MULTIPLIER[kind] ?? 1)) / maxAxis;

  pivot.scale.setScalar(scale);
  pivot.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

  // Ensure crisp stylized PBR lighting response on every child mesh
  raw.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial;
      if (std && typeof std.envMapIntensity === 'number') {
        std.envMapIntensity = 1.15;
      }
    }
  });

  return wrapper;
}

export function createExplorerGlbRegistry(): ExplorerGlbRegistry {
  const templates = new Map<Floating3DEntityKind, THREE.Group>();
  const failed = new Set<Floating3DEntityKind>();
  const pendingCallbacks = new Map<Floating3DEntityKind, Set<() => void>>();
  const visiblePending = new Set<Floating3DEntityKind>();
  const pendingListeners = new Set<(count: number) => void>();
  const queuedKinds: Floating3DEntityKind[] = [];
  const inFlightKinds = new Set<Floating3DEntityKind>();

  const isMobileLike =
    typeof window !== 'undefined' &&
    (window.innerWidth <= 560 ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches));
  // Strict concurrency cap prevents Draco WASM + WebGL texture uploads from stuttering touch pans
  const maxConcurrent = isMobileLike ? 1 : 2;

  let dracoLoader: DRACOLoader | null = null;
  let gltfLoader: GLTFLoader | null = null;
  let disposed = false;
  let paused = false;
  let preloadStarted = false;
  let pumpTimer: number | null = null;

  const emitPending = () => {
    const count = visiblePending.size;
    for (const listener of pendingListeners) {
      try {
        listener(count);
      } catch {
        /* ignore subscriber error */
      }
    }
  };

  const ensureLoader = (): GLTFLoader | null => {
    if (disposed || typeof window === 'undefined') return null;
    if (!gltfLoader) {
      dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('/draco/');
      dracoLoader.setDecoderConfig({ type: 'wasm' });
      gltfLoader = new GLTFLoader();
      gltfLoader.setDRACOLoader(dracoLoader);
    }
    return gltfLoader;
  };

  const schedulePump = (delayMs = 0) => {
    if (disposed || paused || typeof window === 'undefined') return;
    if (pumpTimer !== null) return;
    pumpTimer = window.setTimeout(() => {
      pumpTimer = null;
      pumpQueue();
    }, delayMs);
  };

  const pumpQueue = () => {
    if (disposed || paused) return;
    const loader = ensureLoader();
    if (!loader) return;

    while (inFlightKinds.size < maxConcurrent && queuedKinds.length > 0) {
      const kind = queuedKinds.shift()!;
      if (templates.has(kind) || failed.has(kind) || inFlightKinds.has(kind)) continue;
      const url = GLB_ASSET_BY_KIND[kind];
      if (!url) continue;

      inFlightKinds.add(kind);
      loader.load(
        url,
        (gltf) => {
          inFlightKinds.delete(kind);
          const cbs = pendingCallbacks.get(kind);
          pendingCallbacks.delete(kind);
          visiblePending.delete(kind);
          emitPending();
          if (disposed) {
            gltf.scene.traverse((obj) => {
              const mesh = obj as THREE.Mesh;
              if (mesh.isMesh) {
                mesh.geometry?.dispose();
                const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                for (const m of mats) m?.dispose();
              }
            });
            return;
          }
          const normalized = normalizeGlbScene(gltf.scene, kind);
          templates.set(kind, normalized);
          if (cbs) {
            for (const cb of cbs) cb();
          }
          // Yield a frame gap so map panning stays 60 FPS between GLB decodes
          schedulePump(isMobileLike ? 48 : 20);
        },
        undefined,
        () => {
          inFlightKinds.delete(kind);
          pendingCallbacks.delete(kind);
          visiblePending.delete(kind);
          failed.add(kind);
          emitPending();
          schedulePump(24);
        },
      );
    }
  };

  const requestInternal = (
    kind: Floating3DEntityKind,
    onReady?: () => void,
    trackAsVisible = true,
  ): void => {
    if (disposed || templates.has(kind) || failed.has(kind)) return;
    const url = GLB_ASSET_BY_KIND[kind];
    if (!url) return;

    const existingSet = pendingCallbacks.get(kind);
    if (existingSet) {
      if (onReady) existingSet.add(onReady);
      if (trackAsVisible && !visiblePending.has(kind)) {
        visiblePending.add(kind);
        // Promote visible request to the front of the queue
        const qIdx = queuedKinds.indexOf(kind);
        if (qIdx > 0) {
          queuedKinds.splice(qIdx, 1);
          queuedKinds.unshift(kind);
        }
        emitPending();
      }
      return;
    }

    const callbacks = new Set<() => void>(onReady ? [onReady] : []);
    pendingCallbacks.set(kind, callbacks);
    if (trackAsVisible) {
      visiblePending.add(kind);
      queuedKinds.unshift(kind);
      emitPending();
    } else {
      queuedKinds.push(kind);
    }

    schedulePump(0);
  };

  return {
    getCached(kind: Floating3DEntityKind): THREE.Group | null {
      return templates.get(kind) ?? null;
    },

    requestModel(kind: Floating3DEntityKind, onReady: () => void): void {
      requestInternal(kind, onReady, true);
    },

    preloadCoreModels(): void {
      if (disposed || preloadStarted || typeof window === 'undefined') return;
      preloadStarted = true;
      // On mobile, only preload the top 4 most common models gently in idle time
      const preloadSlice = isMobileLike ? CORE_PRELOAD_KINDS.slice(0, 4) : CORE_PRELOAD_KINDS;
      const runBatch = () => {
        if (disposed) return;
        for (const kind of preloadSlice) {
          // Warm cache quietly one-by-one via queue without tripping spinner or stuttering pans
          requestInternal(kind, undefined, false);
        }
      };
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
      if (typeof ric === 'function') {
        ric(runBatch, { timeout: 3000 });
      } else {
        window.setTimeout(runBatch, 1400);
      }
    },

    setPaused(nextPaused: boolean): void {
      if (paused === nextPaused) return;
      paused = nextPaused;
      if (!paused && queuedKinds.length > 0) {
        schedulePump(32);
      }
    },

    getPendingCount(): number {
      return visiblePending.size;
    },

    onPendingChange(cb: (count: number) => void): () => void {
      pendingListeners.add(cb);
      return () => {
        pendingListeners.delete(cb);
      };
    },

    createInstance(kind: Floating3DEntityKind): THREE.Group | null {
      const tpl = templates.get(kind);
      if (!tpl) return null;
      // Shallow-clone scene graph: shares GPU geometries & PBR textures across all instances!
      return tpl.clone(true);
    },

    dispose(): void {
      disposed = true;
      if (pumpTimer !== null && typeof window !== 'undefined') {
        window.clearTimeout(pumpTimer);
        pumpTimer = null;
      }
      queuedKinds.length = 0;
      inFlightKinds.clear();
      visiblePending.clear();
      pendingCallbacks.clear();
      pendingListeners.clear();
      for (const tpl of templates.values()) {
        tpl.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            if (!mat) continue;
            const std = mat as THREE.MeshStandardMaterial;
            std.map?.dispose();
            std.normalMap?.dispose();
            std.roughnessMap?.dispose();
            std.metalnessMap?.dispose();
            std.aoMap?.dispose();
            std.emissiveMap?.dispose();
            mat.dispose();
          }
        });
      }
      templates.clear();
      dracoLoader?.dispose();
      dracoLoader = null;
      gltfLoader = null;
    },
  };
}
