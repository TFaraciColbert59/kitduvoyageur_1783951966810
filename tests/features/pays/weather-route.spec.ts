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

  it('renvoie une météo réelle normalisée (Open-Meteo)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          current: { temperature_2m: 4.2, weather_code: 3, wind_speed_10m: 12.3 },
          hourly: { precipitation_probability: [20], uv_index: [1] },
        })
      )
    );
    const res = await GET(new Request('http://localhost'), params('IS'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.current.temperatureC).toBe(4);
    expect(body.current.condition).toBe('Nuageux');
    expect(body.current.precipitationProbability).toBe(20);
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
