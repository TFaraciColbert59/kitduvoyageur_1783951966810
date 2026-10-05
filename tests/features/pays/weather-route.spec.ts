import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/pays/[code]/weather/route';

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const params = (code: string) => ({ params: Promise.resolve({ code }) });

describe('GET /api/pays/[code]/weather', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('refuse un code pays invalide', async () => {
    const res = await GET(new Request('http://localhost'), params('../etc'));
    expect(res.status).toBe(400);
  });

  it('renvoie une météo réelle normalisée (MET Norway)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        geometry: { coordinates: [-19.0, 64.9, 500] },
        properties: {
          timeseries: [
            {
              time: '2026-10-05T12:00:00Z',
              data: {
                instant: { details: { air_temperature: 4.2, wind_speed: 3.4, ultraviolet_index_clear_sky: 1 } },
                next_1_hours: {
                  summary: { symbol_code: 'cloudy' },
                  details: { precipitation_amount: 0, probability_of_precipitation: 20 },
                },
              },
            },
          ],
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await GET(new Request('http://localhost'), params('IS'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.source).toBe('MET Norway');
    expect(body.current.temperatureC).toBe(4);
    expect(body.current.condition).toBe('Nuageux');
    expect(body.current.precipitationProbability).toBe(20);
    expect(body.current.uvIndex).toBe(1);
    // MET Norway exige un User-Agent identifiant l'application.
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('api.met.no');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/kitduvoyageur/);
  });

  it('gère un échec amont sans planter', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    const res = await GET(new Request('http://localhost'), params('FR'));
    expect(res.status).toBe(502);
    expect((await res.json()).status).toBe('error');
  });

  it('gère une réponse invalide', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ current: { temperature_2m: 'x' } })));
    const res = await GET(new Request('http://localhost'), params('JP'));
    expect(res.status).toBe(502);
  });
});
