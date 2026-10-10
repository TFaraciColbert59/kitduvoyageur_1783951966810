/**
 * Adversarial Test Suite for LKDV Feed V1 API Route & Server Integration
 *
 * Focus areas:
 * 1. GET /api/community/feed route handling for all 4 tab queries:
 *    ('pour-toi', 'abonnements', 'autour-de-moi', 'clubs') + unknown tab fallback
 * 2. Cursor serialization/deserialization & pagination boundaries
 * 3. Guest / unauthenticated user handling & graceful degradation
 * 4. Geolocation parameters, malformed query inputs, and defensive error handling
 * 5. Full authenticated user pipeline with database mocks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/community/feed/route';
import {
  encodeCursor,
  decodeCursor,
  generateFeedFromCandidates,
} from '@/features/community/feed/server/feedService';
import type { FeedCandidateItem } from '@/features/community/feed/types/feed.types';
import type { RawPostRecord } from '@/features/community/feed/server/candidateBuilder';

// Mock Supabase server client
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

import { createClient } from '@/lib/supabase/server';

function createCandidate(
  id: string,
  authorId: string,
  postType = 'post',
  overrides: Partial<FeedCandidateItem> = {}
): FeedCandidateItem {
  return {
    id,
    authorId,
    content: `Aventure outdoor dans les Alpes pour le post ${id}.`,
    postType,
    createdAt: '2026-10-03T12:00:00Z',
    likesCount: 15,
    commentsCount: 4,
    signals: {
      intent: { matchesDestination: false, matchesActivity: false },
      utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
      quality: { authorTrustScore: 70, authorLoyaltyLevel: 'standard', hasSubstantialContent: true },
      geo: { matchesMassif: false, matchesRegion: false, distanceKm: null },
      social: { isAuthorFollowed: false, sharesClubMembership: false },
      feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
    },
    ...overrides,
  };
}

function setupMockDatabase(rawPosts: RawPostRecord[] = []) {
  mockFrom.mockImplementation((tableName: string) => {
    if (tableName === 'community_posts') {
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: rawPosts, error: null }),
          }),
        }),
      };
    }
    if (tableName === 'public_profiles') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'auth-user-1',
                full_name: 'Guide Alpin',
                trust_score: 95,
                loyalty_level: 'ambassadeur',
              },
            ],
            error: null,
          }),
        }),
      };
    }
    if (tableName === 'carnets') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'carnet-1',
                title: 'Traversée du Vercors',
                destination: 'Vercors',
                verified: true,
                route_rating: 4.8,
                tags: ['randonnée', 'bivouac'],
                map_points: [{ lat: 45.0, lng: 5.5 }],
              },
            ],
            error: null,
          }),
        }),
      };
    }
    // user context tables (user_follows, club_members, content_feedback, trips, post_saves, post_likes)
    const contextQuery: any = {
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    contextQuery.in = vi.fn().mockImplementation(() => ({
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));
    return {
      select: vi.fn().mockReturnValue(contextQuery),
    };
  });
}

describe('Feed V1 API Route (/api/community/feed) Adversarial Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockDatabase([]);
  });

  describe('1. Tab Query Validation and Fallback Behavior', () => {
    it('serves "pour-toi" tab by default when tab parameter is omitted', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = new Request('http://localhost:3000/api/community/feed');
      const response = await GET(req);

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toContain('no-store');

      const data = await response.json();
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('hasMore');
    });

    it('handles "abonnements" tab query properly', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = new Request('http://localhost:3000/api/community/feed?tab=abonnements');
      const response = await GET(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('handles "autour-de-moi" tab query properly with coordinates', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = new Request('http://localhost:3000/api/community/feed?tab=autour-de-moi&lat=45.188&lng=5.724&massif=Vercors');
      const response = await GET(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('handles "clubs" tab query properly', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = new Request('http://localhost:3000/api/community/feed?tab=clubs');
      const response = await GET(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('gracefully falls back to "pour-toi" when an invalid or malicious tab name is provided', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const maliciousTabs = [
        'unknown-tab',
        '<script>alert(1)</script>',
        '../../etc/passwd',
        'ADMIN_MODE',
        '',
        '12345',
      ];

      for (const tabName of maliciousTabs) {
        const req = new Request(`http://localhost:3000/api/community/feed?tab=${encodeURIComponent(tabName)}`);
        const response = await GET(req);
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('items');
        expect(data).toHaveProperty('hasMore');
      }
    });
  });

  describe('2. Cursor Serialization, Deserialization & Boundary Conditions', () => {
    it('encodes and decodes valid offset cursors symmetrically', () => {
      const offsets = [0, 1, 5, 20, 100, 9999];
      for (const offset of offsets) {
        const encoded = encodeCursor(offset);
        expect(typeof encoded).toBe('string');
        const decoded = decodeCursor(encoded);
        expect(decoded).toBe(offset);
      }
    });

    it('safely decodes invalid, malformed, or hostile cursors to 0 without throwing', () => {
      const adversarialCursors = [
        null,
        undefined,
        '',
        '   ',
        'not-base64!',
        Buffer.from('not json').toString('base64'),
        Buffer.from(JSON.stringify({ offset: -10 })).toString('base64'),
        Buffer.from(JSON.stringify({ offset: 'not-a-number' })).toString('base64'),
        Buffer.from(JSON.stringify({ invalidKey: 42 })).toString('base64'),
        Buffer.from(JSON.stringify({ offset: null })).toString('base64'),
        Buffer.from(JSON.stringify({})).toString('base64'),
        Buffer.from(JSON.stringify({ __proto__: { offset: 100 } })).toString('base64'),
      ];

      for (const cursor of adversarialCursors) {
        expect(() => {
          const res = decodeCursor(cursor);
          expect(res).toBe(0);
        }).not.toThrow();
      }
    });

    it('enforces limit boundaries (clamps limit between 1 and 50)', () => {
      const candidates = Array.from({ length: 60 }, (_, i) =>
        createCandidate(`c-${i}`, `author-${i}`)
      );

      // Limit = 0 -> clamped to 1
      const res0 = generateFeedFromCandidates(candidates, {}, { limit: 0 });
      expect(res0.items).toHaveLength(1);

      // Limit = -50 -> clamped to 1
      const resNeg = generateFeedFromCandidates(candidates, {}, { limit: -50 });
      expect(resNeg.items).toHaveLength(1);

      // Limit = 50 -> returns 50
      const res50 = generateFeedFromCandidates(candidates, {}, { limit: 50 });
      expect(res50.items).toHaveLength(50);

      // Limit = 100 -> clamped to 50
      const res100 = generateFeedFromCandidates(candidates, {}, { limit: 100 });
      expect(res100.items).toHaveLength(50);
    });

    it('iterates through entire dataset across consecutive cursor pages until exhaustion', () => {
      const totalCandidates = 25;
      const pageSize = 7;
      const candidates = Array.from({ length: totalCandidates }, (_, i) =>
        createCandidate(`c-${i}`, `author-${i}`, 'post', {
          createdAt: `2026-10-03T${String(10 + Math.floor(i / 2)).padStart(2, '0')}:${String((i * 2) % 60).padStart(2, '0')}:00Z`,
        })
      );

      const collectedIds: string[] = [];
      let cursor: string | undefined = undefined;
      let pages = 0;

      while (pages < 10) {
        pages++;
        const page = generateFeedFromCandidates(candidates, {}, { limit: pageSize, cursor });
        collectedIds.push(...page.items.map((it) => it.post.id));

        if (!page.hasMore) {
          expect(page.nextCursor).toBeUndefined();
          break;
        }

        expect(page.nextCursor).toBeDefined();
        cursor = page.nextCursor;
      }

      // Check pagination invariants
      expect(pages).toBe(Math.ceil(totalCandidates / pageSize)); // 25 / 7 = 4 pages
      expect(collectedIds).toHaveLength(totalCandidates);
      // All items were served uniquely without duplication across pages
      const uniqueIds = new Set(collectedIds);
      expect(uniqueIds.size).toBe(totalCandidates);
    });

    it('handles pagination offset exceeding total candidate pool size', () => {
      const candidates = [createCandidate('c-1', 'author-1')];
      const hugeCursor = encodeCursor(100);

      const page = generateFeedFromCandidates(candidates, {}, { cursor: hugeCursor });
      expect(page.items).toHaveLength(0);
      expect(page.hasMore).toBe(false);
      expect(page.nextCursor).toBeUndefined();
    });
  });

  describe('3. Guest / Unauthenticated User Handling', () => {
    it('returns 200 with feed items for completely unauthenticated guest users', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const req = new Request('http://localhost:3000/api/community/feed');
      const response = await GET(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('hasMore');
    });

    it('recovers gracefully when Supabase client creation throws an error (auth down / network error)', async () => {
      const mockedCreateClient = vi.mocked(createClient);
      mockedCreateClient.mockRejectedValueOnce(new Error('Supabase network connection refused'));

      const req = new Request('http://localhost:3000/api/community/feed?tab=pour-toi');
      const response = await GET(req);

      // Should degrade gracefully to guest mode or return fallback feed instead of crashing
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.items).toEqual([]);
      expect(data.hasMore).toBe(false);
    });

    it('recovers gracefully when getUser throws or returns an error', async () => {
      mockGetUser.mockRejectedValueOnce(new Error('JWT token malformed or expired'));

      const req = new Request('http://localhost:3000/api/community/feed?tab=pour-toi');
      const response = await GET(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('sets user interactions (isSaved, isLiked) to false for unauthenticated guests', () => {
      const guestCandidate = createCandidate('p-guest', 'author-1');
      const response = generateFeedFromCandidates([guestCandidate], {}, { userId: null });

      expect(response.items[0].userInteractions).toEqual({
        isSaved: false,
        isLiked: false,
      });
    });
  });

  describe('4. Geolocation Parameters and Robustness', () => {
    it('handles NaN or invalid coordinates gracefully without throwing', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const req = new Request('http://localhost:3000/api/community/feed?lat=invalid&lng=not_a_number');
      const response = await GET(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('handles boundary coordinates (Null Island: 0, 0)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const req = new Request('http://localhost:3000/api/community/feed?lat=0&lng=0');
      const response = await GET(req);

      expect(response.status).toBe(200);
    });

    it('handles extreme coordinates without crashing', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const req = new Request('http://localhost:3000/api/community/feed?lat=9999&lng=-9999');
      const response = await GET(req);

      expect(response.status).toBe(200);
    });

    it('handles non-numeric limit parameter gracefully and defaults to 20', async () => {
      const mockPosts: RawPostRecord[] = Array.from({ length: 5 }, (_, i) => ({
        id: `post-limit-${i}`,
        author_id: 'auth-user-1',
        content: `Contenu post ${i}`,
        post_type: 'post',
        created_at: '2026-10-03T08:00:00Z',
      }));
      setupMockDatabase(mockPosts);
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const req = new Request('http://localhost:3000/api/community/feed?limit=not_a_number');
      const response = await GET(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.items).toHaveLength(5);
    });
  });

  describe('5. End-to-End Feed Response Contract', () => {
    it('ensures each feed item contains valid transparency and userInteractions structures', () => {
      const candidate = createCandidate('p-1', 'author-1', 'tip', {
        signals: {
          intent: { matchesDestination: true, matchesActivity: true, matchedDestinationName: 'Mont Blanc' },
          utility: { hasVerifiedCarnet: true, hasGpsTrack: true, isTipOrSafety: true, hasVerifiedGear: true },
          quality: { authorTrustScore: 90, authorLoyaltyLevel: 'ambassadeur', hasSubstantialContent: true },
          geo: { matchesMassif: true, matchedMassifName: 'Mont-Blanc', matchesRegion: true },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const feed = generateFeedFromCandidates([candidate], {}, { tab: 'pour-toi' });
      expect(feed.items).toHaveLength(1);

      const item = feed.items[0];
      // Post verification
      expect(item.post.id).toBe('p-1');

      // Transparency verification
      expect(item.transparency).toBeDefined();
      expect(item.transparency.scoreBreakdown.total).toBeGreaterThan(0);
      expect(item.transparency).toBeDefined();
      expect(item.transparency.primaryReason).toBeDefined();
      expect(typeof item.transparency.explanation).toBe('string');
      expect(item.transparency.explanation.length).toBeGreaterThan(0);
      expect(item.transparency.scoreBreakdown).toBeDefined();
      expect(item.transparency.scoreBreakdown.utility).toBeGreaterThan(0);
      expect(item.transparency.scoreBreakdown.total).toBeGreaterThan(0);

      // User interactions verification
      expect(item.userInteractions).toEqual({
        isSaved: false,
        isLiked: false,
      });
    });

    it('populates userInteractions (isSaved, isLiked, reaction) when user is authenticated with database interactions', async () => {
      const mockPost: RawPostRecord = {
        id: 'post-101',
        author_id: 'auth-user-1',
        content: 'Bivouac dans le Vercors au lever du soleil.',
        post_type: 'post',
        linked_carnet_id: 'carnet-1',
        created_at: '2026-10-03T08:00:00Z',
      };

      mockGetUser.mockResolvedValue({ data: { user: { id: 'current-user-id' } } });

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'community_posts') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [mockPost], error: null }),
              }),
            }),
          };
        }
        if (tableName === 'public_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'auth-user-1', full_name: 'Guide Alpin', trust_score: 85 }],
                error: null,
              }),
            }),
          };
        }
        if (tableName === 'carnets') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'carnet-1', title: 'Vercors', destination: 'Vercors', verified: true }],
                error: null,
              }),
            }),
          };
        }
        if (tableName === 'post_saves') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ post_id: 'post-101' }], error: null }),
            }),
          };
        }
        if (tableName === 'post_likes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ post_id: 'post-101', reaction: 'utilite' }], error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const req = new Request('http://localhost:3000/api/community/feed?tab=pour-toi');
      const response = await GET(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.items).toHaveLength(1);

      const item = data.items[0];
      expect(item.post.id).toBe('post-101');
      expect(item.userInteractions.isSaved).toBe(true);
      expect(item.userInteractions.isLiked).toBe(true);
      expect(item.userInteractions.reaction).toBe('utilite');
    });
  });
});
