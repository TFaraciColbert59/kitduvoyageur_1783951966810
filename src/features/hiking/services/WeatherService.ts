import { WeatherSnapshot } from '../types';

/**
 * WeatherService — Integrates Open-Meteo free API for real-time mountain & trail weather.
 */
export class WeatherService {
  private static readonly OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

  public static async fetchWeather(lat: number, lon: number): Promise<WeatherSnapshot | null> {
    try {
      const url = `${this.OPEN_METEO_BASE}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=precipitation_probability,uv_index&forecast_days=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

      if (!res.ok) return null;
      const data = await res.json();

      const current = data.current || {};
      const hourly = data.hourly || {};
      const weatherCode = current.weather_code ?? 0;
      const windKmH = Math.round(current.wind_speed_10m ?? 0);
      const precipProb = hourly.precipitation_probability?.[0] ?? 0;
      const uvIndex = hourly.uv_index?.[0] ?? 0;

      const { condition, isAlert, alertMessage } = this.interpretWeatherCode(weatherCode, windKmH);

      return {
        tempC: Math.round(current.temperature_2m ?? 15),
        condition,
        windKmH,
        precipitationProbability: precipProb,
        uvIndex,
        isAlert,
        alertMessage,
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.warn('[WeatherService] fetch failed, falling back:', err);
      return null;
    }
  }

  private static interpretWeatherCode(code: number, windKmH: number): { condition: string; isAlert: boolean; alertMessage?: string } {
    let condition = 'Ensoleillé';
    let isAlert = false;
    let alertMessage: string | undefined;

    if (code >= 95) {
      condition = 'Orage ⚡';
      isAlert = true;
      alertMessage = 'Risque d\'orage imminent — Abritez-vous rapidement.';
    } else if (code >= 80) {
      condition = 'Averses 🌧';
      if (code >= 82) {
        isAlert = true;
        alertMessage = 'Fortes averses en cours.';
      }
    } else if (code >= 71) {
      condition = 'Neige ❄️';
    } else if (code >= 61) {
      condition = 'Pluie 🌧';
    } else if (code >= 51) {
      condition = 'Bruine 🌫';
    } else if (code >= 45) {
      condition = 'Brouillard 🌫';
    } else if (code >= 1 && code <= 3) {
      condition = 'Partiellement nuageux ⛅';
    }

    if (windKmH > 60 && !isAlert) {
      isAlert = true;
      alertMessage = `Vent fort (${windKmH} km/h) — Prudence sur les crêtes.`;
    }

    return { condition, isAlert, alertMessage };
  }
}
