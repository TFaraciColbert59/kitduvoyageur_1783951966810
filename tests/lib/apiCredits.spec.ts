import { afterEach, describe, expect, it, vi } from 'vitest';
import { GEOAPIFY_DAILY_CREDITS, takeApiCredits } from '@/lib/apiCredits';
import { geoapifyCallCredits } from '@/features/compas/server/geoapify';

function reponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

describe('crédits du jour des services gratuits (plan 1.3)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('demande le coût au compteur en base, par la clé de service', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projet.supabase.co/');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'cle-service');
    const fetchImpl = vi.fn(async () => reponse(true));
    await expect(takeApiCredits('geoapify', 10, GEOAPIFY_DAILY_CREDITS, { fetchImpl })).resolves.toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://projet.supabase.co/rest/v1/rpc/take_api_credits');
    expect(JSON.parse(String(init.body))).toEqual({ p_service: 'geoapify', p_cost: 10, p_limit: 2700 });
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer cle-service');
  });

  it('le compteur dit non : non', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projet.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'cle-service');
    await expect(takeApiCredits('geoapify', 1, 2700, { fetchImpl: async () => reponse(false) })).resolves.toBe(false);
  });

  it('compteur en panne ou absent : la règle d’ouverture décide', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projet.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'cle-service');
    const panne = async () => reponse({ message: 'boom' }, 503);
    await expect(takeApiCredits('geoapify', 1, 2700, { fetchImpl: panne })).resolves.toBe(true);
    await expect(takeApiCredits('geoapify', 1, 2700, { fetchImpl: panne, failOpen: false })).resolves.toBe(false);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    await expect(takeApiCredits('geoapify', 1, 2700)).resolves.toBe(true);
  });

  it('un coût plus grand que la limite n’est jamais demandé', async () => {
    const fetchImpl = vi.fn(async () => reponse(true));
    await expect(takeApiCredits('geoapify', 3000, 2700, { fetchImpl })).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('Geoapify : un crédit par géocodage, un par tranche de 20 lieux', () => {
    expect(geoapifyCallCredits('/v1/geocode/search', { text: 'Annecy' })).toBe(1);
    expect(geoapifyCallCredits('/v2/places', { limit: '200' })).toBe(10);
    expect(geoapifyCallCredits('/v2/places', { limit: '30' })).toBe(2);
  });
});
