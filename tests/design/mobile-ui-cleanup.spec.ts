import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path,'utf8');
const shell = read('src/components/shell/AppShell.tsx');
const header = read('src/components/communaute/MobileCommunityHeader.tsx');
const hub = read('src/components/communaute/MobileCommunityHub.tsx');
const page = read('src/app/communaute/page.tsx');
const explorer = read('src/components/explorer/ExplorerClient.tsx');
const css = read('src/styles/mobile-ui-cleanup.css');
const policy = read('src/components/mobile-nav/nativeAccountRoutes.ts');

describe('global mobile UI cleanup excluding protected Compas', () => {
  it('keeps the Compas background and hides scenic image by default elsewhere', () => {
    expect(shell).toContain('videoBackground ?? protectedCompas');
    expect(shell).toContain("!protectedCompas && !renderVideoBackground");
    expect(policy).toContain("pathname === '/compas'");
  });
  it('puts Community controls in the document flow instead of a fixed overlay', () => {
    expect(header).toContain('lkdv-clean-community-header');
    expect(header).not.toContain('<FloatingPageControls');
    expect(css).toContain('position: sticky');
    expect(page).toContain('lkdv-clean-community-page');
  });
  it('keeps stories ahead of inline tabs and feed', () => {
    const stories = hub.indexOf('lkdv-clean-stories');
    const tabs = hub.indexOf('lkdv-clean-category-tabs');
    const feed = hub.indexOf('ACTIVE TAB CONTENT STREAM');
    expect(stories).toBeGreaterThan(0);
    expect(stories).toBeLessThan(tabs);
    expect(tabs).toBeLessThan(feed);
  });
  it('moves non-blocking map warnings below the control dock', () => {
    expect(explorer).toContain('lkdv-clean-map-banner');
    expect(explorer).toContain('lkdv-clean-map-search');
    expect(explorer).toContain('top-[calc(var(--safe-top)+152px)]');
  });
  it('avoids overriding the native rail or global page outside scope', () => {
    expect(css).not.toMatch(/^\s*(?:html|body)\s*\{/m);
    expect(css).not.toContain('src/app/compas');
  });
});
