import 'server-only';

import {
  averageTrend,
  buildCalendar,
  type CalendarDay,
  type DayForecast,
} from '../engine/weather';
import {
  METNO_SOURCE,
  POWER_SOURCE,
  parseMetNo,
  powerClimateNormals,
  powerClimatology,
  powerToDaily,
} from '../engine/metno';
import type { ClimateNormals } from '@/features/trips/engine/climate';
import tzLookup from '@photostructure/tz-lookup';
import { appUserAgent } from '@/lib/userAgent';
import { metnoForecastUrl, metnoGet } from '@/lib/weather/metnoRequest';
import type { Evidence } from '@/features/adventure-intelligence/schemas/effort.schema';
import {
  assertNoForbiddenProdProvider,
  assertValidLkdvUserAgent,
  buildProviderEvidence,
  formatLicenceSnapshot,
  isValidLkdvUserAgent,
} from '@/features/adventure-intelligence/server/providerTerms';
import { localToday } from '../engine/zone';

/**
 * Compas — météo gratuite, usage commercial permis :
 *
 * - Jours du voyage : prévision MET Norway (Yr) au point de départ de CHAQUE
 *   jour, à l'heure locale du lieu (fuseau retrouvé hors ligne).
 * - Calendrier des conditions sur 6 semaines au point de départ : prévision
 *   tant qu'elle couvre (~9 jours), puis TENDANCE (moyenne des 5 dernières
 *   années aux mêmes dates, NASA POWER). La tendance est toujours étiquetée.
 * - Normales mensuelles (NASA POWER, climatologie, gardées 30 jours) : le mois
 *   le plus sec d'une destination tropicale absente de la table des saisons
 *   sèches (`getPrecipNormals`, une demande par préparation) ; froid, pluie et
 *   chaleur du kit (`getClimateNormals`, plan 4.8).
 *
 * MET Norway passe par un seul point d'accès (`metnoGet`, `metnoForecastUrl`) :
 * User-Agent unique du site, 20 requêtes par seconde au plus, cache au-delà
 * d'`Expires`. Les coordonnées sont arrondies à 0,01° (~1 km) pour que tout le
 * monde partage les mêmes réponses dans le cache de données de Vercel. NASA
 * POWER garde `getJson`.
 *
 * Un appel qui échoue rend `null` pour sa partie : l'écran dit « indisponible »,
 * il ne comble rien.
 */

const POWER = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const POWER_CLIMATOLOGY = 'https://power.larc.nasa.gov/api/temporal/climatology/point';
/** Les normales 2001-2020 ne bougent pas : une réponse sert 30 jours. */
const NORMALS_REVALIDATE_S = 30 * 86_400;
const USER_AGENT = appUserAgent('Compas, meteo');
/** Horizon annoncé : MET Norway couvre ~9 jours pleins après aujourd'hui. */
export const FORECAST_HORIZON_DAYS = 10;
export const CALENDAR_DAYS = 42;
const TREND_YEARS = 5;

export interface CompasTripDayWeather {
  day: number;
  date: string;
  lat: number;
  lon: number;
  forecast: DayForecast | null;
}

export interface CompasWeather {
  /** Sources citées à l'écran (licence CC BY 4.0 pour MET Norway). */
  source: typeof METNO_SOURCE;
  trendSource: typeof POWER_SOURCE;
  /** Dernier jour couvert par la prévision. */
  horizon: string;
  tripDays: CompasTripDayWeather[];
  calendar: CalendarDay[];
}

/* ---------- Dates ---------- */

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** « Aujourd'hui » dans un fuseau : vit dans `engine/zone.ts` (module pur), réexporté ici. */
export { localToday };

/* ---------- URLs (exportées pour les tests) ---------- */

const at2 = (v: number) => (Math.round(v * 100) / 100).toFixed(2);

/** Même constructeur que le reste du site : une seule entrée de cache par point (voir `metnoRequest`). */
export function forecastUrl(lat: number, lon: number): string {
  return metnoForecastUrl(lat, lon);
}

export function trendUrl(lat: number, lon: number, start: string, end: string): string {
  const q = new URLSearchParams({
    parameters: 'T2M_MAX,T2M_MIN,PRECTOTCORR,WS10M_MAX',
    community: 'RE',
    latitude: at2(lat),
    longitude: at2(lon),
    start: start.replaceAll('-', ''),
    end: end.replaceAll('-', ''),
    format: 'JSON',
  });
  return `${POWER}?${q.toString()}`;
}

/** Normales mensuelles de précipitations (climatologie 2001-2020) au point arrondi à 0,01°. */
export function climatologyUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    parameters: 'PRECTOTCORR',
    community: 'RE',
    longitude: at2(lon),
    latitude: at2(lat),
    format: 'JSON',
  });
  return `${POWER_CLIMATOLOGY}?${q.toString()}`;
}

/**
 * Normales mensuelles du kit (même climatologie, même arrondi à 0,01°) :
 * température moyenne, plus basse et plus haute relevées, précipitations.
 * Une demande de plus que `climatologyUrl` parce que les paramètres changent
 * l'adresse, donc l'entrée du cache : chaque lecture reste partagée 30 jours.
 */
export function climateNormalsUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    parameters: 'T2M,T2M_MIN,T2M_MAX,PRECTOTCORR',
    community: 'RE',
    longitude: at2(lon),
    latitude: at2(lat),
    format: 'JSON',
  });
  return `${POWER_CLIMATOLOGY}?${q.toString()}`;
}

/** Fuseau horaire du lieu (hors ligne), ou null quand il ne se retrouve pas (point invalide) : aucun repli. */
export function knownZoneAt(lat: number, lon: number): string | null {
  try {
    return tzLookup(lat, lon) || null;
  } catch {
    return null;
  }
}

/** Fuseau horaire du lieu (hors ligne) ; celui de l'app si la mer ou l'erreur l'empêche. */
export function zoneAt(lat: number, lon: number, fallback: string): string {
  return knownZoneAt(lat, lon) ?? fallback;
}

/**
 * Fuseau de la destination : celui du point donné (premier jour du voyage,
 * sinon le départ), le repli sans point. Côté serveur seulement (tz-lookup).
 */
export function destinationZone(point: { lat: number; lon: number } | null, fallback: string): string {
  return point ? zoneAt(point.lat, point.lon, fallback) : fallback;
}

async function getJson(url: string, revalidate: number, timeoutMs = 6000): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      next: { revalidate },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.warn('[compas] météo', new URL(url).host, res.status);
      return null;
    }
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/**
 * Normales mensuelles de précipitations au point (mm/jour, janvier → décembre),
 * ou null (service injoignable, mois manquant) : la période reste alors non
 * proposée, comme avant.
 */
export async function getPrecipNormals(lat: number, lon: number): Promise<{ precip: number[] } | null> {
  const precip = powerClimatology(await getJson(climatologyUrl(lat, lon), NORMALS_REVALIDATE_S, 8000));
  return precip ? { precip } : null;
}

/**
 * Normales mensuelles de température et de pluie au point, ou null (service
 * injoignable, mois ou mesure manquant) : le kit se passe alors des normales
 * (formulation prudente), il ne comble rien.
 */
export async function getClimateNormals(lat: number, lon: number): Promise<ClimateNormals | null> {
  return powerClimateNormals(await getJson(climateNormalsUrl(lat, lon), NORMALS_REVALIDATE_S, 8000));
}

function shiftYear(iso: string, years: number): string {
  const y = Number(iso.slice(0, 4)) - years;
  const md = iso.slice(5, 10) === '02-29' ? '02-28' : iso.slice(5, 10);
  return `${y}-${md}`;
}

/**
 * Fenêtre de la tendance (NASA POWER), calée sur des mois entiers (plan 1.8) :
 * du premier jour du mois, `TREND_YEARS` ans avant le premier jour voulu, au
 * dernier jour du mois, un an avant le dernier. La même URL, donc le même cache,
 * sert tout le mois à tous les voyages du même point, au lieu d'une URL (et
 * d'un appel) de plus chaque jour. La fenêtre couvre toujours les jours voulus.
 */
export function trendWindow(first: string, last: string): { start: string; end: string } {
  const start = `${shiftYear(first, TREND_YEARS).slice(0, 7)}-01`;
  const endMonth = shiftYear(last, 1).slice(0, 7);
  const [y, m] = endMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start, end: `${endMonth}-${String(lastDay).padStart(2, '0')}` };
}

/* ---------- Chargement ---------- */

export async function getCompasWeather(input: {
  origin: { lat: number; lon: number } | null;
  tripDays: Array<{ day: number; date: string; lat: number; lon: number }>;
  /** Repli quand le lieu ne donne aucun fuseau. */
  timeZone: string;
  now?: Date;
}): Promise<CompasWeather | null> {
  if (!input.origin && input.tripDays.length === 0) return null;
  // Les dates du calendrier et des jours du voyage sont celles de la
  // DESTINATION : « aujourd'hui » s'y lit aussi (premier jour, sinon départ).
  const zone = destinationZone(input.tripDays[0] ?? input.origin, input.timeZone);
  const today = localToday(zone, input.now);
  const horizon = addDays(today, FORECAST_HORIZON_DAYS - 1);

  // 1. Jours du voyage dans l'horizon : une prévision par point (cache partagé).
  const inHorizon = input.tripDays.filter((d) => d.date >= today && d.date <= horizon);
  const byPoint = new Map<string, typeof inHorizon>();
  for (const d of inHorizon) {
    const key = `${at2(d.lat)},${at2(d.lon)}`;
    byPoint.set(key, [...(byPoint.get(key) ?? []), d]);
  }
  const tripForecasts = new Map<string, DayForecast>();
  await Promise.all(
    [...byPoint.values()].map(async (days) => {
      const { lat, lon } = days[0];
      const payload = await metnoGet(forecastUrl(lat, lon), { timeoutMs: 6000 });
      for (const f of parseMetNo(payload, zoneAt(lat, lon, input.timeZone))) {
        for (const d of days) if (d.date === f.date) tripForecasts.set(`${d.day}`, f);
      }
    })
  );

  // 2. Calendrier 6 semaines au point de départ : prévision puis tendance.
  let calendar: CalendarDay[] = [];
  if (input.origin) {
    const { lat, lon } = input.origin;
    const dates = Array.from({ length: CALENDAR_DAYS }, (_, i) => addDays(today, i));
    const span = trendWindow(dates[0], dates[dates.length - 1]);
    const [forecastPayload, powerPayload] = await Promise.all([
      metnoGet(forecastUrl(lat, lon), { timeoutMs: 6000 }),
      getJson(trendUrl(lat, lon, span.start, span.end), 7 * 86_400, 8000),
    ]);
    const forecast = parseMetNo(forecastPayload, zoneAt(lat, lon, input.timeZone)).filter(
      (f) => f.date >= today
    );
    const covered = new Set(forecast.map((f) => f.date));
    const daily = powerToDaily(powerPayload);
    const trend = averageTrend(
      daily ? [daily] : [],
      dates.filter((d) => !covered.has(d))
    );
    calendar = buildCalendar(dates, forecast, trend);
  }

  return {
    source: METNO_SOURCE,
    trendSource: POWER_SOURCE,
    horizon,
    tripDays: input.tripDays.map((d) => ({
      ...d,
      forecast: tripForecasts.get(`${d.day}`) ?? null,
    })),
    calendar,
  };
}

/* ---------- Lot P2 : Cellule 4 décimales MET Norway & Adaptateur Météo-France (AROME / DPObs / BRA) ---------- */

export const METEO_FRANCE_SOURCE =
  'Météo-France — Données Publiques (AROME / DPObs / BRA) — Licence Ouverte Etalab 2.0';
export const METEO_FRANCE_LICENCE = 'Licence Ouverte Etalab 2.0';
export const METNO_LICENCE = 'CC BY 4.0';

/** TTL du cache serveur par cellule 4 décimales (45 min, conforme à Expires MET Norway). */
export const WEATHER_CELL_CACHE_TTL_MS = 45 * 60 * 1000;

const METNO_FORECAST_BASE_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';

/**
 * Arrondit une coordonnée géographique à 4 décimales (~11 m),
 * conformément à la clause technique MET Norway (<= 4 décimales).
 */
export function roundCoord4(coord: number): number {
  if (!Number.isFinite(coord)) return 0;
  return Math.round(coord * 10_000) / 10_000;
}

/** Clé de cache canonique par cellule géographique à 4 décimales. */
export function coordCellKey4(lat: number, lon: number): string {
  return `${roundCoord4(lat).toFixed(4)},${roundCoord4(lon).toFixed(4)}`;
}

/** URL MET Norway Locationforecast 2.0 avec coordonnées tronquées/arrondies à 4 décimales. */
export function metnoForecastUrl4(lat: number, lon: number): string {
  const rLat = roundCoord4(lat).toFixed(4);
  const rLon = roundCoord4(lon).toFixed(4);
  return `${METNO_FORECAST_BASE_URL}?lat=${rLat}&lon=${rLon}`;
}

/** Retourne le User-Agent officiel LKDV utilisé pour les requêtes météo serveur. */
export function getLkdvWeatherUserAgent(): string {
  return USER_AGENT;
}

/** Vérifie que le User-Agent identifie bien LKDV (+https://...). */
export function verifyLkdvWeatherUserAgent(ua: string = USER_AGENT): string {
  assertValidLkdvUserAgent(ua);
  return ua;
}

export { isValidLkdvUserAgent };

export interface AromeForecastPoint {
  tempC: number;
  /** Vitesse du vent à 10 m en m/s (jamais convertie en km/h hors Wind Chill). */
  windMs: number;
  windDirectionDeg: number | null;
  precipMmPerH: number;
  humidityPct: number | null;
  freezingLevelM: number | null;
  snowDepthCm: number | null;
  updatedAt: string;
}

export interface DpObsStationReading {
  stationId: string;
  observedAt: string;
  tempC: number | null;
  windMs: number | null;
  windDirectionDeg: number | null;
  precipMmLast1h: number | null;
  precipHistory72hMm: number[];
  humidityPct: number | null;
}

export type BraRiskIndex = 1 | 2 | 3 | 4 | 5;

export interface BraAvalancheBulletin {
  massifId: string;
  massifName: string | null;
  validFrom: string;
  validUntil: string | null;
  /** Indice de risque d'avalanche 1..5 (échelle européenne). */
  riskIndex: BraRiskIndex;
  accidentalTriggeringSummary: string | null;
  /**
   * Garde-fou éthique (Lot P1/P2) : l'indice BRA alimente exclusivement
   * l'objet `risque` séparé et ne doit JAMAIS majorer le score d'effort (IEA/ERP).
   */
  forRiskObjectOnly: true;
}

export interface MeteoFranceWeatherSnapshot {
  provider: 'meteo-france' | 'met-norway';
  cellKey: string;
  coordinates: { lat: number; lon: number };
  tempC: number;
  windMs: number;
  windDirectionDeg: number | null;
  precipMmPerH: number;
  humidityPct: number | null;
  freezingLevelM: number | null;
  snowDepthCm: number | null;
  dpObs: DpObsStationReading | null;
  bra: BraAvalancheBulletin | null;
  attribution: string;
  licenceSnapshot: string;
  capturedAt: string;
  modelUpdatedAt: string;
  fallbackUsed: boolean;
  fromCache: boolean;
  evidence: {
    tempC: Evidence<number>;
    windMs: Evidence<number>;
    precipMmPerH: Evidence<number>;
    braRiskIndex?: Evidence<BraRiskIndex>;
  };
}

interface CachedWeatherCellEntry {
  snapshot: MeteoFranceWeatherSnapshot;
  expiresAtMs: number;
}

const weatherCellCache = new Map<string, CachedWeatherCellEntry>();

export function clearWeatherCellCache(): void {
  weatherCellCache.clear();
}

export function getWeatherCellCacheSize(): number {
  return weatherCellCache.size;
}

function finiteNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Convertit une température en °C si elle est fournie en Kelvin (ex. GRIB2 t2m > 170 K). */
function normalizeTempToCelsius(rawTemp: number): number {
  const c = rawTemp > 170 ? rawTemp - 273.15 : rawTemp;
  return Math.round(c * 100) / 100;
}

/**
 * Parse un payload JSON ou GRIB2 simulé Météo-France AROME (0.01° / 0.025°).
 * Supporte les champs directs (`tempC`, `windMs`, `windDirectionDeg`, `precipMmPerH`)
 * ainsi que les champs GRIB2 standards (`t2m` en K, `u10`/`v10` en m/s, `tp` en mm).
 */
export function parseAromePayload(
  payload: unknown,
  fallbackNowIso: string = new Date().toISOString()
): AromeForecastPoint | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const data =
    root.grib && typeof root.grib === 'object'
      ? (root.grib as Record<string, unknown>)
      : root.forecast && typeof root.forecast === 'object'
        ? (root.forecast as Record<string, unknown>)
        : root;

  const rawTemp =
    finiteNum(data.tempC) ??
    finiteNum(data.temperature_c) ??
    finiteNum(data.t2m) ??
    finiteNum(data.T2M);
  if (rawTemp === null) return null;
  const tempC = normalizeTempToCelsius(rawTemp);

  let windMs =
    finiteNum(data.windMs) ??
    finiteNum(data.wind_speed_ms) ??
    finiteNum(data.ff) ??
    finiteNum(data.ws10m);
  let windDirectionDeg =
    finiteNum(data.windDirectionDeg) ??
    finiteNum(data.wind_direction_deg) ??
    finiteNum(data.dd);

  const u10 = finiteNum(data.u10) ?? finiteNum(data.U10);
  const v10 = finiteNum(data.v10) ?? finiteNum(data.V10);
  if (windMs === null && u10 !== null && v10 !== null) {
    windMs = Math.round(Math.hypot(u10, v10) * 100) / 100;
  }
  if (windDirectionDeg === null && u10 !== null && v10 !== null && (u10 !== 0 || v10 !== 0)) {
    const dir = (Math.atan2(-u10, -v10) * 180) / Math.PI;
    windDirectionDeg = Math.round(((dir % 360) + 360) % 360);
  }

  if (windMs === null || windMs < 0) return null;

  const precipMmPerH = Math.max(
    0,
    finiteNum(data.precipMmPerH) ??
      finiteNum(data.precipitation_mm_h) ??
      finiteNum(data.tp) ??
      finiteNum(data.rr1) ??
      0
  );

  const humidityPct =
    finiteNum(data.humidityPct) ?? finiteNum(data.rh2m) ?? finiteNum(data.u) ?? null;
  const freezingLevelM =
    finiteNum(data.freezingLevelM) ?? finiteNum(data.isoZeroM) ?? null;
  const snowDepthCm =
    finiteNum(data.snowDepthCm) ??
    (finiteNum(data.sd_m) !== null ? Math.round((finiteNum(data.sd_m) as number) * 100) : null);

  const updatedAtRaw =
    typeof data.updatedAt === 'string'
      ? data.updatedAt
      : typeof root.updatedAt === 'string'
        ? root.updatedAt
        : typeof root.referenceTime === 'string'
          ? root.referenceTime
          : fallbackNowIso;

  return {
    tempC,
    windMs: Math.round(windMs * 100) / 100,
    windDirectionDeg:
      windDirectionDeg !== null ? ((Math.round(windDirectionDeg) % 360) + 360) % 360 : null,
    precipMmPerH: Math.round(precipMmPerH * 100) / 100,
    humidityPct: humidityPct !== null ? Math.min(100, Math.max(0, humidityPct)) : null,
    freezingLevelM,
    snowDepthCm: snowDepthCm !== null ? Math.max(0, snowDepthCm) : null,
    updatedAt: updatedAtRaw,
  };
}

/**
 * Parse un payload d'observation station Météo-France DPObs.
 */
export function parseDpObsPayload(
  payload: unknown,
  fallbackNowIso: string = new Date().toISOString()
): DpObsStationReading | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = Array.isArray(payload) ? (payload[0] as Record<string, unknown> | undefined) : (payload as Record<string, unknown>);
  if (!raw || typeof raw !== 'object') return null;

  const stationId = String(raw.stationId ?? raw.id_station ?? raw.geo_id_insee ?? '').trim();
  if (!stationId) return null;

  const observedAt =
    typeof raw.observedAt === 'string'
      ? raw.observedAt
      : typeof raw.validity_time === 'string'
        ? raw.validity_time
        : typeof raw.reference_time === 'string'
          ? raw.reference_time
          : fallbackNowIso;

  const rawTemp = finiteNum(raw.tempC) ?? finiteNum(raw.t);
  const tempC = rawTemp !== null ? normalizeTempToCelsius(rawTemp) : null;
  const windMs = finiteNum(raw.windMs) ?? finiteNum(raw.ff);
  const windDirectionDeg = finiteNum(raw.windDirectionDeg) ?? finiteNum(raw.dd);
  const precipMmLast1h = finiteNum(raw.precipMmLast1h) ?? finiteNum(raw.rr1);
  const humidityPct = finiteNum(raw.humidityPct) ?? finiteNum(raw.u);

  const historyRaw = Array.isArray(raw.precipHistory72hMm)
    ? raw.precipHistory72hMm
    : Array.isArray(raw.rr_72h)
      ? raw.rr_72h
      : [];
  const precipHistory72hMm = historyRaw
    .map((v) => finiteNum(v))
    .filter((v): v is number => v !== null && v >= 0)
    .slice(0, 72);

  return {
    stationId,
    observedAt,
    tempC,
    windMs: windMs !== null && windMs >= 0 ? Math.round(windMs * 100) / 100 : null,
    windDirectionDeg:
      windDirectionDeg !== null ? ((Math.round(windDirectionDeg) % 360) + 360) % 360 : null,
    precipMmLast1h: precipMmLast1h !== null && precipMmLast1h >= 0 ? precipMmLast1h : null,
    precipHistory72hMm,
    humidityPct: humidityPct !== null ? Math.min(100, Math.max(0, humidityPct)) : null,
  };
}

/**
 * Parse un Bulletin d'Estimation du Risque d'Avalanche (BRA Météo-France).
 * L'indice de risque est borné à 1..5 et marqué `forRiskObjectOnly: true`.
 */
export function parseBraPayload(
  payload: unknown,
  fallbackNowIso: string = new Date().toISOString()
): BraAvalancheBulletin | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  const massifId = String(raw.massifId ?? raw.id_massif ?? raw.MASSIF ?? '').trim();
  if (!massifId) return null;

  const rawRisk =
    finiteNum(raw.riskIndex) ??
    finiteNum(raw.RISQUE_MAX) ??
    finiteNum(raw.risque_max) ??
    finiteNum(raw.risque1);
  if (rawRisk === null) return null;
  const roundedRisk = Math.round(rawRisk);
  if (roundedRisk < 1 || roundedRisk > 5) return null;

  return {
    massifId,
    massifName:
      typeof raw.massifName === 'string'
        ? raw.massifName
        : typeof raw.nom_massif === 'string'
          ? raw.nom_massif
          : null,
    validFrom:
      typeof raw.validFrom === 'string'
        ? raw.validFrom
        : typeof raw.date_validite === 'string'
          ? raw.date_validite
          : fallbackNowIso,
    validUntil:
      typeof raw.validUntil === 'string'
        ? raw.validUntil
        : typeof raw.date_echeance === 'string'
          ? raw.date_echeance
          : null,
    riskIndex: roundedRisk as BraRiskIndex,
    accidentalTriggeringSummary:
      typeof raw.accidentalTriggeringSummary === 'string'
        ? raw.accidentalTriggeringSummary
        : typeof raw.resume_declenchements === 'string'
          ? raw.resume_declenchements
          : null,
    forRiskObjectOnly: true,
  };
}

/**
 * Extrait un point météo instantané (tempC en °C, windMs en m/s, precipMmPerH en mm/h)
 * depuis une réponse MET Norway `locationforecast/2.0/complete` pour le repli transparent.
 */
export function parseMetNoInstantForEffort(
  payload: unknown,
  fallbackNowIso: string = new Date().toISOString()
): AromeForecastPoint | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as {
    properties?: {
      meta?: { updated_at?: unknown };
      timeseries?: Array<{
        time?: unknown;
        data?: {
          instant?: { details?: Record<string, unknown> };
          next_1_hours?: { details?: Record<string, unknown> };
          next_6_hours?: { details?: Record<string, unknown> };
        };
      }>;
    };
  };
  const series = Array.isArray(p.properties?.timeseries) ? p.properties.timeseries : [];
  if (series.length === 0) return null;

  const first = series[0];
  const inst = first.data?.instant?.details ?? {};
  const next1h = first.data?.next_1_hours?.details;
  const next6h = first.data?.next_6_hours?.details;

  const tempC = finiteNum(inst.air_temperature);
  const windMs = finiteNum(inst.wind_speed);
  if (tempC === null || windMs === null || windMs < 0) return null;

  const windDirectionDeg = finiteNum(inst.wind_from_direction);
  const humidityPct = finiteNum(inst.relative_humidity);
  const precip1h = finiteNum(next1h?.precipitation_amount);
  const precip6h = finiteNum(next6h?.precipitation_amount);
  const precipMmPerH =
    precip1h !== null ? Math.max(0, precip1h) : precip6h !== null ? Math.max(0, precip6h / 6) : 0;

  const updatedAt =
    typeof p.properties?.meta?.updated_at === 'string'
      ? p.properties.meta.updated_at
      : typeof first.time === 'string'
        ? first.time
        : fallbackNowIso;

  return {
    tempC: Math.round(tempC * 100) / 100,
    windMs: Math.round(windMs * 100) / 100,
    windDirectionDeg:
      windDirectionDeg !== null ? ((Math.round(windDirectionDeg) % 360) + 360) % 360 : null,
    precipMmPerH: Math.round(precipMmPerH * 100) / 100,
    humidityPct: humidityPct !== null ? Math.min(100, Math.max(0, humidityPct)) : null,
    freezingLevelM: null,
    snowDepthCm: null,
    updatedAt,
  };
}

export interface FetchMeteoFranceAromeObsBraInput {
  lat: number;
  lon: number;
  nowIso?: string;
  aromeUrl?: string;
  dpObsUrl?: string;
  braUrl?: string;
  metnoUrl?: string;
  preferCache?: boolean;
  cacheTtlMs?: number;
}

export interface FetchMeteoFranceDeps {
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
  userAgent?: string;
  nowMs?: () => number;
}

async function fetchJsonWithGuard(
  url: string,
  fetchFn: (url: string, init?: RequestInit) => Promise<Response>,
  userAgent: string
): Promise<unknown | null> {
  assertNoForbiddenProdProvider(url);
  try {
    const res = await fetchFn(url, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/**
 * Adaptateur météo unifié Lot P2 :
 * - Priorité à Météo-France Données Publiques (AROME + DPObs + BRA, Licence Ouverte Etalab 2.0)
 * - Repli transparent sur MET Norway (CC BY 4.0) en cas d'indisponibilité ou d'absence de couverture
 * - Cache serveur par cellule géographique arrondie à 4 décimales `(roundCoord4(lat), roundCoord4(lon))`
 * - Vérification stricte du User-Agent LKDV et interdiction totale d'Open-Meteo public (`api.open-meteo.com`)
 */
export async function fetchMeteoFranceAromeObsBra(
  input: FetchMeteoFranceAromeObsBraInput,
  deps: FetchMeteoFranceDeps = {}
): Promise<MeteoFranceWeatherSnapshot | null> {
  const userAgent = verifyLkdvWeatherUserAgent(deps.userAgent ?? USER_AGENT);
  const fetchFn = deps.fetchFn ?? ((url: string, init?: RequestInit) => fetch(url, init));
  const nowMs = deps.nowMs ?? Date.now;
  const capturedAt = input.nowIso ?? new Date(nowMs()).toISOString();

  const roundedLat = roundCoord4(input.lat);
  const roundedLon = roundCoord4(input.lon);
  const cellKey = coordCellKey4(roundedLat, roundedLon);

  // Vérification coupe-circuit sur toutes les URLs passées en entrée
  if (input.aromeUrl) assertNoForbiddenProdProvider(input.aromeUrl);
  if (input.dpObsUrl) assertNoForbiddenProdProvider(input.dpObsUrl);
  if (input.braUrl) assertNoForbiddenProdProvider(input.braUrl);
  if (input.metnoUrl) assertNoForbiddenProdProvider(input.metnoUrl);

  const useCache = input.preferCache ?? true;
  const currentMs = nowMs();
  if (useCache) {
    const cached = weatherCellCache.get(cellKey);
    if (cached && cached.expiresAtMs > currentMs) {
      return {
        ...cached.snapshot,
        fromCache: true,
      };
    }
  }

  const aromeUrl =
    input.aromeUrl ??
    `https://public-api.meteofrance.fr/public/arome/1.0/point?lat=${roundedLat.toFixed(4)}&lon=${roundedLon.toFixed(4)}`;
  const metnoUrl = input.metnoUrl ?? metnoForecastUrl4(roundedLat, roundedLon);

  const [aromeRaw, dpObsRaw, braRaw] = await Promise.all([
    fetchJsonWithGuard(aromeUrl, fetchFn, userAgent),
    input.dpObsUrl ? fetchJsonWithGuard(input.dpObsUrl, fetchFn, userAgent) : Promise.resolve(null),
    input.braUrl ? fetchJsonWithGuard(input.braUrl, fetchFn, userAgent) : Promise.resolve(null),
  ]);

  const arome = parseAromePayload(aromeRaw, capturedAt);
  const dpObs = parseDpObsPayload(dpObsRaw, capturedAt);
  const bra = parseBraPayload(braRaw, capturedAt);

  if (arome) {
    const tempC = dpObs?.tempC ?? arome.tempC;
    const windMs = dpObs?.windMs ?? arome.windMs;
    const windDirectionDeg = dpObs?.windDirectionDeg ?? arome.windDirectionDeg;
    const precipMmPerH = dpObs?.precipMmLast1h ?? arome.precipMmPerH;
    const humidityPct = dpObs?.humidityPct ?? arome.humidityPct;
    const modelUpdatedAt = arome.updatedAt;
    const licenceSnapshot = formatLicenceSnapshot('meteo_france_open_data', modelUpdatedAt);

    const snapshot: MeteoFranceWeatherSnapshot = {
      provider: 'meteo-france',
      cellKey,
      coordinates: { lat: roundedLat, lon: roundedLon },
      tempC,
      windMs,
      windDirectionDeg,
      precipMmPerH,
      humidityPct,
      freezingLevelM: arome.freezingLevelM,
      snowDepthCm: arome.snowDepthCm,
      dpObs,
      bra,
      attribution: METEO_FRANCE_SOURCE,
      licenceSnapshot,
      capturedAt,
      modelUpdatedAt,
      fallbackUsed: false,
      fromCache: false,
      evidence: {
        tempC: buildProviderEvidence({
          providerId: 'meteo_france_open_data',
          value: tempC,
          unit: 'degC',
          kind: dpObs?.tempC != null ? 'measured' : 'derived',
          quality: dpObs?.tempC != null ? 0.96 : 0.9,
          capturedAt,
          updatedAt: modelUpdatedAt,
          modelVersion: 'arome-hd-0.01',
          sourceDetail: dpObs?.tempC != null ? `DPObs station ${dpObs.stationId}` : 'AROME',
        }),
        windMs: buildProviderEvidence({
          providerId: 'meteo_france_open_data',
          value: windMs,
          unit: 'm/s',
          kind: dpObs?.windMs != null ? 'measured' : 'derived',
          quality: dpObs?.windMs != null ? 0.95 : 0.88,
          capturedAt,
          updatedAt: modelUpdatedAt,
          modelVersion: 'arome-hd-0.01',
          sourceDetail: dpObs?.windMs != null ? `DPObs station ${dpObs.stationId}` : 'AROME',
        }),
        precipMmPerH: buildProviderEvidence({
          providerId: 'meteo_france_open_data',
          value: precipMmPerH,
          unit: 'mm/h',
          kind: dpObs?.precipMmLast1h != null ? 'measured' : 'derived',
          quality: dpObs?.precipMmLast1h != null ? 0.94 : 0.85,
          capturedAt,
          updatedAt: modelUpdatedAt,
          modelVersion: 'arome-hd-0.01',
          sourceDetail: dpObs?.precipMmLast1h != null ? `DPObs station ${dpObs.stationId}` : 'AROME',
        }),
        ...(bra
          ? {
              braRiskIndex: buildProviderEvidence({
                providerId: 'meteo_france_open_data',
                value: bra.riskIndex,
                unit: 'bra_index_1_5',
                kind: 'derived',
                quality: 0.95,
                capturedAt,
                updatedAt: bra.validFrom,
                modelVersion: 'bra-v1',
                sourceDetail: `BRA massif ${bra.massifId} (objet risque uniquement)`,
              }),
            }
          : {}),
      },
    };

    weatherCellCache.set(cellKey, {
      snapshot,
      expiresAtMs: currentMs + (input.cacheTtlMs ?? WEATHER_CELL_CACHE_TTL_MS),
    });
    return snapshot;
  }

  // Repli transparent sur MET Norway (CC BY 4.0)
  const metnoRaw = await fetchJsonWithGuard(metnoUrl, fetchFn, userAgent);
  const metnoPoint = parseMetNoInstantForEffort(metnoRaw, capturedAt);
  if (!metnoPoint) return null;

  const licenceSnapshot = formatLicenceSnapshot('met_norway', metnoPoint.updatedAt);
  const fallbackSnapshot: MeteoFranceWeatherSnapshot = {
    provider: 'met-norway',
    cellKey,
    coordinates: { lat: roundedLat, lon: roundedLon },
    tempC: metnoPoint.tempC,
    windMs: metnoPoint.windMs,
    windDirectionDeg: metnoPoint.windDirectionDeg,
    precipMmPerH: metnoPoint.precipMmPerH,
    humidityPct: metnoPoint.humidityPct,
    freezingLevelM: metnoPoint.freezingLevelM,
    snowDepthCm: metnoPoint.snowDepthCm,
    dpObs,
    bra,
    attribution: 'MET Norway (Yr) — CC BY 4.0',
    licenceSnapshot,
    capturedAt,
    modelUpdatedAt: metnoPoint.updatedAt,
    fallbackUsed: true,
    fromCache: false,
    evidence: {
      tempC: buildProviderEvidence({
        providerId: 'met_norway',
        value: metnoPoint.tempC,
        unit: 'degC',
        kind: 'derived',
        quality: 0.85,
        capturedAt,
        updatedAt: metnoPoint.updatedAt,
        modelVersion: 'locationforecast-2.0',
      }),
      windMs: buildProviderEvidence({
        providerId: 'met_norway',
        value: metnoPoint.windMs,
        unit: 'm/s',
        kind: 'derived',
        quality: 0.82,
        capturedAt,
        updatedAt: metnoPoint.updatedAt,
        modelVersion: 'locationforecast-2.0',
      }),
      precipMmPerH: buildProviderEvidence({
        providerId: 'met_norway',
        value: metnoPoint.precipMmPerH,
        unit: 'mm/h',
        kind: 'derived',
        quality: 0.8,
        capturedAt,
        updatedAt: metnoPoint.updatedAt,
        modelVersion: 'locationforecast-2.0',
      }),
      ...(bra
        ? {
            braRiskIndex: buildProviderEvidence({
              providerId: 'meteo_france_open_data',
              value: bra.riskIndex,
              unit: 'bra_index_1_5',
              kind: 'derived',
              quality: 0.95,
              capturedAt,
              updatedAt: bra.validFrom,
              modelVersion: 'bra-v1',
              sourceDetail: `BRA massif ${bra.massifId} (objet risque uniquement)`,
            }),
          }
        : {}),
    },
  };

  weatherCellCache.set(cellKey, {
    snapshot: fallbackSnapshot,
    expiresAtMs: currentMs + (input.cacheTtlMs ?? WEATHER_CELL_CACHE_TTL_MS),
  });
  return fallbackSnapshot;
}
