/**
 * Remediation Unit & Integration Tests for Milestone 3 (Requirement R4)
 * Validating Reviewer 2 Findings Resolution:
 * 1. CommunityPostCard optimistic rollback, error haptics, and response validation
 *    for handleHidePost and handleLessLikeThis.
 * 2. MobileCommunityHub guest mode strict isolation in 'abonnements' tab.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CommunityPostCard from '@/components/communaute/CommunityPostCard';
import MobileCommunityHub from '@/components/communaute/MobileCommunityHub';

// Capture props passed to PostActionSheet to test callbacks
let capturedActionSheetProps: any = null;
vi.mock('@/components/communaute/PostActionSheet', () => ({
  default: (props: any) => {
    capturedActionSheetProps = props;
    return React.createElement('div', { 'data-testid': 'mock-post-action-sheet' });
  },
}));

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

// Mock Radix Dialog
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

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
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

const POST_ID = 'aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaaa';
const USER_ID = 'bbbbbbbb-bbbb-4000-8000-bbbbbbbbbbbb';

const dummyPost = {
  id: POST_ID,
  author_id: USER_ID,
  content: 'Expédition test dans le Queyras',
  author: {
    id: USER_ID,
    full_name: 'Guillaume Rando',
    loyalty_level: 'explorateur',
  },
  likes_count: 10,
  comments_count: 2,
  created_at: new Date().toISOString(),
  user_liked: false,
  user_saved: false,
};

describe('Remediation — Reviewer 2 Findings Verification', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedActionSheetProps = null;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 1. COMMUNITY POST CARD: handleHidePost REMEDIATION
  // ════════════════════════════════════════════════════════════════════════════
  describe('1. CommunityPostCard: handleHidePost Error Handling & Rollback', () => {
    it('rolls back optimistic hide, triggers error haptic, and does NOT call onHide when API returns 401', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Authentification requise' }),
      });

      const onHide = vi.fn();
      const onFeedback = vi.fn();

      renderToStaticMarkup(
        React.createElement(CommunityPostCard, {
          post: dummyPost,
          user: null, // Guest
          onHide,
          onFeedback,
        })
      );

      expect(capturedActionSheetProps).toBeDefined();
      await capturedActionSheetProps.onHide();

      // Check API request was sent with hide action
      expect(global.fetch).toHaveBeenCalledWith('/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          targetType: 'post',
          targetId: POST_ID,
          feedbackType: 'hide',
        }),
      });

      // Error haptic triggered
      expect(mockTriggerHaptic).toHaveBeenCalledWith('error');

      // Parent onHide MUST NOT be called so card is not removed from feed
      expect(onHide).not.toHaveBeenCalled();
      expect(onFeedback).not.toHaveBeenCalled();
    });

    it('rolls back optimistic hide and triggers error haptic when API returns 500', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      const onHide = vi.fn();
      const onFeedback = vi.fn();

      renderToStaticMarkup(
        React.createElement(CommunityPostCard, {
          post: dummyPost,
          user: { id: USER_ID },
          onHide,
          onFeedback,
        })
      );

      await capturedActionSheetProps.onHide();

      expect(mockTriggerHaptic).toHaveBeenCalledWith('error');
      expect(onHide).not.toHaveBeenCalled();
      expect(onFeedback).not.toHaveBeenCalled();
    });

    it('rolls back optimistic hide and triggers error haptic on network exception', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network offline'));

      const onHide = vi.fn();
      const onFeedback = vi.fn();

      renderToStaticMarkup(
        React.createElement(CommunityPostCard, {
          post: dummyPost,
          user: { id: USER_ID },
          onHide,
          onFeedback,
        })
      );

      await capturedActionSheetProps.onHide();

      expect(mockTriggerHaptic).toHaveBeenCalledWith('error');
      expect(onHide).not.toHaveBeenCalled();
      expect(onFeedback).not.toHaveBeenCalled();
    });

    it('successfully calls onHide and onFeedback on 200 OK response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const onHide = vi.fn();
      const onFeedback = vi.fn();

      renderToStaticMarkup(
        React.createElement(CommunityPostCard, {
          post: dummyPost,
          user: { id: USER_ID },
          onHide,
          onFeedback,
        })
      );

      await capturedActionSheetProps.onHide();

      expect(onHide).toHaveBeenCalledWith(POST_ID);
      expect(onFeedback).toHaveBeenCalledWith(POST_ID, 'hide');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. COMMUNITY POST CARD: handleLessLikeThis REMEDIATION
  // ════════════════════════════════════════════════════════════════════════════
  describe('2. CommunityPostCard: handleLessLikeThis Error Handling & Rollback', () => {
    it('rolls back preference, triggers error haptic, and does NOT call onFeedback on 401', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Authentification requise' }),
      });

      const onFeedback = vi.fn();

      renderToStaticMarkup(
        React.createElement(CommunityPostCard, {
          post: dummyPost,
          user: null,
          onFeedback,
        })
      );

      await capturedActionSheetProps.onLessLikeThis();

      expect(global.fetch).toHaveBeenCalledWith('/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          targetType: 'post',
          targetId: POST_ID,
          feedbackType: 'less_like_this',
        }),
      });

      expect(mockTriggerHaptic).toHaveBeenCalledWith('error');
      expect(onFeedback).not.toHaveBeenCalled();
    });

    it('rolls back preference and triggers error haptic on 500', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Database write failed' }),
      });

      const onFeedback = vi.fn();

      renderToStaticMarkup(
        React.createElement(CommunityPostCard, {
          post: dummyPost,
          user: { id: USER_ID },
          onFeedback,
        })
      );

      await capturedActionSheetProps.onLessLikeThis();

      expect(mockTriggerHaptic).toHaveBeenCalledWith('error');
      expect(onFeedback).not.toHaveBeenCalled();
    });

    it('rolls back preference and triggers error haptic on network failure', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection timed out'));

      const onFeedback = vi.fn();

      renderToStaticMarkup(
        React.createElement(CommunityPostCard, {
          post: dummyPost,
          user: { id: USER_ID },
          onFeedback,
        })
      );

      await capturedActionSheetProps.onLessLikeThis();

      expect(mockTriggerHaptic).toHaveBeenCalledWith('error');
      expect(onFeedback).not.toHaveBeenCalled();
    });

    it('confirms feedback and calls onFeedback on 200 OK', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, feedbackType: 'less_like_this' }),
      });

      const onFeedback = vi.fn();

      renderToStaticMarkup(
        React.createElement(CommunityPostCard, {
          post: dummyPost,
          user: { id: USER_ID },
          onFeedback,
        })
      );

      await capturedActionSheetProps.onLessLikeThis();

      expect(onFeedback).toHaveBeenCalledWith(POST_ID, 'less_like_this');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. COMMUNITY POST CARD: handleToggleSave REMEDIATION
  // ════════════════════════════════════════════════════════════════════════════
  describe('3. CommunityPostCard: handleToggleSave Error Handling', () => {
    it('triggers error haptic and rolls back isSaved on 401', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Non authentifié' }),
      });

      const onSaveToggle = vi.fn();

      renderToStaticMarkup(
        React.createElement(CommunityPostCard, {
          post: dummyPost,
          user: null,
          onSaveToggle,
        })
      );

      await capturedActionSheetProps.onToggleSave();

      expect(mockTriggerHaptic).toHaveBeenCalledWith('error');
      expect(onSaveToggle).not.toHaveBeenCalled();
    });

    it('triggers error haptic and rolls back on network error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network failure'));

      const onSaveToggle = vi.fn();

      renderToStaticMarkup(
        React.createElement(CommunityPostCard, {
          post: dummyPost,
          user: { id: USER_ID },
          onSaveToggle,
        })
      );

      await capturedActionSheetProps.onToggleSave();

      expect(mockTriggerHaptic).toHaveBeenCalledWith('error');
      expect(onSaveToggle).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. MOBILE COMMUNITY HUB: GUEST MODE LEAK IN ABONNEMENTS TAB
  // ════════════════════════════════════════════════════════════════════════════
  describe('4. MobileCommunityHub: Clean Guest Mode in Abonnements Tab', () => {
    it('renders ONLY the connection prompt card and zero feed posts when user is guest', () => {
      const postsWithDistinctContent = [
        {
          id: 'post-abonnements-1',
          content: 'SECRET_UNAUTHENTICATED_LEAK_PREVENTION_TEST_TEXT',
          author: { full_name: 'Compagnon Suivi' },
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(MobileCommunityHub, {
          posts: postsWithDistinctContent as any,
          user: null, // Guest
          activeTab: 'abonnements',
        })
      );

      // Connection prompt must be rendered
      expect(html).toContain('Connectez-vous pour voir vos abonnements');
      expect(html).toContain('Se connecter');

      // Zero post content leak
      expect(html).not.toContain('SECRET_UNAUTHENTICATED_LEAK_PREVENTION_TEST_TEXT');
      expect(html).not.toContain('Compagnon Suivi');
      expect(html).not.toContain('mock-post-action-sheet');
    });

    it('renders empty state when user is logged in and no subscription posts exist', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileCommunityHub, {
          posts: [],
          user: { id: USER_ID },
          activeTab: 'abonnements',
        })
      );

      expect(html).not.toContain('Connectez-vous pour voir vos abonnements');
      expect(html).toContain('Aucune sortie récente de vos abonnements');
    });
  });
});
