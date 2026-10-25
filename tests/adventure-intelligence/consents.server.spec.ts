import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import {
  listConsents,
  setConsent,
  CONSENT_POLICY_VERSION,
} from '@/features/adventure-intelligence/server/consents';

const USER_ID = '22222222-2222-4222-8222-222222222222';
const ISO = '2026-09-11T10:00:00.000Z';

function authenticatedClient(options: { from?: unknown } = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
    },
    from: options.from ?? vi.fn(),
  };
}

describe('Consentements serveur — listConsents / setConsent (TEST-A1-CONSENT)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('TEST-A1-CONSENT-01: liste les consentements de l’utilisateur courant', async () => {
    const rows = [
      {
        id: 'c-1',
        user_id: USER_ID,
        purpose: 'personal_performance',
        granted: true,
        policy_version: CONSENT_POLICY_VERSION,
        granted_at: ISO,
        revoked_at: null,
        created_at: ISO,
        updated_at: ISO,
      },
    ];

    const eq = vi.fn().mockResolvedValue({ data: rows, error: null });
    const mockSupabase = authenticatedClient({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq,
      })),
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);

    const consents = await listConsents();

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(mockSupabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(consents).toEqual(rows);
  });

  it('TEST-A1-CONSENT-02: une erreur de lecture ou une absence d’utilisateur renvoie []', async () => {
    const errorClient = authenticatedClient({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
      })),
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(errorClient);
    await expect(listConsents()).resolves.toEqual([]);

    const anonymousClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: vi.fn(),
    };
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(anonymousClient);
    await expect(listConsents()).resolves.toEqual([]);
    expect(anonymousClient.from).not.toHaveBeenCalled();
  });

  it('TEST-A1-CONSENT-03: accord et retrait d’une finalité autorisée via upsert', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const mockSupabase = authenticatedClient({ from: vi.fn(() => ({ upsert })) });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);

    await expect(setConsent('personal_performance', true)).resolves.toEqual({ ok: true });

    expect(upsert).toHaveBeenCalledTimes(1);
    const [grantPayload, grantOptions] = upsert.mock.calls[0];
    expect(grantPayload.user_id).toBe(USER_ID);
    expect(grantPayload.purpose).toBe('personal_performance');
    expect(grantPayload.granted).toBe(true);
    expect(grantPayload.policy_version).toBe(CONSENT_POLICY_VERSION);
    expect(typeof grantPayload.granted_at).toBe('string');
    expect(grantPayload.revoked_at).toBeNull();
    expect(grantOptions).toEqual({ onConflict: 'user_id,purpose,policy_version' });

    await expect(setConsent('personal_performance', false)).resolves.toEqual({ ok: true });
    const [revokePayload] = upsert.mock.calls[1];
    expect(revokePayload.granted).toBe(false);
    expect(revokePayload.granted_at).toBeNull();
    expect(typeof revokePayload.revoked_at).toBe('string');

    vi.clearAllMocks();
    const refused = await setConsent('external_readiness', true);
    expect(refused).toEqual({ ok: false, error: 'external_readiness_disabled' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('TEST-A1-CONSENT-04: finalité inconnue et utilisateur non authentifié refusés', async () => {
    const invalid = await setConsent('tracking', true);
    expect(invalid).toEqual({ ok: false, error: 'invalid_purpose' });
    expect(createClient).not.toHaveBeenCalled();

    const anonymousClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: vi.fn(),
    };
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(anonymousClient);

    const unauthenticated = await setConsent('live_location', true);
    expect(unauthenticated).toEqual({ ok: false, error: 'unauthenticated' });
    expect(anonymousClient.from).not.toHaveBeenCalled();
  });
});
