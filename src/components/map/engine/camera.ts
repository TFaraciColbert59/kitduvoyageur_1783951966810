import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * CHANTIER ATLAS — Phase 4
 * Chorégraphie caméra : uniquement les animations natives MapLibre
 * (`flyTo`/`easeTo`), courbe d'accélération native, aucune animation maison.
 * `prefers-reduced-motion` → saut immédiat (durée 0).
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
}

export function flyToTarget(map: MapLibreMap, target: FlyToTarget): void {
  const duration = animationDuration(target.duration ?? 700, prefersReducedMotion());
  map.flyTo({ center: target.center, zoom: target.zoom, duration });
}

export function easeToTarget(map: MapLibreMap, target: FlyToTarget): void {
  const duration = animationDuration(target.duration ?? 400, prefersReducedMotion());
  map.easeTo({ center: target.center, zoom: target.zoom, duration });
}
