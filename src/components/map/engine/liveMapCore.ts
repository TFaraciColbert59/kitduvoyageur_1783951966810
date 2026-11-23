import type { Map as MlMap, MapOptions } from 'maplibre-gl';
import { WebGLArbiter, type WebGLHolder } from '@/features/hub/webgl/WebGLArbiter';
import { SMOOTH_MAPLIBRE_OPTIONS, applySmoothMapPhysics, createMapStyle, type AtlasTileMode } from './createMapStyle';

/**
 * Noyau de la carte vivante de LKDV (2.1 « Une seule carte ») : création de la carte, style, physique de
 * déplacement, perte de contexte WebGL et cycle de vie auprès de l'arbitre. Partagé par la carte vivante du
 * Compas (`compas/v5/map/LiveMap.tsx`) et par la carte de `/compas/itineraire` (`RouteCollabMap.tsx`) : un seul
 * moteur, un seul réglage.
 */

export type MlModule = typeof import('maplibre-gl');

export const MAP_WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';

/** Charge MapLibre (module ou export par défaut, selon le bundler) et pose l'adresse du worker. */
export async function loadMaplibre(): Promise<MlModule> {
  const mod = await import('maplibre-gl');
  const maplibre = ((mod as unknown as { Map?: unknown }).Map ? mod : (mod as unknown as { default: MlModule }).default) as MlModule;
  maplibre.setWorkerUrl?.(MAP_WORKER_URL);
  return maplibre;
}

/** Options communes à toutes les cartes 2D du site : Mercator, pas de rotation ni d'inclinaison, fluidité. */
export const LIVE_MAP_OPTIONS = {
  minZoom: 2,
  maxZoom: 18,
  renderWorldCopies: false,
  attributionControl: false,
  dragRotate: false,
  pitchWithRotate: false,
  touchPitch: false,
  ...SMOOTH_MAPLIBRE_OPTIONS,
} as const;

export interface LiveMapInit {
  container: HTMLElement;
  base: AtlasTileMode;
  center: [number, number];
  zoom: number;
  /** Titre accessible de la carte. */
  title?: string;
  /** Style déjà construit (repli : `createMapStyle(base, { projection: 'mercator' })`). */
  style?: MapOptions['style'];
}

/** Crée la carte avec le style et la physique du Compas. */
export function createLiveMap(maplibre: MlModule, init: LiveMapInit): MlMap {
  const map = new maplibre.Map({
    container: init.container,
    style: init.style ?? createMapStyle(init.base, { projection: 'mercator' }),
    center: init.center,
    zoom: init.zoom,
    ...LIVE_MAP_OPTIONS,
    ...(init.title ? { locale: { 'Map.Title': init.title } } : null),
  });
  applySmoothMapPhysics(map, { lockRotation: true });
  return map;
}

/** WebGL est-il utilisable ici ? (sonde sur un canvas jetable, sans toucher au contexte de la carte). */
export function webglSupport(arbiter: WebGLArbiter = WebGLArbiter.getInstance()): 'ok' | 'unsupported' | 'degraded' {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 'unsupported';
  const probe = document.createElement('canvas');
  const gl = window.WebGLRenderingContext && (probe.getContext('webgl') || probe.getContext('experimental-webgl'));
  if (!gl) return 'unsupported';
  return arbiter.isContextDegraded() ? 'degraded' : 'ok';
}

export interface ArbiterLease {
  /** À appeler quand la carte est créée : relaie la perte et la restauration de contexte à l'arbitre. */
  watch(map: MlMap): void;
  /** Rend le contexte à l'arbitre et détache les écouteurs. */
  release(): void;
}

/**
 * Cycle de vie WebGLArbiter (ADR-002) : la carte devient titulaire (`holder`), une autre vue 3D qui la réclame la
 * libère (`onReleased`), une perte de contexte est tentée une fois puis passe en mode liste (`onLost`).
 */
export async function leaseWebGL(
  holder: WebGLHolder,
  handlers: { isCancelled: () => boolean; onReleased: () => void; onLost: () => void },
  arbiter: WebGLArbiter = WebGLArbiter.getInstance()
): Promise<ArbiterLease> {
  await arbiter.acquire(holder);
  const cleanups: Array<() => void> = [];
  cleanups.push(
    arbiter.registerReleaseHandler(holder, () => {
      if (!handlers.isCancelled()) handlers.onReleased();
    })
  );
  cleanups.push(arbiter.registerRestoreHandler(holder, () => !handlers.isCancelled()));
  cleanups.push(
    arbiter.onContextLost(() => {
      if (!handlers.isCancelled()) handlers.onLost();
    })
  );
  return {
    watch(map) {
      map.on('webglcontextlost', () => {
        if (!handlers.isCancelled()) arbiter.triggerContextLost();
      });
      map.on('webglcontextrestored', () => arbiter.notifyContextRestored());
    },
    release() {
      cleanups.forEach((fn) => fn());
      arbiter.release(holder);
    },
  };
}

/** Lit un jeton CSS du thème pour MapLibre, qui ne lit pas `var(--…)`. */
export function themeColor(el: Element, token: string, fallback: string): string {
  try {
    const v = getComputedStyle(el).getPropertyValue(token).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}
