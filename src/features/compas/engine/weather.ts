/**
 * Compas — conditions météo : lecture Open-Meteo, qualité des heures et des
 * jours, heure de départ conseillée. Module pur (aucun réseau) : le serveur
 * lui passe les réponses brutes, l'écran affiche le résultat.
 *
 * Règle : une colonne illisible invalide la valeur, jamais de zéro inventé
 * (le code météo 0 vaut « dégagé » : le combler par défaut mentirait).
 */

export type Quality = 'bon' | 'moyen' | 'mauvais';

export interface HourCondition {
  /** Heure locale « YYYY-MM-DDTHH:MM ». */
  time: string;
  tempC: number | null;
  precipPct: number | null;
  precipMm: number | null;
  windKmh: number | null;
  gustKmh: number | null;
  code: number | null;
  /** Altitude de l'isotherme 0 °C, en mètres. */
  freezingM: number | null;
  isDay: boolean | null;
}

export interface DayForecast {
  date: string;
  tMin: number | null;
  tMax: number | null;
  precipPct: number | null;
  precipMm: number | null;
  gustMax: number | null;
  code: number | null;
  sunrise: string | null;
  sunset: string | null;
  hours: HourCondition[];
}

/** Moyenne des mêmes jours sur les années passées (au-delà de l'horizon de prévision). */
export interface DayTrend {
  date: string;
  tMin: number | null;
  tMax: number | null;
  precipMm: number | null;
  gustMax: number | null;
  years: number;
}

export interface CalendarDay {
  date: string;
  kind: 'prevision' | 'tendance' | 'inconnu';
  quality: Quality | null;
  reasons: string[];
  tMin: number | null;
  tMax: number | null;
}

/* ---------- Lecture défensive ---------- */

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function col(source: Record<string, unknown> | undefined, key: string, i: number): number | null {
  const arr = source?.[key];
  return Array.isArray(arr) ? num(arr[i]) : null;
}

function clock(iso: unknown): string | null {
  if (typeof iso !== 'string') return null;
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : null;
}

/** Réponse Open-Meteo /v1/forecast (daily + hourly) → jours lisibles. */
export function parseForecast(payload: unknown): DayForecast[] {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as { daily?: Record<string, unknown>; hourly?: Record<string, unknown> };
  const dayTimes = Array.isArray(p.daily?.time) ? (p.daily?.time as unknown[]) : [];
  const hourTimes = Array.isArray(p.hourly?.time) ? (p.hourly?.time as unknown[]) : [];

  const hoursByDay = new Map<string, HourCondition[]>();
  hourTimes.forEach((t, i) => {
    if (typeof t !== 'string') return;
    const day = t.slice(0, 10);
    const isDay = col(p.hourly, 'is_day', i);
    const h: HourCondition = {
      time: t.slice(0, 16),
      tempC: col(p.hourly, 'temperature_2m', i),
      precipPct: col(p.hourly, 'precipitation_probability', i),
      precipMm: col(p.hourly, 'precipitation', i),
      windKmh: col(p.hourly, 'wind_speed_10m', i),
      gustKmh: col(p.hourly, 'wind_gusts_10m', i),
      code: col(p.hourly, 'weather_code', i),
      freezingM: col(p.hourly, 'freezing_level_height', i),
      isDay: isDay == null ? null : isDay === 1,
    };
    hoursByDay.set(day, [...(hoursByDay.get(day) ?? []), h]);
  });

  return dayTimes
    .map((t, i): DayForecast | null => {
      if (typeof t !== 'string') return null;
      const sunrise = Array.isArray(p.daily?.sunrise)
        ? clock((p.daily?.sunrise as unknown[])[i])
        : null;
      const sunset = Array.isArray(p.daily?.sunset)
        ? clock((p.daily?.sunset as unknown[])[i])
        : null;
      return {
        date: t.slice(0, 10),
        tMin: col(p.daily, 'temperature_2m_min', i),
        tMax: col(p.daily, 'temperature_2m_max', i),
        precipPct: col(p.daily, 'precipitation_probability_max', i),
        precipMm: col(p.daily, 'precipitation_sum', i),
        gustMax: col(p.daily, 'wind_gusts_10m_max', i),
        code: col(p.daily, 'weather_code', i),
        sunrise,
        sunset,
        hours: hoursByDay.get(t.slice(0, 10)) ?? [],
      };
    })
    .filter((d): d is DayForecast => d !== null);
}

/** Plusieurs réponses Open-Meteo /v1/archive (une par année) → moyenne par jour calendaire. */
export function averageTrend(payloads: unknown[], targetDates: string[]): DayTrend[] {
  const acc = new Map<
    string,
    { tMin: number[]; tMax: number[]; precip: number[]; gust: number[]; years: number }
  >();
  for (const payload of payloads) {
    if (!payload || typeof payload !== 'object') continue;
    const daily = (payload as { daily?: Record<string, unknown> }).daily;
    const times = Array.isArray(daily?.time) ? (daily?.time as unknown[]) : [];
    times.forEach((t, i) => {
      if (typeof t !== 'string') return;
      const md = t.slice(5, 10);
      const a = acc.get(md) ?? { tMin: [], tMax: [], precip: [], gust: [], years: 0 };
      a.years += 1;
      const push = (arr: number[], v: number | null) => {
        if (v != null) arr.push(v);
      };
      push(a.tMin, col(daily, 'temperature_2m_min', i));
      push(a.tMax, col(daily, 'temperature_2m_max', i));
      push(a.precip, col(daily, 'precipitation_sum', i));
      push(a.gust, col(daily, 'wind_gusts_10m_max', i));
      acc.set(md, a);
    });
  }
  const mean = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : null;
  return targetDates.map((date) => {
    const a = acc.get(date.slice(5, 10));
    return {
      date,
      tMin: a ? mean(a.tMin) : null,
      tMax: a ? mean(a.tMax) : null,
      precipMm: a ? mean(a.precip) : null,
      gustMax: a ? mean(a.gust) : null,
      years: a?.years ?? 0,
    };
  });
}

/* ---------- Qualité ---------- */

const STORM = (code: number | null) => code != null && code >= 95;
const SNOW = (code: number | null) =>
  code != null && ((code >= 71 && code <= 77) || code === 85 || code === 86);

function worst(a: Quality, b: Quality): Quality {
  const order: Quality[] = ['bon', 'moyen', 'mauvais'];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

/** Qualité d'une heure de marche, avec ses raisons. */
export function hourQuality(h: HourCondition): { quality: Quality; reasons: string[] } {
  let q: Quality = 'bon';
  const reasons: string[] = [];
  if (STORM(h.code)) {
    q = 'mauvais';
    reasons.push('orage');
  }
  if (h.precipPct != null && h.precipPct >= 70) {
    q = worst(q, 'mauvais');
    reasons.push(`pluie ${h.precipPct} %`);
  } else if (h.precipPct != null && h.precipPct >= 40) {
    q = worst(q, 'moyen');
    reasons.push(`pluie ${h.precipPct} %`);
  }
  if (h.gustKmh != null && h.gustKmh >= 60) {
    q = worst(q, 'mauvais');
    reasons.push(`rafales ${Math.round(h.gustKmh)} km/h`);
  } else if (h.gustKmh != null && h.gustKmh >= 40) {
    q = worst(q, 'moyen');
    reasons.push(`rafales ${Math.round(h.gustKmh)} km/h`);
  }
  if (h.isDay === false) {
    q = worst(q, 'moyen');
    reasons.push('nuit');
  }
  return { quality: q, reasons };
}

/** Qualité d'un jour de prévision. */
export function dayQuality(d: DayForecast): { quality: Quality; reasons: string[] } {
  let q: Quality = 'bon';
  const reasons: string[] = [];
  const storm = STORM(d.code) || d.hours.some((h) => STORM(h.code) && h.isDay !== false);
  if (storm) {
    q = 'mauvais';
    reasons.push('orages');
  }
  if (d.precipPct != null && d.precipPct >= 70) {
    q = worst(q, 'mauvais');
    reasons.push(`pluie probable (${d.precipPct} %)`);
  } else if (d.precipPct != null && d.precipPct >= 40) {
    q = worst(q, 'moyen');
    reasons.push(`risque de pluie (${d.precipPct} %)`);
  }
  if (d.gustMax != null && d.gustMax >= 60) {
    q = worst(q, 'mauvais');
    reasons.push(`rafales à ${Math.round(d.gustMax)} km/h`);
  } else if (d.gustMax != null && d.gustMax >= 45) {
    q = worst(q, 'moyen');
    reasons.push(`vent fort (${Math.round(d.gustMax)} km/h)`);
  }
  if (SNOW(d.code)) {
    q = worst(q, 'moyen');
    reasons.push('neige');
  }
  if (d.tMin != null && d.tMin <= -5) {
    q = worst(q, 'moyen');
    reasons.push(`froid (${Math.round(d.tMin)} °C)`);
  }
  return { quality: q, reasons };
}

/** Qualité d'un jour hors prévision, d'après la moyenne des années passées. */
export function trendQuality(t: DayTrend): { quality: Quality | null; reasons: string[] } {
  if (!t.years || (t.precipMm == null && t.gustMax == null)) return { quality: null, reasons: [] };
  let q: Quality = 'bon';
  const reasons: string[] = [];
  if (t.precipMm != null && t.precipMm >= 5) {
    q = 'mauvais';
    reasons.push(`souvent pluvieux (${t.precipMm} mm en moyenne)`);
  } else if (t.precipMm != null && t.precipMm >= 1.5) {
    q = 'moyen';
    reasons.push(`pluie fréquente (${t.precipMm} mm en moyenne)`);
  }
  if (t.gustMax != null && t.gustMax >= 55) {
    q = worst(q, 'moyen');
    reasons.push(`vent souvent fort (${Math.round(t.gustMax)} km/h)`);
  }
  return { quality: q, reasons };
}

/** Calendrier des conditions : prévision tant qu'elle existe, puis tendance. */
export function buildCalendar(
  dates: string[],
  forecast: DayForecast[],
  trend: DayTrend[]
): CalendarDay[] {
  const f = new Map(forecast.map((d) => [d.date, d]));
  const tr = new Map(trend.map((d) => [d.date, d]));
  return dates.map((date) => {
    const fd = f.get(date);
    if (fd) {
      const q = dayQuality(fd);
      return {
        date,
        kind: 'prevision',
        quality: q.quality,
        reasons: q.reasons,
        tMin: fd.tMin,
        tMax: fd.tMax,
      };
    }
    const td = tr.get(date);
    if (td) {
      const q = trendQuality(td);
      if (q.quality)
        return {
          date,
          kind: 'tendance',
          quality: q.quality,
          reasons: q.reasons,
          tMin: td.tMin,
          tMax: td.tMax,
        };
    }
    return { date, kind: 'inconnu', quality: null, reasons: [], tMin: null, tMax: null };
  });
}

/* ---------- Temps de marche et heure de départ ---------- */

export type Pace = 'tranquille' | 'normal' | 'soutenu';
const PACE_FACTOR: Record<Pace, number> = { tranquille: 0.85, normal: 1, soutenu: 1.15 };

/**
 * Temps de marche (méthode DIN 33466) : temps horizontal à la vitesse du plus
 * lent du groupe, temps vertical à 300 m/h en montée et 500 m/h en descente ;
 * le plus long des deux plus la moitié de l'autre.
 */
export function walkingMinutes(input: {
  distanceKm: number | null;
  gainM: number | null;
  lossM: number | null;
  flatSpeedKmh: number | null;
  pace: Pace;
}): number | null {
  if (input.distanceKm == null || input.distanceKm <= 0) return null;
  const speed =
    (input.flatSpeedKmh && input.flatSpeedKmh > 0 ? input.flatSpeedKmh : 4) *
    PACE_FACTOR[input.pace];
  const horizontal = input.distanceKm / speed;
  const vertical = (input.gainM ?? 0) / 300 + (input.lossM ?? 0) / 500;
  const hours = Math.max(horizontal, vertical) + Math.min(horizontal, vertical) / 2;
  return Math.round(hours * 60);
}

function toMin(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function toClock(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export interface DepartureAdvice {
  /** Départ conseillé : dès qu'il fait jour (pas avant 7 h). */
  start: string | null;
  /** Arrivée estimée avec les pauses (+15 %). */
  arrival: string | null;
  /** Départ au plus tard pour arriver avant la nuit et avant les orages. */
  latestStart: string | null;
  /** Première heure d'orage en journée, s'il y en a. */
  stormFrom: string | null;
  warning: string | null;
}

/** Heure de départ conseillée pour une journée de marche. */
export function departureAdvice(input: {
  walkMin: number | null;
  sunrise: string | null;
  sunset: string | null;
  hours: HourCondition[];
}): DepartureAdvice {
  const empty: DepartureAdvice = {
    start: null,
    arrival: null,
    latestStart: null,
    stormFrom: null,
    warning: null,
  };
  if (input.walkMin == null) return empty;
  const sunrise = toMin(input.sunrise);
  const sunset = toMin(input.sunset);
  if (sunrise == null || sunset == null) return empty;

  const stormHour = input.hours.find((h) => {
    const t = toMin(h.time.slice(11, 16));
    return STORM(h.code) && t != null && t >= sunrise && t <= sunset;
  });
  const stormFrom = stormHour ? toMin(stormHour.time.slice(11, 16)) : null;

  const total = Math.round(input.walkMin * 1.15);
  const deadline = Math.min(sunset - 30, stormFrom != null ? stormFrom - 30 : Infinity);
  const start = Math.ceil(Math.max(sunrise, 7 * 60) / 15) * 15;
  const arrival = start + total;
  const latest = Math.floor((deadline - total) / 15) * 15;

  let warning: string | null = null;
  if (arrival > deadline) {
    warning =
      stormFrom != null && stormFrom - 30 < sunset - 30
        ? `Arrivée prévue après le début des orages (${toClock(stormFrom)}) : raccourcir l'étape ou décaler le jour.`
        : `L'étape dépasse la lumière du jour : arrivée vers ${toClock(arrival)}, coucher à ${toClock(sunset)}.`;
  }
  return {
    start: toClock(start),
    arrival: toClock(arrival),
    latestStart: latest >= start ? toClock(latest) : null,
    stormFrom: stormFrom != null ? toClock(stormFrom) : null,
    warning,
  };
}

/** Isotherme 0 °C le matin (6 h – 10 h), en mètres. */
export function morningFreezingLevel(hours: HourCondition[]): number | null {
  const morning = hours.filter((h) => {
    const hh = Number(h.time.slice(11, 13));
    return hh >= 6 && hh <= 10 && h.freezingM != null;
  });
  if (!morning.length) return null;
  return Math.round(Math.min(...morning.map((h) => h.freezingM as number)) / 10) * 10;
}
