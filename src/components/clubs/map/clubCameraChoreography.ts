import type { Map as MapLibreMap } from 'maplibre-gl';
import { prefersReducedMotion } from '@/components/map/engine/camera';
import { haversineM } from '@/features/explorer-v2/geo/track';
import type { ClubMapOutingTrack, ClubTrackCoord } from './clubMapTypes';
import { snapPointAlongTrack } from './clubTrackGeometry';
import { CLUB_MAX_PITCH } from './createClub3DStyle';

export interface ScenicCameraPose {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface AlpineReferencePeak {
  id: string;
  name: string;
  alt: number;
  lng: number;
  lat: number;
}

export interface NearbyAlpinePeak extends AlpineReferencePeak {
  distanceKm: number;
  bearing: number;
}

export const ALPINE_REFERENCE_PEAKS: AlpineReferencePeak[] = [
  { id: 'mont-blanc', name: 'Mont-Blanc', alt: 4806, lng: 6.8652, lat: 45.8326 },
  { id: 'aiguille-verte', name: 'Aiguille Verte', alt: 4122, lng: 6.97, lat: 45.9347 },
  { id: 'grande-casse', name: 'Grande Casse', alt: 3855, lng: 6.8272, lat: 45.4058 },
  { id: 'barre-ecrins', name: 'Barre des Écrins', alt: 4102, lng: 6.36, lat: 44.9225 },
  { id: 'la-meije', name: 'La Meije', alt: 3983, lng: 6.3086, lat: 45.0047 },
  { id: 'grand-veymont', name: 'Grand Veymont', alt: 2341, lng: 5.5269, lat: 44.8697 },
  { id: 'mont-aiguille', name: 'Mont Aiguille', alt: 2087, lng: 5.5528, lat: 44.8414 },
  { id: 'croix-belledonne', name: 'Croix de Belledonne', alt: 2926, lng: 5.9875, lat: 45.1694 },
  { id: 'chamechaude', name: 'Chamechaude', alt: 2082, lng: 5.7897, lat: 45.2878 },
  { id: 'pic-de-bure', name: 'Pic de Bure', alt: 2709, lng: 5.9353, lat: 44.6267 },
  { id: 'mont-viso', name: 'Mont Viso', alt: 3841, lng: 7.0906, lat: 44.6675 },
  { id: 'cervin', name: 'Cervin', alt: 4478, lng: 7.6586, lat: 45.9766 },
  { id: 'mont-ventoux', name: 'Mont Ventoux', alt: 1910, lng: 5.2786, lat: 44.174 },
  { id: 'canigou', name: 'Pic du Canigou', alt: 2784, lng: 2.4567, lat: 42.5189 },
];

export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(rLat2);
  const x =
    Math.cos(rLat1) * Math.sin(rLat2) -
    Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);
  if (y === 0 && x === 0) return 0;
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

export function lerp(start: number, end: number, amt: number): number {
  const t = Math.max(0, Math.min(1, amt));
  return (1 - t) * start + t * end;
}

/**
 * Interpolation d'angle par le chemin le plus court autour de ±180° / 0°–360°.
 */
export function lerpAngleDeg(start: number, end: number, amt: number): number {
  const t = Math.max(0, Math.min(1, amt));
  const diff = ((((end - start) % 360) + 540) % 360) - 180;
  return (((start + diff * t) % 360) + 360) % 360;
}

/**
 * Adapte l'inclinaison 3D à la pente réelle (monte le regard en montée raide,
 * ouvre le panorama en descente), bornée dans [44°, maxPitch 76°].
 */
export function calculateDynamicPitch(basePitch: number, slopePct: number): number {
  const safeSlope = Number.isFinite(slopePct) ? slopePct : 0;
  const safeBase = Number.isFinite(basePitch) ? basePitch : 64;
  if (safeSlope > 0) {
    return Math.min(CLUB_MAX_PITCH, safeBase + Math.min(10, safeSlope * 0.35));
  }
  return Math.max(44, safeBase - Math.min(12, Math.abs(safeSlope) * 0.35));
}

export function computeScenicOutingCamera(
  outing: ClubMapOutingTrack,
  options: { isFullscreen?: boolean } = {},
): ScenicCameraPose {
  const [startLng, startLat] = outing.start;
  const [peakLng, peakLat] = outing.peak;
  const samePoint =
    Math.abs(startLng - peakLng) < 1e-5 && Math.abs(startLat - peakLat) < 1e-5;

  const bearing = samePoint
    ? -20
    : Math.round(calculateBearing(startLat, startLng, peakLat, peakLng));

  // Centre pondéré vers le sommet pour regarder la face gravie
  const center: [number, number] = [
    Number((startLng * 0.36 + peakLng * 0.64).toFixed(5)),
    Number((startLat * 0.36 + peakLat * 0.64).toFixed(5)),
  ];

  const [west, south, east, north] = outing.bounds;
  const diagM = haversineM([west, south], [east, north]);
  const baseZoom =
    !Number.isFinite(diagM) || diagM <= 1200
      ? 14.0
      : diagM < 4500
        ? 13.4
        : diagM < 10_000
          ? 12.7
          : diagM < 20_000
            ? 12.1
            : 11.6;
  const zoom = options.isFullscreen ? Math.min(14.5, baseZoom + 0.35) : baseZoom;

  return {
    center,
    zoom: Number(zoom.toFixed(2)),
    pitch: 56,
    bearing,
  };
}

export function flyToCountryCamera(
  map: MapLibreMap,
  center: [number, number],
): void {
  const reduced = prefersReducedMotion();
  map.flyTo({
    center,
    zoom: 5.8,
    pitch: 28,
    bearing: 0,
    curve: 1.42,
    duration: reduced ? 0 : 1400,
    essential: true,
  });
}

export function flyToMassifCamera(
  map: MapLibreMap,
  center: [number, number],
): void {
  const reduced = prefersReducedMotion();
  map.flyTo({
    center,
    zoom: 10.2,
    pitch: 54,
    bearing: -16,
    curve: 1.35,
    duration: reduced ? 0 : 1300,
    essential: true,
  });
}

export function flyToOutingCamera(
  map: MapLibreMap,
  outing: ClubMapOutingTrack,
  options: { isFullscreen?: boolean } = {},
): ScenicCameraPose {
  const pose = computeScenicOutingCamera(outing, options);
  const reduced = prefersReducedMotion();
  map.flyTo({
    center: pose.center,
    zoom: pose.zoom,
    pitch: pose.pitch,
    bearing: pose.bearing,
    curve: 1.32,
    duration: reduced ? 0 : 1450,
    essential: true,
  });
  return pose;
}

export function flyToMicroSpotCamera(
  map: MapLibreMap,
  lngLat: [number, number],
  bearing?: number,
): void {
  const reduced = prefersReducedMotion();
  map.flyTo({
    center: lngLat,
    zoom: 15.2,
    pitch: 68,
    bearing: bearing ?? map.getBearing(),
    duration: reduced ? 0 : 1050,
    essential: true,
  });
}

export function computeNearbyAlpinePeaks(
  originLng: number,
  originLat: number,
  limit = 6,
): NearbyAlpinePeak[] {
  return ALPINE_REFERENCE_PEAKS.map((peak) => {
    const distM = haversineM([originLng, originLat], [peak.lng, peak.lat]);
    const distanceKm = Number(((Number.isFinite(distM) ? distM : 0) / 1000).toFixed(1));
    const bearing = Math.round(calculateBearing(originLat, originLng, peak.lat, peak.lng));
    return { ...peak, distanceKm, bearing };
  })
    .filter((peak) => peak.distanceKm >= 0.8)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/**
 * Calcule la pente instantanée (%) autour d'une fraction `t` sur une polyligne 3D.
 */
export function computeTrackSlopeAt(coords: ClubTrackCoord[], progress: number): number {
  if (coords.length < 2) return 0;
  const clamped = Math.max(0, Math.min(1, progress));
  const scaled = clamped * (coords.length - 1);
  const i = Math.min(coords.length - 2, Math.floor(scaled));
  const a = coords[i];
  const b = coords[i + 1];
  const dist = haversineM([a[0], a[1]], [b[0], b[1]]);
  if (!Number.isFinite(dist) || dist < 1) return 0;
  const eleA = a[2] ?? 0;
  const eleB = b[2] ?? eleA;
  return ((eleB - eleA) / dist) * 100;
}

export interface DroneFlyoverOptions {
  map: MapLibreMap;
  outing: ClubMapOutingTrack;
  startProgress?: number;
  onRequestFullscreen?: (next: boolean) => void;
  onProgress?: (progress: number, pos: [number, number, number], slopePct: number) => void;
  onStop?: (reason: 'finished' | 'user' | 'reduced-motion') => void;
}

/**
 * Survol Drone 3-DOF à 60 fps : interpolation LERP/SLERP + pitch dynamique selon
 * la pente réelle, annulable immédiatement au premier pointerdown / wheel / touchstart.
 */
export function startClubDroneFlyover(options: DroneFlyoverOptions): () => void {
  const {
    map,
    outing,
    startProgress = 0,
    onRequestFullscreen,
    onProgress,
    onStop,
  } = options;

  const coords = outing.coords;
  if (coords.length < 2) {
    onStop?.('finished');
    return () => undefined;
  }

  onRequestFullscreen?.(true);

  if (prefersReducedMotion()) {
    const pose = flyToOutingCamera(map, outing, { isFullscreen: true });
    const mid = snapPointAlongTrack(coords, 0.5);
    const slope = computeTrackSlopeAt(coords, 0.5);
    onProgress?.(0.5, mid, slope);
    void pose;
    onStop?.('reduced-motion');
    return () => undefined;
  }

  let progress = Math.max(0, Math.min(0.96, startProgress));
  const initialPos = snapPointAlongTrack(coords, progress);
  const lookAhead0 = snapPointAlongTrack(coords, Math.min(1, progress + 0.05));

  let currentLng = initialPos[0];
  let currentLat = initialPos[1];
  let currentBearing = calculateBearing(initialPos[1], initialPos[0], lookAhead0[1], lookAhead0[0]);
  let currentPitch = 64;

  const baseZoom = Math.min(14.6, Math.max(13.2, computeScenicOutingCamera(outing, { isFullscreen: true }).zoom + 0.6));
  const durationSeconds = Math.max(16, Math.min(28, outing.km * 1.15));

  let rafId = 0;
  let lastTime = performance.now();
  let stopped = false;

  const canvas = map.getCanvas();

  const stop = (reason: 'finished' | 'user') => {
    if (stopped) return;
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    canvas.removeEventListener('pointerdown', onUserInterrupt);
    canvas.removeEventListener('wheel', onUserInterrupt);
    canvas.removeEventListener('touchstart', onUserInterrupt);
    onStop?.(reason);
  };

  const onUserInterrupt = () => stop('user');
  canvas.addEventListener('pointerdown', onUserInterrupt, { passive: true });
  canvas.addEventListener('wheel', onUserInterrupt, { passive: true });
  canvas.addEventListener('touchstart', onUserInterrupt, { passive: true });

  const tick = (now: number) => {
    if (stopped) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    progress = Math.min(1, progress + dt / durationSeconds);
    const targetPos = snapPointAlongTrack(coords, progress);
    const aheadPos = snapPointAlongTrack(coords, Math.min(1, progress + 0.045));
    const slopePct = computeTrackSlopeAt(coords, progress);

    const sameSpot =
      Math.abs(targetPos[0] - aheadPos[0]) < 1e-6 &&
      Math.abs(targetPos[1] - aheadPos[1]) < 1e-6;
    const targetBearing = sameSpot
      ? currentBearing
      : calculateBearing(targetPos[1], targetPos[0], aheadPos[1], aheadPos[0]);
    const targetPitch = calculateDynamicPitch(64, slopePct);

    const smoothPos = 1 - Math.exp(-8.5 * dt);
    const smoothAngle = 1 - Math.exp(-5.0 * dt);
    const smoothPitch = 1 - Math.exp(-4.5 * dt);

    currentLng = lerp(currentLng, targetPos[0], smoothPos);
    currentLat = lerp(currentLat, targetPos[1], smoothPos);
    currentBearing = lerpAngleDeg(currentBearing, targetBearing, smoothAngle);
    currentPitch = lerp(currentPitch, targetPitch, smoothPitch);

    try {
      map.jumpTo({
        center: [currentLng, currentLat],
        zoom: baseZoom,
        pitch: currentPitch,
        bearing: currentBearing,
      });
    } catch {
      stop('user');
      return;
    }

    onProgress?.(progress, [currentLng, currentLat, targetPos[2]], slopePct);

    if (progress >= 1) {
      stop('finished');
      return;
    }
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return () => stop('user');
}

export interface Summit360Options {
  map: MapLibreMap;
  peak: [number, number, number];
  onBearingChange?: (bearing: number) => void;
  onStop?: () => void;
}

/**
 * Mode Table d'Orientation 360° au Sommet : positionne la caméra au point culminant
 * à `pitch: 76°` avec rotation panoramique douce (désactivée sous `prefers-reduced-motion`).
 */
export function startSummit360Panorama(options: Summit360Options): () => void {
  const { map, peak, onBearingChange, onStop } = options;
  const reduced = prefersReducedMotion();

  map.flyTo({
    center: [peak[0], peak[1]],
    zoom: 13.7,
    pitch: CLUB_MAX_PITCH,
    bearing: map.getBearing(),
    duration: reduced ? 0 : 1200,
    essential: true,
  });

  if (reduced) {
    return () => {
      onStop?.();
    };
  }

  let stopped = false;
  let rafId = 0;
  let started = false;
  let lastTime = performance.now();
  const canvas = map.getCanvas();

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    window.clearTimeout(delayTimer);
    canvas.removeEventListener('pointerdown', onUserInterrupt);
    canvas.removeEventListener('wheel', onUserInterrupt);
    canvas.removeEventListener('touchstart', onUserInterrupt);
    onStop?.();
  };

  const onUserInterrupt = () => stop();
  canvas.addEventListener('pointerdown', onUserInterrupt, { passive: true });
  canvas.addEventListener('wheel', onUserInterrupt, { passive: true });
  canvas.addEventListener('touchstart', onUserInterrupt, { passive: true });

  const step = (now: number) => {
    if (stopped || !started) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    const nextBearing = (map.getBearing() + dt * 9.5 + 360) % 360;
    try {
      map.jumpTo({
        center: [peak[0], peak[1]],
        zoom: 13.7,
        pitch: CLUB_MAX_PITCH,
        bearing: nextBearing,
      });
      onBearingChange?.(nextBearing);
    } catch {
      stop();
      return;
    }
    rafId = requestAnimationFrame(step);
  };

  const delayTimer = window.setTimeout(() => {
    if (stopped) return;
    started = true;
    lastTime = performance.now();
    rafId = requestAnimationFrame(step);
  }, 1250);

  return () => stop();
}
