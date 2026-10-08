import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { anonymousSignInsEnabled, resetAnonymousSettingsMemo } from '../anonymousSettings';

vi.mock('server-only', () => ({}));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('connexions anonymes allumées ?', () => {
  beforeEach(() => {
    resetAnonymousSettingsMemo();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projet.supabase.co/');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'cle-publique');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('lit `external.anonymous_users` sur /auth/v1/settings avec la clé publique', async () => {
    const fetchImpl = vi.fn(async () => json({ external: { anonymous_users: true, email: true } }));
    expect(await anonymousSignInsEnabled(fetchImpl)).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://projet.supabase.co/auth/v1/settings');
    expect((init.headers as Record<string, string>).apikey).toBe('cle-publique');
  });

  it('éteint, illisible ou injoignable : « non » (le site garde son comportement d’avant)', async () => {
    expect(await anonymousSignInsEnabled(async () => json({ external: { anonymous_users: false } }))).toBe(false);
    resetAnonymousSettingsMemo();
    expect(await anonymousSignInsEnabled(async () => json({ nope: 1 }, 500))).toBe(false);
    resetAnonymousSettingsMemo();
    expect(
      await anonymousSignInsEnabled(async () => {
        throw new Error('econnrefused');
      })
    ).toBe(false);
  });

  it('gardé 5 minutes : une seule lecture, puis relu après', async () => {
    let t = 1_000_000;
    const fetchImpl = vi.fn(async () => json({ external: { anonymous_users: true } }));
    await anonymousSignInsEnabled(fetchImpl, () => t);
    t += 4 * 60_000;
    await anonymousSignInsEnabled(fetchImpl, () => t);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t += 2 * 60_000;
    await anonymousSignInsEnabled(fetchImpl, () => t);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('sans configuration Supabase : « non », sans appel réseau', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    const fetchImpl = vi.fn();
    expect(await anonymousSignInsEnabled(fetchImpl)).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
