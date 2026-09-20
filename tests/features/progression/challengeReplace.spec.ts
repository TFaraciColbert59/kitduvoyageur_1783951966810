/**
 * P1 — route `/api/progression/challenge/replace` : session obligatoire, corps
 * facultatif strict, remplacement réel côté serveur, cooldown 409, erreurs
 * génériques sans fuite interne.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/features/progression/server/challengeService', () => ({
  replaceProgressionChallenge: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { replaceProgressionChallenge } from '@/features/progression/server/challengeService';
import { POST } from '@/app/api/progression/challenge/replace/route';

const USER_ID = '22222222-2222-4222-8222-222222222222';

const mockedCreateClient = vi.mocked(createClient);
const mockedReplace = vi.mocked(replaceProgressionChallenge);

function sessionClient(user: { id: string } | null) {
  return { auth: { getUser: async () => ({ data: { user } }) } } as never;
}

function post(body?: string) {
  return new NextRequest('http://localhost/api/progression/challenge/replace', {
    method: 'POST',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body,
  });
}

describe('POST /api/progression/challenge/replace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sans session → 401 unauthorized, service jamais appelé', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient(null));

    const response = await POST(post());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: 'unauthorized' });
    expect(mockedReplace).not.toHaveBeenCalled();
  });

  it('corps illisible → 400 invalid_body, service jamais appelé', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));

    const response = await POST(post('pas-du-json'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: 'invalid_body' });
    expect(mockedReplace).not.toHaveBeenCalled();
  });

  it('corps JSON non-objet → 400 invalid_body', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));

    const response = await POST(post('["défi"]'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: 'invalid_body' });
  });

  it('corps absent (facultatif) → 200, remplacement réel', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedReplace.mockResolvedValue({ ok: true, challengeId: 'catalogue-defi-reel' });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, challengeId: 'catalogue-defi-reel' });
    expect(mockedReplace).toHaveBeenCalledWith(USER_ID);
  });

  it('remplacement nominal → 200 avec l’identifiant choisi par le serveur', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedReplace.mockResolvedValue({ ok: true, challengeId: 'catalogue-defi-reel' });

    const response = await POST(post('{}'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, challengeId: 'catalogue-defi-reel' });
    expect(mockedReplace).toHaveBeenCalledWith(USER_ID);
  });

  it('cooldown actif → 409 cooldown', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedReplace.mockResolvedValue({ ok: false, reason: 'cooldown' });

    const response = await POST(post());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, error: 'cooldown' });
  });

  it('aucune ligne de progression → 409 no_progression', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedReplace.mockResolvedValue({ ok: false, reason: 'no_progression' });

    const response = await POST(post());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, error: 'no_progression' });
  });

  it('service indisponible → 503, message stable', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedReplace.mockResolvedValue({ ok: false, reason: 'unavailable' });

    const response = await POST(post());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, error: 'unavailable' });
  });

  it('erreur interne → 500 avec message générique (aucune fuite)', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedReplace.mockRejectedValue(new Error('détail interne sensible'));

    const response = await POST(post());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: 'Erreur lors du remplacement du défi',
    });
    expect(JSON.stringify(body)).not.toContain('détail interne sensible');
  });
});
