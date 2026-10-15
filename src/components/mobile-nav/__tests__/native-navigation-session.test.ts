import { describe, it, expect } from 'vitest';
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
