import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapBounds } from '@/features/compte/map/types';

/**
 * CHANTIER ATLAS — Phase 4
 * Chorégraphie caméra : uniquement les animations natives MapLibre
 * (`flyTo`/`easeTo`), courbe d'accélération native, aucune animation maison.
 * `prefers-reduced-motion` → saut immédiat (durée 0).
 *
 * CHANTIER FLUIDITÉ — Phase F1
 * Vols longue distance en trajectoire courbe Van Wijk (défauts MapLibre
 * curve 1.42 / speed 1.2) au lieu d'une `duration` fixe : la vitesse perçue
 * devient homogène quel que soit le trajet (F0 : 1 541 → 21 822 km/s à
 * durée fixe, soit 14× d'écart sur les mêmes vols).
 */

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function animationDuration(duration: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : duration;
}

export interface FlyToTarget {
  center: [number, number];
  zoom: number;
  duration?: number;
  curve?: number;
  speed?: number;
  screenSpeed?: number;
  maxDuration?: number;
  minZoom?: number;
  essential?: boolean;
}

export type FlyToParams = { center: [number, number]; zoom: number } & Partial<
  Pick<
    FlyToTarget,
    'duration' | 'curve' | 'speed' | 'screenSpeed' | 'maxDuration' | 'minZoom' | 'essential'
  >
>;

/**
 * Construit l'objet exact transmis à `map.flyTo` : seules les clés
 * explicitement demandées sont incluses (pas de `undefined` injecté), et
 * `prefers-reduced-motion` court-circuite vers un saut instantané sans
 * trajectoire courbe (FLU-R3).
 */
export function buildFlyToParams(target: FlyToTarget, reducedMotion: boolean): FlyToParams {
  if (reducedMotion) {
    return { center: target.center, zoom: target.zoom, duration: 0 };
  }
  const params: FlyToParams = { center: target.center, zoom: target.zoom };
  if (target.duration !== undefined) params.duration = target.duration;
  if (target.curve !== undefined) params.curve = target.curve;
  if (target.speed !== undefined) params.speed = target.speed;
  if (target.screenSpeed !== undefined) params.screenSpeed = target.screenSpeed;
  if (target.maxDuration !== undefined) params.maxDuration = target.maxDuration;
  if (target.minZoom !== undefined) params.minZoom = target.minZoom;
  if (target.essential !== undefined) params.essential = target.essential;
  return params;
}

export function flyToTarget(map: MapLibreMap, target: FlyToTarget): void {
  map.flyTo(buildFlyToParams(target, prefersReducedMotion()));
}

export function easeToTarget(map: MapLibreMap, target: FlyToTarget): void {
  const duration = animationDuration(target.duration ?? 400, prefersReducedMotion());
  map.easeTo({ center: target.center, zoom: target.zoom, duration });
}

type ToggleInteraction = {
  enable?: () => void;
  disable?: () => void;
};

/**
 * Courbe d'accélération CSS `cubic-bezier(x1, y1, x2, y2)` traduite en
 * progression MapLibre (`t ∈ [0, 1] → t'`). Sert aux vols de caméra qui
 * doivent suivre une courbe d'interface, sans animation maison : MapLibre
 * reste seul à animer, il reçoit seulement la courbe.
 *
 * Une abscisse hors `[0, 1]` n'est pas une courbe : on retombe sur le linéaire
 * plutôt que de produire un mouvement silencieusement faux.
 */
export function cubicBezierEasing(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): (progress: number) => number {
  const inRange = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1;
  if (!inRange(x1) || !inRange(x2)) {
    return (progress) => (Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0);
  }
  const curve = (t: number, a: number, b: number) => {
    const u = 1 - t;
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
  };
  const slope = (t: number, a: number, b: number) => {
    const u = 1 - t;
    return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b);
  };
  return (progress) => {
    if (!Number.isFinite(progress) || progress <= 0) return 0;
    if (progress >= 1) return 1;
    let t = progress;
    for (let step = 0; step < 8; step += 1) {
      const error = curve(t, x1, x2) - progress;
      if (Math.abs(error) < 1e-6) return curve(t, y1, y2);
      const tangent = slope(t, x1, x2);
      if (Math.abs(tangent) < 1e-6) break;
      t -= error / tangent;
    }
    let low = 0;
    let high = 1;
    t = progress;
    for (let step = 0; step < 24; step += 1) {
      const x = curve(t, x1, x2);
      if (Math.abs(x - progress) < 1e-6) break;
      if (x < progress) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return curve(t, y1, y2);
  };
}

/** Cible de cadrage d'un tracé : bornes réelles + réglage du vol. */
export interface TraceCameraTarget {
  /** `[ouest, sud, est, nord]`. */
  bounds: MapBounds;
  padding: { top: number; bottom: number; left: number; right: number };
  /** Durée du vol en ms. Défaut : `1100` (cadrage historique du carnet). */
  duration?: number;
  /** Courbe du vol. Absente : courbe native de MapLibre. */
  easing?: (progress: number) => number;
  pitch?: number;
  bearing?: number;
  maxZoom?: number;
}

/**
 * Surface MapLibre strictement nécessaire au cadrage d'un tracé. Le vrai
 * `Map` la satisfait : le helper reste testable sans WebGL.
 */
export interface TraceCameraMap {
  fitBounds(bounds: [[number, number], [number, number]], options: Record<string, unknown>): unknown;
  cameraForBounds?(
    bounds: [[number, number], [number, number]],
    options?: Record<string, unknown>
  ): { center: [number, number]; zoom: number } | null | undefined;
  jumpTo?(options: Record<string, unknown>): unknown;
}

/**
 * Cadre un tracé : un vol animé (durée + courbe) ou, en `prefers-reduced-motion`,
 * un saut sec vers la caméra finale — mêmes bornes, même inclinaison, même cap,
 * aucune animation. Le saut passe par `cameraForBounds`, c'est-à-dire par la
 * pose exacte que `fitBounds` atteindrait.
 */
export function applyTraceCamera(
  map: TraceCameraMap,
  target: TraceCameraTarget,
  reducedMotion: boolean
): void {
  const pitch = target.pitch ?? 45;
  const bearing = target.bearing ?? -18;
  const maxZoom = target.maxZoom ?? 14;
  const corners: [[number, number], [number, number]] = [
    [target.bounds[0], target.bounds[1]],
    [target.bounds[2], target.bounds[3]],
  ];

  if (!reducedMotion) {
    map.fitBounds(corners, {
      padding: target.padding,
      maxZoom,
      pitch,
      bearing,
      duration: target.duration ?? 1100,
      ...(target.easing ? { easing: target.easing } : {}),
      essential: true,
    });
    return;
  }

  const pose = map.cameraForBounds?.(corners, { padding: target.padding, maxZoom });
  if (pose && map.jumpTo) {
    map.jumpTo({ center: pose.center, zoom: pose.zoom, pitch, bearing });
    return;
  }
  map.fitBounds(corners, {
    padding: target.padding,
    maxZoom,
    pitch,
    bearing,
    duration: 0,
    essential: true,
  });
}

type RotationInteraction = {
  enableRotation?: () => void;
  disableRotation?: () => void;
};

export interface GlobeInteractionHandlers {
  dragRotate?: ToggleInteraction;
  touchZoomRotate?: RotationInteraction;
  touchPitch?: ToggleInteraction;
}

function callInteraction<T extends object>(
  receiver: T | undefined,
  method: (() => void) | undefined,
  label: string
): void {
  if (!receiver || typeof method !== 'function') return;
  try {
    method.call(receiver);
  } catch (error) {
    console.warn('[camera] geste MapLibre indisponible : ' + label, error);
  }
}

/**
 * Le globe exploite la rotation et l'inclinaison ; la vue locale les neutralise
 * pour éviter qu'un pincement ne bascule la carte de travers sous le doigt.
 */
export function syncGlobeInteractionHandlers(
  map: GlobeInteractionHandlers,
  mode: 'local' | 'globe'
): void {
  const enabled = mode === 'globe';
  callInteraction(
    map.dragRotate,
    enabled ? map.dragRotate?.enable : map.dragRotate?.disable,
    'dragRotate (' + mode + ')'
  );
  callInteraction(
    map.touchZoomRotate,
    enabled ? map.touchZoomRotate?.enableRotation : map.touchZoomRotate?.disableRotation,
    'touchZoomRotate.rotation (' + mode + ')'
  );
  callInteraction(
    map.touchPitch,
    enabled ? map.touchPitch?.enable : map.touchPitch?.disable,
    'touchPitch (' + mode + ')'
  );
}

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineKm(a: [number, number], b: [number, number]): number {
  const dLat = toRadians(b[1] - a[1]);
  const dLng = toRadians(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a[1])) * Math.cos(toRadians(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

export interface CountryFlight {
  curve: number;
  speed: number;
  maxDuration: number;
  minZoom: number;
  essential: true;
}

/**
 * Paramètres du vol lors de la sélection d'un pays : trajectoire Van Wijk
 * (curve 1.42, défaut documenté MapLibre), vitesse modulée par la distance
 * réelle (haversine) et bornée [0.8, base] — F1 mesuré : un bonus de vitesse
 * sur les longues distances inversait la perception (vol Pacifique 1 063 ms
 * < vol Atlantique 1 580 ms) ; la distance RALENTIT donc légèrement le vol
 * (plafond `maxDuration` 8 s), `minZoom` 2 pour laisser respirer l'arc de
 * décollage, `essential: true` (vol informatif, jamais annulé par un geste
 * pendant l'animation). Mobile : curseur de base réduit (écran plus petit
 * ⇒ sensation plus rapide à vitesse égale).
 */
export function computeCountryFlight(
  from: { center: [number, number]; zoom: number },
  to: { center: [number, number]; zoom: number },
  options: { isMobile?: boolean } = {}
): CountryFlight {
  const distanceKm = haversineKm(from.center, to.center);
  const base = options.isMobile ? 1.0 : 1.2;
  const reach = Math.min(distanceKm / 12000, 1);
  const speed = Math.max(0.8, base - (base - 0.8) * reach);
  return {
    curve: 1.42,
    speed: Number(speed.toFixed(2)),
    maxDuration: 8000,
    minZoom: 2,
    essential: true,
  };
}
