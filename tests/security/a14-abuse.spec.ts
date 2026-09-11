/**
 * A14 — Tests d'abus (TEST-A14-ABUSE-*) : bornes GeoJSON, rate limits Terrain
 * Live, photo URL seulement, taille/description bornées.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: vi.fn(() => ({ service: true })) }));
vi.mock('@/features/adventure-intelligence/server/featureFlags', () => ({
  currentAdventureFeatureFlags: vi.fn(async () => ({
    performance_profile_v2: false,
    route_prediction_v2: false,
    collective_intelligence: false,
    terrain_live: true,
  })),
}));
vi.mock('@/features/adventure-intelligence/server/terrainReports', () => ({
  createTerrainReport: vi.fn(),
  createSupabaseTerrainReportsClient: vi.fn(() => ({ client: true })),
}));

import { createClient } from '@/lib/supabase/server';
import { createTerrainReport } from '@/features/adventure-intelligence/server/terrainReports';
import { GET as geojsonGET } from '@/app/api/hikes/geojson/route';
import { POST as terrainPOST } from '@/app/api/terrain/reports/route';
import {
  MAX_REPORTS_PER_HOUR,
  MAX_CONFIRMATIONS_COOLDOWN,
  MAX_DESCRIPTION_LENGTH,
  MAX_PHOTO_BYTES,
  NEW_ACCOUNT_MAX_REPORTS,
  MODERATION_REASONS,
  moderationDecision,
} from '@/features/adventure-intelligence/domain/terrainLive';
import { MAX_BBOX_SPAN_DEG } from '@/lib/geo/bbox';
import {
  createInviteToken,
  verifyInviteToken,
} from '@/features/crews/lib/invitations';
import {
  generateSignedDocumentUrl,
  verifySignedDocumentUrl,
} from '@/features/affiliation/engine/affiliateEngine';

const mockedCreateClient = vi.mocked(createClient);
const mockedCreateTerrainReport = vi.mocked(createTerrainReport);

function geojsonRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/hikes/geojson${query}`, { method: 'GET' });
}

function terrainRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/terrain/reports', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const VALID_TERRAIN_BODY = { category: 'obstacle', severity: 'warning', lat: 45.1, lng: 2.8 };

function moderationInput(overrides: Record<string, unknown> = {}) {
  return {
    reportsLastHour: 0,
    confirmationsLastHour: 0,
    accountAgeDays: 30,
    reputation: 50,
    hasPhoto: false,
    descriptionLength: 100,
    ...overrides,
  };
}

describe('A14 — abus GeoJSON borné (TEST-A14-ABUSE-GEOJSON)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TEST-A14-ABUSE-GEOJSON-01: sans paramètres ⇒ bbox France par défaut', async () => {
    const rpc = vi.fn(async () => ({ data: { type: 'FeatureCollection', features: [] }, error: null }));
    mockedCreateClient.mockResolvedValue({ rpc } as never);

    const response = await geojsonGET(geojsonRequest(''));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('get_routes_for_map', {
      min_lng: -5.5,
      min_lat: 41.0,
      max_lng: 10.0,
      max_lat: 52.0,
      simplify_tolerance: 0.0008,
    });
    expect(response.headers.get('x-lkdv-bbox-clamped')).toBeNull();
  });

  it('TEST-A14-ABUSE-GEOJSON-02: bbox partielle ⇒ 400 sans appel RPC', async () => {
    const rpc = vi.fn();
    mockedCreateClient.mockResolvedValue({ rpc } as never);

    const response = await geojsonGET(geojsonRequest('?min_lng=-1&max_lng=2'));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('TEST-A14-ABUSE-GEOJSON-03: coordonnées non numériques/hors monde ⇒ 400', async () => {
    const rpc = vi.fn();
    mockedCreateClient.mockResolvedValue({ rpc } as never);

    const nan = await geojsonGET(geojsonRequest('?min_lng=abc&min_lat=41&max_lng=2&max_lat=52'));
    expect(nan.status).toBe(400);

    const outOfWorld = await geojsonGET(
      geojsonRequest('?min_lng=-181&min_lat=41&max_lng=2&max_lat=52')
    );
    expect(outOfWorld.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('TEST-A14-ABUSE-GEOJSON-04: bbox planétaire ⇒ bornée à MAX_BBOX_SPAN_DEG par axe (clamp vérifié)', async () => {
    const rpc = vi.fn(
      async (_fn: string, _args: Record<string, number>) => ({
        data: { type: 'FeatureCollection', features: [] },
        error: null,
      })
    );
    mockedCreateClient.mockResolvedValue({ rpc } as never);

    const response = await geojsonGET(
      geojsonRequest('?min_lng=-170&min_lat=-80&max_lng=170&max_lat=80')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-lkdv-bbox-clamped')).toBe('1');
    const args = rpc.mock.calls[0]?.[1];
    expect(args).toBeDefined();
    expect(args!.max_lng - args!.min_lng).toBeLessThanOrEqual(MAX_BBOX_SPAN_DEG + 0.000001);
    expect(args!.max_lat - args!.min_lat).toBeLessThanOrEqual(MAX_BBOX_SPAN_DEG + 0.000001);
  });

  it('TEST-A14-ABUSE-GEOJSON-05: tolérance énorme ⇒ bornée à MAX_TOLERANCE', async () => {
    const rpc = vi.fn(
      async (_fn: string, _args: Record<string, number>) => ({
        data: { type: 'FeatureCollection', features: [] },
        error: null,
      })
    );
    mockedCreateClient.mockResolvedValue({ rpc } as never);

    const response = await geojsonGET(geojsonRequest('?tolerance=999'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-lkdv-bbox-clamped')).toBe('1');
    const args = rpc.mock.calls[0]?.[1];
    expect(args).toBeDefined();
    expect(args!.simplify_tolerance).toBe(0.01);
  });

  it('TEST-A14-ABUSE-GEOJSON-06: min ≥ max ⇒ 400', async () => {
    const rpc = vi.fn();
    mockedCreateClient.mockResolvedValue({ rpc } as never);

    const response = await geojsonGET(geojsonRequest('?min_lng=5&min_lat=5&max_lng=5&max_lat=5'));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('A14 — abus Terrain Live : rate limits et contenus (TEST-A14-ABUSE-TERRAIN)', () => {
  it('TEST-A14-ABUSE-TERRAIN-01: 10 signalements/heure max (compte établi)', () => {
    const atLimit = moderationDecision(
      moderationInput({ reportsLastHour: MAX_REPORTS_PER_HOUR })
    );
    expect(atLimit.allowed).toBe(false);
    expect(atLimit.reasons).toContain(MODERATION_REASONS.rateLimit);

    const belowLimit = moderationDecision(
      moderationInput({ reportsLastHour: MAX_REPORTS_PER_HOUR - 1 })
    );
    expect(belowLimit.allowed).toBe(true);
  });

  it('TEST-A14-ABUSE-TERRAIN-02: compte de moins de 24 h limité à 3 signalements/heure', () => {
    const blocked = moderationDecision(
      moderationInput({ accountAgeDays: 0, reportsLastHour: NEW_ACCOUNT_MAX_REPORTS })
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons).toContain(MODERATION_REASONS.rateLimit);
  });

  it('TEST-A14-ABUSE-TERRAIN-03: cooldown de confirmations (2 max)', () => {
    const blocked = moderationDecision(
      moderationInput({ confirmationsLastHour: MAX_CONFIRMATIONS_COOLDOWN })
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons).toContain(MODERATION_REASONS.cooldown);
  });

  it('TEST-A14-ABUSE-TERRAIN-04: description > 1000 caractères rejetée', () => {
    const blocked = moderationDecision(
      moderationInput({ descriptionLength: MAX_DESCRIPTION_LENGTH + 1 })
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons).toContain(MODERATION_REASONS.description);
  });

  it('TEST-A14-ABUSE-TERRAIN-05: source officielle ⇒ rate limit neutralisé, contenu toujours borné', () => {
    const official = moderationDecision(
      moderationInput({ officialSource: true, reportsLastHour: 999 })
    );
    expect(official.allowed).toBe(true);

    const officialBadContent = moderationDecision(
      moderationInput({
        officialSource: true,
        reportsLastHour: 999,
        descriptionLength: MAX_DESCRIPTION_LENGTH + 1,
      })
    );
    expect(officialBadContent.allowed).toBe(false);
    expect(officialBadContent.reasons).toContain(MODERATION_REASONS.description);
  });
});

describe('A14 — abus photos : URL only, protocole et taille (TEST-A14-ABUSE-PHOTO)', () => {
  it('TEST-A14-ABUSE-PHOTO-01: URL non http(s) refusée (ftp, data:, javascript:)', () => {
    for (const url of ['ftp://serveur/photo.jpg', 'data:image/png;base64,AAAA', 'javascript:alert(1)']) {
      const decision = moderationDecision(
        moderationInput({ hasPhoto: true, photoUrl: url, photoSizeBytes: 1024 })
      );
      expect(decision.allowed).toBe(false);
      expect(decision.reasons).toContain(MODERATION_REASONS.photo);
    }
  });

  it('TEST-A14-ABUSE-PHOTO-02: photo > 5 Mo refusée, photo valide acceptée', () => {
    const tooBig = moderationDecision(
      moderationInput({ hasPhoto: true, photoUrl: 'https://cdn.example.invalid/p.jpg', photoSizeBytes: MAX_PHOTO_BYTES + 1 })
    );
    expect(tooBig.allowed).toBe(false);
    expect(tooBig.reasons).toContain(MODERATION_REASONS.photo);

    const valid = moderationDecision(
      moderationInput({
        hasPhoto: true,
        photoUrl: 'https://cdn.example.invalid/p.jpg',
        photoSizeBytes: MAX_PHOTO_BYTES,
      })
    );
    expect(valid.allowed).toBe(true);
  });

  it('TEST-A14-ABUSE-PHOTO-03: route ⇒ photoSizeBytes > 5 Mo rejeté en 400 avant toute écriture', async () => {
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    } as never);

    const response = await terrainPOST(
      terrainRequest({ ...VALID_TERRAIN_BODY, photoSizeBytes: MAX_PHOTO_BYTES + 1 })
    );

    expect(response.status).toBe(400);
    expect(mockedCreateTerrainReport).not.toHaveBeenCalled();
  });

  it('TEST-A14-ABUSE-PHOTO-04: route ⇒ photoUrl malformée rejetée en 400', async () => {
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    } as never);

    const response = await terrainPOST(
      terrainRequest({ ...VALID_TERRAIN_BODY, photoUrl: 'pas-une-url' })
    );

    expect(response.status).toBe(400);
    expect(mockedCreateTerrainReport).not.toHaveBeenCalled();
  });

  it('TEST-A14-ABUSE-PHOTO-05: route ⇒ description > 1000 caractères rejetée en 400', async () => {
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    } as never);

    const response = await terrainPOST(
      terrainRequest({ ...VALID_TERRAIN_BODY, description: 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1) })
    );

    expect(response.status).toBe(400);
    expect(mockedCreateTerrainReport).not.toHaveBeenCalled();
  });
});

describe('A14 — secrets HMAC fail-closed (TEST-A14-ABUSE-SECRET)', () => {
  const savedKeys = {
    crew: process.env.CREW_INVITE_SECRET,
    doc: process.env.DOC_SIGNING_SECRET,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  function clearSecrets(): void {
    delete process.env.CREW_INVITE_SECRET;
    delete process.env.DOC_SIGNING_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  function restoreSecrets(): void {
    const entries: [string, string | undefined][] = [
      ['CREW_INVITE_SECRET', savedKeys.crew],
      ['DOC_SIGNING_SECRET', savedKeys.doc],
      ['SUPABASE_SERVICE_ROLE_KEY', savedKeys.service],
    ];
    for (const [key, value] of entries) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  it('TEST-A14-ABUSE-SECRET-01: invitation sans clé configurée ⇒ fail-closed, jamais de secret public', () => {
    clearSecrets();
    try {
      expect(() => createInviteToken({ crewId: 'c1', inviterId: 'u1' })).toThrow(
        /CREW_INVITE_SECRET/
      );
      expect(verifyInviteToken('jeton-quelconque')).toBeNull();
    } finally {
      restoreSecrets();
    }
  });

  it('TEST-A14-ABUSE-SECRET-02: document signé sans clé ⇒ fail-closed', () => {
    clearSecrets();
    try {
      expect(() => generateSignedDocumentUrl('docs/passeport.pdf')).toThrow(/DOC_SIGNING_SECRET/);
      expect(verifySignedDocumentUrl('/api/documents/secure?file=x&expires=1&sig=y')).toEqual({
        isValid: false,
        error: 'INVALID_SIGNATURE',
      });
    } finally {
      restoreSecrets();
    }
  });

  it('TEST-A14-ABUSE-SECRET-03: clé explicite ⇒ signature/vérification toujours correctes', () => {
    const secret = 'a14-test-secret-0123456789abcdef';
    const token = createInviteToken({ crewId: 'c1', inviterId: 'u1' }, secret);
    expect(verifyInviteToken(token, secret)?.crewId).toBe('c1');
    expect(verifyInviteToken(token, 'autre-secret-0123456789abcdef')).toBeNull();

    const url = generateSignedDocumentUrl('docs/x.pdf', 60, secret);
    expect(verifySignedDocumentUrl(url, secret).isValid).toBe(true);
  });
});
