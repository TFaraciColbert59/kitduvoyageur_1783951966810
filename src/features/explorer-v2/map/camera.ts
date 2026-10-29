import type { Map as MapLibreMap, LngLatBoundsLike } from 'maplibre-gl';
import type { Level } from '../state/types';

/**
 * Chorégraphie caméra de l'Explorer v2 (04_CARTE.md §3).
 *
 * Six mouvements, tous interrompus par le premier geste utilisateur (`movestart`
 * d'origine utilisateur géré par MapLibre : tout `flyTo`/`easeTo` en cours est
 * annulé dès que le doigt touche la carte).
 *
 * Avec `prefers-reduced-motion` : `jumpTo` immédiat, aucune trajectoire.
 * Le `padding` intègre toujours la hauteur du tiroir et de l'Island.
 */

export const LEVEL_ZOOM: Record<Level, number> = { 0: 1.6, 1: 4.8, 2: 7.2, 3: 12 };

export const FLY_DURATION_MS = 1300;
export const REVEAL_EASE_MS = 1800;
export const FOLLOW_EASE_MS = 900;
export const OVERVIEW_MS = 900;
export const ORBIT_TURN_S = 40;

export interface CameraPadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Marge haute qui place l'utilisateur au tiers bas de l'écran en suivi. */
export function followPadding(viewportHeight: number, sheetHeight: number): CameraPadding {
  return {
    top: Math.round(viewportHeight * 0.62),
    bottom: Math.round(sheetHeight) + 16,
    left: 24,
    right: 24,
  };
}

/** Marge qui laisse le tracé entièrement visible au-dessus du tiroir. */
export function overviewPadding(viewportWidth: number, sheetHeight: number): CameraPadding {
  return {
    top: 96,
    bottom: Math.round(sheetHeight) + 24,
    left: 24,
    right: Math.max(24, Math.round(viewportWidth * 0.06)),
  };
}

/** Zoom de suivi selon la vitesse de déplacement (m/s). */
export function followZoomForSpeed(speedMs: number, level: Level): number {
  if (level !== 3) return LEVEL_ZOOM[level];
  if (speedMs < 1.2) return 15;
  if (speedMs < 2.6) return 15.5;
  if (speedMs < 5.5) return 15;
  if (speedMs < 9) return 14.8;
  return 14.2;
}

/** Plongée entre niveaux : centre = point touché, zoom du niveau. */
export function flyToLevel(
  map: MapLibreMap,
  center: [number, number],
  level: Level,
  reducedMotion: boolean,
): void {
  const options = {
    center,
    zoom: LEVEL_ZOOM[level],
    pitch: level >= 3 ? 45 : 0,
    duration: reducedMotion ? 0 : FLY_DURATION_MS,
    curve: 0.65,
    essential: true,
  };
  map.flyTo(options);
}

/**
 * Révélation (refuge, eau, danger, ami, bivouac, belvédère, accès) :
 * saut serré (zoom +1,7, pitch 0) puis inclinaison douce à 45°.
 */
export function revealAt(
  map: MapLibreMap,
  center: [number, number],
  reducedMotion: boolean,
): void {
  const current = map.getZoom();
  map.jumpTo({ center, zoom: Math.min(17.5, current + 1.7), pitch: 0 });
  if (reducedMotion) return;
  map.easeTo({ pitch: 45, duration: REVEAL_EASE_MS, essential: true });
}

/** Suivi : cap en haut, pitch 60, zoom selon la vitesse, utilisateur au tiers bas. */
export function followAt(
  map: MapLibreMap,
  position: [number, number],
  headingDeg: number,
  speedMs: number,
  padding: CameraPadding,
  reducedMotion: boolean,
): void {
  map.easeTo({
    center: position,
    bearing: Number.isFinite(headingDeg) ? headingDeg : map.getBearing(),
    pitch: 60,
    zoom: followZoomForSpeed(speedMs, 3),
    padding,
    duration: reducedMotion ? 0 : FOLLOW_EASE_MS,
    essential: true,
  });
}

/** Vue d'ensemble : `fitBounds` sur la trace, pitch 0. */
export function overviewOf(
  map: MapLibreMap,
  bounds: LngLatBoundsLike | null,
  padding: CameraPadding,
  reducedMotion: boolean,
): void {
  if (!bounds) return;
  map.fitBounds(bounds, {
    padding,
    pitch: 0,
    bearing: 0,
    duration: reducedMotion ? 0 : OVERVIEW_MS,
    essential: true,
  });
}

/** Emprise [[ouest, sud], [est, nord]] d'une trace GeoJSON. */
export function boundsOfTrack(geometry: unknown): [[number, number], [number, number]] | null {
  const coordinates = (geometry as { coordinates?: unknown } | null)?.coordinates;
  if (!coordinates) return null;
  let w = 180;
  let s = 90;
  let e = -180;
  let n = -90;
  const walk = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      const [x, y] = value as [number, number];
      w = Math.min(w, x);
      e = Math.max(e, x);
      s = Math.min(s, y);
      n = Math.max(n, y);
      return;
    }
    for (const child of value) walk(child);
  };
  walk(coordinates);
  if (w === 180) return null;
  return [
    [w, s],
    [e, n],
  ];
}

/**
 * Survol de trace : la caméra parcourt la trace lissée sur ~200 m, regard
 * 300 m devant, pitch 55°. Durée proportionnelle à la distance, plafonnée à 20 s.
 */
export function flyoverTrack(
  map: MapLibreMap,
  points: Array<[number, number]>,
  reducedMotion: boolean,
  onProgress?: (index: number) => void,
): () => void {
  if (points.length < 2 || reducedMotion) {
    if (points.length >= 2) {
      map.jumpTo({ center: points[0], pitch: 55 });
    }
    return () => undefined;
  }

  const STEP_MS = 260;
  const maxDuration = 20_000;
  const total = Math.min(maxDuration, Math.max(3_000, points.length * STEP_MS));
  const stepMs = total / points.length;
  let index = 0;
  let cancelled = false;

  const tick = () => {
    if (cancelled) return;
    const point = points[index];
    const ahead = points[Math.min(points.length - 1, index + 3)] ?? point;
    const bearing = (Math.atan2(ahead[0] - point[0], ahead[1] - point[1]) * 180) / Math.PI;
    map.easeTo({
      center: point,
      bearing: Number.isFinite(bearing) ? bearing : 0,
      pitch: 55,
      zoom: 14.5,
      duration: stepMs,
      essential: false,
    });
    onProgress?.(index);
    index += 1;
    if (index >= points.length) {
      cancelled = true;
      return;
    }
    timer = window.setTimeout(tick, stepMs);
  };

  let timer = window.setTimeout(tick, 0);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}

/** Orbite de sommet : 360° en 40 s, pause au toucher, reprise après 6 s. */
export function orbitController(map: MapLibreMap, enabled: boolean): () => void {
  if (!enabled) return () => undefined;
  let bearing = map.getBearing();
  let paused = false;
  let resumeTimer: number | null = null;

  const interval = window.setInterval(() => {
    if (paused) return;
    bearing += (360 / ORBIT_TURN_S) * 0.1;
    map.rotateTo(bearing, { duration: 100 });
  }, 100);

  const onUserMove = (event: { originalEvent?: unknown }) => {
    if (!event.originalEvent) return;
    paused = true;
    if (resumeTimer) window.clearTimeout(resumeTimer);
    resumeTimer = window.setTimeout(() => {
      paused = false;
    }, 6000);
  };

  map.on('movestart', onUserMove as never);

  return () => {
    window.clearInterval(interval);
    if (resumeTimer) window.clearTimeout(resumeTimer);
    map.off('movestart', onUserMove as never);
  };
}
