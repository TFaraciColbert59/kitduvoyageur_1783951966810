/**
 * Pluie : probabilité (%) quand la source la publie, sinon quantité annoncée
 * (mm). MET Norway ne publie la probabilité qu'en Scandinavie : ailleurs elle
 * reste `null`, jamais devinée.
 */
export interface WeatherCell {
  hour: string;
  tempC: number;
  precipPct: number | null;
  precipMm?: number | null;
  weathercode: number;
}

export interface WeatherDay {
  date: string;
  day: string;
  tempMinC: number;
  tempMaxC: number;
  precipPct: number | null;
  precipMm?: number | null;
  weathercode: number;
}

export interface WeatherForecast {
  cells: WeatherCell[];
  days: WeatherDay[];
  current: { tempC: number; weathercode: number; precipPct: number | null; precipMm?: number | null };
  location: { latitude: number; longitude: number; label: string };
  /** Source citée (licence CC BY 4.0). */
  source?: string;
}

/** « 20 % » si la probabilité est connue, sinon « 3 mm » si de la pluie est annoncée, sinon null. */
export function rainLabel(pct: number | null | undefined, mm?: number | null): string | null {
  if (pct != null) return `${Math.round(pct)} %`;
  if (mm != null && mm > 0) return `${Math.round(mm * 10) / 10} mm`;
  return null;
}

/** Pluie à prévoir : probabilité au-dessus du seuil, ou au moins 1 mm annoncé. */
export function isRainy(pct: number | null | undefined, mm: number | null | undefined, pctThreshold = 40): boolean {
  if (pct != null) return pct >= pctThreshold;
  return mm != null && mm >= 1;
}

export function weatherLabel(code: number): string {
  if (code === 0) return 'Dégagé';
  if (code <= 3) return 'Partiellement nuageux';
  if (code <= 48) return 'Brumeux';
  if (code <= 67) return 'Pluie';
  if (code <= 77) return 'Neige';
  if (code <= 86) return 'Averses';
  return 'Orage';
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/**
 * getWeather — prévisions Open-Meteo (gratuit, sans clé) : 24h + jours suivants
 * (`forecastDays`, 5 par défaut, borné 1..16 côté fournisseur).
 * Zéro donnée fabriquée : sans coordonnées réelles ou en cas d'échec/timeout API,
 * retourne null (état « indisponible » honnête, jamais de fausses prévisions).
 */
/**
 * Une colonne de mesures du fournisseur, ou `null` si elle est illisible.
 *
 * Toute case non numérique invalide TOUTE la colonne. C'est le point :
 * l'ancien repli à zéro ne comblait pas un trou, il inventait un ciel dégagé
 * — le code 0 d Open-Meteo vaut « Dégagé ». Mieux vaut une prévision
 * absente qu'une prévision fausse, donc on refuse la colonne entière.
 */
function measuredColumn(raw: unknown, expected = 0): number[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length < expected) return null;
  const column: number[] = [];
  for (const value of raw) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    column.push(value);
  }
  return column;
}

/** Une colonne d'instants, ou `null` si l'un d'eux n'est pas une date-heure. */
function stringColumn(raw: unknown, expected = 0): string[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length < expected) return null;
  const column: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return null;
    column.push(value);
  }
  return column;
}

/** Une valeur unique mesurée, ou `null` si elle manque ou n'est pas un nombre. */
function measuredValue(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

export async function getWeather(
  latitude?: number | null,
  longitude?: number | null,
  label?: string | null,
  forecastDays = 5
): Promise<WeatherForecast | null> {
  if (latitude == null || longitude == null) return null;

  const requestedDays = Number.isFinite(forecastDays)
    ? Math.min(16, Math.max(1, Math.trunc(forecastDays)))
    : 5;

  try {
    // MET Norway (gratuit, usage commercial permis), au format Open-Meteo.
    // Import à la demande : ce module sert aussi des composants client (libellés),
    // le client n'embarque ni le fuseau horaire ni l'appel réseau.
    const { fetchMetnoAsOpenMeteo } = await import('@/lib/weather/metnoFetch');
    const data = await fetchMetnoAsOpenMeteo(latitude, longitude, { timeoutMs: 4000 });
    if (!data) return null;

    const allHours = stringColumn(data.hourly?.time);
    if (allHours === null) return null;
    const windowSize = Math.min(24, allHours.length);
    // Une prevision sans aucune heure n'a pas de `current.precipPct` mesure :
    // on la refuse plutot qu'a en fabriquer un.
    if (windowSize === 0) return null;

    const hours = allHours.slice(0, 24);
    const temps = measuredColumn(data.hourly?.temperature_2m, windowSize);
    const codes = measuredColumn(data.hourly?.weathercode, windowSize);
    if (temps === null || codes === null) return null;
    // Pluie : facultative, case par case (jamais comblée).
    const pctAt = (i: number) => measuredValue(data.hourly?.precipitation_probability?.[i]);
    const mmAt = (i: number) => measuredValue(data.hourly?.precipitation?.[i]);

    const cells: WeatherCell[] = hours.map((t: string, i: number) => {
      const pct = pctAt(i);
      return {
        // Heure locale du lieu, déjà écrite « YYYY-MM-DDTHH:MM » par la source.
        hour: t.slice(11, 16),
        tempC: Math.round(temps[i]),
        precipPct: pct == null ? null : Math.round(pct),
        precipMm: mmAt(i),
        weathercode: codes[i],
      };
    });

    const allDayTimes = stringColumn(data.daily?.time);
    if (allDayTimes === null) return null;
    const dayCount = Math.min(requestedDays, allDayTimes.length);
    const dayCodes = measuredColumn(data.daily?.weathercode, dayCount);
    const dayMax = measuredColumn(data.daily?.temperature_2m_max, dayCount);
    const dayMin = measuredColumn(data.daily?.temperature_2m_min, dayCount);
    if (dayCount === 0 || dayCodes === null || dayMax === null || dayMin === null) {
      return null;
    }

    const dayTimes = allDayTimes.slice(0, requestedDays);
    const days: WeatherDay[] = dayTimes.map((t: string, i: number) => {
      const d = new Date(t);
      return {
        date: t,
        day: i === 0 ? 'Auj.' : DAY_LABELS[d.getDay()] ?? '—',
        tempMinC: Math.round(dayMin[i]),
        tempMaxC: Math.round(dayMax[i]),
        precipPct: (() => {
          const v = measuredValue(data.daily?.precipitation_probability_max?.[i]);
          return v == null ? null : Math.round(v);
        })(),
        precipMm: measuredValue(data.daily?.precipitation_sum?.[i]),
        weathercode: dayCodes[i],
      };
    });

    if (!data.current_weather) return null;

    const curTemp = measuredValue(data.current_weather.temperature);
    const curCode = measuredValue(data.current_weather.weathercode);
    // L'etat courant est mesure comme le reste : sans lui, pas de prevision.
    if (curTemp === null || curCode === null) return null;
    const currentPrecip = cells[0];
    if (currentPrecip === undefined) return null;

    return {
      cells,
      days,
      current: {
        tempC: Math.round(curTemp),
        weathercode: curCode,
        precipPct: currentPrecip.precipPct,
        precipMm: currentPrecip.precipMm,
      },
      location: { latitude, longitude, label: label ?? '' },
      source: 'MET Norway',
    };
  } catch (err) {
    console.error('getWeather error, météo indisponible', err);
    return null;
  }
}
