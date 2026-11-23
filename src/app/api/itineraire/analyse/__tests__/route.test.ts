import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/rate-limit', () => ({ clientIpFromHeaders: vi.fn(() => '203.0.113.9') }));
vi.mock('@/lib/api/requireUser', () => ({ requireUser: vi.fn() }));
vi.mock('@/features/route-collab/server/sharedChecks', () => ({ getSharedChecks: vi.fn() }));
vi.mock('@/features/compas/server/officialAlerts', () => ({ getOfficialAlerts: vi.fn() }));
vi.mock('@/app/api/explorer/v2/fires/route', () => ({ parseFirmsCsv: vi.fn(() => []) }));

import { requireUser } from '@/lib/api/requireUser';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { getSharedChecks } from '@/features/route-collab/server/sharedChecks';
import { getOfficialAlerts } from '@/features/compas/server/officialAlerts';
import { parseFirmsCsv } from '@/app/api/explorer/v2/fires/route';
import { POST } from '../route';

const call = (body: unknown, raw?: string) =>
  POST(
    new NextRequest('http://localhost/api/itineraire/analyse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw ?? JSON.stringify(body),
    }),
  );

const day = { day: 1, dateIso: '2026-11-24', lat: 45.9, lon: 6.8, passageLocal: '12:00', timezone: 'Europe/Paris', basis: 'midday' as const };
const hours = [
  { time: '2026-11-24T09:00', tempC: 3, precipPct: null, precipMm: 0, windKmh: 10, gustKmh: null, code: 3, freezingM: null, isDay: true },
  { time: '2026-11-24T12:00', tempC: 7, precipPct: 40, precipMm: 0.4, windKmh: 18, gustKmh: 30, code: 61, freezingM: null, isDay: true },
];

const checks = (weather: unknown, alertsStatus: string = 'indisponibles') =>
  ({ weather, danger: { axes: {}, signals: [] }, alertsStatus, alertsReadAt: null, alertsService: null }) as never;

describe('POST /api/itineraire/analyse', () => {
  beforeEach(() => {
    vi.mocked(requireUser).mockResolvedValue({ ok: true, supabase: {} as never, user: { id: 'u1' } });
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
    vi.mocked(getSharedChecks).mockReset();
    vi.mocked(getOfficialAlerts).mockReset();
    delete process.env.NASA_FIRMS_MAP_KEY;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('exige une session', async () => {
    vi.mocked(requireUser).mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'x' }, { status: 401 }) });
    expect((await call({ days: [day] })).status).toBe(401);
    expect(getSharedChecks).not.toHaveBeenCalled();
  });

  it('refuse un JSON illisible, des coordonnées hors bornes, une clé inconnue, trop de jours', async () => {
    expect((await call(null, '{oups')).status).toBe(400);
    expect((await call({ days: [{ ...day, lat: 99 }] })).status).toBe(400);
    expect((await call({ days: [day], url: 'http://x' })).status).toBe(400);
    expect((await call({ days: [{ ...day, dateIso: '24/11/2026' }] })).status).toBe(400);
    expect((await call({ days: Array.from({ length: 22 }, () => day) })).status).toBe(400);
    expect(getSharedChecks).not.toHaveBeenCalled();
  });

  it('rend la météo à l’heure de passage, avec l’heure du relevé et l’horizon', async () => {
    vi.mocked(getSharedChecks).mockResolvedValue(checks({
      source: 'MET Norway',
      trendSource: 'NASA POWER',
      horizon: '2026-12-02',
      tripDays: [{ day: 1, date: '2026-11-24', lat: 45.9, lon: 6.8, forecast: { date: '2026-11-24', tMin: 2, tMax: 8, precipPct: 40, precipMm: 0.4, gustMax: 30, code: 61, sunrise: null, sunset: null, hours } }],
      calendar: [],
    }));
    const res = await call({ days: [day] });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.horizon).toBe('2026-12-02');
    expect(Date.parse(json.fetchedAt)).not.toBeNaN();
    expect(json.weather[0]).toMatchObject({ day: 1, status: 'ok', hourLocal: '2026-11-24T12:00', tempC: 7, deltaMin: 0, approximate: false, fetchedAt: json.fetchedAt });
    expect(json.fire).toBeNull();
  });

  it('hors de l’horizon : météo inconnue, jamais comblée', async () => {
    vi.mocked(getSharedChecks).mockResolvedValue(checks({ source: 'MET Norway', trendSource: 'NASA POWER', horizon: '2026-12-02', tripDays: [{ day: 1, date: '2027-03-01', lat: 45.9, lon: 6.8, forecast: null }], calendar: [] }));
    const json = await (await call({ days: [{ ...day, dateIso: '2027-03-01' }] })).json();
    expect(json.weather[0].status).toBe('out_of_horizon');
    expect(json.weather[0].tempC).toBeNull();
  });

  it('source météo en panne : chaque jour reste inconnu', async () => {
    vi.mocked(getSharedChecks).mockRejectedValue(new Error('metno'));
    const json = await (await call({ days: [day] })).json();
    expect(json.weather[0]).toMatchObject({ status: 'unavailable', tempC: null, fetchedAt: null });
  });

  it('alertes officielles : lues par le même service que le tiroir Vérifs, avec leur fin de validité', async () => {
    vi.mocked(getSharedChecks).mockResolvedValue({ ...(checks(null, 'lues') as object), alertsService: 'Météo-France via Meteoalarm', alertsReadAt: '2026-11-23T08:00:00Z' } as never);
    vi.mocked(getOfficialAlerts).mockResolvedValue({
      status: 'lues',
      area: 'Haute-Savoie',
      readAt: '2026-11-23T08:00:00Z',
      alerts: [{ id: 'a1', source: 'Météo-France via Meteoalarm', hazard: 'orages', level: 'orange', area: 'Haute-Savoie', onset: '2026-11-24T10:00:00Z', expires: '2026-11-24T20:00:00Z', sent: '2026-11-23T07:00:00Z', fetchedAt: '2026-11-23T08:00:00Z' }],
    } as never);
    const json = await (await call({ days: [day] })).json();
    expect(json.official.status).toBe('lues');
    expect(json.official.alerts[0]).toMatchObject({ level: 'orange', expires: '2026-11-24T20:00:00Z', sent: '2026-11-23T07:00:00Z' });
    expect(getOfficialAlerts).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-11-24', to: '2026-11-24' }));
  });

  it('alertes officielles : un pays sans flux n’est jamais « aucune alerte »', async () => {
    vi.mocked(getSharedChecks).mockResolvedValue(checks(null, 'non_couvert'));
    const json = await (await call({ days: [day] })).json();
    expect(json.official).toMatchObject({ status: 'non_couvert', alerts: [] });
    expect(getOfficialAlerts).not.toHaveBeenCalled();
  });

  it('feux : sans clé NASA FIRMS, « indisponible » et jamais « aucun feu »', async () => {
    vi.mocked(getSharedChecks).mockResolvedValue(checks(null));
    const json = await (await call({ days: [], track: [{ lat: 45, lon: 6 }, { lat: 45.1, lon: 6.1 }] })).json();
    expect(json.fire.status).toBe('unavailable');
    expect(json.fire.impacts).toEqual([]);
    expect(json.fire.reason).toMatch(/NASA_FIRMS_MAP_KEY/);
  });

  it('feux : un point chaud sur le tracé est rendu avec sa source et sa date, sans fermeture', async () => {
    process.env.NASA_FIRMS_MAP_KEY = 'k';
    vi.mocked(parseFirmsCsv).mockReturnValue([
      { id: 'firms-1', kind: 'hotspot', geometry: { type: 'Point', coordinates: [6.05, 45.05] }, radiusM: 5000, label: 'Point chaud satellite', source: 'NASA FIRMS (VIIRS)', observedAt: '2026-11-23T00:00:00Z', closure: false },
    ]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('latitude,longitude\n', { status: 200 })));
    const json = await (await call({ days: [], track: [{ lat: 45, lon: 6 }, { lat: 45.1, lon: 6.1 }] })).json();
    expect(json.fire.status).toBe('alerts');
    expect(json.fire.impacts[0]).toMatchObject({ kind: 'hotspot', severity: 'info', observedAt: '2026-11-23T00:00:00Z', validUntil: null, source: 'NASA FIRMS (VIIRS)' });
  });

  it('respecte la limite de débit', async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue(NextResponse.json({ error: 'Trop' }, { status: 429 }));
    expect((await call({ days: [day] })).status).toBe(429);
  });
});
