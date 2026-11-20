/**
 * Cartographie bioénergétique du terrain, état latent du sol, crépuscule topographique MNT,
 * peuplement ODbL idempotent de `trail_segments` et segmentation fallback `positions_timed` (Lot P2).
 *
 * Respecte strictement :
 * - Zéro appel à Overpass public (`overpass-api.de`) ou Open-Meteo public (`api.open-meteo.com`).
 * - Séparation stricte ODbL 1.0 : aucune donnée utilisateur ou biométrique dans `trail_segments`
 *   ni `trail_segment_features`.
 * - Fallback `trail_segments = 0` : segmentation directe de `hike_sessions.positions_timed`
 *   avec recalage MNT (hystérésis 3 m) et surface par défaut `dirt` (`eta = 1.10`).
 */
import SunCalc from 'suncalc';
import {
  EffortSegmentInputSchema,
  PANDOLF_SNOW_MAX_ETA,
  computePandolfSnowEta,
  isSpeedInLcdaDomain,
  type Evidence,
} from '../schemas/effort.schema';
import { haversineM } from '../domain/geo';
import {
  DEFAULT_DEM_HYSTERESIS_M,
  smoothElevationWithDemHysteresis,
} from '@/features/compas/server/elevation';
import {
  assertNoForbiddenProdProvider,
  assertOdblBiometricSeparation,
  buildProviderEvidence,
} from './providerTerms';

// ─────────────────────────────────────────────────────────────────────────────
// 1. MAPPING DÉTERMINISTE OSM TAGS → FACTEUR TERRAIN η + TECHNICITÉ 1..5
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_FALLBACK_SURFACE = 'dirt';
export const DEFAULT_FALLBACK_ETA = 1.10;

const PAVED_SURFACES = new Set<string>([
  'asphalt',
  'paved',
  'concrete',
  'concrete:plates',
  'concrete:lanes',
  'paving_stones',
  'sett',
]);

/** Table de base Pandolf / Givoni-Goldman des coefficients de surface η. */
const SURFACE_BASE_ETA: Readonly<Record<string, { eta: number; canonical: string; techBase: number }>> = {
  asphalt: { eta: 1.00, canonical: 'asphalt', techBase: 1 },
  paved: { eta: 1.00, canonical: 'asphalt', techBase: 1 },
  concrete: { eta: 1.00, canonical: 'asphalt', techBase: 1 },
  'concrete:plates': { eta: 1.02, canonical: 'asphalt', techBase: 1 },
  paving_stones: { eta: 1.02, canonical: 'asphalt', techBase: 1 },
  sett: { eta: 1.05, canonical: 'compacted', techBase: 1 },
  compacted: { eta: 1.05, canonical: 'compacted', techBase: 1 },
  fine_gravel: { eta: 1.06, canonical: 'compacted', techBase: 1 },
  wood: { eta: 1.05, canonical: 'compacted', techBase: 1 },
  metal: { eta: 1.05, canonical: 'compacted', techBase: 1 },
  dirt: { eta: 1.10, canonical: 'dirt', techBase: 1 },
  earth: { eta: 1.10, canonical: 'dirt', techBase: 1 },
  ground: { eta: 1.10, canonical: 'dirt', techBase: 1 },
  trail: { eta: 1.10, canonical: 'dirt', techBase: 1 },
  unpaved: { eta: 1.10, canonical: 'dirt', techBase: 1 },
  soil: { eta: 1.10, canonical: 'dirt', techBase: 1 },
  clay: { eta: 1.20, canonical: 'dirt', techBase: 2 },
  pebblestone: { eta: 1.15, canonical: 'gravel', techBase: 2 },
  gravel: { eta: 1.15, canonical: 'gravel', techBase: 2 },
  grass: { eta: 1.15, canonical: 'grass', techBase: 1 },
  grass_paver: { eta: 1.10, canonical: 'grass', techBase: 1 },
  woodchips: { eta: 1.15, canonical: 'dirt', techBase: 1 },
  forest: { eta: 1.15, canonical: 'dirt', techBase: 2 },
  cobblestone: { eta: 1.20, canonical: 'rock', techBase: 2 },
  unhewn_cobblestone: { eta: 1.25, canonical: 'rock', techBase: 2 },
  rock: { eta: 1.25, canonical: 'rock', techBase: 3 },
  stone: { eta: 1.25, canonical: 'rock', techBase: 3 },
  bare_rock: { eta: 1.28, canonical: 'rock', techBase: 3 },
  roots: { eta: 1.22, canonical: 'dirt', techBase: 2 },
  scree: { eta: 1.45, canonical: 'scree', techBase: 4 },
  shingle: { eta: 1.45, canonical: 'scree', techBase: 4 },
  moraine: { eta: 1.50, canonical: 'scree', techBase: 4 },
  mud: { eta: 1.60, canonical: 'mud', techBase: 3 },
  sand: { eta: 1.80, canonical: 'sand', techBase: 2 },
  wetland: { eta: 1.75, canonical: 'mud', techBase: 3 },
  marsh: { eta: 1.75, canonical: 'mud', techBase: 3 },
  bog: { eta: 1.80, canonical: 'mud', techBase: 3 },
  snow: { eta: 1.30, canonical: 'snow', techBase: 3 },
  ice: { eta: 1.35, canonical: 'snow', techBase: 4 },
  glacier: { eta: 1.50, canonical: 'snow', techBase: 5 },
};

/** Valeurs OSM standards de `tracktype` (de la piste revêtue au chemin meuble). */
const TRACKTYPE_FALLBACK_ETA: Readonly<Record<string, { eta: number; deltaIfSurfaceKnown: number; tech: number }>> = {
  grade1: { eta: 1.00, deltaIfSurfaceKnown: 0.00, tech: 1 },
  grade2: { eta: 1.05, deltaIfSurfaceKnown: 0.02, tech: 1 },
  grade3: { eta: 1.10, deltaIfSurfaceKnown: 0.04, tech: 1 },
  grade4: { eta: 1.18, deltaIfSurfaceKnown: 0.06, tech: 2 },
  grade5: { eta: 1.25, deltaIfSurfaceKnown: 0.10, tech: 2 },
};

/** Modulation par tag OSM `smoothness`. */
const SMOOTHNESS_MODULATION: Readonly<Record<string, { deltaEta: number; minTech: number }>> = {
  excellent: { deltaEta: 0.00, minTech: 1 },
  good: { deltaEta: 0.00, minTech: 1 },
  intermediate: { deltaEta: 0.03, minTech: 1 },
  bad: { deltaEta: 0.08, minTech: 2 },
  very_bad: { deltaEta: 0.15, minTech: 3 },
  horrible: { deltaEta: 0.25, minTech: 4 },
  very_horrible: { deltaEta: 0.35, minTech: 4 },
  impassable: { deltaEta: 0.45, minTech: 5 },
};

/** Modulation par tag OSM `sac_scale` (échelle CAS T1..T6). */
const SAC_SCALE_MODULATION: Readonly<Record<string, { deltaEta: number; technicite: 1 | 2 | 3 | 4 | 5 }>> = {
  hiking: { deltaEta: 0.00, technicite: 1 },
  mountain_hiking: { deltaEta: 0.05, technicite: 2 },
  demanding_mountain_hiking: { deltaEta: 0.12, technicite: 3 },
  alpine_hiking: { deltaEta: 0.22, technicite: 4 },
  demanding_alpine_hiking: { deltaEta: 0.35, technicite: 5 },
  difficult_alpine_hiking: { deltaEta: 0.45, technicite: 5 },
};

export interface OsmTerrainTagsInput {
  surface?: string | null;
  tracktype?: string | null;
  sac_scale?: string | null;
  sacScale?: string | null;
  smoothness?: string | null;
  highway?: string | null;
  snowSinkCm?: number;
}

export interface TerrainEtaMappingResult {
  eta: number;
  technicite: 1 | 2 | 3 | 4 | 5;
  normalizedSurface: string;
  isPaved: boolean;
  isFallback: boolean;
  evidence: Evidence<number>;
}

export function isPavedSurface(surface: string | null | undefined): boolean {
  if (!surface) return false;
  return PAVED_SURFACES.has(surface.trim().toLowerCase());
}

/**
 * Transforme de manière déterministe les tags OSM (`surface`, `tracktype`, `sac_scale`, `smoothness`)
 * en facteur de terrain bioénergétique `eta` ∈ [1.0, 5.0], indice de `technicite` ∈ 1..5
 * et preuve `Evidence<number>` typée sous licence ODbL 1.0.
 */
export function mapOsmTagsToTerrainEta(
  tags: OsmTerrainTagsInput,
  options: { capturedAt?: string } = {}
): TerrainEtaMappingResult {
  const capturedAt = options.capturedAt ?? new Date().toISOString();
  const rawSurface = tags.surface?.trim().toLowerCase() || null;
  const rawTracktype = tags.tracktype?.trim().toLowerCase() || null;
  const rawSacScale = (tags.sac_scale ?? tags.sacScale)?.trim().toLowerCase() || null;
  const rawSmoothness = tags.smoothness?.trim().toLowerCase() || null;
  const snowSinkCm =
    typeof tags.snowSinkCm === 'number' && Number.isFinite(tags.snowSinkCm) && tags.snowSinkCm > 0
      ? tags.snowSinkCm
      : 0;

  const surfaceMatch = rawSurface ? SURFACE_BASE_ETA[rawSurface] : undefined;
  const trackMatch = rawTracktype ? TRACKTYPE_FALLBACK_ETA[rawTracktype] : undefined;
  const smoothnessMatch = rawSmoothness ? SMOOTHNESS_MODULATION[rawSmoothness] : undefined;
  const sacMatch = rawSacScale ? SAC_SCALE_MODULATION[rawSacScale] : undefined;

  const hasAnyTag = Boolean(surfaceMatch || trackMatch || smoothnessMatch || sacMatch || snowSinkCm > 0);

  let baseEta = DEFAULT_FALLBACK_ETA;
  let normalizedSurface = DEFAULT_FALLBACK_SURFACE;
  let techScore = 1;

  if (surfaceMatch) {
    baseEta = surfaceMatch.eta;
    normalizedSurface = surfaceMatch.canonical;
    techScore = Math.max(techScore, surfaceMatch.techBase);
    if (trackMatch) {
      baseEta += trackMatch.deltaIfSurfaceKnown;
      techScore = Math.max(techScore, trackMatch.tech);
    }
  } else if (trackMatch) {
    baseEta = trackMatch.eta;
    normalizedSurface = trackMatch.eta <= 1.01 ? 'asphalt' : trackMatch.eta <= 1.06 ? 'compacted' : 'dirt';
    techScore = Math.max(techScore, trackMatch.tech);
  }

  if (smoothnessMatch) {
    baseEta += smoothnessMatch.deltaEta;
    techScore = Math.max(techScore, smoothnessMatch.minTech);
  }

  if (sacMatch) {
    baseEta += sacMatch.deltaEta;
    techScore = Math.max(techScore, sacMatch.technicite);
  }

  if (snowSinkCm > 0 || normalizedSurface === 'snow') {
    const snowEta = snowSinkCm > 0 ? computePandolfSnowEta(snowSinkCm) : 1.30;
    baseEta = Math.max(baseEta, snowEta);
    normalizedSurface = 'snow';
    techScore = Math.max(techScore, snowSinkCm >= 20 ? 4 : 3);
  }

  const eta = Math.round(Math.min(PANDOLF_SNOW_MAX_ETA, Math.max(1.0, baseEta)) * 10_000) / 10_000;
  const technicite = Math.min(5, Math.max(1, Math.round(techScore))) as 1 | 2 | 3 | 4 | 5;
  const paved = isPavedSurface(rawSurface ?? normalizedSurface);

  const evidence = buildProviderEvidence({
    providerId: 'openstreetmap_odbl',
    value: eta,
    unit: 'eta_factor',
    kind: hasAnyTag ? 'derived' : 'imputed',
    quality: surfaceMatch ? 0.92 : hasAnyTag ? 0.8 : 0.6,
    capturedAt,
    updatedAt: capturedAt,
    modelVersion: 'osm-terrain-mapper-v1',
    sourceDetail: hasAnyTag
      ? `surface=${rawSurface ?? 'n/a'},tracktype=${rawTracktype ?? 'n/a'},sac_scale=${rawSacScale ?? 'n/a'},smoothness=${rawSmoothness ?? 'n/a'}`
      : 'fallback:dirt (eta=1.10)',
  });

  return {
    eta,
    technicite,
    normalizedSurface,
    isPaved: paved,
    isFallback: !hasAnyTag,
    evidence,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ÉTAT LATENT DU SOL : API_72h, HUMIDITÉ VOLUMIQUE, BOUE & VERGLAS
// ─────────────────────────────────────────────────────────────────────────────

export const API_72H_WINDOW_HOURS = 72;
export const DEFAULT_API_DECAY_K = 0.96;

/**
 * Calcule l'Antecedent Precipitation Index sur 72 heures :
 * `API_72h = sum_{t=0..min(71, N-1)} precipMm[t] * (decayK ^ t)`
 * où `t = 0` est l'heure la plus récente avant le départ.
 */
export function computeApi72h(
  hourlyPrecipMm: ReadonlyArray<number>,
  decayK: number = DEFAULT_API_DECAY_K
): number {
  if (!Array.isArray(hourlyPrecipMm) || hourlyPrecipMm.length === 0) return 0;
  const safeK = Number.isFinite(decayK) ? Math.min(1, Math.max(0.01, decayK)) : DEFAULT_API_DECAY_K;

  const limit = Math.min(API_72H_WINDOW_HOURS, hourlyPrecipMm.length);
  let api = 0;
  let weight = 1;
  for (let i = 0; i < limit; i += 1) {
    const p = hourlyPrecipMm[i];
    if (typeof p === 'number' && Number.isFinite(p) && p > 0) {
      api += p * weight;
    }
    weight *= safeK;
  }
  return Math.round(api * 1000) / 1000;
}

export interface LatentGroundStateInput {
  surface?: string | null;
  baseEta?: number;
  hourlyPrecipMm?: ReadonlyArray<number>;
  api72hMm?: number;
  decayK?: number;
  /** Humidité volumique du sol (Volumetric Water Content, m³/m³ dans [0, 1]). */
  soilMoistureVwc?: number | null;
  /** Température de surface du sol en °C. */
  soilTempC: number;
  capturedAt?: string;
}

export interface LatentGroundStateResult {
  api72hMm: number;
  soilMoistureVwc: number;
  wetness: number;
  soilTempC: number;
  isPaved: boolean;
  mudModulationActive: boolean;
  verglas: boolean;
  baseEta: number;
  effectiveEta: number;
  evidence: Evidence<number>;
}

/**
 * Calcule l'état latent du sol à partir de `API_72h` et `soilMoistureVwc` :
 * - Si `soilTempC > 0` et sol humide non revêtu ⇒ modulation boue (`mudModulationActive = true`, majoration de η).
 * - Si `soilTempC <= 0` et sol humide ⇒ flag `verglas = true` (danger verglas).
 */
export function computeLatentGroundState(
  input: LatentGroundStateInput
): LatentGroundStateResult {
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const surface = input.surface?.trim().toLowerCase() || DEFAULT_FALLBACK_SURFACE;
  const paved = isPavedSurface(surface);
  const baseEta =
    typeof input.baseEta === 'number' && Number.isFinite(input.baseEta) && input.baseEta >= 1
      ? input.baseEta
      : SURFACE_BASE_ETA[surface]?.eta ?? DEFAULT_FALLBACK_ETA;

  const api72hMm =
    typeof input.api72hMm === 'number' && Number.isFinite(input.api72hMm) && input.api72hMm >= 0
      ? input.api72hMm
      : computeApi72h(input.hourlyPrecipMm ?? [], input.decayK ?? DEFAULT_API_DECAY_K);

  // Normalisation de l'indice API_72h sur un seuil de saturation de 35 mm cumulés pondérés
  const apiWetness = Math.min(1, Math.max(0, api72hMm / 35));

  const providedVwc =
    typeof input.soilMoistureVwc === 'number' && Number.isFinite(input.soilMoistureVwc)
      ? Math.min(1, Math.max(0, input.soilMoistureVwc))
      : null;

  // VWC saturé autour de 0.45 m³/m³ sur sol naturel
  const vwcWetness = providedVwc !== null ? Math.min(1, Math.max(0, providedVwc / 0.45)) : apiWetness;
  const soilMoistureVwc =
    providedVwc !== null ? providedVwc : Math.round(apiWetness * 0.45 * 1000) / 1000;

  const wetness = Math.round(Math.max(apiWetness, vwcWetness) * 1000) / 1000;
  const isHumid = wetness >= 0.2 || api72hMm >= 5 || (providedVwc !== null && providedVwc >= 0.22);

  const soilTempC = Number.isFinite(input.soilTempC) ? input.soilTempC : 10;
  const verglas = soilTempC <= 0 && isHumid;
  const mudModulationActive = soilTempC > 0 && !paved && isHumid;

  let effectiveEta = baseEta;
  if (mudModulationActive) {
    // Modulation progressive vers le régime boueux (jusqu'à +0.50 sur sol saturé, plafonné à 5.0)
    const mudDelta = 0.5 * wetness;
    effectiveEta = Math.min(PANDOLF_SNOW_MAX_ETA, Math.max(baseEta, baseEta + mudDelta));
  }
  effectiveEta = Math.round(effectiveEta * 10_000) / 10_000;

  const evidence = buildProviderEvidence({
    providerId: 'meteo_france_open_data',
    value: effectiveEta,
    unit: 'eta_factor',
    kind: 'derived',
    quality: providedVwc !== null ? 0.9 : 0.84,
    capturedAt,
    updatedAt: capturedAt,
    modelVersion: 'latent-soil-api72h-v1',
    sourceDetail: `api72h=${api72hMm}mm,vwc=${soilMoistureVwc},soilTempC=${soilTempC},mud=${mudModulationActive},verglas=${verglas}`,
  });

  return {
    api72hMm,
    soilMoistureVwc,
    wetness,
    soilTempC,
    isPaved: paved,
    mudModulationActive,
    verglas,
    baseEta,
    effectiveEta,
    evidence,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CRÉPUSCULE ASTRONOMIQUE (`suncalc`) + MASQUE D'HORIZON TOPOGRAPHIQUE MNT
// ─────────────────────────────────────────────────────────────────────────────

export interface HorizonSector {
  /** Azimut en degrés [0, 360) (0 = Nord, 90 = Est, 180 = Sud, 270 = Ouest). */
  azimuthDeg: number;
  /** Angle d'élévation de la crête topographique MNT en degrés [0, 89]. */
  elevationDeg: number;
}

export interface DemObstacleSample {
  /** Distance horizontale depuis l'observateur (mètres, > 0). */
  distanceM: number;
  /** Altitude MNT de l'obstacle (mètres). */
  altitudeM: number;
  /** Azimut optionnel en degrés [0, 360). */
  azimuthDeg?: number;
}

/**
 * Calcule l'angle d'élévation angulaire du masque d'horizon MNT (en degrés >= 0)
 * vu depuis `observerAltitudeM` face à une liste de reliefs MNT, en tenant compte
 * de la courbure terrestre.
 */
export function computeDemHorizonElevationDeg(
  observerAltitudeM: number,
  obstacles: ReadonlyArray<DemObstacleSample>
): number {
  if (!Number.isFinite(observerAltitudeM) || obstacles.length === 0) return 0;
  const earthRadiusM = 6_371_000;
  let maxAngleDeg = 0;

  for (const obs of obstacles) {
    if (!Number.isFinite(obs.distanceM) || obs.distanceM <= 0 || !Number.isFinite(obs.altitudeM)) {
      continue;
    }
    const curvatureDropM = (obs.distanceM * obs.distanceM) / (2 * earthRadiusM);
    const deltaH = obs.altitudeM - observerAltitudeM - curvatureDropM;
    const angleDeg = (Math.atan2(deltaH, obs.distanceM) * 180) / Math.PI;
    if (angleDeg > maxAngleDeg) {
      maxAngleDeg = angleDeg;
    }
  }
  return Math.round(Math.min(85, Math.max(0, maxAngleDeg)) * 100) / 100;
}

function resolveHorizonElevationAtAzimuth(
  mask: number | ReadonlyArray<HorizonSector> | ((azimuthDeg: number) => number) | undefined,
  azimuthDeg: number
): number {
  if (typeof mask === 'number') {
    return Number.isFinite(mask) ? Math.min(85, Math.max(0, mask)) : 0;
  }
  if (typeof mask === 'function') {
    const v = mask(azimuthDeg);
    return Number.isFinite(v) ? Math.min(85, Math.max(0, v)) : 0;
  }
  if (!Array.isArray(mask) || mask.length === 0) {
    return 0;
  }
  // Recherche du secteur azimutal le plus proche sur le cercle [0, 360)
  const normAz = ((azimuthDeg % 360) + 360) % 360;
  let best = mask[0];
  let bestDiff = 360;
  for (const sector of mask) {
    const sAz = ((sector.azimuthDeg % 360) + 360) % 360;
    const rawDiff = Math.abs(normAz - sAz);
    const circularDiff = Math.min(rawDiff, 360 - rawDiff);
    if (circularDiff < bestDiff) {
      bestDiff = circularDiff;
      best = sector;
    }
  }
  return Number.isFinite(best.elevationDeg) ? Math.min(85, Math.max(0, best.elevationDeg)) : 0;
}

/** Convertit l'azimut SunCalc (0 = Sud, positif vers l'Ouest) en azimut géographique [0, 360) (0 = Nord). */
function sunCalcAzimuthToCompassDeg(sunCalcAzimuthRad: number): number {
  const degFromNorth = (sunCalcAzimuthRad * 180) / Math.PI + 180;
  return ((degFromNorth % 360) + 360) % 360;
}

export interface TopographicTwilightInput {
  lat: number;
  lon: number;
  /** Date de référence (Date ou chaîne ISO-8601). */
  date: Date | string;
  /**
   * Masque d'horizon MNT :
   * - soit un angle d'élévation uniforme en degrés (`number >= 0`),
   * - soit une rose d'horizon directionnelle (`HorizonSector[]`),
   * - soit une fonction `(azimuthDeg) => elevationDeg`.
   */
  horizonMaskDeg?: number | ReadonlyArray<HorizonSector> | ((azimuthDeg: number) => number);
  capturedAt?: string;
}

export interface TopographicTwilightResult {
  flatSunsetTime: string;
  flatCivilDuskTime: string;
  /** Instant où le soleil passe sous la crête du masque d'horizon MNT. */
  topographicSunsetTime: string;
  /**
   * Crépuscule effectif utilisé pour la marge de sécurité en montagne :
   * en vallée encaissée (`horizonMaskDeg > 0`), le soleil franchit l'horizon topographique
   * avant le crépuscule civil plat.
   */
  effectiveTwilightTime: string;
  horizonElevationDegAtSunset: number;
  /** Avance du coucher/crépuscule topographique en secondes par rapport au crépuscule civil plat (`> 0` dès que MNT > 0°). */
  twilightAdvanceS: number;
  evidence: Evidence<string>;
}

/**
 * Calcule le coucher du soleil et le crépuscule astronomique (`SunCalc`) corrigés
 * du masque d'horizon MNT (en degrés d'élévation angulaire).
 *
 * Dès qu'un masque d'horizon MNT `> 0°` est présent, le soleil passe sous l'horizon
 * topographique avant le coucher plat et avant le crépuscule civil plat.
 */
export function computeTopographicTwilight(
  input: TopographicTwilightInput
): TopographicTwilightResult {
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const baseDate = typeof input.date === 'string' ? new Date(input.date) : input.date;
  const times = SunCalc.getTimes(baseDate, input.lat, input.lon);

  const solarNoonMs = Number.isFinite(times.solarNoon?.getTime())
    ? times.solarNoon.getTime()
    : baseDate.getTime();
  const flatSunsetMs = Number.isFinite(times.sunset?.getTime())
    ? times.sunset.getTime()
    : solarNoonMs + 6 * 3_600_000;
  const flatCivilDuskMs = Number.isFinite(times.dusk?.getTime())
    ? times.dusk.getTime()
    : flatSunsetMs + 30 * 60_000;

  // Échantillonnage minute par minute depuis le midi solaire jusqu'au crépuscule civil plat
  // pour trouver l'instant exact où l'élévation solaire passe sous le masque d'horizon MNT.
  const stepMs = 60_000;
  let crossingMs = flatSunsetMs;
  let foundCrossing = false;
  let horizonDegAtCrossing = 0;

  for (let t = solarNoonMs; t <= flatCivilDuskMs; t += stepMs) {
    const pos = SunCalc.getPosition(new Date(t), input.lat, input.lon);
    const sunAltDeg = (pos.altitude * 180) / Math.PI;
    const sunAzDeg = sunCalcAzimuthToCompassDeg(pos.azimuth);
    const maskDeg = resolveHorizonElevationAtAzimuth(input.horizonMaskDeg, sunAzDeg);

    // Horizon plat standard de SunCalc : -0.833° (réfraction + demi-diamètre solaire).
    const thresholdDeg = maskDeg > 0 ? maskDeg : -0.833;
    if (sunAltDeg <= thresholdDeg) {
      // Affinage par dichotomie entre t - stepMs et t
      let lo = Math.max(solarNoonMs, t - stepMs);
      let hi = t;
      for (let iter = 0; iter < 12; iter += 1) {
        const mid = 0.5 * (lo + hi);
        const midPos = SunCalc.getPosition(new Date(mid), input.lat, input.lon);
        const midAltDeg = (midPos.altitude * 180) / Math.PI;
        if (midAltDeg <= thresholdDeg) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
      crossingMs = Math.round(hi);
      horizonDegAtCrossing = maskDeg;
      foundCrossing = true;
      break;
    }
  }

  if (!foundCrossing) {
    const sunsetPos = SunCalc.getPosition(new Date(flatSunsetMs), input.lat, input.lon);
    horizonDegAtCrossing = resolveHorizonElevationAtAzimuth(
      input.horizonMaskDeg,
      sunCalcAzimuthToCompassDeg(sunsetPos.azimuth)
    );
  }

  const topographicSunsetMs =
    horizonDegAtCrossing > 0 ? Math.min(flatSunsetMs, crossingMs) : flatSunsetMs;

  // En présence d'un relief encaissant (masque MNT > 0°), l'obscurité en fond de vallée
  // survient avec une avance équivalente au décalage du coucher topographique (et le soleil
  // franchit l'horizon topographique strictement avant le crépuscule civil plat).
  const flatTwilightSpanMs = Math.max(15 * 60_000, flatCivilDuskMs - flatSunsetMs);
  const effectiveTwilightMs =
    horizonDegAtCrossing > 0
      ? Math.min(
          flatCivilDuskMs - 1000,
          topographicSunsetMs + Math.round(flatTwilightSpanMs * Math.max(0.2, 1 - horizonDegAtCrossing / 35))
        )
      : flatCivilDuskMs;

  const flatSunsetTime = new Date(flatSunsetMs).toISOString();
  const flatCivilDuskTime = new Date(flatCivilDuskMs).toISOString();
  const topographicSunsetTime = new Date(topographicSunsetMs).toISOString();
  const effectiveTwilightTime = new Date(effectiveTwilightMs).toISOString();
  const twilightAdvanceS = Math.max(0, Math.round((flatCivilDuskMs - effectiveTwilightMs) / 1000));

  const evidence = buildProviderEvidence({
    providerId: 'ign_geoplateforme_altimetrie',
    value: effectiveTwilightTime,
    unit: 'iso8601_utc',
    kind: 'derived',
    quality: 0.94,
    capturedAt,
    updatedAt: capturedAt,
    modelVersion: 'suncalc-dem-horizon-v1',
    sourceDetail: `horizonElevationDeg=${horizonDegAtCrossing},advanceS=${twilightAdvanceS}`,
  });

  return {
    flatSunsetTime,
    flatCivilDuskTime,
    topographicSunsetTime,
    effectiveTwilightTime,
    horizonElevationDegAtSunset: Math.round(horizonDegAtCrossing * 100) / 100,
    twilightAdvanceS,
    evidence,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PEUPLEMENT ODbL IDEMPOTENT DE `trail_segments` (SANS OVERPASS PUBLIC)
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_HIKING_HIGHWAYS = new Set<string>([
  'path',
  'footway',
  'track',
  'bridleway',
  'steps',
]);

/** Liste blanche stricte des clés OSM géographiques autorisées dans `trail_segments.tags` (ODbL 1.0). */
const ALLOWED_ODBL_TAG_KEYS = new Set<string>([
  'highway',
  'surface',
  'sac_scale',
  'tracktype',
  'smoothness',
  'name',
  'ref',
  'network',
  'width',
  'incline',
  'trail_visibility',
  'bridge',
  'tunnel',
  'lit',
  'access',
  'foot',
]);

export interface LocalOsmFeatureInput {
  osmId?: number | string;
  osm_id?: number | string;
  name?: string | null;
  highway?: string | null;
  sac_scale?: string | null;
  surface?: string | null;
  tracktype?: string | null;
  smoothness?: string | null;
  tags?: Record<string, unknown> | null;
  properties?: Record<string, unknown> | null;
  /** Coordonnées LineString `[lon, lat]` ou `[lon, lat, ele]`. */
  coordinates?: ReadonlyArray<ReadonlyArray<number>>;
  geometry?: {
    type: 'LineString';
    coordinates: ReadonlyArray<ReadonlyArray<number>>;
  };
}

export interface TrailSegmentSeedRow {
  osm_id: number;
  name: string | null;
  highway: string;
  sac_scale: string | null;
  surface: string | null;
  tags: Record<string, string>;
  /** WKT EWKT PostGIS `SRID=4326;LINESTRING(...)`. */
  geom_ewkt: string;
  geojson: {
    type: 'LineString';
    coordinates: Array<[number, number] | [number, number, number]>;
  };
  feature: {
    osm_id: number;
    length_m: number;
    gain_m: number;
    loss_m: number;
    mean_grade_pct: number;
    max_grade_pct: number;
    surface: string;
    technical_class: 1 | 2 | 3 | 4 | 5;
    terrain_factor_eta: number;
    source: 'osm_local_extract';
    licence_snapshot: 'ODbL 1.0';
  };
}

export interface BuildTrailSegmentsOptions {
  /** Source ou chemin de l'extrait local (vérifié contre Overpass public / Open-Meteo public). */
  sourceUrlOrPath?: string;
  capturedAt?: string;
}

/**
 * Construit de manière **idempotente** les lignes `trail_segments` et leurs caractéristiques
 * dérivées depuis des extraits OSM/GeoJSON locaux, sans aucun appel à Overpass public
 * (`overpass-api.de`), et en garantissant la séparation stricte ODbL 1.0 (zéro champ biométrique
 * ou utilisateur).
 */
export function buildTrailSegmentsFromLocalOsmFeatures(
  features: ReadonlyArray<LocalOsmFeatureInput>,
  options: BuildTrailSegmentsOptions = {}
): TrailSegmentSeedRow[] {
  if (options.sourceUrlOrPath) {
    assertNoForbiddenProdProvider(options.sourceUrlOrPath);
  }

  // Vérification de séparation stricte ODbL : lève OdblBiometricSeparationError si un champ
  // utilisateur ou biométrique (user_id, weight_kg, hr_rest, hr_max, vo2_max, session_id...) est présent.
  assertOdblBiometricSeparation(features);

  const byOsmId = new Map<number, TrailSegmentSeedRow>();

  for (const rawFeature of features) {
    const props = (rawFeature.properties ?? {}) as Record<string, unknown>;
    const rawTags = (rawFeature.tags ?? props.tags ?? {}) as Record<string, unknown>;
    assertOdblBiometricSeparation(props);
    assertOdblBiometricSeparation(rawTags);

    const rawOsmId =
      rawFeature.osmId ??
      rawFeature.osm_id ??
      props.osm_id ??
      props.osmId ??
      rawTags.osm_id;
    const osmId = typeof rawOsmId === 'number' ? Math.trunc(rawOsmId) : Number(rawOsmId);
    if (!Number.isFinite(osmId) || osmId <= 0) continue;

    const highway = String(
      rawFeature.highway ?? props.highway ?? rawTags.highway ?? ''
    )
      .trim()
      .toLowerCase();
    if (!ALLOWED_HIKING_HIGHWAYS.has(highway)) continue;

    const footwayVal = String(props.footway ?? rawTags.footway ?? '')
      .trim()
      .toLowerCase();
    if (footwayVal === 'sidewalk') continue;

    const coordsRaw = rawFeature.coordinates ?? rawFeature.geometry?.coordinates ?? [];
    if (!Array.isArray(coordsRaw) || coordsRaw.length < 2) continue;

    const validCoords: Array<[number, number] | [number, number, number]> = [];
    for (const c of coordsRaw) {
      if (!Array.isArray(c) || c.length < 2) continue;
      const lon = Number(c[0]);
      const lat = Number(c[1]);
      const ele = c.length >= 3 && Number.isFinite(Number(c[2])) ? Number(c[2]) : undefined;
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        continue;
      }
      validCoords.push(ele !== undefined ? [lon, lat, ele] : [lon, lat]);
    }
    if (validCoords.length < 2) continue;

    const surface =
      String(rawFeature.surface ?? props.surface ?? rawTags.surface ?? '')
        .trim()
        .toLowerCase() || null;
    const sacScale =
      String(rawFeature.sac_scale ?? props.sac_scale ?? rawTags.sac_scale ?? '')
        .trim()
        .toLowerCase() || null;
    const tracktype =
      String(rawFeature.tracktype ?? props.tracktype ?? rawTags.tracktype ?? '')
        .trim()
        .toLowerCase() || null;
    const smoothness =
      String(rawFeature.smoothness ?? props.smoothness ?? rawTags.smoothness ?? '')
        .trim()
        .toLowerCase() || null;
    const name =
      typeof (rawFeature.name ?? props.name ?? rawTags.name) === 'string'
        ? String(rawFeature.name ?? props.name ?? rawTags.name).trim() || null
        : null;

    // Filtrage liste blanche ODbL des tags conservés
    const sanitizedTags: Record<string, string> = { highway };
    if (surface) sanitizedTags.surface = surface;
    if (sacScale) sanitizedTags.sac_scale = sacScale;
    if (tracktype) sanitizedTags.tracktype = tracktype;
    if (smoothness) sanitizedTags.smoothness = smoothness;
    if (name) sanitizedTags.name = name;

    for (const [k, v] of Object.entries({ ...props, ...rawTags })) {
      const key = k.trim().toLowerCase();
      if (ALLOWED_ODBL_TAG_KEYS.has(key) && (typeof v === 'string' || typeof v === 'number')) {
        sanitizedTags[key] = String(v).trim();
      }
    }

    const mapped = mapOsmTagsToTerrainEta(
      {
        surface,
        sac_scale: sacScale,
        tracktype,
        smoothness,
        highway,
      },
      { capturedAt: options.capturedAt }
    );

    const smoothed = smoothElevationWithDemHysteresis(
      validCoords.map((c) => ({
        lat: c[1],
        lon: c[0],
        demEleM: c.length === 3 ? c[2] : 0,
      })),
      { hysteresisM: DEFAULT_DEM_HYSTERESIS_M }
    );

    const maxGradePct =
      smoothed.segments.length > 0
        ? Math.max(...smoothed.segments.map((s) => Math.abs(s.gradePct)))
        : 0;

    const wktCoords = validCoords.map((c) => `${c[0].toFixed(6)} ${c[1].toFixed(6)}`).join(', ');
    const geomEwkt = `SRID=4326;LINESTRING(${wktCoords})`;

    byOsmId.set(osmId, {
      osm_id: osmId,
      name,
      highway,
      sac_scale: sacScale,
      surface: mapped.normalizedSurface,
      tags: sanitizedTags,
      geom_ewkt: geomEwkt,
      geojson: {
        type: 'LineString',
        coordinates: validCoords,
      },
      feature: {
        osm_id: osmId,
        length_m: smoothed.totalDistanceM,
        gain_m: smoothed.totalGainM,
        loss_m: smoothed.totalLossM,
        mean_grade_pct: smoothed.meanGradePct,
        max_grade_pct: Math.round(maxGradePct * 100) / 100,
        surface: mapped.normalizedSurface,
        technical_class: mapped.technicite,
        terrain_factor_eta: mapped.eta,
        source: 'osm_local_extract',
        licence_snapshot: 'ODbL 1.0',
      },
    });
  }

  return [...byOsmId.values()].sort((a, b) => a.osm_id - b.osm_id);
}

export interface TrailSegmentsUpsertStore {
  upsertTrailSegments(rows: ReadonlyArray<TrailSegmentSeedRow>): Promise<{ upsertedCount: number }>;
}

/**
 * Job idempotent de peuplement de `trail_segments` depuis des extraits OSM locaux
 * (déduplication sur `osm_id`, zéro appel Overpass public, séparation ODbL stricte).
 */
export async function populateTrailSegmentsFromLocalOsmIdempotent(
  features: ReadonlyArray<LocalOsmFeatureInput>,
  store: TrailSegmentsUpsertStore,
  options: BuildTrailSegmentsOptions = {}
): Promise<{ rows: TrailSegmentSeedRow[]; upsertedCount: number }> {
  const rows = buildTrailSegmentsFromLocalOsmFeatures(features, options);
  if (rows.length === 0) {
    return { rows: [], upsertedCount: 0 };
  }
  const { upsertedCount } = await store.upsertTrailSegments(rows);
  return { rows, upsertedCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. FALLBACK `trail_segments = 0` : SEGMENTATION DIRECTE DE `positions_timed` + MNT
// ─────────────────────────────────────────────────────────────────────────────

export interface TimedPositionSampleInput {
  lat: number;
  lng?: number;
  lon?: number;
  timestamp: string;
  elevationM?: number | null;
  ele?: number | null;
  accuracyM?: number | null;
  speedMps?: number | null;
}

export type DemLookupFn = (
  points: ReadonlyArray<{ lat: number; lon: number }>
) => Promise<ReadonlyArray<number | null>> | ReadonlyArray<number | null>;

export interface FallbackSegmentedEffortItem {
  segmentId: number;
  distanceM: number;
  durationS: number;
  speedMs: number;
  gradePct: number;
  gradeDec: number;
  gainM: number;
  lossM: number;
  altitudeM: number;
  surface: string;
  terrainFactorEta: number;
  snowSinkCm: number;
  technicalClass: number;
  exposureClass: number;
  isolationClass: number;
  outOfDomain: boolean;
  isRegroupPoint: boolean;
  evidence: Evidence<number>;
}

export interface SegmentTimedPositionsOptions {
  /** Longueur minimale d'un segment agrégé en mètres (défaut : découpage par intervalle significatif >= 25 m). */
  minSegmentDistanceM?: number;
  /** Surface fallback lorsque `trail_segments` est vide (défaut : `'dirt'`). */
  fallbackSurface?: string;
  /** Hystérésis MNT en mètres (défaut : `3 m`). */
  hysteresisM?: number;
  capturedAt?: string;
}

/**
 * Mode de segmentation directe depuis `hike_sessions.positions_timed` lorsque `trail_segments`
 * contient 0 ligne en base :
 * 1. Valide et ordonne chronologiquement les échantillons horodatés.
 * 2. Interroge le MNT (`demLookup` IGN Géoplateforme / AWS Terrain Tiles) et applique
 *    le lissage altimétrique avec **hystérésis `3 m`** (`smoothElevationWithDemHysteresis`).
 * 3. Applique le fallback de surface (`dirt` / `eta = 1.10`) et produit des segments
 *    strictement conformes à `EffortSegmentInputSchema` (`effort.schema.ts`).
 */
export async function segmentTimedPositionsWithDemFallback(
  positionsTimed: ReadonlyArray<TimedPositionSampleInput>,
  demLookup?: DemLookupFn,
  options: SegmentTimedPositionsOptions = {}
): Promise<FallbackSegmentedEffortItem[]> {
  const capturedAt = options.capturedAt ?? new Date().toISOString();
  const minSegmentDistanceM = Math.max(1, options.minSegmentDistanceM ?? 20);
  const hysteresisM = options.hysteresisM ?? DEFAULT_DEM_HYSTERESIS_M;
  const fallbackSurface = options.fallbackSurface ?? DEFAULT_FALLBACK_SURFACE;
  const mappedFallback = mapOsmTagsToTerrainEta(
    { surface: fallbackSurface },
    { capturedAt }
  );

  // 1. Filtrage et tri chronologique des échantillons valides
  const validSamples = positionsTimed
    .map((sample) => {
      const lon = sample.lon ?? sample.lng;
      const timeMs = Date.parse(sample.timestamp);
      if (
        !Number.isFinite(sample.lat) ||
        typeof lon !== 'number' ||
        !Number.isFinite(lon) ||
        Math.abs(sample.lat) > 90 ||
        Math.abs(lon) > 180 ||
        !Number.isFinite(timeMs)
      ) {
        return null;
      }
      const rawEle =
        typeof sample.elevationM === 'number' && Number.isFinite(sample.elevationM)
          ? sample.elevationM
          : typeof sample.ele === 'number' && Number.isFinite(sample.ele)
            ? sample.ele
            : null;
      return {
        lat: sample.lat,
        lon,
        timeMs,
        rawEle,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => a.timeMs - b.timeMs);

  if (validSamples.length < 2) {
    return [];
  }

  // 2. Lecture des altitudes MNT (IGN Géoplateforme / AWS Terrain Tiles)
  let demElevations: ReadonlyArray<number | null> = [];
  if (demLookup) {
    try {
      demElevations =
        (await demLookup(validSamples.map((s) => ({ lat: s.lat, lon: s.lon })))) ?? [];
    } catch {
      demElevations = [];
    }
  }

  // 3. Lissage MNT avec hystérésis 3 m
  const smoothed = smoothElevationWithDemHysteresis(
    validSamples.map((s, idx) => ({
      lat: s.lat,
      lon: s.lon,
      rawEleM: s.rawEle,
      demEleM:
        typeof demElevations[idx] === 'number' && Number.isFinite(demElevations[idx])
          ? demElevations[idx]
          : null,
    })),
    { hysteresisM }
  );

  // 4. Construction des segments conformes à EffortSegmentInputSchema
  const outputSegments: FallbackSegmentedEffortItem[] = [];
  let accDistanceM = 0;
  let accDurationS = 0;
  let accGainM = 0;
  let accLossM = 0;
  let segStartEleM = smoothed.smoothedElevationsM[0] ?? 0;
  let segEndEleM = segStartEleM;

  const flushSegment = (): void => {
    if (accDistanceM <= 0 || accDurationS <= 0) return;
    const segmentId = outputSegments.length + 1;
    const distanceM = Math.round(accDistanceM * 100) / 100;
    const durationS = Math.max(1, Math.round(accDurationS * 100) / 100);
    const speedMs = Math.round((distanceM / durationS) * 10_000) / 10_000;
    const deltaEle = segEndEleM - segStartEleM;
    const rawGradePct = (deltaEle / distanceM) * 100;
    const gradePct = Math.round(Math.min(100, Math.max(-100, rawGradePct)) * 100) / 100;
    const gradeDec = gradePct / 100;
    const altitudeM = Math.round(((segStartEleM + segEndEleM) / 2) * 100) / 100;
    const outOfDomain = !isSpeedInLcdaDomain(speedMs);

    const evidence = buildProviderEvidence({
      providerId: 'ign_geoplateforme_altimetrie',
      value: mappedFallback.eta,
      unit: 'eta_factor',
      kind: 'imputed',
      quality: demElevations.length > 0 ? 0.78 : 0.62,
      capturedAt,
      updatedAt: capturedAt,
      modelVersion: 'positions-timed-dem-fallback-v1',
      sourceDetail: `trail_segments=0,surface=${mappedFallback.normalizedSurface},eta=${mappedFallback.eta},hysteresisM=${hysteresisM}`,
    });

    const candidate: FallbackSegmentedEffortItem = {
      segmentId,
      distanceM,
      durationS,
      speedMs,
      gradePct,
      gradeDec,
      gainM: Math.round(accGainM * 100) / 100,
      lossM: Math.round(accLossM * 100) / 100,
      altitudeM,
      surface: mappedFallback.normalizedSurface,
      terrainFactorEta: mappedFallback.eta,
      snowSinkCm: 0,
      technicalClass: mappedFallback.technicite,
      exposureClass: 0,
      isolationClass: 0,
      outOfDomain,
      isRegroupPoint: false,
      evidence,
    };

    EffortSegmentInputSchema.parse(candidate);
    outputSegments.push(candidate);

    accDistanceM = 0;
    accDurationS = 0;
    accGainM = 0;
    accLossM = 0;
    segStartEleM = segEndEleM;
  };

  for (let i = 1; i < validSamples.length; i += 1) {
    const prev = validSamples[i - 1];
    const curr = validSamples[i];
    const stepDistanceM = haversineM(
      { lat: prev.lat, lng: prev.lon },
      { lat: curr.lat, lng: curr.lon }
    );
    const stepDurationS = Math.max(0, (curr.timeMs - prev.timeMs) / 1000);
    const smoothedSeg = smoothed.segments[i - 1];

    accDistanceM += stepDistanceM;
    accDurationS += stepDurationS;
    accGainM += smoothedSeg?.gainM ?? 0;
    accLossM += smoothedSeg?.lossM ?? 0;
    segEndEleM = smoothed.smoothedElevationsM[i] ?? segEndEleM;

    const isLast = i === validSamples.length - 1;
    if ((accDistanceM >= minSegmentDistanceM && accDurationS > 0) || isLast) {
      flushSegment();
    }
  }

  return outputSegments;
}
