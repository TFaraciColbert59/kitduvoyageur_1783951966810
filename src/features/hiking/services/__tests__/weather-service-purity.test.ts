import { afterEach, describe, expect, it, vi } from 'vitest';
import { WeatherService } from '../WeatherService';

/**
 * WeatherService ne doit JAMAIS inventer une donnee meteo.
 * Un champ absent de la reponse Open-Meteo reste inconnu : le snapshot entier
 * est alors refuse plutot que complete avec une valeur par defaut.
 */

function mockFetchOk(payload: unknown) {
  const spy = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => payload,
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

const SNAPSHOT_COMPLET = {
  current: {
    temperature_2m: 12.4,
    relative_humidity_2m: 60,
    weather_code: 3,
    wind_speed_10m: 18.2,
  },
  hourly: {
    precipitation_probability: [35, 40, 20],
    uv_index: [4.1, 5, 3],
  },
};

const LAT = 45.9;
const LON = 6.9;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('WeatherService — refus de toute valeur meteo inventee', () => {
  it('lit les valeurs reellement presentes dans la reponse', async () => {
    mockFetchOk(SNAPSHOT_COMPLET);

    const snapshot = await WeatherService.fetchWeather(LAT, LON);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.tempC).toBe(12);
    expect(snapshot?.windKmH).toBe(18);
    expect(snapshot?.precipitationProbability).toBe(35);
    expect(snapshot?.uvIndex).toBe(4.1);
    expect(snapshot?.condition).toBe('Partiellement nuageux \u26C5');
  });

  it('NE FABRIQUE PAS 15 degres quand la temperature est absente', async () => {
    const { temperature_2m: _absent, ...currentSansTemperature } = SNAPSHOT_COMPLET.current;
    mockFetchOk({ ...SNAPSHOT_COMPLET, current: currentSansTemperature });

    const snapshot = await WeatherService.fetchWeather(LAT, LON);

    expect(snapshot).toBeNull();
  });

  it('NE FABRIQUE PAS 15 degres quand la temperature vaut null', async () => {
    mockFetchOk({
      ...SNAPSHOT_COMPLET,
      current: { ...SNAPSHOT_COMPLET.current, temperature_2m: null },
    });

    expect(await WeatherService.fetchWeather(LAT, LON)).toBeNull();
  });

  it('NE FABRIQUE PAS 0 km/h quand le vent est absent', async () => {
    const { wind_speed_10m: _absent, ...currentSansVent } = SNAPSHOT_COMPLET.current;
    mockFetchOk({ ...SNAPSHOT_COMPLET, current: currentSansVent });

    expect(await WeatherService.fetchWeather(LAT, LON)).toBeNull();
  });

  it('NE FABRIQUE PAS un ciel degage quand le code meteo est absent', async () => {
    const { weather_code: _absent, ...currentSansCode } = SNAPSHOT_COMPLET.current;
    mockFetchOk({ ...SNAPSHOT_COMPLET, current: currentSansCode });

    expect(await WeatherService.fetchWeather(LAT, LON)).toBeNull();
  });

  it('NE FABRIQUE PAS 0 % de pluie quand la probabilite est absente', async () => {
    mockFetchOk({ ...SNAPSHOT_COMPLET, hourly: { uv_index: [4.1] } });

    expect(await WeatherService.fetchWeather(LAT, LON)).toBeNull();
  });

  it('NE FABRIQUE PAS un indice UV de 0 quand uv_index est absent', async () => {
    mockFetchOk({ ...SNAPSHOT_COMPLET, hourly: { precipitation_probability: [35] } });

    expect(await WeatherService.fetchWeather(LAT, LON)).toBeNull();
  });

  it('refuse un snapshot quand le tableau horaire est vide', async () => {
    mockFetchOk({
      ...SNAPSHOT_COMPLET,
      hourly: { precipitation_probability: [], uv_index: [] },
    });

    expect(await WeatherService.fetchWeather(LAT, LON)).toBeNull();
  });

  it('refuse une temperature non finie (NaN) venue de l API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...SNAPSHOT_COMPLET,
          current: { ...SNAPSHOT_COMPLET.current, temperature_2m: Number.NaN },
        }),
      })
    );

    expect(await WeatherService.fetchWeather(LAT, LON)).toBeNull();
  });

  it('refuse une reponse HTTP en erreur sans fabriquer de snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    );

    expect(await WeatherService.fetchWeather(LAT, LON)).toBeNull();
  });

  it('refuse une exception reseau sans fabriquer de snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    expect(await WeatherService.fetchWeather(LAT, LON)).toBeNull();
  });

  it('n emet aucun logclaiming un repli qui n existe pas', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await WeatherService.fetchWeather(LAT, LON);

    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.join(' | ')).not.toMatch(/fallback|falling back|repli/i);
  });

  it('interprete un code WMO 0 reel comme beau temps, sans le confondre avec une absence', async () => {
    mockFetchOk({
      ...SNAPSHOT_COMPLET,
      current: { ...SNAPSHOT_COMPLET.current, weather_code: 0 },
    });

    const snapshot = await WeatherService.fetchWeather(LAT, LON);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.condition).toBe('Ensoleill\u00E9');
  });

  it('leve une alerte de vent fort sur un vent reel et eleve', async () => {
    mockFetchOk({
      ...SNAPSHOT_COMPLET,
      current: { ...SNAPSHOT_COMPLET.current, wind_speed_10m: 78 },
    });

    const snapshot = await WeatherService.fetchWeather(LAT, LON);

    expect(snapshot?.isAlert).toBe(true);
    expect(snapshot?.alertMessage).toMatch(/78/);
  });
});
