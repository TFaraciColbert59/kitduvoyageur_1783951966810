// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isNetworkPermittingBackgroundPreload,
  isFastNetworkConnection,
  getPreloadedReelComments,
  setPreloadedReelComments,
  hasPreloadedReelComments,
  getPreloadedPublicProfile,
  setPreloadedPublicProfile,
  clearPreloadProfileCache,
  preloadReelComments,
  preloadPublicProfile,
  runWhenIdle,
} from '../reelsPreloadService';
import type { FreedomComment } from '../freedom-types';

describe('reelsPreloadService — Network awareness & In-memory Caching', () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    clearPreloadProfileCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe('1. Network Detection', () => {
    it('returns false when offline', () => {
      Object.defineProperty(global, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });
      expect(isNetworkPermittingBackgroundPreload()).toBe(false);
    });

    it('returns false when saveData is enabled', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          connection: { saveData: true, effectiveType: '4g' },
        },
        writable: true,
        configurable: true,
      });
      expect(isNetworkPermittingBackgroundPreload()).toBe(false);
    });

    it('returns false on slow 2G and 2G networks', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          connection: { saveData: false, effectiveType: '2g' },
        },
        writable: true,
        configurable: true,
      });
      expect(isNetworkPermittingBackgroundPreload()).toBe(false);

      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          connection: { saveData: false, effectiveType: 'slow-2g' },
        },
        writable: true,
        configurable: true,
      });
      expect(isNetworkPermittingBackgroundPreload()).toBe(false);
    });

    it('returns true on 3G, 4G, and Wi-Fi networks without saveData', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          connection: { saveData: false, effectiveType: '4g' },
        },
        writable: true,
        configurable: true,
      });
      expect(isNetworkPermittingBackgroundPreload()).toBe(true);
      expect(isFastNetworkConnection()).toBe(true);
    });

    it('differentiates fast (4g/5g) vs regular network (3g)', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          connection: { saveData: false, effectiveType: '3g' },
        },
        writable: true,
        configurable: true,
      });
      expect(isNetworkPermittingBackgroundPreload()).toBe(true);
      expect(isFastNetworkConnection()).toBe(false);
    });
  });

  describe('2. Comments Preload Cache', () => {
    const dummyComment: FreedomComment = {
      id: 'c-1',
      reelId: 'reel-test',
      author: {
        id: 'user-1',
        name: 'Alexandre',
        avatarUrl: '/avatars/alex.jpg',
      },
      content: 'Superbe vidéo !',
      createdAt: new Date().toISOString(),
      likesCount: 12,
      isLiked: false,
      isOwner: false,
    };

    it('stores and retrieves comments immediately', () => {
      expect(hasPreloadedReelComments('reel-test')).toBe(false);
      expect(getPreloadedReelComments('reel-test')).toBeNull();

      setPreloadedReelComments('reel-test', [dummyComment]);

      expect(hasPreloadedReelComments('reel-test')).toBe(true);
      const comments = getPreloadedReelComments('reel-test');
      expect(comments).toHaveLength(1);
      expect(comments![0].content).toBe('Superbe vidéo !');
    });

    it('bypasses background preload when network does not permit', async () => {
      Object.defineProperty(global, 'navigator', {
        value: { onLine: true, connection: { saveData: true } },
        writable: true,
        configurable: true,
      });

      const res = await preloadReelComments('reel-no-network');
      expect(res).toBeNull();
      expect(hasPreloadedReelComments('reel-no-network')).toBe(false);
    });
  });

  describe('3. Public Profile Preload Cache', () => {
    const dummyBundle = {
      targetId: 'uuid-1234',
      cleanKey: 'thomas.mercier',
      profile: {
        id: 'uuid-1234',
        handle: 'thomas.mercier',
        first_name: 'Thomas',
        last_name: 'Mercier',
        bio: 'Alpiniste passionné',
        avatar_url: '/avatars/thomas.jpg',
        stats: { publications: 10, abonnes: 150, abonnements: 80 },
      } as any,
      carnets: [],
      clubs: [],
      badges: [],
      activite: [],
      timestamp: Date.now(),
    };

    it('normalizes handles and retrieves profile seamlessly', () => {
      setPreloadedPublicProfile('thomas.mercier', dummyBundle);

      // Matches @ handle
      expect(getPreloadedPublicProfile('@thomas.mercier')?.profile.first_name).toBe('Thomas');
      // Matches UUID
      expect(getPreloadedPublicProfile('uuid-1234')?.profile.first_name).toBe('Thomas');
      // Matches case insensitive
      expect(getPreloadedPublicProfile('THOMAS.MERCIER')?.profile.first_name).toBe('Thomas');
      // Matches underscore / dot conversion
      expect(getPreloadedPublicProfile('thomas_mercier')?.profile.first_name).toBe('Thomas');
    });

    it('returns null on cache miss', () => {
      expect(getPreloadedPublicProfile('unknown_user')).toBeNull();
    });

    it('clears all cached profiles on clearPreloadProfileCache', () => {
      setPreloadedPublicProfile('thomas.mercier', dummyBundle);
      expect(getPreloadedPublicProfile('thomas.mercier')).not.toBeNull();

      clearPreloadProfileCache();
      expect(getPreloadedPublicProfile('thomas.mercier')).toBeNull();
    });
  });

  describe('4. Idle Scheduler', () => {
    it('executes callback without throwing', async () => {
      let executed = false;
      const cancel = runWhenIdle(() => {
        executed = true;
      }, 50);

      expect(typeof cancel).toBe('function');
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(executed).toBe(true);
    });
  });
});
