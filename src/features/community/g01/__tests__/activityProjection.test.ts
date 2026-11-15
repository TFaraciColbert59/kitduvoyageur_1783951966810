import { describe, expect, it } from 'vitest';
import { buildActivityShareDraft } from '../activityShare';
import {
  activityPreviewLabel,
  projectActivityFeed,
  projectActivityShare,
  visibleActivityCount,
} from '../activityProjection';
import type { SportSessionMetrics } from '../sportStats';

const OWNER = '11111111-1111-4111-8111-111111111111';
const VIEWER = '22222222-2222-4222-8222-222222222222';
const SESSION = '33333333-3333-4333-8333-333333333333';
const REQUEST = '44444444-4444-4444-8444-444444444444';
const POST = '55555555-5555-4555-8555-555555555555';

const session: SportSessionMetrics = {
  id: SESSION,
  ownerId: OWNER,
  sport: 'rando',
  title: 'Tour du lac',
  startedAt: '2026-11-13T08:00:00.000Z',
  distanceKm: 12.4,
  durationSeconds: 7200,
  elevationGainM: 850,
  maxAltitudeM: 2100,
  visibility: 'collective_anonymized',
  coverUrl: null,
};

function draft() {
  const result = buildActivityShareDraft(session, {
    audience: 'public',
    requestId: REQUEST,
    allowLikes: true,
    allowComments: true,
  });
  if (!result.ok) throw new Error(result.reason);
  return result;
}

function post(overrides: Record<string, unknown> = {}) {
  const result = draft();
  return {
    id: POST,
    author_id: OWNER,
    content: result.content,
    audience: 'public',
    club_id: null,
    created_at: '2026-11-13T10:00:00.000Z',
    likes_count: 3,
    comments_count: 1,
    creation_meta: result.meta,
    ...overrides,
  };
}

const viewer = { viewerId: VIEWER, blocked: false };

describe('G01 activity projection — carte', () => {
  it('projette une carte complète depuis la méta figée', () => {
    const card = projectActivityShare({
      post: post(),
      viewer,
      author: { id: OWNER, full_name: 'Marie Dupont', handle: 'marie', avatar_url: null },
    });
    expect(card).not.toBeNull();
    expect(card?.sessionId).toBe(SESSION);
    expect(card?.sport).toBe('rando');
    expect(card?.sportLabel).toBe('Randonnée');
    expect(card?.title).toBe('Tour du lac');
    expect(card?.stats.map((stat) => stat.key)).toContain('distance');
    expect(card?.likesCount).toBe(3);
    expect(card?.commentsCount).toBe(1);
    expect(card?.canLike).toBe(true);
    expect(card?.canComment).toBe(true);
    expect(card?.author.name).toBe('Marie Dupont');
    expect(card?.coverUrl).toBeNull();
  });

  it('retombe sur un nom stable quand le profil est absent', () => {
    const card = projectActivityShare({ post: post(), viewer });
    expect(card?.author.name).toBe('Voyageur 1111');
  });

  it('refuse une séance d’un autre propriétaire', () => {
    const card = projectActivityShare({
      post: post(),
      session: { ...session, ownerId: VIEWER },
      viewer,
    });
    expect(card).toBeNull();
  });

  it('refuse une publication dont l’auteur ne correspond pas à la méta', () => {
    const card = projectActivityShare({ post: post({ author_id: VIEWER }), viewer });
    expect(card).toBeNull();
  });

  it('refuse un partage retiré', () => {
    const result = draft();
    const card = projectActivityShare({
      post: post({
        creation_meta: {
          ...result.meta,
          status: 'revoked',
          version: 2,
          revoked_at: '2026-11-13T12:00:00.000Z',
        },
      }),
      viewer,
    });
    expect(card).toBeNull();
  });

  it('refuse une audience non satisfaite', () => {
    const card = projectActivityShare({
      post: post({ audience: 'abonnies' }),
      viewer: { viewerId: VIEWER, blocked: false, isFollower: false },
    });
    expect(card).toBeNull();

    const allowed = projectActivityShare({
      post: post({ audience: 'abonnies' }),
      viewer: { viewerId: VIEWER, blocked: false, isFollower: true },
    });
    expect(allowed).not.toBeNull();
  });

  it('refuse une séance devenue privée à un tiers', () => {
    const result = draft();
    const card = projectActivityShare({
      post: post({
        creation_meta: { ...result.meta, activity_visibility: 'private' },
      }),
      viewer,
    });
    expect(card).toBeNull();
  });

  it('ne rend pas une carte sans statistique éligible', () => {
    const result = draft();
    const card = projectActivityShare({
      post: post({
        creation_meta: {
          ...result.meta,
          metrics: {
            distanceKm: null,
            durationSeconds: null,
            elevationGainM: null,
            maxAltitudeM: null,
          },
        },
      }),
      viewer,
    });
    expect(card).toBeNull();
  });

  it('affiche les records figés dans la méta sans relire la séance', () => {
    const result = buildActivityShareDraft(session, {
      audience: 'public',
      requestId: REQUEST,
      records: [
        {
          id: 'rec-1',
          sport: 'rando',
          sessionId: SESSION,
          stat: 'distance',
          value: 12.4,
          visibility: 'collective_anonymized',
        },
      ],
    });
    if (!result.ok) throw new Error(result.reason);
    const card = projectActivityShare({
      post: post({ creation_meta: result.meta }),
      viewer,
    });
    expect(card?.records).toHaveLength(1);
    expect(card?.records[0].label).toBe('Plus longue distance');
    expect(card?.records[0].formatted).toMatch(/12,4 km/);
  });

  it('désactive les interactions quand la méta les ferme', () => {
    const result = buildActivityShareDraft(session, {
      audience: 'public',
      requestId: REQUEST,
      allowLikes: false,
      allowComments: false,
    });
    if (!result.ok) throw new Error(result.reason);
    const card = projectActivityShare({
      post: post({ creation_meta: result.meta }),
      viewer,
    });
    expect(card?.canLike).toBe(false);
    expect(card?.canComment).toBe(false);
  });

  it('projette une liste en conservant l’ordre et en retirant les refus', () => {
    const cards = projectActivityFeed([
      { post: post(), viewer },
      { post: post({ id: '66666666-6666-4666-8666-666666666666', audience: 'club' }), viewer },
    ]);
    expect(cards).toHaveLength(1);
    expect(visibleActivityCount([{ post: post(), viewer }])).toBe(1);
    expect(activityPreviewLabel(cards[0])).toMatch(/Randonnée/);
  });
});
