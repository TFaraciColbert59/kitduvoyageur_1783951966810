import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/requireUser', () => ({
  requireUser: vi.fn(async () => ({
    ok: true,
    user: { id: 'user-consent' },
    supabase: {},
  })),
}));

vi.mock('@/features/adventure-intelligence/server/consents', () => ({
  CONSENT_PURPOSES: [
    'personal_performance',
    'collective_terrain',
    'live_location',
    'group_location',
    'external_readiness',
  ],
  setConsent: vi.fn(async () => ({ ok: true })),
}));

import { setConsent } from '@/features/adventure-intelligence/server/consents';
import { resetConnectorStoreForTests } from '@/lib/connectors/serverStore';
import { POST as consentPOST } from '../consent/route';

function request(body: unknown): Request {
  return new Request('https://lkdv.app/api/connectors/consent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetConnectorStoreForTests();
  vi.mocked(setConsent).mockClear();
  vi.mocked(setConsent).mockResolvedValue({ ok: true });
});

describe('Route consentement connecteurs', () => {
  it('refuse une finalité inconnue sans écrire en base', async () => {
    const response = await consentPOST(request({ purpose: 'health_metrics', granted: true }));
    expect(response.status).toBe(400);
    expect(setConsent).not.toHaveBeenCalled();
  });

  it('enregistre une finalité autorisée et renvoie le catalogue réel', async () => {
    const response = await consentPOST(request({ purpose: 'personal_performance', granted: true }));
    expect(response.status).toBe(200);
    expect(setConsent).toHaveBeenCalledWith('personal_performance', true);
    const body = (await response.json()) as { catalog: { connectors: unknown[] } };
    expect(body.catalog.connectors).toHaveLength(15);
  });

  it('refuse la finalité santé désactivée en Phase 1', async () => {
    vi.mocked(setConsent).mockResolvedValueOnce({ ok: false, error: 'external_readiness_disabled' });
    const response = await consentPOST(request({ purpose: 'external_readiness', granted: true }));
    expect(response.status).toBe(400);
  });
});
