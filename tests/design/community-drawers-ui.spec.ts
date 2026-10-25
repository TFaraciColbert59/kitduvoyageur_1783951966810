import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('drawers Communauté — grammaire du drawer Profil', () => {
  it('reprend la feuille Profil : 8 px, 46 px, 44 px, verre Compte', () => {
    const css = read('src/styles/community-feed.css');
    const drawer = css.slice(css.indexOf('.lkdv-half-drawer {'), css.indexOf('@keyframes lkdv-profile-sheet-in'));
    expect(drawer).toContain('left: 12px');
    expect(drawer).toContain('right: 12px');
    expect(drawer).toContain('top: auto');
    expect(drawer).toContain('height: 50dvh');
    expect(drawer).toContain('bottom: 0');
    expect(drawer).toContain('border-radius: 24px 24px 0 0');
    expect(drawer).toContain('blur(30px) saturate(1.7) brightness(1.04)');
    const form = css.slice(css.indexOf('.lkdv-form-drawer {'), css.indexOf('.lkdv-form-grab'));
    expect(form).toContain('top: auto');
    expect(form).toContain('height: 50dvh');
    expect(form).toContain('bottom: calc(86px');
    expect(form).toContain('border-radius: 24px 24px 0 0');
  });

  it('place la recherche en première section, avec tous les types', () => {
    const source = read('src/features/community/sections/CommunitySectionsDrawer.tsx');
    const tabs = read('src/features/community/sections/CommunityTabSelector.tsx');
    expect(tabs).toContain("id: 'recherche'");
    expect(source).toContain("kind: 'member'");
    expect(source).toContain('public_profiles');
    expect(source).toContain('SEARCH_SCOPES');
    expect(source).toContain('lkdv-result-kind');
  });
});
