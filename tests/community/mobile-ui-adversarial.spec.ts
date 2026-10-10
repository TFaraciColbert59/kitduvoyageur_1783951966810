/**
 * Empirical Adversarial Test Suite for LKDV Community Milestone 3 (Requirement R4)
 * Stress-testing:
 * 1. Touch targets (Apple HIG 44px minimum)
 * 2. Tab transitions & legacy tab normalization
 * 3. Pull-to-refresh & geolocation rejection fallback
 * 4. Zero orange palette violations & CSS tokens
 * 5. Hostile inputs, extreme data, and defensive rendering in CommunityPostCard & API
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

// Mock framer-motion
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

// Mock Radix Dialog portal to render children inline for static markup
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

// Mock SearchContext
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

// Mock Haptics
const mockTriggerHaptic = vi.fn();
vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({
    haptic: mockTriggerHaptic,
    triggerHaptic: mockTriggerHaptic,
    vibrate: mockTriggerHaptic,
  }),
}));

// Mock Supabase server client
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

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const USER_UUID = '660e8400-e29b-41d4-a716-446655440000';

describe('Adversarial Stress Suite — Milestone 3 (Requirement R4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 1. TOUCH TARGETS & APPLE HIG ERGONOMICS (44x44px minimum)
  // ════════════════════════════════════════════════════════════════════════════
  describe('1. Touch Targets & Apple HIG Ergonomics', () => {
    it('verifies all interactive buttons in PostActionSheet meet >= 44px min height', () => {
      const html = renderToStaticMarkup(
        React.createElement(PostActionSheet, {
          open: true,
          onOpenChange: vi.fn(),
          isSaved: true,
          onToggleSave: vi.fn(),
          onWhyThis: vi.fn(),
          onLessLikeThis: vi.fn(),
          onHide: vi.fn(),
          onShare: vi.fn(),
          onReport: vi.fn(),
          hasTransparency: true,
        })
      );

      // Find all button tags in the rendered sheet
      const buttonMatches = html.match(/<button[^>]*>.*?<\/button>/g) || [];
      expect(buttonMatches.length).toBeGreaterThanOrEqual(7);

      for (const btn of buttonMatches) {
        // Each interactive button in PostActionSheet must specify min-h-[44px], min-h-[48px], or h-11 (44px in Tailwind)
        const hasMinHeight = /min-h-\[(44|48)px\]|h-11/.test(btn);
        expect(hasMinHeight).toBe(true);
      }
    });

    it('verifies TransparencySheet dismissal button meets 44px touch target', () => {
      const html = renderToStaticMarkup(
        React.createElement(TransparencySheet, {
          open: true,
          onOpenChange: vi.fn(),
          transparency: {
            primaryReason: 'quality_field_proof',
            explanation: 'Vérifié terrain avec traces',
            matchedSignals: {},
            scoreBreakdown: { total: 0.8, intent: 0.8, utility: 0.9, quality: 0.7, geo: 0.6, social: 0.5 },
          },
        })
      );

      expect(html).toContain('min-h-[44px]');
      expect(html).toContain('Fermer');
    });

    it('verifies Tabs component in MobileCommunityHub uses touch targets >= 44px', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileCommunityHub, {
          posts: [],
          activeTab: 'pour-toi',
        })
      );

      // Scrollable tabs use --lkv-touch-min (44px)
      expect(html).toContain('min-h-[var(--lkv-touch-min)]');
      expect(html).toContain('min-w-[var(--lkv-touch-min)]');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. TAB TRANSITIONS, PULL-TO-REFRESH & GEOLOCATION FALLBACK
  // ════════════════════════════════════════════════════════════════════════════
  describe('2. Tab Navigation & Edge State Fallbacks', () => {
    it('normalizes legacy "fil" tab to "pour-toi"', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileCommunityHub, {
          posts: [],
          activeTab: 'fil' as any,
        })
      );

      // Must display Pour toi header and Feed V1 indicator
      expect(html).toContain('Pour toi');
      expect(html).toContain('Recommandations terrain');
      expect(html).toContain('Feed V1 scoré');
    });

    it('renders unauthenticated state in "abonnements" tab gracefully with connection CTA', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileCommunityHub, {
          posts: [],
          user: null, // Unauthenticated visitor
          activeTab: 'abonnements',
        })
      );

      expect(html).toContain('Connectez-vous pour voir vos abonnements');
      expect(html).toContain('Se connecter');
      expect(html).toContain('/connexion');
    });

    it('renders geolocation fallback banner when position is unshared in "autour-de-moi"', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileCommunityHub, {
          posts: [],
          activeTab: 'autour-de-moi',
        })
      );

      expect(html).toContain('Position non partagée (Massif par défaut)');
      expect(html).toContain('Activer le GPS');
      // Shows empty state rather than error crash
      expect(html).toContain('Aucune sortie dans ce secteur');
    });

    it('renders clubs feed stream and collective directory seamlessly', () => {
      const sampleClubs = [
        { id: 'club-test-1', name: 'Alpinistes du Vercors', members_count: 55, emoji: '🧗' },
      ];

      const html = renderToStaticMarkup(
        React.createElement(MobileCommunityHub, {
          posts: [],
          clubs: sampleClubs,
          activeTab: 'clubs',
        })
      );

      expect(html).toContain('Activités de vos clubs');
      expect(html).toContain('Alpinistes du Vercors');
      expect(html).toContain('55 m.');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. ZERO ORANGE COLOR & DESIGN TOKEN INTEGRITY
  // ════════════════════════════════════════════════════════════════════════════
  describe('3. Strict Zero Orange Palette Compliance', () => {
    it('ensures TransparencySheet contains no orange tokens or hex #E4501C', () => {
      const dummyTransparency: RecommendationTransparency = {
        primaryReason: 'quality_field_proof',
        badgeLabel: 'Terrain Écrins',
        explanation: 'Sortie vérifiée',
        matchedSignals: {},
        scoreBreakdown: { total: 0.9, intent: 0.9, utility: 0.9, quality: 0.9, geo: 0.9, social: 0.9 },
      };

      const html = renderToStaticMarkup(
        React.createElement(TransparencySheet, {
          open: true,
          onOpenChange: vi.fn(),
          transparency: dummyTransparency,
        })
      );

      expect(html).not.toMatch(/#e4501c/i);
      expect(html).not.toMatch(/\borange\b/i);
      expect(html).not.toMatch(/bg-orange/i);
      expect(html).not.toMatch(/text-orange/i);
    });

    it('ensures PostActionSheet uses red tokens for destructive actions and zero orange', () => {
      const html = renderToStaticMarkup(
        React.createElement(PostActionSheet, {
          open: true,
          onOpenChange: vi.fn(),
          onToggleSave: vi.fn(),
          onLessLikeThis: vi.fn(),
          onHide: vi.fn(),
          onReport: vi.fn(),
        })
      );

      expect(html).not.toMatch(/#e4501c/i);
      expect(html).not.toMatch(/\borange\b/i);
      // Destructive button uses --lkv-danger tokens
      expect(html).toContain('var(--lkv-danger)');
    });

    it('ensures CommunityHubNav contains zero orange tokens', () => {
      const html = renderToStaticMarkup(
        React.createElement(CommunityHubNav, {
          activeTab: 'pour-toi',
          mode: 'feed',
        })
      );

      expect(html).not.toMatch(/#e4501c/i);
      expect(html).not.toMatch(/\borange\b/i);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. ADVERSARIAL MUTATION API TESTING (/api/community/interactions)
  // ════════════════════════════════════════════════════════════════════════════
  describe('4. Adversarial API Attacks & Malformed Payloads', () => {
    it('rejects SQL injection and malformed UUID payloads in POST', async () => {
      const maliciousPayloads = [
        "'; DROP TABLE post_saves; --",
        '12345',
        '../../../etc/passwd',
        '<script>alert("xss")</script>',
        '550e8400-e29b-41d4-a716-44665544000g', // invalid hex
      ];

      for (const badId of maliciousPayloads) {
        mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_UUID } }, error: null });

        const req = new Request('http://localhost:3000/api/community/interactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save', postId: badId }),
        });

        const res = await interactionsPost(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toMatch(/UUID valide requis/i);
      }
    });

    it('rejects invalid action types', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_UUID } }, error: null });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: '__proto__' }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(400);
    });

    it('rejects invalid JSON body in POST', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_UUID } }, error: null });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'NOT_A_JSON{{{',
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/JSON invalide/i);
    });

    it('GET: rejects invalid UUID parameter and handles null safely', async () => {
      const req = new Request('http://localhost:3000/api/community/interactions?postId=invalid-id');
      const res = await interactionsGet(req);
      expect(res.status).toBe(400);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. DEFENSIVE COMPONENT RENDERING UNDER EXTREME DATA
  // ════════════════════════════════════════════════════════════════════════════
  describe('5. Defensive Edge Data in CommunityPostCard', () => {
    it('handles null author and undefined properties without throwing', () => {
      const hostilePost: any = {
        id: VALID_UUID,
        content: 'Post sans auteur avec données minimales',
        author: null,
        likes_count: 0,
        comments_count: 0,
        created_at: undefined,
      };

      const html = renderToStaticMarkup(
        React.createElement(CommunityPostCard, {
          post: hostilePost,
          user: null,
        })
      );

      expect(html).toContain('Voyageur LKDV');
      expect(html).toContain('Post sans auteur avec données minimales');
    });

    it('handles extremely long content by truncating to CONTENT_LIMIT (200 chars)', () => {
      const longText = 'A'.repeat(500);
      const postWithLongContent: any = {
        id: VALID_UUID,
        content: longText,
        author: { full_name: 'Test Author' },
        created_at: new Date().toISOString(),
      };

      const html = renderToStaticMarkup(
        React.createElement(CommunityPostCard, {
          post: postWithLongContent,
          user: null,
        })
      );

      expect(html).toContain('Afficher plus');
      expect(html).toContain('…');
    });

    it('escapes potential XSS in content safely', () => {
      const xssContent = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
      const postWithXss: any = {
        id: VALID_UUID,
        content: xssContent,
        author: { full_name: 'XSS Tester' },
      };

      const html = renderToStaticMarkup(
        React.createElement(CommunityPostCard, {
          post: postWithXss,
          user: null,
        })
      );

      // React escapes raw HTML to &lt;script&gt;
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });
});
