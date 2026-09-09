export interface WeatherCell {
  hour: string;
  tempC: number;
  precipPct: number;
  weathercode: number;
}

export interface WeatherDay {
  date: string;
  day: string;
  tempMinC: number;
  tempMaxC: number;
  precipPct: number;
  weathercode: number;
}

export interface WeatherForecast {
  cells: WeatherCell[];
  days: WeatherDay[];
  current: { tempC: number; weathercode: number; precipPct: number };
  location: { latitude: number; longitude: number; label: string };
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
 * getWeather — prévisions Open-Meteo (gratuit, sans clé) : 24h + 5 prochains jours.
 * Zéro donnée fabriquée : sans coordonnées réelles ou en cas d'échec/timeout API,
 * retourne null (état « indisponible » honnête, jamais de fausses prévisions).
 */
export async function getWeather(
  latitude?: number | null,
  longitude?: number | null,
  label?: string | null
): Promise<WeatherForecast | null> {
  if (latitude == null || longitude == null) return null;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation_probability,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&current_weather=true&forecast_days=5&timezone=auto`;
    const res = await fetch(url, { next: { revalidate: 900 }, signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const data = await res.json();

    const hours = data.hourly?.time ?? [];
    const temps = data.hourly?.temperature_2m ?? [];
    const precips = data.hourly?.precipitation_probability ?? [];
    const codes = data.hourly?.weathercode ?? [];

    const cells: WeatherCell[] = hours.slice(0, 24).map((t: string, i: number) => ({
      hour: new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      tempC: Math.round(temps[i] ?? 0),
      precipPct: Math.round(precips[i] ?? 0),
      weathercode: codes[i] ?? 0,
    }));

    const dayTimes: string[] = data.daily?.time ?? [];
    const dayCodes: number[] = data.daily?.weathercode ?? [];
    const dayMax: number[] = data.daily?.temperature_2m_max ?? [];
    const dayMin: number[] = data.daily?.temperature_2m_min ?? [];
    const dayPrecip: number[] = data.daily?.precipitation_probability_max ?? [];

    const days: WeatherDay[] = dayTimes.slice(0, 5).map((t: string, i: number) => {
      const d = new Date(t);
      return {
        date: t,
        day: i === 0 ? 'Auj.' : DAY_LABELS[d.getDay()] ?? '—',
        tempMinC: Math.round(dayMin[i] ?? 0),
        tempMaxC: Math.round(dayMax[i] ?? 0),
        precipPct: Math.round(dayPrecip[i] ?? 0),
        weathercode: dayCodes[i] ?? 0,
      };
    });

    if (days.length === 0 || !data.current_weather) return null;

    const cur = data.current_weather;
    return {
      cells,
      days,
      current: {
        tempC: Math.round(cur.temperature),
        weathercode: cur.weathercode,
        precipPct: cells[0]?.precipPct ?? 0,
      },
      location: { latitude, longitude, label: label ?? '' },
    };
  } catch (err) {
    console.error('getWeather error, météo indisponible', err);
    return null;
  }
}
