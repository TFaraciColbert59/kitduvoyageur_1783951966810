import SunCalc from 'suncalc';
import type { DayForecast, HourCondition } from './weather';

/**
 * Compas — lecture PURE de deux sources météo gratuites, usage commercial
 * permis (décision du 2026-10-05 : Open-Meteo n'est gratuit qu'en usage non
 * commercial) :
 *
 * - MET Norway / Yr, `locationforecast/2.0/complete` : prévision mondiale,
 *   heure par heure sur ~2,5 jours puis par pas de 6 h jusqu'à ~9 jours.
 *   Licence CC BY 4.0 (citer « MET Norway »).
 * - NASA POWER, données journalières : la tendance des années passées
 *   au-delà de l'horizon de prévision. Domaine public.
 *
 * Ce que MET Norway ne donne pas n'est jamais inventé : la probabilité de
 * pluie et les rafales n'existent que sur certaines zones (Nordiques) et
 * restent `null` ailleurs. Deux valeurs sont DÉRIVÉES, et documentées :
 * le jour ou la nuit (position du soleil, SunCalc) et l'isotherme 0 °C,
 * estimée depuis la température et l'altitude du point (gradient standard
 * de 6,5 °C par km).
 */

export const METNO_SOURCE = 'MET Norway';
export const POWER_SOURCE = 'NASA POWER';
const LAPSE_C_PER_M = 0.0065;

/* ---------- Codes ---------- */

/**
 * Symbole Yr → code météo WMO (celui que lit le reste du Compas). La neige
 * fondue n'a pas de code WMO dans notre table : elle compte comme pluie.
 */
export function symbolToWmo(symbol: unknown): number | null {
  if (typeof symbol !== 'string' || !symbol) return null;
  const s = symbol.replace(/_(day|night|polartwilight)$/, '');
  if (s.includes('thunder')) return 95;
  const table: Record<string, number> = {
    clearsky: 0,
    fair: 1,
    partlycloudy: 2,
    cloudy: 3,
    fog: 45,
    lightrain: 61,
    rain: 63,
    heavyrain: 65,
    lightsleet: 61,
    sleet: 63,
    heavysleet: 65,
    lightrainshowers: 80,
    rainshowers: 81,
    heavyrainshowers: 82,
    lightsleetshowers: 80,
    sleetshowers: 81,
    heavysleetshowers: 82,
    lightsnow: 71,
    snow: 73,
    heavysnow: 75,
    lightsnowshowers: 85,
    snowshowers: 85,
    heavysnowshowers: 86,
  };
  return table[s] ?? null;
}

/* ---------- Heure locale ---------- */

const formatters = new Map<string, Intl.DateTimeFormat>();
function fmt(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
    } catch {
      f = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
    }
    formatters.set(timeZone, f);
  }
  return f;
}

/** Instant → « YYYY-MM-DDTHH:MM » à l'heure locale du lieu. */
export function localStamp(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(fmt(timeZone).formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/* ---------- Lecture défensive ---------- */

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

interface Period {
  summary?: { symbol_code?: unknown };
  details?: Record<string, unknown>;
}

interface Step {
  time?: unknown;
  data?: {
    instant?: { details?: Record<string, unknown> };
    next_1_hours?: Period;
    next_6_hours?: Period;
  };
}

/**
 * Réponse `locationforecast/2.0/complete` → jours lisibles, à l'heure locale
 * du lieu. Un pas horaire porte sa pluie de l'heure ; un pas de 6 h, celle de
 * ses 6 heures : la somme d'un jour ne compte jamais deux fois la même pluie.
 */
export function parseMetNo(payload: unknown, timeZone: string): DayForecast[] {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as {
    geometry?: { coordinates?: unknown };
    properties?: { timeseries?: unknown };
  };
  const coords = Array.isArray(p.geometry?.coordinates) ? p.geometry.coordinates : [];
  const lon = num(coords[0]);
  const lat = num(coords[1]);
  const altitude = num(coords[2]);
  const series = Array.isArray(p.properties?.timeseries) ? (p.properties.timeseries as Step[]) : [];
  if (lat == null || lon == null) return [];

  interface Acc {
    hours: HourCondition[];
    temps: number[];
    precipMm: number | null;
    precipPct: number | null;
    gust: number | null;
    code: number | null;
  }
  const days = new Map<string, Acc>();

  for (const step of series) {
    if (typeof step?.time !== 'string') continue;
    const at = new Date(step.time);
    if (Number.isNaN(at.getTime())) continue;
    const stamp = localStamp(at, timeZone);
    const day = stamp.slice(0, 10);
    const d = step.data ?? {};
    const inst = d.instant?.details ?? {};
    const period = d.next_1_hours ?? d.next_6_hours;
    const pd = period?.details ?? {};

    const tempC = num(inst.air_temperature);
    const wind = num(inst.wind_speed);
    const gust = num(inst.wind_speed_of_gust);
    const precipMm = num(pd.precipitation_amount);
    const precipPct = num(pd.probability_of_precipitation);
    const code = symbolToWmo(period?.summary?.symbol_code);
    const sunAlt = SunCalc.getPosition(at, lat, lon).altitude;

    const hour: HourCondition = {
      time: stamp,
      tempC,
      precipPct: precipPct == null ? null : Math.round(precipPct),
      precipMm: precipMm == null ? null : round1(precipMm),
      windKmh: wind == null ? null : Math.round(wind * 3.6),
      gustKmh: gust == null ? null : Math.round(gust * 3.6),
      code,
      freezingM:
        tempC == null || altitude == null
          ? null
          : Math.max(0, Math.round((altitude + tempC / LAPSE_C_PER_M) / 50) * 50),
      isDay: Number.isFinite(sunAlt) ? sunAlt > 0 : null,
    };

    const accFor = (key: string): Acc => {
      const a = days.get(key) ?? { hours: [], temps: [], precipMm: null, precipPct: null, gust: null, code: null };
      days.set(key, a);
      return a;
    };
    // L'instant appartient à son jour ; la période qu'il ouvre (1 h ou 6 h)
    // appartient au jour local qui contient son milieu : un pas de 6 h qui
    // commence à 23 h 45 à Katmandou couvre le lendemain.
    const acc = accFor(day);
    acc.hours.push(hour);
    if (tempC != null) acc.temps.push(tempC);
    const span = d.next_1_hours ? 1 : 6;
    const periodDay =
      span === 1 ? day : localStamp(new Date(at.getTime() + 3 * 3_600_000), timeZone).slice(0, 10);
    const pAcc = accFor(periodDay);
    const six = span === 6 ? d.next_6_hours?.details : null;
    for (const v of [num(six?.air_temperature_min), num(six?.air_temperature_max)]) {
      if (v != null) pAcc.temps.push(v);
    }
    if (precipMm != null) pAcc.precipMm = (pAcc.precipMm ?? 0) + precipMm;
    if (hour.precipPct != null) pAcc.precipPct = Math.max(pAcc.precipPct ?? 0, hour.precipPct);
    if (hour.gustKmh != null) acc.gust = Math.max(acc.gust ?? 0, hour.gustKmh);
    if (code != null) pAcc.code = Math.max(pAcc.code ?? 0, code);
  }

  return [...days.entries()]
    // Un jour qui ne reçoit que la fin d'une période de 6 h, sans aucun
    // instant prévu, n'est pas une prévision du jour : écarté.
    .filter(([, a]) => a.hours.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, a]): DayForecast => {
      const noon = new Date(`${date}T12:00:00Z`);
      const sun = SunCalc.getTimes(noon, lat, lon);
      const clock = (t: Date) =>
        Number.isNaN(t.getTime()) ? null : localStamp(t, timeZone).slice(11, 16);
      return {
        date,
        tMin: a.temps.length ? round1(Math.min(...a.temps)) : null,
        tMax: a.temps.length ? round1(Math.max(...a.temps)) : null,
        precipPct: a.precipPct,
        precipMm: a.precipMm == null ? null : round1(a.precipMm),
        gustMax: a.gust,
        code: a.code,
        sunrise: clock(sun.sunrise),
        sunset: clock(sun.sunset),
        hours: a.hours,
      };
    });
}

/* ---------- Tendance (NASA POWER) ---------- */

/**
 * Réponse NASA POWER journalière → même forme que l'archive lue par
 * `averageTrend` (une colonne par mesure, une ligne par jour). La valeur de
 * remplissage (-999) devient `null`. Le vent est le vent maximal à 10 m,
 * converti en km/h.
 */
export function powerToDaily(payload: unknown): { daily: Record<string, unknown[]> } | null {
  if (!payload || typeof payload !== 'object') return null;
  const param = (payload as { properties?: { parameter?: Record<string, Record<string, unknown>> } })
    .properties?.parameter;
  if (!param) return null;
  const fill = (payload as { header?: { fill_value?: unknown } }).header?.fill_value;
  const fillValue = typeof fill === 'number' ? fill : -999;
  const keys = Object.keys(param.T2M_MAX ?? param.T2M_MIN ?? param.PRECTOTCORR ?? {}).sort();
  if (!keys.length) return null;
  const read = (name: string, k: string, scale = 1) => {
    const v = num(param[name]?.[k]);
    return v == null || v === fillValue ? null : round1(v * scale);
  };
  return {
    daily: {
      time: keys.map((k) => `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`),
      temperature_2m_max: keys.map((k) => read('T2M_MAX', k)),
      temperature_2m_min: keys.map((k) => read('T2M_MIN', k)),
      precipitation_sum: keys.map((k) => read('PRECTOTCORR', k)),
      wind_gusts_10m_max: keys.map((k) => read('WS10M_MAX', k, 3.6)),
    },
  };
}

const MONTH_KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

/**
 * NASA POWER, climatologie (normales mensuelles 2001-2020) : précipitations
 * moyennes de janvier à décembre, en mm/jour. Un mois absent, illisible ou
 * égal à la valeur de remplissage (-999) : null, rien n'est comblé.
 */
export function powerClimatology(payload: unknown): number[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as {
    properties?: { parameter?: { PRECTOTCORR?: Record<string, unknown> } };
    header?: { fill_value?: unknown };
  };
  const series = p.properties?.parameter?.PRECTOTCORR;
  if (!series || typeof series !== 'object') return null;
  const fillRaw = p.header?.fill_value;
  const fill = typeof fillRaw === 'number' ? fillRaw : -999;
  const out: number[] = [];
  for (const k of MONTH_KEYS) {
    const v = num(series[k]);
    if (v == null || v === fill || v < 0) return null;
    out.push(v);
  }
  return out;
}
