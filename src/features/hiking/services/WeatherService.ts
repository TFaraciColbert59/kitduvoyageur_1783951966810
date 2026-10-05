import { WeatherSnapshot } from '../types';

/**
 * WeatherService — Integrates Open-Meteo free API for real-time mountain & trail weather.
 *
 * Regle absolue : aucun champ absent n'est remplace par une valeur plausible.
 * `temperature_2m ?? 15` afficherait 15 °C sur une reponse incomplete et
 * `weather_code ?? 0` afficherait « Ensoleille » : deux fabrications silencieuses.
 *
 * `WeatherSnapshot` ne porte pas de null sur ses champs (tous les consommateurs
 * — HikingController, HikingCockpitPage, DesktopTopBar, SafetyEngine — les
 * attendent en nombre) mais tous acceptent deja `WeatherSnapshot | null`.
 * Changer le contrat public obligerait a modifier des consommateurs hors
 * perimetre, dont `PreparationEngine` qui teste `tempC < 5` et traiterait alors
 * `null < 5` comme du grand froid. Un champ manquant invalide donc le snapshot
 * entier : la meteo est « indisponible », jamais inventee.
 */
export class WeatherService {
  /** Route serveur : MET Norway (CC BY 4.0) au format Open-Meteo. */
  private static readonly WEATHER_POINT = '/api/weather/point';

  public static async fetchWeather(lat: number, lon: number): Promise<WeatherSnapshot | null> {
    try {
      const url = `${this.WEATHER_POINT}?lat=${lat}&lon=${lon}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

      if (!res.ok) return null;
      const payload = asRecord(await res.json());
      const current = asRecord(payload?.current);
      const hourly = asRecord(payload?.hourly);
      if (!current || !hourly) return null;

      const tempC = finiteNumber(current.temperature_2m);
      const weatherCode = finiteNumber(current.weather_code);
      const windKmH = finiteNumber(current.wind_speed_10m);
      const precipProb = finiteNumber(firstValue(hourly.precipitation_probability));
      const uvIndex = finiteNumber(firstValue(hourly.uv_index));

      // Un seul champ manquant et la meteo est inexploitable : la refuse entierement
      // plutot que de publication un snapshot partiellement fabrique.
      // La probabilité de pluie n'est publiée qu'en Scandinavie : son absence
      // reste `null` (inconnue), elle n'invalide pas le reste.
      if (tempC === null || weatherCode === null || windKmH === null || uvIndex === null) {
        return null;
      }

      const { condition, isAlert, alertMessage } = this.interpretWeatherCode(weatherCode, windKmH);

      return {
        tempC: Math.round(tempC),
        condition,
        windKmH: Math.round(windKmH),
        precipitationProbability: precipProb,
        uvIndex,
        isAlert,
        alertMessage,
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      // Aucun repli : pas de « valeur par defaut » a worter une panne reseau.
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
      alertMessage = `Vent fort (${Math.round(windKmH)} km/h) — Prudence sur les crêtes.`;
    }

    return { condition, isAlert, alertMessage };
  }
}

/** Restreint une valeur JSON inconnue a un objet indexable, ou `null`. */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Nombre fini, ou `null`. `null` et `NaN` ne deviennent jamais 0. */
function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

/** Premiere valeur d une serie horaire, ou `null` si la serie est vide ou absente. */
function firstValue(series: unknown): unknown {
  if (!Array.isArray(series) || series.length === 0) return null;
  return series[0];
}
