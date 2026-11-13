import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));

vi.mock('@/lib/api/requireUser', () => ({ requireUser: mocks.requireUser }));

import { GET, POST } from '../route';
import { PATCH as PATCH_PREFERENCES } from '../preferences/route';
import { buildActivity, buildSegment } from '@/components/segments/__tests__/fixtures';
import {
  getPreferences,
  resetSegmentsStore,
  upsertSegment,
} from '@/lib/segments/store';

beforeEach(() => {
  resetSegmentsStore();
  mocks.requireUser.mockReset();
  mocks.requireUser.mockResolvedValue({
    ok: true,
    user: { id: 'user-1' },
    supabase: {},
  });
});

describe('/api/segments', () => {
  it('refuse sans session', async () => {
    mocks.requireUser.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });
    const response = await GET(new NextRequest('http://localhost/api/segments'));
    expect(response.status).toBe(401);
  });

  it('crée un segment depuis la trace du demandeur', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/segments', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Montée du Belvédère',
          activity: buildActivity(),
          startPointIndex: 0,
          endPointIndex: 11,
          visibility: 'public',
        }),
      })
    );

    expect(response.status).toBe(201);
    const payload = (await response.json()) as { segment: { name: string; lengthM: number } };
    expect(payload.segment.name).toBe('Montée du Belvédère');
    expect(payload.segment.lengthM).toBeGreaterThan(120);
  });

  it('refuse une activité qui appartient à un autre compte', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/segments', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Segment volé',
          activity: buildActivity({ userId: 'user-2' }),
          startPointIndex: 0,
          endPointIndex: 11,
          visibility: 'public',
        }),
      })
    );

    expect(response.status).toBe(403);
  });

  it('recherche et exclut les segments privés d’autrui (P01)', async () => {
    upsertSegment(buildSegment());
    upsertSegment(
      buildSegment({
        id: 'seg-private',
        name: 'Secret de Bob',
        visibility: 'private',
        createdByUserId: 'user-2',
      })
    );

    const response = await GET(new NextRequest('http://localhost/api/segments'));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { hits: Array<{ segment: { id: string } }> };
    expect(payload.hits.map((hit) => hit.segment.id)).toEqual(['seg-1']);
  });

  it('étoile puis masque un segment de façon idempotente', async () => {
    upsertSegment(buildSegment());

    const starred = await PATCH_PREFERENCES(
      new NextRequest('http://localhost/api/segments/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ segmentId: 'seg-1', action: 'star' }),
      })
    );
    expect(starred.status).toBe(200);
    expect(getPreferences('user-1').starredSegmentIds).toEqual(['seg-1']);

    const hidden = await PATCH_PREFERENCES(
      new NextRequest('http://localhost/api/segments/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ segmentId: 'seg-1', action: 'hide' }),
      })
    );
    expect(hidden.status).toBe(200);
    expect(getPreferences('user-1').hiddenSegmentIds).toEqual(['seg-1']);
  });
});
