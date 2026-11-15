/**
 * S3.16, S3.17, S3.18, S3.19 — Fenêtres temporelles pour heatmaps communautaires
 * et personnelles :
 * - `global` (S3.16, K3.07)
 * - `last_7_days` (S3.17 : 7 derniers jours glissants)
 * - `nocturnal` (S3.18 : passages isolés entre le coucher et le lever du soleil)
 * - `PersonalTimeFilter` (K3.08, S3.19 : périodes de comparaison personnelles)
 */

import {
  HEATMAP_GLOBAL_MAX_AGE_DAYS,
  HEATMAP_RECENT_WINDOW_DAYS,
  type CommunityTimeWindow,
  type HeatmapTrackPoint,
  type PersonalTimeFilter,
} from './types';

const MS_PER_DAY = 86_400_000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export interface SolarWindow {
  /** Heure UTC du lever du soleil en minutes depuis 00:00 UTC (null en nuit/jour polaire). */
  sunriseUtcMinutes: number | null;
  /** Heure UTC du coucher du soleil en minutes depuis 00:00 UTC (null en nuit/jour polaire). */
  sunsetUtcMinutes: number | null;
  /** Vrai si le soleil ne se lève jamais ce jour-là à cette latitude (nuit polaire). */
  polarNight: boolean;
  /** Vrai si le soleil ne se couche jamais ce jour-là à cette latitude (jour polaire). */
  polarDay: boolean;
}

/** Jour de l'année (1..366) en UTC. */
function dayOfYearUtc(date: Date): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const currentUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
  return Math.floor((currentUtc - startOfYear) / MS_PER_DAY);
}

/**
 * Calcule les instants de lever et de coucher du soleil (modèle astronomique NOAA,
 * dépression zénithale officielle 90.833° incluant réfraction atmosphérique)
 * pour une position `(lat, lng)` et une date donnée.
 */
export function computeSolarWindow(lat: number, lng: number, at: Date): SolarWindow {
  const doy = dayOfYearUtc(at);
  const gamma = ((2 * Math.PI) / 365) * (doy - 1 + (12 - 12) / 24);

  // Équation du temps (en minutes)
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  // Déclinaison solaire (en radians)
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const latRad = Math.max(-89.8, Math.min(89.8, lat)) * DEG_TO_RAD;
  const zenithRad = 90.833 * DEG_TO_RAD;

  const cosHourAngle =
    Math.cos(zenithRad) / (Math.cos(latRad) * Math.cos(decl)) -
    Math.tan(latRad) * Math.tan(decl);

  if (cosHourAngle > 1) {
    // Le soleil reste sous l'horizon toute la journée (nuit polaire)
    return {
      sunriseUtcMinutes: null,
      sunsetUtcMinutes: null,
      polarNight: true,
      polarDay: false,
    };
  }

  if (cosHourAngle < -1) {
    // Soleil de minuit (jour polaire)
    return {
      sunriseUtcMinutes: null,
      sunsetUtcMinutes: null,
      polarNight: false,
      polarDay: true,
    };
  }

  const hourAngleDeg = Math.acos(cosHourAngle) * RAD_TO_DEG;
  const sunriseUtcMinutes = 720 - 4 * (lng + hourAngleDeg) - eqTime;
  const sunsetUtcMinutes = 720 - 4 * (lng - hourAngleDeg) - eqTime;

  return {
    sunriseUtcMinutes,
    sunsetUtcMinutes,
    polarNight: false,
    polarDay: false,
  };
}

/**
 * Détermine si un instant ISO donné correspond à un passage nocturne (S3.18 :
 * strictement entre le coucher et le lever du soleil à la coordonnée `(lat, lng)`).
 *
 * Fail-closed : si l'horodatage est absent ou invalide, retourne `false`
 * afin de ne jamais polluer la couche nocturne avec des traces non horodatées.
 */
export function isNocturnalTimestamp(
  timestampIso: string | null | undefined,
  lat: number,
  lng: number
): boolean {
  if (!timestampIso || typeof timestampIso !== 'string') return false;
  const ms = Date.parse(timestampIso);
  if (!Number.isFinite(ms)) return false;

  const date = new Date(ms);
  const solar = computeSolarWindow(lat, lng, date);
  if (solar.polarNight) return true;
  if (solar.polarDay) return false;
  if (solar.sunriseUtcMinutes === null || solar.sunsetUtcMinutes === null) return false;

  // Conversion en heure solaire locale (décalée par la longitude) pour éviter
  // tout effet de bord lorsque sunrise/sunset franchissent minuit UTC.
  const utcMinutes =
    date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const solarOffsetMin = 4 * lng;
  const normalizeDayMin = (m: number) => ((m % 1440) + 1440) % 1440;

  const localSolarMin = normalizeDayMin(utcMinutes + solarOffsetMin);
  const localSunriseMin = normalizeDayMin(solar.sunriseUtcMinutes + solarOffsetMin);
  const localSunsetMin = normalizeDayMin(solar.sunsetUtcMinutes + solarOffsetMin);

  if (localSunriseMin < localSunsetMin) {
    return localSolarMin < localSunriseMin || localSolarMin >= localSunsetMin;
  }
  return localSolarMin >= localSunsetMin && localSolarMin < localSunriseMin;
}

/**
 * Vérifie si un horodatage ISO appartient à la fenêtre communautaire demandée
 * (`global`, `last_7_days`).
 */
export function isWithinCommunityWindow(
  timestampIso: string | null | undefined,
  window: CommunityTimeWindow,
  nowMs: number,
  maxGlobalAgeDays = HEATMAP_GLOBAL_MAX_AGE_DAYS
): boolean {
  if (!timestampIso || typeof timestampIso !== 'string') return false;
  const ms = Date.parse(timestampIso);
  if (!Number.isFinite(ms)) return false;

  // Tolérance d'horloge de 5 minutes dans le futur maximum
  if (ms > nowMs + 5 * 60_000) return false;

  const ageMs = Math.max(0, nowMs - ms);
  if (window === 'last_7_days') {
    return ageMs <= HEATMAP_RECENT_WINDOW_DAYS * MS_PER_DAY;
  }

  // Pour 'global' et 'nocturnal', on applique la limite d'âge globale (730 jours par défaut)
  return ageMs <= maxGlobalAgeDays * MS_PER_DAY;
}

/**
 * Filtre les points d'une activité selon la fenêtre temporelle communautaire
 * (`global`, `last_7_days`, `nocturnal` — S3.16, S3.17, S3.18).
 *
 * Chaque point utilise son propre `timestamp` s'il est renseigné, ou retombe
 * sur `activityStartedAt` de la sortie.
 */
export function filterPointsByCommunityTimeWindow(
  points: readonly HeatmapTrackPoint[],
  activityStartedAt: string,
  window: CommunityTimeWindow,
  nowIso: string,
  maxGlobalAgeDays = HEATMAP_GLOBAL_MAX_AGE_DAYS
): HeatmapTrackPoint[] {
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(nowMs)) return [];

  const result: HeatmapTrackPoint[] = [];
  for (const pt of points) {
    const effectiveTimestamp = pt.timestamp ?? activityStartedAt;
    if (!isWithinCommunityWindow(effectiveTimestamp, window, nowMs, maxGlobalAgeDays)) {
      continue;
    }
    if (window === 'nocturnal' && !isNocturnalTimestamp(effectiveTimestamp, pt.lat, pt.lng)) {
      continue;
    }
    result.push(pt);
  }
  return result;
}

/**
 * Vérifie si un horodatage ISO appartient à la période personnelle choisie (K3.08, S3.19).
 */
export function isWithinPersonalTimeFilter(
  timestampIso: string | null | undefined,
  filter: PersonalTimeFilter,
  nowIso: string
): boolean {
  if (!timestampIso || typeof timestampIso !== 'string') return false;
  const tsMs = Date.parse(timestampIso);
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(tsMs) || !Number.isFinite(nowMs)) return false;
  if (tsMs > nowMs + 5 * 60_000) return false;

  switch (filter.kind) {
    case 'all_time':
      return true;
    case 'last_7_days':
      return nowMs - tsMs <= 7 * MS_PER_DAY;
    case 'last_30_days':
      return nowMs - tsMs <= 30 * MS_PER_DAY;
    case 'last_90_days':
      return nowMs - tsMs <= 90 * MS_PER_DAY;
    case 'year_to_date': {
      const nowDate = new Date(nowMs);
      const startOfYearMs = Date.UTC(nowDate.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
      return tsMs >= startOfYearMs && tsMs <= nowMs + 5 * 60_000;
    }
    case 'custom': {
      if (!filter.fromIso || !filter.toIso) return false;
      const fromMs = Date.parse(filter.fromIso);
      const toMs = Date.parse(filter.toIso);
      if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) return false;
      return tsMs >= fromMs && tsMs <= toMs;
    }
    default:
      return false;
  }
}
