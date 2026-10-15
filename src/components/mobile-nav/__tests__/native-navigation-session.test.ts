import { describe, it, expect } from 'vitest';
import { updateNativeBarHideSources } from '../nativeModalVisibility';
import { readFileSync } from 'node:fs';
const nav = readFileSync('src/components/mobile-nav/NavigationBar.tsx','utf8');
const wrapper = readFileSync('src/components/mobile-nav/MobileNavWrapper.tsx','utf8');
const shell = readFileSync('src/components/shell/AppShell.tsx','utf8');
const web = readFileSync('src/components/mobile-nav/navigation/WebNavigationBar.tsx','utf8');

describe('native bottom rail survives login / logout / app lifecycle', () => {
  it('uses a session-independent revision, avoiding Swift stale-request rejection', () => {
    expect(nav).toContain('nativeRevisionClock = Math.max(nativeRevisionClock + 1, Date.now())');
    expect(nav).not.toContain('const revision = ++revisionRef.current');
    expect(nav).toContain('visibilitychange');
    expect(nav).toContain('pageshow');
    expect(nav).toContain("data-lkdv-ios-web-fallback");
  });
  it('explicitly hides UIKit on full-screen routes without rendering Web tab bar', () => {
    expect(wrapper).toContain('<NavigationBar />');
    expect(nav).toContain('isNoBottomNavigationRoute(pathname)');
  });
  it('avoids a second Community rail at the bottom, including fallback web', () => {
    expect(nav).toContain('!hasCommunityInPageTabs(pathname)');
    expect(web).toContain('!hasCommunityInPageTabs(pathname)');
    expect(shell).toContain('!hasCommunityInPageTabs(pathname)');
  });
  it('retains the Compas exclusion in the nav registry', () => {
    const policy=readFileSync('src/components/mobile-nav/nativeAccountRoutes.ts','utf8');
    expect(policy).toContain("pathname === '/compas'");
  });
});

describe('independent modal sources control native tab bar', () => {
  it('does not re-show UIKit when one of two dialogs closes', () => {
    let state = new Set<string>();
    state = updateNativeBarHideSources(state, 'story-composer', true);
    state = updateNativeBarHideSources(state, 'modal-observer', true);
    state = updateNativeBarHideSources(state, 'story-composer', false);
    expect(state.has('modal-observer')).toBe(true);
    expect(state.size).toBe(1);
    state = updateNativeBarHideSources(state, 'modal-observer', false);
    expect(state.size).toBe(0);
  });

  it('avoids attaching modal observer on Compas', () => {
    expect(wrapper).toContain('if (isProtectedCompasRoute(pathname)) return');
    expect(wrapper).toContain("'modal-observer'");
    expect(nav).toContain('updateNativeBarHideSources');
  });
});
