import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getHighlights, POST as postHighlight } from '@/app/api/highlights/route';
import { GET as getCollections, POST as postCollection } from '@/app/api/collections/route';
import { GET as getDiscover } from '@/app/api/highlights/discover/route';
import { GET as getRouteMedia, POST as postRouteMedia } from '@/app/api/highlights/route-media/route';

const mockUser = { id: 'user-owner-1', email: 'owner@lkdv.test' };
let currentUserId = mockUser.id;
let authed = true;

vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async () => null),
}));

vi.mock('@/lib/api/requireUser', () => ({
  requireUser: vi.fn(async () =>
    authed
      ? { ok: true, user: { id: currentUserId, email: `${currentUserId}@lkdv.test` } }
      : { ok: false, response: new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }) },
  ),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: async () => ({
        data: { user: authed ? { id: currentUserId, email: `${currentUserId}@lkdv.test` } : null },
      }),
    },
  })),
}));

vi.mock('@/lib/supabase/pgrest', () => ({
  pgrest: {
    get: vi.fn(async () => []),
  },
}));

describe('C03 API routes (Highlights, Collections, Discover, Route-Media)', () => {
  beforeEach(() => {
    authed = true;
    currentUserId = mockUser.id;
  });

  it('rejects unauthenticated highlight creation (401) and enforces C-PRIV when authorized', async () => {
    authed = false;
    const unauthRes = await postHighlight(
      new NextRequest('http://localhost/api/highlights', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          kind: 'place',
          targetType: 'route',
          targetId: 'route-42',
          title: 'Belvédère secret',
          description: 'Vue dégagée',
          sport: 'hike',
          areaLabel: 'Vercors',
          lat: 45.05,
          lng: 5.55,
          audience: 'public',
          hideExactLocation: true,
        }),
      }),
    );
    expect(unauthRes.status).toBe(401);

    authed = true;
    const createRes = await postHighlight(
      new NextRequest('http://localhost/api/highlights', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          kind: 'place',
          targetType: 'route',
          targetId: 'route-42',
          title: 'Col panoramique',
          description: 'Point de vue alpin',
          sport: 'hike',
          areaLabel: 'Mont-Blanc',
          lat: 45.92,
          lng: 6.87,
          audience: 'public',
          hideExactLocation: true,
        }),
      }),
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.highlight.title).toBe('Col panoramique');

    // Public viewer should not see hidden exact coordinates
    authed = false;
    const publicListRes = await getHighlights(
      new NextRequest('http://localhost/api/highlights?targetId=route-42'),
    );
    const publicJson = await publicListRes.json();
    const item = publicJson.items.find((h: { id: string }) => h.id === created.highlight.id);
    expect(item).toBeDefined();
    expect(item.location).toBeNull();
  });

  it('creates, shares, resolves, and revokes a collection (K5.16, K5.18)', async () => {
    const createRes = await postCollection(
      new NextRequest('http://localhost/api/collections', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          title: 'Boucles Gravel 2026',
          description: 'Traces alpines',
          visibility: 'unlisted',
          kind: 'personal',
        }),
      }),
    );
    expect(createRes.status).toBe(200);
    const { collection } = await createRes.json();

    const shareRes = await postCollection(
      new NextRequest('http://localhost/api/collections', {
        method: 'POST',
        body: JSON.stringify({
          action: 'share',
          collectionId: collection.id,
          expiresInHours: 48,
        }),
      }),
    );
    expect(shareRes.status).toBe(200);
    const shareJson = await shareRes.json();
    const token: string | undefined = shareJson.link?.token;
    expect(token).toBeTruthy();
    expect(shareJson.path).toBe(`/h/c/${encodeURIComponent(token!)}`);

    authed = false;
    const resolved = await getCollections(
      new NextRequest(`http://localhost/api/collections?token=${encodeURIComponent(token!)}`),
    );
    expect(resolved.status).toBe(200);

    authed = true;
    const revokeRes = await postCollection(
      new NextRequest('http://localhost/api/collections', {
        method: 'POST',
        body: JSON.stringify({
          action: 'revoke_share',
          collectionId: collection.id,
          linkId: shareJson.link.id,
        }),
      }),
    );
    expect(revokeRes.status).toBe(200);

    authed = false;
    const afterRevoke = await getCollections(
      new NextRequest(`http://localhost/api/collections?token=${encodeURIComponent(token!)}`),
    );
    expect(afterRevoke.status).toBe(404);
  });

  it('exposes discover feed and route-media with provider-absent StreetView fallback and community observations', async () => {
    const discoverRes = await getDiscover(new NextRequest('http://localhost/api/highlights/discover'));
    expect(discoverRes.status).toBe(200);
    const discoverJson = await discoverRes.json();
    expect(Array.isArray(discoverJson.recommendations)).toBe(true);
    expect(Array.isArray(discoverJson.guides)).toBe(true);

    const obsRes = await postRouteMedia(
      new NextRequest('http://localhost/api/highlights/route-media', {
        method: 'POST',
        body: JSON.stringify({
          routeId: 'route-42',
          text: 'Sentier sec et bien balisé ce matin',
          tags: ['panoramique', 'sec'],
          audience: 'public',
          consentAggregate: true,
        }),
      }),
    );
    expect(obsRes.status).toBe(201);

    // Second distinct source confirms multi-source threshold for S3.24 tags
    currentUserId = 'user-owner-2';
    const obsRes2 = await postRouteMedia(
      new NextRequest('http://localhost/api/highlights/route-media', {
        method: 'POST',
        body: JSON.stringify({
          routeId: 'route-42',
          text: 'Vue panoramique confirmée au col',
          tags: ['panoramique'],
          audience: 'public',
          consentAggregate: true,
        }),
      }),
    );
    expect(obsRes2.status).toBe(201);

    const mediaRes = await getRouteMedia(
      new NextRequest('http://localhost/api/highlights/route-media?routeId=route-42&lat=45.9&lng=6.8'),
    );
    expect(mediaRes.status).toBe(200);
    const mediaJson = await mediaRes.json();
    expect(mediaJson.streetView.reason).toBe('provider-absent');
    expect(mediaJson.communitySummary.tags.some((t: { tag: string }) => t.tag === 'panoramique')).toBe(true);
  });
});
