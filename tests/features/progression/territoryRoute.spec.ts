/**
 * P3 — route `/api/progression/territory` : choix manuel, consentement 1 km,
 * verrou court, corrections plafonnées, état sans coordonnées.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/features/progression/server/territoryService', () => ({
  getTerritoryState: vi.fn(),
  updateDeclaredTerritory: vi.fn(),
  updatePrivateAttachment: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import {
  getTerritoryState,
  updateDeclaredTerritory,
  updatePrivateAttachment,
} from '@/features/progression/server/territoryService';
import { GET, POST } from '@/app/api/progression/territory/route';

const USER_ID = '22222222-2222-4222-8222-222222222222';

const mockedCreateClient = vi.mocked(createClient);
const mockedGetState = vi.mocked(getTerritoryState);
const mockedDeclared = vi.mocked(updateDeclaredTerritory);
const mockedPrivate = vi.mocked(updatePrivateAttachment);

function sessionClient(user: { id: string } | null) {
  return { auth: { getUser: async () => ({ data: { user } }) } } as never;
}

function post(body: unknown) {
  return new NextRequest('http://localhost/api/progression/territory', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const DECLARED = {
  cityName: 'Grenoble',
  cityCode: '38185',
  regionCode: '84',
  countryCode: 'FR',
  source: 'manual',
  updatedAt: '2026-09-19T10:00:00.000Z',
};

const ATTACHMENT = {
  present: true,
  consentAt: '2026-09-19T10:00:00.000Z',
  lockedUntil: '2026-09-20T10:00:00.000Z',
  locked: true,
};

describe('GET /api/progression/territory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sans session → 401, service jamais appelé', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient(null));

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: 'unauthorized' });
    expect(mockedGetState).not.toHaveBeenCalled();
  });

  it('authentifié → territoire déclaré + état privé sans coordonnées', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedGetState.mockResolvedValue({
      declared: DECLARED,
      privateAttachment: ATTACHMENT,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      declared: DECLARED,
      privateAttachment: ATTACHMENT,
    });
    expect(mockedGetState).toHaveBeenCalledWith(USER_ID);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('lat');
    expect(serialized).not.toContain('lng');
    expect(serialized).not.toContain('accuracy');
  });
});

describe('POST /api/progression/territory — choix manuel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sans session → 401', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient(null));

    const response = await POST(post({ city_code: '38185' }));

    expect(response.status).toBe(401);
    expect(mockedDeclared).not.toHaveBeenCalled();
  });

  it('corps illisible → 400 invalid_body', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));

    const response = await POST(
      new NextRequest('http://localhost/api/progression/territory', {
        method: 'POST',
        body: 'pas-du-json',
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: 'invalid_body' });
  });

  it('choix manuel → upsert déclaré (source manual, identifiants stables)', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedDeclared.mockResolvedValue({ ok: true, declared: DECLARED });

    const response = await POST(
      post({
        city_code: '38185',
        region_code: '84',
        country_code: 'FR',
        city_name: 'Grenoble',
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, declared: DECLARED });
    expect(mockedDeclared).toHaveBeenCalledWith(USER_ID, {
      city_code: '38185',
      region_code: '84',
      country_code: 'FR',
      city_name: 'Grenoble',
    });
    expect(mockedPrivate).not.toHaveBeenCalled();
  });
});

describe('POST /api/progression/territory — rattachement privé 1 km', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
  });

  it('coordonnées sans consentement explicite → 400 consent_required', async () => {
    mockedPrivate.mockResolvedValue({ ok: false, error: 'consent_required' });

    const response = await POST(post({ lat: 48.8566, lng: 2.3522 }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: 'consent_required' });
    expect(mockedPrivate).toHaveBeenCalledWith(USER_ID, {
      lat: 48.8566,
      lng: 2.3522,
      accuracy_m: null,
      consent: false,
      correction: false,
    });
    expect(mockedDeclared).not.toHaveBeenCalled();
  });

  it('coordonnées invalides → 400 invalid_coordinates', async () => {
    mockedPrivate.mockResolvedValue({ ok: false, error: 'invalid_coordinates' });

    const response = await POST(post({ lat: 999, lng: 2.3522, consent: true }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: 'invalid_coordinates' });
  });

  it('consentement + verrou actif → 409 lock_active', async () => {
    mockedPrivate.mockResolvedValue({ ok: false, error: 'lock_active' });

    const response = await POST(post({ lat: 48.8566, lng: 2.3522, consent: true }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, error: 'lock_active' });
  });

  it('correction déjà consommée (30 jours) → 409 correction_limit', async () => {
    mockedPrivate.mockResolvedValue({ ok: false, error: 'correction_limit' });

    const response = await POST(
      post({ lat: 48.8566, lng: 2.3522, consent: true, correction: true })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, error: 'correction_limit' });
  });

  it('consentement valide → état privé (verrou) sans coordonnées dans la réponse', async () => {
    mockedPrivate.mockResolvedValue({ ok: true, privateAttachment: ATTACHMENT });

    const response = await POST(
      post({ lat: 48.8566, lng: 2.3522, accuracy_m: 15, consent: true })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, privateAttachment: ATTACHMENT });
    expect(mockedPrivate).toHaveBeenCalledWith(USER_ID, {
      lat: 48.8566,
      lng: 2.3522,
      accuracy_m: 15,
      consent: true,
      correction: false,
    });

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('48.8566');
    expect(serialized).not.toContain('"lat"');
    expect(serialized).not.toContain('"lng"');
  });
});
