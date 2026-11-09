import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetEventWeatherCache,
  fetchEventDayWeather,
  storyWeatherSticker,
} from '../communityDetails';

const NOW = new Date('2026-11-08T10:00:00+01:00');
const POINT = { lat: 45.19, lng: 5.72 };

function jsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    json: async () => payload,
  } as unknown as Response;
}

beforeEach(() => {
  __resetEventWeatherCache();
});

describe('fetchEventDayWeather (FID-071)', () => {
  it('lit la journée demandée sur /api/weather et arrondit les températures', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        status: 'ok',
        days: [{ date: '2026-11-10', label: 'Éclaircies', code: 2, tMaxC: 4.4, tMinC: -1.6 }],
      }),
    );
    const weather = await fetchEventDayWeather(POINT, '2026-11-10', NOW, fetchMock as unknown as typeof fetch);
    expect(weather).toEqual({ label: 'Éclaircies', symbol: '2', tempMax: 4, tempMin: -2 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain('/api/weather?lat=45.1900&lon=5.7200');
    expect(url).toContain('from=2026-11-10&to=2026-11-10');
  });

  it('ne demande rien hors fenêtre J-7, ni sans coordonnées', async () => {
    const fetchMock = vi.fn();
    expect(
      await fetchEventDayWeather(POINT, '2026-12-01', NOW, fetchMock as unknown as typeof fetch),
    ).toBeNull();
    expect(await fetchEventDayWeather(null, '2026-11-10', NOW, fetchMock as unknown as typeof fetch)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('replie en silence sur une réponse indisponible et met en cache l’absence', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ status: 'unavailable', days: [] }, false));
    expect(
      await fetchEventDayWeather(POINT, '2026-11-10', NOW, fetchMock as unknown as typeof fetch),
    ).toBeNull();
    // Deuxième appel : le cache répond, la route n'est pas rejouée.
    expect(
      await fetchEventDayWeather(POINT, '2026-11-10', NOW, fetchMock as unknown as typeof fetch),
    ).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignore une journée incomplète (jamais la météo d’une autre date)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ status: 'ok', days: [{ date: '2026-11-11', label: 'Pluie', tMaxC: 9, tMinC: 4 }] }),
    );
    expect(
      await fetchEventDayWeather(POINT, '2026-11-10', NOW, fetchMock as unknown as typeof fetch),
    ).toBeNull();
  });

  it('formate la valeur du sticker Story de la maquette', () => {
    expect(storyWeatherSticker({ label: 'Éclaircies', symbol: '', tempMax: 4, tempMin: -2 })).toBe(
      '4° · Éclaircies',
    );
    expect(storyWeatherSticker(null)).toBeNull();
  });
});
