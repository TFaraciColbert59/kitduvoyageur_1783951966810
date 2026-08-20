import { createClient } from '@/lib/supabase/server';

export interface WeatherCell {
  hour: string;
  tempC: number;
  precipPct: number;
  weathercode: number;
}

export interface WeatherForecast {
  cells: WeatherCell[];
  current: { tempC: number; weathercode: number; precipPct: number };
  location: { latitude: number; longitude: number; label: string };
}

const DEFAULT_LOCATION = { latitude: 45.4, longitude: 6.6, label: 'Alpes' };

function weatherLabel(code: number): string {
  if (code === 0) return 'Dégagé';
  if (code <= 3) return 'Partiellement nuageux';
  if (code <= 48) return 'Brumeux';
  if (code <= 67) return 'Pluie';
  if (code <= 77) return 'Neige';
  if (code <= 86) return 'Averses';
  return 'Orage';
}

/** getWeather — prévisions Open-Meteo (gratuit, sans clé) pour 48h. */
export async function getWeather(
  latitude?: number | null,
  longitude?: number | null,
  label?: string | null
): Promise<WeatherForecast | null> {
  const lat = latitude ?? DEFAULT_LOCATION.latitude;
  const lon = longitude ?? DEFAULT_LOCATION.longitude;
  const locLabel = label ?? DEFAULT_LOCATION.label;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,weathercode&current_weather=true&forecast_days=2&timezone=auto`;
    const res = await fetch(url, { next: { revalidate: 900 } });
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

    const cur = data.current_weather ?? {};
    return {
      cells,
      current: {
        tempC: Math.round(cur.temperature ?? 0),
        weathercode: cur.weathercode ?? 0,
        precipPct: cells[0]?.precipPct ?? 0,
      },
      location: { latitude: lat, longitude: lon, label: locLabel },
    };
  } catch (err) {
    console.error('getWeather', err);
    return null;
  }
}

export { weatherLabel };
