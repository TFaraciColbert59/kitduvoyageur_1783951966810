import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { createBrowserClientMock } = vi.hoisted(() => ({
  createBrowserClientMock: vi.fn((_url: string, _key: string) => ({ __kind: 'browser' })),
}));

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: createBrowserClientMock,
}));

import { createClient } from '@/lib/supabase/client';

describe('A11 — clé anon jamais en dur (TEST-A11-KEY)', () => {
  beforeEach(() => {
    createBrowserClientMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('TEST-A11-KEY-01: createClient échoue explicitement sans variables d’environnement', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', undefined);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', undefined);
    expect(() => createClient()).toThrow(/Configuration Supabase manquante/);
    expect(() => createClient()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    expect(createBrowserClientMock).not.toHaveBeenCalled();

    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test-ref.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', undefined);
    expect(() => createClient()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);

    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', undefined);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    expect(() => createClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(createBrowserClientMock).not.toHaveBeenCalled();
  });

  it('TEST-A11-KEY-02: avec les variables, le client navigateur reçoit exactement ces valeurs', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test-ref.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    const client = createClient();

    expect(client).toEqual({ __kind: 'browser' });
    expect(createBrowserClientMock).toHaveBeenCalledWith(
      'https://test-ref.supabase.co',
      'test-anon-key',
      expect.objectContaining({ cookies: expect.any(Object) })
    );
  });
});
