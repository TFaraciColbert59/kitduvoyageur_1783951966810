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

/** Hauteur minimale de sécurité (mètres) entre l'œil caméra / rayon de visée et le sol 3D. */
const MIN_CAMERA_TERRAIN_CLEARANCE_M = 130;

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
 * Adapte l'inclinaison 3D à la pente réelle sans jamais dépasser l'enveloppe anti-collision
 * (`[34°, CLUB_MAX_PITCH = 56°]`).
 */
export function calculateDynamicPitch(basePitch: number, slopePct: number): number {
  const safeSlope = Number.isFinite(slopePct) ? slopePct : 0;
  const safeBase = Math.min(CLUB_MAX_PITCH, Number.isFinite(basePitch) ? basePitch : 46);
  if (safeSlope > 0) {
    return Math.min(CLUB_MAX_PITCH, safeBase + Math.min(8, safeSlope * 0.28));
  }
  return Math.max(34, safeBase - Math.min(12, Math.abs(safeSlope) * 0.28));
}

function offsetLngLatMeters(
  lng: number,
  lat: number,
  bearingDeg: number,
  distanceM: number,
): [number, number] {
  const rad = (bearingDeg * Math.PI) / 180;
  const dNorth = Math.cos(rad) * distanceM;
  const dEast = Math.sin(rad) * distanceM;
  const dLat = dNorth / 111_320;
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const dLng = dEast / (111_320 * cosLat);
  return [lng + dLng, lat + dLat];
}

function queryTerrainMeters(map: MapLibreMap, lng: number, lat: number): number | null {
  if (typeof map.queryTerrainElevation !== 'function') return null;
  try {
    const val = map.queryTerrainElevation([lng, lat]);
    return typeof val === 'number' && Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

function getViewportHeightPx(map: MapLibreMap): number {
  try {
    const h = map.getContainer?.()?.clientHeight;
    return typeof h === 'number' && h > 40 ? h : 420;
  } catch {
    return 420;
  }
}

/**
 * Estime la hauteur verticale de la caméra au-dessus de son point cible et son recul horizontal
 * en tenant compte de la hauteur réelle du conteneur (en bande basse 250px, la caméra MapLibre est
 * proportionnellement plus proche du sol qu'en plein écran 760px au même niveau de zoom).
 */
function estimateCameraRigMeters(
  lat: number,
  zoom: number,
  pitchDeg: number,
  viewportHeightPx = 420,
): {
  eyeRiseM: number;
  groundBackM: number;
} {
  const clampedZoom = Math.max(2, Math.min(17, zoom));
  const clampedPitch = Math.max(0, Math.min(CLUB_MAX_PITCH, pitchDeg));
  const metersPerTile = (40_075_016.686 * Math.max(0.2, Math.cos((lat * Math.PI) / 180))) / Math.pow(2, clampedZoom);
  const heightScale = Math.max(0.42, Math.min(1.5, viewportHeightPx / 520));
  const slantDistM = metersPerTile * 1.32 * heightScale;
  const pitchRad = (clampedPitch * Math.PI) / 180;
  return {
    eyeRiseM: Math.max(80, slantDistM * Math.cos(pitchRad)),
    groundBackM: slantDistM * Math.sin(pitchRad),
  };
}

/**
 * Mesure l'intrusion maximale du relief physique dans le cône de visée caméra -> cible
 * ainsi que sur les bords latéraux du plan proche (near-plane frustum ±26°).
 */
function measureRayTerrainIntrusionM(
  map: MapLibreMap,
  targetLngLat: [number, number],
  targetEleM: number,
  zoom: number,
  pitchDeg: number,
  bearingDeg: number,
): number {
  const vh = getViewportHeightPx(map);
  const { eyeRiseM, groundBackM } = estimateCameraRigMeters(targetLngLat[1], zoom, pitchDeg, vh);
  if (groundBackM < 25) return 0;
  const camAzimuth = (bearingDeg + 180) % 360;
  let worstIntrusion = 0;
  const steps = [0.3, 0.6, 0.85, 1.0];
  for (const frac of steps) {
    const azimuths = frac >= 0.85 ? [camAzimuth, (camAzimuth + 26) % 360, (camAzimuth + 334) % 360] : [camAzimuth];
    for (const az of azimuths) {
      const [sLng, sLat] = offsetLngLatMeters(
        targetLngLat[0],
        targetLngLat[1],
        az,
        groundBackM * frac,
      );
      const groundEle = queryTerrainMeters(map, sLng, sLat);
      if (groundEle === null) continue;
      const rayEle = targetEleM + eyeRiseM * frac;
      const requiredEle = groundEle + MIN_CAMERA_TERRAIN_CLEARANCE_M * (0.5 + 0.55 * frac);
      const intrusion = requiredEle - rayEle;
      if (intrusion > worstIntrusion) {
        worstIntrusion = intrusion;
      }
    }
  }
  return worstIntrusion;
}

/**
 * Résout une pose caméra garantie sans collision physique avec le relief 3D :
 * - pivote automatiquement vers le versant ouvert (vallée dégagée) si une paroi bloque l'arrière de la caméra ;
 * - relève l'angle (`pitch`) et ajuste le `zoom` si le point est au fond d'un cirque encaissé.
 */
export function resolveCollisionFreeCamera(
  map: MapLibreMap,
  pose: ScenicCameraPose,
  fallbackTargetEleM = 1600,
): ScenicCameraPose {
  const safeZoom = Math.min(14.2, Math.max(1.5, pose.zoom));
  const safePitch = Math.min(CLUB_MAX_PITCH, Math.max(0, pose.pitch));
  const basePose: ScenicCameraPose = {
    center: pose.center,
    zoom: Number(safeZoom.toFixed(2)),
    pitch: Math.round(safePitch),
    bearing: Math.round(((pose.bearing % 360) + 360) % 360),
  };

  const queriedTarget = queryTerrainMeters(map, basePose.center[0], basePose.center[1]);
  if (queriedTarget === null) {
    return basePose;
  }
  const targetEle = Math.max(0, queriedTarget || fallbackTargetEleM);

  const initialIntrusion = measureRayTerrainIntrusionM(
    map,
    basePose.center,
    targetEle,
    basePose.zoom,
    basePose.pitch,
    basePose.bearing,
  );
  if (initialIntrusion <= 0) {
    return basePose;
  }

  // 1. Cherche l'azimut le plus dégagé (vallée ouverte) autour de l'axe demandé
  const candidateOffsets = [0, -35, 35, -70, 70, -110, 110, -145, 145, 180];
  let bestBearing = basePose.bearing;
  let bestIntrusion = initialIntrusion;

  for (const delta of candidateOffsets) {
    const candidateBearing = (((basePose.bearing + delta) % 360) + 360) % 360;
    const intr = measureRayTerrainIntrusionM(
      map,
      basePose.center,
      targetEle,
      basePose.zoom,
      basePose.pitch,
      candidateBearing,
    );
    if (intr < bestIntrusion) {
      bestIntrusion = intr;
      bestBearing = candidateBearing;
      if (bestIntrusion <= 0) break;
    }
  }

  // 2. Si le cirque reste encaissé, abaisse le pitch (vue plus plongeante) et élargit légèrement le zoom
  let resolvedPitch = basePose.pitch;
  let resolvedZoom = basePose.zoom;
  let guard = 0;
  while (bestIntrusion > 0 && guard < 6) {
    guard += 1;
    resolvedPitch = Math.max(26, resolvedPitch - 6);
    if (guard >= 3) {
      resolvedZoom = Math.max(11.2, resolvedZoom - 0.35);
    }
    bestIntrusion = measureRayTerrainIntrusionM(
      map,
      basePose.center,
      targetEle,
      resolvedZoom,
      resolvedPitch,
      bestBearing,
    );
  }

  return {
    center: basePose.center,
    zoom: Number(resolvedZoom.toFixed(2)),
    pitch: Math.round(resolvedPitch),
    bearing: Math.round(bestBearing),
  };
}

/**
 * Garde-fou temps réel pendant les zooms / déplacements manuels : empêche la caméra
 * de passer sous le maillage DEM ou à travers une falaise en relevant doucement le pitch.
 */
export function enforceCameraTerrainClearance(map: MapLibreMap): void {
  if (typeof map.getZoom !== 'function' || typeof map.getPitch !== 'function') return;
  const zoom = map.getZoom();
  const pitch = map.getPitch();
  if (zoom < 9.5 || pitch <= 28) return;

  const center = map.getCenter?.();
  if (!center) return;
  const centerEle = queryTerrainMeters(map, center.lng, center.lat);
  if (centerEle === null) return;

  const bearing = map.getBearing?.() ?? 0;
  const intrusion = measureRayTerrainIntrusionM(
    map,
    [center.lng, center.lat],
    centerEle,
    zoom,
    pitch,
    bearing,
  );

  if (intrusion > 25) {
    const nextPitch = Math.max(26, pitch - Math.min(10, Math.ceil(intrusion / 35) * 3));
    if (nextPitch < pitch - 0.5) {
      try {
        map.setPitch?.(nextPitch);
      } catch {
        /* ignore */
      }
    }
  }
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
    ? -18
    : Math.round(calculateBearing(startLat, startLng, peakLat, peakLng));

  const center: [number, number] = [
    Number((startLng * 0.45 + peakLng * 0.55).toFixed(5)),
    Number((startLat * 0.45 + peakLat * 0.55).toFixed(5)),
  ];

  const [west, south, east, north] = outing.bounds;
  const diagM = haversineM([west, south], [east, north]);
  const baseZoom =
    !Number.isFinite(diagM) || diagM <= 1500
      ? 13.3
      : diagM < 4500
        ? 12.8
        : diagM < 10_000
          ? 12.2
          : diagM < 20_000
            ? 11.6
            : 11.1;
  const zoom = options.isFullscreen ? Math.min(13.8, baseZoom + 0.3) : baseZoom;

  return {
    center,
    zoom: Number(zoom.toFixed(2)),
    pitch: 46,
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
    zoom: 6.2,
    pitch: 24,
    bearing: 0,
    curve: 1.85,
    speed: 1.25,
    duration: reduced ? 0 : 1150,
    essential: true,
  });
}

export function flyToMassifCamera(
  map: MapLibreMap,
  center: [number, number],
): void {
  const reduced = prefersReducedMotion();
  const safePose = resolveCollisionFreeCamera(map, {
    center,
    zoom: 10.2,
    pitch: 44,
    bearing: -14,
  });
  map.flyTo({
    center: safePose.center,
    zoom: safePose.zoom,
    pitch: safePose.pitch,
    bearing: safePose.bearing,
    curve: 1.88,
    speed: 1.25,
    duration: reduced ? 0 : 1100,
    essential: true,
  });
}

export function flyToOutingCamera(
  map: MapLibreMap,
  outing: ClubMapOutingTrack,
  options: { isFullscreen?: boolean } = {},
): ScenicCameraPose {
  const rawPose = computeScenicOutingCamera(outing, options);
  const pose = resolveCollisionFreeCamera(map, rawPose, outing.maxAlt || 2000);
  const reduced = prefersReducedMotion();
  // Courbe parabolique haute (1.92) : la caméra s'élève toujours au-dessus des sommets avant de redescendre
  map.flyTo({
    center: pose.center,
    zoom: pose.zoom,
    pitch: pose.pitch,
    bearing: pose.bearing,
    curve: 1.92,
    speed: 1.28,
    duration: reduced ? 0 : 1200,
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
  const currentBearing = typeof map.getBearing === 'function' ? map.getBearing() : -14;
  const safePose = resolveCollisionFreeCamera(map, {
    center: lngLat,
    zoom: 13.6,
    pitch: 45,
    bearing: bearing ?? currentBearing,
  });
  map.flyTo({
    center: safePose.center,
    zoom: safePose.zoom,
    pitch: safePose.pitch,
    bearing: safePose.bearing,
    curve: 1.9,
    speed: 1.3,
    duration: reduced ? 0 : 950,
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

/**
 * Échantillonne une position lissée sur la trace (fenêtre glissante gaussienne)
 * afin que la caméra drone survole les lacets sans jamais osciller gauche-droite.
 */
function sampleSmoothedTrackPoint(coords: ClubTrackCoord[], progress: number): [number, number, number] {
  const offsets = [-0.06, -0.03, 0, 0.03, 0.06];
  const weights = [0.12, 0.23, 0.3, 0.23, 0.12];
  let lng = 0;
  let lat = 0;
  let ele = 0;
  for (let i = 0; i < offsets.length; i += 1) {
    const p = snapPointAlongTrack(coords, Math.max(0, Math.min(1, progress + offsets[i])));
    lng += p[0] * weights[i];
    lat += p[1] * weights[i];
    ele += (p[2] ?? 0) * weights[i];
  }
  return [lng, lat, ele];
}

/**
 * Calcule la tangente lissée de la ligne de crête/vallée sans couper les sommets en boucle.
 */
function computeMacroDroneBearing(
  coords: ClubTrackCoord[],
  progress: number,
  fallbackBearing: number,
): number {
  const backP = sampleSmoothedTrackPoint(coords, Math.max(0, progress - 0.025));
  const aheadP = sampleSmoothedTrackPoint(coords, Math.min(1, progress + 0.075));
  const distM = haversineM([backP[0], backP[1]], [aheadP[0], aheadP[1]]);
  if (!Number.isFinite(distM) || distM < 20) {
    return fallbackBearing;
  }
  return calculateBearing(backP[1], backP[0], aheadP[1], aheadP[0]);
}

function clampAngleDeltaDeg(current: number, target: number, maxStepDeg: number): number {
  const diff = ((((target - current) % 360) + 540) % 360) - 180;
  const clamped = Math.max(-maxStepDeg, Math.min(maxStepDeg, diff));
  return (((current + clamped) % 360) + 360) % 360;
}

function computeDroneViewportPadding(map: MapLibreMap): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  const vh = getViewportHeightPx(map);
  const isCompact = vh < 380;
  if (isCompact) {
    // En 3D avec relief alpin (2000–3800 m), le sommet projeté monte au-dessus du centre niveau mer :
    // un top padding plus grand abaisse le centre niveau mer pour garder la bille bien centrée dans la fenêtre.
    const top = Math.min(130, Math.round(vh * 0.42));
    const maxBottom = Math.max(0, vh - top - 56);
    const bottom = Math.min(maxBottom, Math.max(24, Math.round(vh * 0.12)));
    return { top, bottom, left: 14, right: 46 };
  }
  const top = 64;
  const maxBottom = Math.max(0, vh - top - 96);
  const bottom = Math.min(maxBottom, 148);
  return { top, bottom, left: 20, right: 52 };
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
 * Survol Drone 3D cinématique (style hélicoptère stabilisé) :
 * - Transition d'approche douce (lead-in 0.85s) depuis la caméra actuelle sans saut brusque ;
 * - Trajectoire caméra filtrée (zéro secousse dans les lacets) + cap macro-horizon ;
 * - Élévation verticale continue au-dessus des crêtes (sans retournement d'azimut brutal) ;
 * - Bille dorée mise à jour directement en WebGL à 60 fps sans saturer React.
 */
export function startClubDroneFlyover(options: DroneFlyoverOptions): () => void {
  const {
    map,
    outing,
    startProgress = 0,
    onProgress,
    onStop,
  } = options;

  const coords = outing.coords;
  if (coords.length < 2) {
    onStop?.('finished');
    return () => undefined;
  }

  if (prefersReducedMotion()) {
    const pose = flyToOutingCamera(map, outing, { isFullscreen: false });
    const mid = snapPointAlongTrack(coords, 0.5);
    const slope = computeTrackSlopeAt(coords, 0.5);
    onProgress?.(0.5, mid, slope);
    void pose;
    onStop?.('reduced-motion');
    return () => undefined;
  }

  // Stoppe toute animation MapLibre en cours (flyTo précédent) pour éviter tout conflit
  try {
    map.stop?.();
  } catch {
    /* ignore */
  }

  let progress = startProgress >= 0.95 || startProgress < 0 ? 0 : startProgress;

  // Pose de départ réelle de la carte pour un fondu d'entrée cinématique sans téléportation
  const originCenter = map.getCenter?.() ?? { lng: coords[0][0], lat: coords[0][1] };
  const originZoom = typeof map.getZoom === 'function' ? map.getZoom() : 11.8;
  const originPitch = typeof map.getPitch === 'function' ? map.getPitch() : 42;
  const originBearing = typeof map.getBearing === 'function' ? map.getBearing() : -14;

  const startRigPos = sampleSmoothedTrackPoint(coords, Math.min(1, progress + 0.03));
  let smoothBearing = computeMacroDroneBearing(coords, progress, originBearing);
  const isCompactViewport = getViewportHeightPx(map) < 380;
  const baseDronePitch = isCompactViewport ? 31 : 44;
  let smoothPitch = baseDronePitch;
  const rawCruiseZoom = computeScenicOutingCamera(outing).zoom + (isCompactViewport ? -0.95 : 0.28);
  const cruiseZoom = Math.min(isCompactViewport ? 11.6 : 13.15, Math.max(isCompactViewport ? 10.5 : 11.6, rawCruiseZoom));
  const initialStartEle = queryTerrainMeters(map, startRigPos[0], startRigPos[1]) ?? startRigPos[2];
  const initialStartIntr = measureRayTerrainIntrusionM(
    map,
    [startRigPos[0], startRigPos[1]],
    initialStartEle,
    cruiseZoom,
    baseDronePitch,
    smoothBearing,
  );
  const leadInTargetPitch =
    initialStartIntr > 0 ? Math.max(26, baseDronePitch - Math.min(12, initialStartIntr / 22)) : baseDronePitch;
  const leadInTargetZoom =
    initialStartIntr > 80 ? Math.max(10.5, cruiseZoom - Math.min(0.5, (initialStartIntr - 80) / 300)) : cruiseZoom;
  smoothPitch = leadInTargetPitch;
  let smoothZoom = leadInTargetZoom;

  let rigLng = startRigPos[0];
  let rigLat = startRigPos[1];

  const leadInDistM = haversineM([originCenter.lng, originCenter.lat], [startRigPos[0], startRigPos[1]]);
  const isLongLeadIn = Number.isFinite(leadInDistM) && leadInDistM > 5_000;
  const leadInDurationSec = isLongLeadIn ? 1.15 : 0.75;
  let elapsedLeadInSec = 0;
  const flightDurationSec = Math.max(16, Math.min(26, (outing.km || 14) * 1.15));

  let rafId = 0;
  let lastTime = performance.now();
  let stopped = false;

  const canvas = map.getCanvas();

  const updateOrbDirect = (orbPt: [number, number, number]) => {
    try {
      const orbSrc = map.getSource?.('club-scrubber-orb') as
        | { setData?: (d: unknown) => void }
        | undefined;
      orbSrc?.setData?.({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [orbPt[0], orbPt[1]] },
          },
        ],
      });
    } catch {
      /* ignore */
    }
  };

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

    // Phase 1 : Approche hélicoptère douce vers le point de départ du survol
    if (elapsedLeadInSec < leadInDurationSec) {
      elapsedLeadInSec = Math.min(leadInDurationSec, elapsedLeadInSec + dt);
      const u = elapsedLeadInSec / leadInDurationSec;
      const ease = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;

      const curLng = lerp(originCenter.lng, startRigPos[0], ease);
      const curLat = lerp(originCenter.lat, startRigPos[1], ease);
      // Arc parabolique en cas d'approche longue pour passer largement au-dessus des massifs intermédiaires
      const arcDip = isLongLeadIn ? Math.sin(Math.PI * ease) * 1.4 : 0;
      const curZoom = lerp(originZoom, leadInTargetZoom, ease) - arcDip;
      const curPitch = lerp(originPitch, leadInTargetPitch, ease) - (isLongLeadIn ? Math.sin(Math.PI * ease) * 10 : 0);
      const curBearing = lerpAngleDeg(originBearing, smoothBearing, ease);

      try {
        map.jumpTo({
          center: [curLng, curLat],
          zoom: curZoom,
          pitch: curPitch,
          bearing: curBearing,
          padding: computeDroneViewportPadding(map),
        });
      } catch {
        stop('user');
        return;
      }

      const orbPt = snapPointAlongTrack(coords, progress);
      updateOrbDirect(orbPt);
      onProgress?.(progress, orbPt, computeTrackSlopeAt(coords, progress));
      rafId = requestAnimationFrame(tick);
      return;
    }

    // Phase 2 : Survol continu stabilisé le long du tracé (recentré sur la bille en vue repliée)
    const compactNow = getViewportHeightPx(map) < 380;
    progress = Math.min(1, progress + dt / flightDurationSec);
    const exactOrbPos = snapPointAlongTrack(coords, progress);
    const smoothedAhead = sampleSmoothedTrackPoint(coords, Math.min(1, progress + 0.035));
    const aheadWeight = compactNow ? 0.22 : 0.65;
    const smoothedRigTarget: [number, number, number] = [
      lerp(exactOrbPos[0], smoothedAhead[0], aheadWeight),
      lerp(exactOrbPos[1], smoothedAhead[1], aheadWeight),
      smoothedAhead[2],
    ];
    const slopePct = computeTrackSlopeAt(coords, progress);

    const desiredBearing = computeMacroDroneBearing(coords, progress, smoothBearing);
    // Vitesse angulaire plafonnée (~34°/s max) pour négocier les cols en boucle avec fluidité
    const rateLimitedBearing = clampAngleDeltaDeg(smoothBearing, desiredBearing, 34 * dt);
    smoothBearing = lerpAngleDeg(smoothBearing, rateLimitedBearing, 1 - Math.exp(-3.6 * dt));

    const scenicCruiseZoom = computeScenicOutingCamera(outing).zoom + (compactNow ? -0.95 : 0.28);
    const activeCruiseZoom = Math.min(
      compactNow ? 11.6 : 13.15,
      Math.max(compactNow ? 10.5 : 11.6, scenicCruiseZoom),
    );
    const basePitch = compactNow
      ? Math.min(35, calculateDynamicPitch(31, slopePct * 0.28))
      : calculateDynamicPitch(44, slopePct * 0.45);
    const centerEle =
      queryTerrainMeters(map, smoothedRigTarget[0], smoothedRigTarget[1]) ??
      (smoothedRigTarget[2] || outing.maxAlt);
    const intr = measureRayTerrainIntrusionM(
      map,
      [smoothedRigTarget[0], smoothedRigTarget[1]],
      centerEle,
      smoothZoom,
      basePitch,
      smoothBearing,
    );

    // Dégagement vertical doux (aucun retournement d'azimut brusque ni rognage near-plane !)
    const targetPitch = intr > 0 ? Math.max(24, basePitch - Math.min(16, intr / 18)) : basePitch;
    const targetZoom =
      intr > 60
        ? Math.max(compactNow ? 10.2 : 11.4, activeCruiseZoom - Math.min(0.85, intr / 280))
        : activeCruiseZoom;

    const posAlpha = 1 - Math.exp(-5.5 * dt);
    const pitchAlpha = 1 - Math.exp(-2.4 * dt);
    const zoomAlpha = 1 - Math.exp(-2.0 * dt);

    rigLng = lerp(rigLng, smoothedRigTarget[0], posAlpha);
    rigLat = lerp(rigLat, smoothedRigTarget[1], posAlpha);
    smoothPitch = lerp(smoothPitch, targetPitch, pitchAlpha);
    smoothZoom = lerp(smoothZoom, targetZoom, zoomAlpha);

    try {
      map.jumpTo({
        center: [rigLng, rigLat],
        zoom: smoothZoom,
        pitch: smoothPitch,
        bearing: smoothBearing,
        padding: computeDroneViewportPadding(map),
      });
    } catch {
      stop('user');
      return;
    }

    updateOrbDirect(exactOrbPos);
    onProgress?.(progress, exactOrbPos, slopePct);

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
 * Mode Table d'Orientation 360° au Sommet : positionne la caméra au-dessus du point culminant
 * à hauteur dégagée (`pitch <= 52°`) sans jamais intersecter les arêtes voisines.
 */
export function startSummit360Panorama(options: Summit360Options): () => void {
  const { map, peak, onBearingChange, onStop } = options;
  const reduced = prefersReducedMotion();
  const safeInitial = resolveCollisionFreeCamera(
    map,
    {
      center: [peak[0], peak[1]],
      zoom: 13.1,
      pitch: Math.min(50, CLUB_MAX_PITCH),
      bearing: typeof map.getBearing === 'function' ? map.getBearing() : 0,
    },
    peak[2],
  );

  map.flyTo({
    center: safeInitial.center,
    zoom: safeInitial.zoom,
    pitch: safeInitial.pitch,
    bearing: safeInitial.bearing,
    curve: 1.85,
    duration: reduced ? 0 : 1050,
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
  let currentPitch = safeInitial.pitch;
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
    const nextBearing = (map.getBearing() + dt * 9.0 + 360) % 360;
    const centerEle = queryTerrainMeters(map, peak[0], peak[1]) ?? peak[2];
    const intr = measureRayTerrainIntrusionM(
      map,
      [peak[0], peak[1]],
      centerEle,
      13.1,
      50,
      nextBearing,
    );
    const targetPitch = intr > 0 ? Math.max(32, 50 - Math.min(18, intr / 18)) : 50;
    currentPitch = lerp(currentPitch, targetPitch, 1 - Math.exp(-4.5 * dt));

    try {
      map.jumpTo({
        center: [peak[0], peak[1]],
        zoom: 13.1,
        pitch: currentPitch,
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
  }, 1100);

  return () => stop();
}
