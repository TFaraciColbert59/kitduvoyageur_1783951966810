import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { createBrowserClientMock, createServerClientMock, cookieSetMock } = vi.hoisted(() => ({
  createBrowserClientMock: vi.fn((_url: string, _key: string) => ({ __kind: 'browser' })),
  createServerClientMock: vi.fn((_url: string, _key: string, _opts: unknown) => ({ __kind: 'server' })),
  cookieSetMock: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: createBrowserClientMock,
  createServerClient: createServerClientMock,
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => [{ name: 'sb-test', value: 'token' }],
    set: cookieSetMock,
  }),
}));

import { createClient } from '../../src/lib/supabase/server';

describe('src/lib/supabase/server — configuration sécurisée (Chantier 0)', () => {
  beforeEach(() => {
    createBrowserClientMock.mockClear();
    createServerClientMock.mockClear();
    cookieSetMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('TEST-SRV-01: rejette la création si les variables Supabase sont absentes (plus de clé en dur)', async () => {
    // Vitest charge le .env réel : on efface explicitement les variables.
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', undefined);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', undefined);

    await expect(createClient()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(createBrowserClientMock).not.toHaveBeenCalled();
  });

  it('TEST-SRV-02: rejette si seule la clé anon manque', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test-ref.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', undefined);

    await expect(createClient()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('TEST-SRV-03: côté serveur, crée le client avec les valeurs des variables d\'environnement', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test-ref.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    const client = await createClient();

    expect(client).toEqual({ __kind: 'server' });
    expect(createServerClientMock).toHaveBeenCalledWith(
      'https://test-ref.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        cookies: expect.objectContaining({ getAll: expect.any(Function) }),
      }),
    );
  });

  it('TEST-SRV-04: la logique cookies existante est préservée (sameSite none + secure)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test-ref.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    await createClient();

    const config = (createServerClientMock.mock.calls[0] as unknown[])[2] as {
      cookies: {
        setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
      };
    };

    config.cookies.setAll([{ name: 'sb-ref', value: 'tok', options: { path: '/' } }]);

    expect(cookieSetMock).toHaveBeenCalledWith(
      'sb-ref',
      'tok',
      expect.objectContaining({ sameSite: 'none', secure: true }),
    );
  });

  it('TEST-SRV-05: côté navigateur, utilise createBrowserClient avec les variables d\'environnement', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test-ref.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubGlobal('window', {});

    const client = await createClient();

    expect(client).toEqual({ __kind: 'browser' });
    expect(createBrowserClientMock).toHaveBeenCalledWith('https://test-ref.supabase.co', 'test-anon-key');
  });
});
