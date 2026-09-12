import type { Map as MapLibreMap } from 'maplibre-gl';

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
