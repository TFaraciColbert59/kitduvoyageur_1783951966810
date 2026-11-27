/**
 * Modèles environnementaux 100 % hors ligne pour Explorer v2 :
 * - Calcul solaire NOAA complet (lever, coucher, crépuscule civil -6°, jour/nuit polaire)
 * - Contrainte thermique (refroidissement éolien NWS/EC & indice de chaleur Rothfusz)
 * - Vent effectif sur crête / altitude (accélération orographique)
 * - Estimation des besoins hydriques en litres
 */

import type {
  DaylightStatus,
  OfflineDaylight,
  RidgeWindResult,
  ThermalStressLevel,
  ThermalStressResult,
  WeatherSnapshot,
  WindHazardLevel,
} from './types';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const MS_PER_DAY = 86_400_000;
const MS_PER_MIN = 60_000;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeDeg(angle: number): number {
  const mod = angle % 360;
  return mod < 0 ? mod + 360 : mod;
}

/**
 * Calcule l'angle horaire solaire (en degrés) pour une latitude, une déclinaison
 * solaire et un angle zénithal donnés.
 * - `90.833°` : lever/coucher officiel (réfraction atmosphérique + rayon solaire)
 * - `96.0°` : crépuscule civil (-6° sous l'horizon)
 */
function solarHourAngleDeg(
  latDeg: number,
  declinationRad: number,
  zenithDeg: number,
): { status: DaylightStatus; haDeg: number | null } {
  const latRad = clamp(latDeg, -89.999, 89.999) * DEG2RAD;
  const zenithRad = zenithDeg * DEG2RAD;
  const cosHa =
    Math.cos(zenithRad) / (Math.cos(latRad) * Math.cos(declinationRad)) -
    Math.tan(latRad) * Math.tan(declinationRad);

  if (cosHa < -1) {
    return { status: 'polar_day', haDeg: null };
  }
  if (cosHa > 1) {
    return { status: 'polar_night', haDeg: null };
  }
  return { status: 'normal', haDeg: Math.acos(clamp(cosHa, -1, 1)) * RAD2DEG };
}

/**
 * Calcul solaire 100 % hors ligne basé sur les équations astronomiques de la NOAA.
 * Déterministe, sans dépendance réseau ni fuseau horaire système (horodatages UTC).
 */
export function computeOfflineDaylight(
  lat: number,
  lng: number,
  dateMs: number,
): OfflineDaylight {
  const safeLat = clamp(lat, -89.999, 89.999);
  const safeLng = clamp(lng, -180, 180);
  const utcDayStartMs = Math.floor(dateMs / MS_PER_DAY) * MS_PER_DAY;
  // Midi UTC du jour civil demandé (et décalage approximatif de longitude)
  const jdNoon = utcDayStartMs / MS_PER_DAY + 2440587.5 + 0.5 - safeLng / 360;
  const t = (jdNoon - 2451545.0) / 36525.0;

  // Longitude moyenne géométrique du Soleil (deg)
  const l0 = normalizeDeg(280.46646 + t * (36000.76983 + 0.0003032 * t));
  // Anomalie moyenne géométrique du Soleil (deg)
  const m = normalizeDeg(357.52911 + t * (35999.05029 - 0.0001537 * t));
  const mRad = m * DEG2RAD;
  // Excentricité de l'orbite terrestre
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  // Équation du centre du Soleil (deg)
  const sunEqCtr =
    Math.sin(mRad) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * mRad) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * mRad) * 0.000289;

  // Longitude vraie et apparente du Soleil (deg)
  const sunTrueLong = l0 + sunEqCtr;
  const omega = 125.04 - 1934.136 * t;
  const sunAppLong = sunTrueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG2RAD);

  // Obliquité moyenne et corrigée de l'écliptique (deg)
  const meanObliq =
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliqCorr = meanObliq + 0.00256 * Math.cos(omega * DEG2RAD);
  const obliqCorrRad = obliqCorr * DEG2RAD;

  // Déclinaison solaire (rad)
  const sinDecl = Math.sin(obliqCorrRad) * Math.sin(sunAppLong * DEG2RAD);
  const declRad = Math.asin(clamp(sinDecl, -1, 1));

  // Équation du temps (minutes)
  const tanHalfObliq = Math.tan(obliqCorrRad / 2);
  const y = tanHalfObliq * tanHalfObliq;
  const l0Rad = l0 * DEG2RAD;
  const eqTimeMin =
    4 *
    RAD2DEG *
    (y * Math.sin(2 * l0Rad) -
      2 * e * Math.sin(mRad) +
      4 * e * y * Math.sin(mRad) * Math.cos(2 * l0Rad) -
      0.5 * y * y * Math.sin(4 * l0Rad) -
      1.25 * e * e * Math.sin(2 * mRad));

  // Midi solaire en minutes UTC depuis 00:00 UTC du jour civil
  const solarNoonMinUtc = 720 - 4 * safeLng - eqTimeMin;
  const solarNoonMs = Math.round(utcDayStartMs + solarNoonMinUtc * MS_PER_MIN);

  const official = solarHourAngleDeg(safeLat, declRad, 90.833);
  const civil = solarHourAngleDeg(safeLat, declRad, 96.0);

  let sunriseMs: number | null = null;
  let sunsetMs: number | null = null;
  let daylightHours = 0;

  if (official.status === 'normal' && official.haDeg !== null) {
    const deltaMin = official.haDeg * 4;
    sunriseMs = Math.round(utcDayStartMs + (solarNoonMinUtc - deltaMin) * MS_PER_MIN);
    sunsetMs = Math.round(utcDayStartMs + (solarNoonMinUtc + deltaMin) * MS_PER_MIN);
    daylightHours = round((deltaMin * 2) / 60, 2);
  } else if (official.status === 'polar_day') {
    daylightHours = 24;
  } else {
    daylightHours = 0;
  }

  let civilDawnMs: number | null = null;
  let civilDuskMs: number | null = null;
  if (civil.status === 'normal' && civil.haDeg !== null) {
    const civilDeltaMin = civil.haDeg * 4;
    civilDawnMs = Math.round(utcDayStartMs + (solarNoonMinUtc - civilDeltaMin) * MS_PER_MIN);
    civilDuskMs = Math.round(utcDayStartMs + (solarNoonMinUtc + civilDeltaMin) * MS_PER_MIN);
  }

  return {
    status: official.status,
    lat: safeLat,
    lng: safeLng,
    dateMs,
    sunriseMs,
    sunsetMs,
    civilDawnMs,
    civilDuskMs,
    solarNoonMs,
    daylightHours,
    solarDeclinationDeg: round(declRad * RAD2DEG, 2),
  };
}

/**
 * Estime le vent effectif sur crête / relief selon l'altitude et l'exposition
 * (effet Venturi + cisaillement de couche limite).
 */
export function computeEffectiveRidgeWind(
  baseWindKmh: number,
  altitudeM = 0,
  ridgeExposed = false,
  baseGustKmh?: number | null,
): RidgeWindResult {
  const safeBase = Number.isFinite(baseWindKmh) && baseWindKmh > 0 ? baseWindKmh : 0;
  const safeAlt = Number.isFinite(altitudeM) && altitudeM > 0 ? altitudeM : 0;

  const altGain = safeAlt > 1200 ? clamp((safeAlt - 1200) / 3000, 0, 0.45) : 0;
  const ridgeGain = ridgeExposed ? 0.35 : 0;
  const exposureMultiplier = round(1 + altGain + ridgeGain, 2);

  const effectiveWindKmh = round(safeBase * exposureMultiplier, 1);
  const rawGust =
    baseGustKmh != null && Number.isFinite(baseGustKmh) && baseGustKmh > safeBase
      ? baseGustKmh
      : safeBase * 1.35;
  const effectiveGustKmh = round(rawGust * exposureMultiplier, 1);

  const referenceKmh = Math.max(effectiveWindKmh, effectiveGustKmh * 0.85);
  let hazardLevel: WindHazardLevel = 'calm';
  if (referenceKmh >= 75) hazardLevel = 'storm';
  else if (referenceKmh >= 50) hazardLevel = 'gale';
  else if (referenceKmh >= 30) hazardLevel = 'strong';
  else if (referenceKmh >= 15) hazardLevel = 'breezy';

  return {
    baseWindKmh: round(safeBase, 1),
    effectiveWindKmh,
    effectiveGustKmh,
    exposureMultiplier,
    hazardLevel,
  };
}

/**
 * Calcule la contrainte thermique (refroidissement éolien & indice de chaleur)
 * ainsi que son impact sur l'allure et les besoins d'hydratation.
 */
export function computeThermalStress(
  weather: WeatherSnapshot | null | undefined,
  effectiveWindKmh?: number | null,
): ThermalStressResult {
  if (!weather || weather.temperatureC == null || !Number.isFinite(weather.temperatureC)) {
    return {
      level: 'unknown',
      apparentTempC: null,
      windChillC: null,
      heatIndexC: null,
      speedPenaltyFactor: 1.0,
      hydrationMultiplier: 1.0,
      advisoryFr: null,
    };
  }

  const tempC = weather.temperatureC;
  const windKmh =
    effectiveWindKmh != null && Number.isFinite(effectiveWindKmh)
      ? Math.max(0, effectiveWindKmh)
      : Math.max(0, weather.windSpeedKmh ?? 0);
  const rh = clamp(weather.humidityPct ?? 50, 5, 100);

  let windChillC: number | null = null;
  if (tempC <= 10 && windKmh >= 4.8) {
    const v016 = Math.pow(windKmh, 0.16);
    windChillC = round(13.12 + 0.6215 * tempC - 11.37 * v016 + 0.3965 * tempC * v016, 1);
  }

  let heatIndexC: number | null = null;
  if (tempC >= 26 && rh >= 40) {
    const tF = tempC * 1.8 + 32;
    const hiF =
      -42.379 +
      2.04901523 * tF +
      10.14333127 * rh -
      0.22475541 * tF * rh -
      0.00683783 * tF * tF -
      0.05481717 * rh * rh +
      0.00122874 * tF * tF * rh +
      0.00085282 * tF * rh * rh -
      0.00000199 * tF * tF * rh * rh;
    heatIndexC = round((hiF - 32) / 1.8, 1);
  }

  const apparentTempC = windChillC ?? heatIndexC ?? round(tempC, 1);

  let level: ThermalStressLevel = 'comfortable';
  let speedPenaltyFactor = 1.0;
  let hydrationMultiplier = 1.0;
  let advisoryFr: string | null = null;

  if (apparentTempC <= -15) {
    level = 'cold_extreme';
    speedPenaltyFactor = 1.18;
    hydrationMultiplier = 1.1;
    advisoryFr = `Froid extrême ressenti (${apparentTempC} °C) : risque d’engelures et perte de dextérité.`;
  } else if (apparentTempC < 2) {
    level = 'cold';
    speedPenaltyFactor = 1.05;
    hydrationMultiplier = 1.05;
    advisoryFr = `Température ressentie froide (${apparentTempC} °C) : prévoir une couche thermique coupe-vent.`;
  } else if (apparentTempC >= 32) {
    level = 'heat_extreme';
    speedPenaltyFactor = 1.22;
    hydrationMultiplier = 1.65;
    advisoryFr = `Chaleur sévère ressentie (${apparentTempC} °C) : risque de coup de chaleur, hydratation majorée.`;
  } else if (apparentTempC >= 25) {
    level = 'warm';
    speedPenaltyFactor = 1.09;
    hydrationMultiplier = 1.3;
    advisoryFr = `Chaleur marquée (${apparentTempC} °C) : augmenter les apports hydriques et électrolytes.`;
  }

  return {
    level,
    apparentTempC,
    windChillC,
    heatIndexC,
    speedPenaltyFactor,
    hydrationMultiplier,
    advisoryFr,
  };
}

/**
 * Estime le volume d'eau conseillé (en litres) selon la durée, le dénivelé,
 * l'altitude sèche et la contrainte thermique.
 */
export function estimateHydrationLiters(params: {
  readonly durationHours: number;
  readonly elevationGainM?: number | null;
  readonly maxAltitudeM?: number | null;
  readonly weather?: WeatherSnapshot | null;
  readonly effectiveWindKmh?: number | null;
}): number {
  const hours = Number.isFinite(params.durationHours) && params.durationHours > 0 ? params.durationHours : 0;
  if (hours <= 0) return 0;

  const gainM = Math.max(0, params.elevationGainM ?? 0);
  const maxAlt = Math.max(0, params.maxAltitudeM ?? 0);
  const thermal = computeThermalStress(params.weather, params.effectiveWindKmh);

  const baseLitersPerHour = 0.5;
  const climbBonusL = (gainM / 1000) * 0.25;
  const altitudeDrynessFactor = maxAlt > 2000 ? 1 + Math.min(0.2, ((maxAlt - 2000) / 2000) * 0.2) : 1;

  const totalL = (hours * baseLitersPerHour + climbBonusL) * thermal.hydrationMultiplier * altitudeDrynessFactor;
  return round(Math.max(0.5, totalL), 1);
}
