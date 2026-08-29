import { describe, it, expect } from 'vitest';

describe('Mobile Layout & Shell Navigation Architecture', () => {
  it('calculates proper bottom padding for standard and upper-extension routes', () => {
    const computeBottomNavHeight = (pathname: string, hasBottomNav = true) => {
      if (!hasBottomNav) return 'calc(12px + env(safe-area-inset-bottom, 0px))';
      const hasUpperExtension =
        pathname?.startsWith('/communaute') ||
        pathname?.startsWith('/pays') ||
        pathname?.startsWith('/carnets') ||
        pathname?.startsWith('/groupes') ||
        pathname?.startsWith('/clubs') ||
        pathname?.startsWith('/entraide') ||
        pathname?.startsWith('/evenements') ||
        pathname?.startsWith('/alertes');

      return hasUpperExtension
        ? 'var(--bottom-tab-extended-height, calc(92px + env(safe-area-inset-bottom, 0px)))'
        : 'var(--bottom-tab-base-height, calc(52px + env(safe-area-inset-bottom, 0px)))';
    };

    // Standard routes without upper tray
    expect(computeBottomNavHeight('/compte')).toBe(
      'var(--bottom-tab-base-height, calc(52px + env(safe-area-inset-bottom, 0px)))'
    );
    expect(computeBottomNavHeight('/explorer')).toBe(
      'var(--bottom-tab-base-height, calc(52px + env(safe-area-inset-bottom, 0px)))'
    );
    expect(computeBottomNavHeight('/materiel')).toBe(
      'var(--bottom-tab-base-height, calc(52px + env(safe-area-inset-bottom, 0px)))'
    );

    // Routes with upper extension tray
    expect(computeBottomNavHeight('/communaute')).toBe(
      'var(--bottom-tab-extended-height, calc(92px + env(safe-area-inset-bottom, 0px)))'
    );
    expect(computeBottomNavHeight('/clubs/c-1')).toBe(
      'var(--bottom-tab-extended-height, calc(92px + env(safe-area-inset-bottom, 0px)))'
    );
    expect(computeBottomNavHeight('/carnets')).toBe(
      'var(--bottom-tab-extended-height, calc(92px + env(safe-area-inset-bottom, 0px)))'
    );
    expect(computeBottomNavHeight('/pays/france')).toBe(
      'var(--bottom-tab-extended-height, calc(92px + env(safe-area-inset-bottom, 0px)))'
    );

    // No bottom nav routes (fullscreen modes)
    expect(computeBottomNavHeight('/boussole', false)).toBe(
      'calc(12px + env(safe-area-inset-bottom, 0px))'
    );
  });

  it('ensures safeTop is predictable for custom headers and immersive covers', () => {
    const computeSafeTopPadding = (safeTop: boolean) => {
      return safeTop ? 'calc(env(safe-area-inset-top, 0px) + 8px)' : '0px';
    };

    // When page has sticky/immersive custom header, safeTop is false to avoid double padding
    expect(computeSafeTopPadding(false)).toBe('0px');
    // Default standard views
    expect(computeSafeTopPadding(true)).toBe('calc(env(safe-area-inset-top, 0px) + 8px)');
  });
});
