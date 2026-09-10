import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/geodata', () => ({
  fetchCountryByIso: vi.fn(),
  fetchCountryContentByIso: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      }),
    }),
  })),
}));
vi.mock('@/features/pays/server/countryTrails', () => ({ resolveCountryTrails: vi.fn() }));
vi.mock('@/lib/ai/askAI', () => ({ askAI: vi.fn() }));

import { fetchCountryByIso, fetchCountryContentByIso } from '@/lib/geodata';
import { resolveCountryTrails } from '@/features/pays/server/countryTrails';
import { askAI } from '@/lib/ai/askAI';
import { GET } from '@/app/api/pays/[code]/recommendations/route';

const geoMock = vi.mocked(fetchCountryByIso);
const contentMock = vi.mocked(fetchCountryContentByIso);
const trailsMock = vi.mocked(resolveCountryTrails);
const askMock = vi.mocked(askAI);

const params = (code: string) => ({ params: Promise.resolve({ code }) });
const request = (query = 'level=modere&duration=semaine') =>
  new Request(`http://localhost/api/pays/IS/recommendations?${query}`);

describe('GET /api/pays/[code]/recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    geoMock.mockResolvedValue({ name: 'Islande', iso_a2: 'IS' } as never);
    contentMock.mockResolvedValue({ climat: { meilleure_periode_trek: 'Juin à septembre' } } as never);
    trailsMock.mockResolvedValue([
      { id: 't1', name: 'Sentier côtier', distanceKm: 8, durationHours: null, difficulty: 'Modérée', elevationGain: null, latitude: null, longitude: null },
    ] as never);
    askMock.mockResolvedValue({
      text: 'Pour un profil intermédiaire, visez juin à septembre.',
      model: 'test',
      degraded: false,
      cached: false,
      provider: 'test',
    });
  });

  it('refuse un code invalide', async () => {
    const res = await GET(request(), params('X'));
    expect(res.status).toBe(400);
  });

  it('refuse un profil invalide', async () => {
    const res = await GET(request('level=extreme'), params('IS'));
    expect(res.status).toBe(400);
  });

  it('renvoie recommandations + synthèse IA', async () => {
    const res = await GET(request(), params('IS'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.recommendations.length).toBeGreaterThan(0);
    expect(body.recommendations.some((r: { title: string }) => r.title === 'Sentier côtier')).toBe(true);
    expect(body.synthesis).toContain('juin à septembre');
    expect(body.synthesisProvider).toBe('ai');
  });

  it('reste fonctionnel sans synthèse IA (fallback silencieux)', async () => {
    askMock.mockResolvedValue({ text: '', model: 'fallback-deterministe', degraded: true, cached: false, provider: 'fallback' });
    const res = await GET(request(), params('IS'));
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.synthesis).toBeNull();
    expect(body.synthesisProvider).toBe('none');
  });

  it('pays inconnu → statut error', async () => {
    geoMock.mockResolvedValue(null as never);
    const res = await GET(request(), params('ZZ'));
    expect((await res.json()).status).toBe('error');
  });
});
