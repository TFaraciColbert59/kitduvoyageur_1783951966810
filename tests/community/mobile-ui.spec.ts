/**
 * Automated Test Suite for LKDV Community Architecture Milestone 3 (Requirement R4)
 * Mobile UI, Apple HIG Interactions, Persistent Social Mutations, and Algorithmic Transparency
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { POST as interactionsPost, GET as interactionsGet } from '@/app/api/community/interactions/route';
import TransparencySheet from '@/components/communaute/TransparencySheet';
import PostActionSheet from '@/components/communaute/PostActionSheet';
import CommunityPostCard from '@/components/communaute/CommunityPostCard';
import MobileCommunityHub from '@/components/communaute/MobileCommunityHub';
import CommunityHubNav from '@/components/social/CommunityHubNav';
import type { RecommendationTransparency } from '@/features/community/feed/types/feed.types';

// Mock framer-motion to prevent browser-only errors during server-side markup rendering
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
    motion: {
      div: ({ children, className, style, ...props }: any) =>
        React.createElement('div', { className, style, ...props }, children),
      button: ({ children, className, ...props }: any) =>
        React.createElement('button', { className, ...props }, children),
      span: ({ children, className, ...props }: any) =>
        React.createElement('span', { className, ...props }, children),
    },
  };
});

// Mock Radix Dialog portal for server-side static markup rendering
vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children, open }: any) => (open ? React.createElement(React.Fragment, null, children) : null),
  Portal: ({ children }: any) => React.createElement(React.Fragment, null, children),
  Overlay: ({ children, className }: any) => React.createElement('div', { className }, children),
  Content: ({ children, className }: any) => React.createElement('div', { className }, children),
  Title: ({ children, className }: any) => React.createElement('h2', { className }, children),
  Description: ({ children, className }: any) => React.createElement('p', { className }, children),
  Close: ({ children }: any) => children,
  Trigger: ({ children }: any) => children,
}));

// Mock SearchContext for MobileCommunityHeader
vi.mock('@/contexts/SearchContext', () => ({
  useSearchContext: () => ({
    query: '',
    setQuery: vi.fn(),
    isOpen: false,
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
  }),
}));

// Mock Next.js navigation
const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/communaute',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href, className, onClick, ...props }: any) =>
    React.createElement('a', { href, className, onClick, ...props }, children),
}));

// Mock haptics
const mockTriggerHaptic = vi.fn();
vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({
    haptic: mockTriggerHaptic,
    triggerHaptic: mockTriggerHaptic,
    vibrate: mockTriggerHaptic,
  }),
}));

// Mock Supabase server client for API route tests
const mockGetUser = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

const VALID_POST_ID = '33333333-3333-4000-8000-333333333333';
const VALID_AUTHOR_ID = '11111111-1111-4000-8000-111111111111';
const VALID_CARNET_ID = '22222222-2222-4000-8000-222222222222';
const VALID_USER_ID = '99999999-9999-4000-8000-999999999999';

const dummyTransparency: RecommendationTransparency = {
  primaryReason: 'quality_field_proof',
  explanation: 'Récit d’expédition vérifié avec tracé GPS et données terrain dans les Écrins.',
  badgeLabel: 'Vérifié terrain',
  scoreBreakdown: {
    total: 0.82,
    intent: 0.70,
    utility: 0.85,
    quality: 0.80,
    geo: 0.60,
    social: 0.45,
  },
  matchedSignals: {
    tripDestination: 'Écrins',
    massif: 'Écrins',
    isVerifiedCarnet: true,
    authorTrustScore: 88,
  },
};

describe('Milestone 3 — Mobile UI & Apple HIG Architecture (Requirement R4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 1. PERSISTENT SOCIAL MUTATIONS API ROUTE (/api/community/interactions)
  // ════════════════════════════════════════════════════════════════════════════
  describe('1. API Route: /api/community/interactions', () => {
    it('POST: rejects unauthenticated requests with 401', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('No session') });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', postId: VALID_POST_ID }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/Authentification requise/i);
    });

    it('POST: validates invalid action or missing postId', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', postId: 'not-a-valid-uuid' }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/UUID valide requis/i);
    });

    it('POST: toggles save via RPC toggle_post_save for authenticated user', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockRpc.mockResolvedValueOnce({
        data: { saved: true, post_id: VALID_POST_ID },
        error: null,
      });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', postId: VALID_POST_ID }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.saved).toBe(true);
      expect(json.postId).toBe(VALID_POST_ID);
      expect(mockRpc).toHaveBeenCalledWith('toggle_post_save', { p_post_id: VALID_POST_ID });
    });

    it('POST: handles feedback "hide" via RPC submit_content_feedback', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockRpc.mockResolvedValueOnce({
        data: 'feedback-uuid-1',
        error: null,
      });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          targetType: 'post',
          targetId: VALID_POST_ID,
          feedbackType: 'hide',
        }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.feedbackType).toBe('hide');
      expect(mockRpc).toHaveBeenCalledWith('submit_content_feedback', {
        p_target_type: 'post',
        p_target_id: VALID_POST_ID,
        p_feedback_type: 'hide',
        p_reason: null,
      });
    });

    it('POST: handles shorthand action "less_like_this"', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockRpc.mockResolvedValueOnce({
        data: 'feedback-uuid-2',
        error: null,
      });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'less_like_this',
          postId: VALID_POST_ID,
        }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.feedbackType).toBe('less_like_this');
    });

    it('POST: rejects invalid target_type and invalid feedback_type', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          targetType: 'invalid_type',
          targetId: VALID_POST_ID,
          feedbackType: 'hide',
        }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/targetType invalide/i);
    });

    it('GET: returns save status for a given postId', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'save-123' }, error: null }),
            }),
          }),
        }),
      });

      const req = new Request(`http://localhost:3000/api/community/interactions?postId=${VALID_POST_ID}`);
      const res = await interactionsGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.isSaved).toBe(true);
      expect(json.postId).toBe(VALID_POST_ID);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. TRANSPARENCY SHEET (Radix Sheet, Breakdown Factors & Apple HIG)
  // ════════════════════════════════════════════════════════════════════════════
  describe('2. TransparencySheet Component', () => {
    it('renders dialog title and explanation correctly', () => {
      const html = renderToStaticMarkup(
        React.createElement(TransparencySheet, {
          open: true,
          onOpenChange: vi.fn(),
          transparency: dummyTransparency,
          postTitle: 'Bivouac au glacier Blanc',
          authorName: 'Alexandre Guide',
        })
      );

      expect(html).toContain('Pourquoi je vois ce contenu');
      expect(html).toContain('Récit d’expédition vérifié avec tracé GPS');
      expect(html).toContain('Vérifié terrain');
      expect(html).toContain('Alexandre Guide');
    });

    it('displays all 5 breakdown factors with appropriate weights', () => {
      const html = renderToStaticMarkup(
        React.createElement(TransparencySheet, {
          open: true,
          onOpenChange: vi.fn(),
          transparency: dummyTransparency,
        })
      );

      expect(html).toContain('Intention de voyage');
      expect(html).toContain('Poids 30%');
      expect(html).toContain('Utilité &amp; Données terrain');
      expect(html).toContain('Poids 25%');
      expect(html).toContain('Qualité &amp; Fiabilité auteur');
      expect(html).toContain('Poids 20%');
      expect(html).toContain('Proximité &amp; Territoire');
      expect(html).toContain('Poids 15%');
      expect(html).toContain('Affinité sociale &amp; Clubs');
      expect(html).toContain('Poids 10%');
    });

    it('contains progress bars for scores without any orange color', () => {
      const html = renderToStaticMarkup(
        React.createElement(TransparencySheet, {
          open: true,
          onOpenChange: vi.fn(),
          transparency: dummyTransparency,
        })
      );

      expect(html).toContain('progressbar');
      expect(html).toContain('Engagement éthique LKDV');
      // Zero orange #E4501C strict check
      expect(html).not.toContain('#E4501C');
      expect(html).not.toContain('orange');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. POST ACTION SHEET (Native Mobile Action Sheet & 44px min targets)
  // ════════════════════════════════════════════════════════════════════════════
  describe('3. PostActionSheet Component', () => {
    it('renders all 6 essential actions with Apple HIG touch targets', () => {
      const html = renderToStaticMarkup(
        React.createElement(PostActionSheet, {
          open: true,
          onOpenChange: vi.fn(),
          isSaved: false,
          onToggleSave: vi.fn(),
          onWhyThis: vi.fn(),
          onLessLikeThis: vi.fn(),
          onHide: vi.fn(),
          onShare: vi.fn(),
          onReport: vi.fn(),
          hasTransparency: true,
        })
      );

      expect(html).toContain('Options de la publication');
      expect(html).toContain('Enregistrer dans mes favoris');
      expect(html).toContain('Pourquoi je vois ce contenu');
      expect(html).toContain('Copier le lien direct');
      expect(html).toContain('Moins comme ceci');
      expect(html).toContain('Masquer cette publication');
      expect(html).toContain('Signaler la publication');
      expect(html).toContain('Annuler');
      // Min 44px / 48px touch targets
      expect(html).toMatch(/min-h-\[(44|48)px\]/);
    });

    it('shows saved confirmation text when isSaved is true', () => {
      const html = renderToStaticMarkup(
        React.createElement(PostActionSheet, {
          open: true,
          onOpenChange: vi.fn(),
          isSaved: true,
          onToggleSave: vi.fn(),
          onLessLikeThis: vi.fn(),
          onHide: vi.fn(),
          onReport: vi.fn(),
        })
      );

      expect(html).toContain('Retirer des favoris');
      expect(html).toContain('Enregistré ✓');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. COMMUNITY POST CARD (Optimistic UI, Transparency Pill & Haptics)
  // ════════════════════════════════════════════════════════════════════════════
  describe('4. CommunityPostCard Component', () => {
    const dummyPost = {
      id: VALID_POST_ID,
      author_id: VALID_AUTHOR_ID,
      content: 'Magnifique traversée du massif avec bivouac sous les étoiles.',
      author: {
        id: VALID_AUTHOR_ID,
        full_name: 'Camille Randonneuse',
        loyalty_level: 'guide',
      },
      likes_count: 24,
      comments_count: 6,
      created_at: new Date().toISOString(),
      user_liked: false,
      user_saved: false,
      transparency: dummyTransparency,
    };

    it('renders author, content, and interactive transparency badge', () => {
      const html = renderToStaticMarkup(
        React.createElement(CommunityPostCard, {
          post: dummyPost,
          user: { id: VALID_USER_ID },
        })
      );

      expect(html).toContain('Camille Randonneuse');
      expect(html).toContain('Magnifique traversée du massif');
      expect(html).toContain('Vérifié terrain');
      expect(html).toContain('Pourquoi ce contenu');
    });

    it('renders safely with camelCase properties from Feed V1 service', () => {
      const camelCasePost = {
        id: VALID_POST_ID,
        authorId: VALID_AUTHOR_ID,
        content: 'Données camelCase du moteur Feed V1',
        author: {
          id: VALID_AUTHOR_ID,
          fullName: 'Sylvain Explorateur',
        },
        likesCount: 12,
        commentsCount: 3,
        createdAt: new Date().toISOString(),
        userLiked: true,
        userSaved: true,
      };

      const html = renderToStaticMarkup(
        React.createElement(CommunityPostCard, {
          post: camelCasePost as any,
          user: { id: VALID_USER_ID },
        })
      );

      expect(html).toContain('Sylvain Explorateur');
      expect(html).toContain('Données camelCase du moteur Feed V1');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. MOBILE COMMUNITY HUB (4 Operational Tabs & Fluid Transitions)
  // ════════════════════════════════════════════════════════════════════════════
  describe('5. MobileCommunityHub & Navigation', () => {
    const samplePosts = [
      {
        id: VALID_POST_ID,
        content: 'Récit alpin 1',
        author: { full_name: 'Alpiniste 1' },
      },
    ];

    const sampleCarnets = [
      {
        id: VALID_CARNET_ID,
        title: 'Traversée du Vercors',
        destination: 'Vercors',
        days_count: 3,
      },
    ];

    const sampleClubs = [
      {
        id: 'club-1',
        name: 'Club Rando Alpes',
        members_count: 42,
        emoji: '🏔️',
      },
    ];

    it('renders the 4 operational tabs in the mobile navigation rail', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileCommunityHub, {
          posts: samplePosts as any,
          carnets: sampleCarnets,
          clubs: sampleClubs,
          activeTab: 'pour-toi',
        })
      );

      expect(html).toContain('Pour toi');
      expect(html).toContain('Abonnements');
      expect(html).toContain('Autour de moi');
      expect(html).toContain('Clubs');
    });

    it('renders durable carnets discovery shelf within stream', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileCommunityHub, {
          posts: samplePosts as any,
          carnets: sampleCarnets,
          clubs: sampleClubs,
          activeTab: 'pour-toi',
        })
      );

      expect(html).toContain('Carnets durables vérifiés');
      expect(html).toContain('Traversée du Vercors');
    });

    it('renders clubs discovery section within stream', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileCommunityHub, {
          posts: samplePosts as any,
          carnets: sampleCarnets,
          clubs: sampleClubs,
          activeTab: 'pour-toi',
        })
      );

      expect(html).toContain('Clubs &amp; Collectifs LKDV');
      expect(html).toContain('Club Rando Alpes');
    });

    it('displays geolocation status in "autour-de-moi" tab', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileCommunityHub, {
          posts: samplePosts as any,
          activeTab: 'autour-de-moi',
        })
      );

      expect(html).toContain('Position');
    });

    it('strictly isolates guest mode on "abonnements" tab and never leaks posts underneath', () => {
      const distinctPosts = [
        {
          id: 'leak-check-post-1',
          content: 'CONTENU_CONFIDENTIEL_NON_VISIBLE_POUR_INVITE',
          author: { full_name: 'Auteur Suivi' },
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(MobileCommunityHub, {
          posts: distinctPosts as any,
          user: null, // Guest visitor
          activeTab: 'abonnements',
        })
      );

      expect(html).toContain('Connectez-vous pour voir vos abonnements');
      expect(html).toContain('Se connecter');
      expect(html).not.toContain('CONTENU_CONFIDENTIEL_NON_VISIBLE_POUR_INVITE');
      expect(html).not.toContain('Auteur Suivi');
    });

    it('renders empty state on "abonnements" tab when user is logged in with no items', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileCommunityHub, {
          posts: [],
          user: { id: VALID_USER_ID },
          activeTab: 'abonnements',
        })
      );

      expect(html).not.toContain('Connectez-vous pour voir vos abonnements');
      expect(html).toContain('Aucune sortie récente de vos abonnements');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 6. COMMUNITY HUB NAV (4 Operational Tabs Support)
  // ════════════════════════════════════════════════════════════════════════════
  describe('6. CommunityHubNav Navigation Bar', () => {
    it('supports 4 operational tabs in feed mode', () => {
      const html = renderToStaticMarkup(
        React.createElement(CommunityHubNav, {
          activeTab: 'pour-toi',
          mode: 'feed',
        })
      );

      expect(html).toContain('Pour toi');
      expect(html).toContain('Abonnements');
      expect(html).toContain('Autour de moi');
      expect(html).toContain('Clubs &amp; Collectifs');
    });

    it('maintains backwards compatibility for hub categories', () => {
      const html = renderToStaticMarkup(
        React.createElement(CommunityHubNav, {
          activeTab: 'fil',
          mode: 'hub',
        })
      );

      expect(html).toContain('Fil d&#x27;actualité');
      expect(html).toContain('Carnets de voyage');
      expect(html).toContain('Groupes d&#x27;expédition');
    });
  });
});
