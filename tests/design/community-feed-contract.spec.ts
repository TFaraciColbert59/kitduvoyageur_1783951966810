import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
/** Vrai si un fichier source de la Communauté mentionne encore ce nom (import ou usage). */
const page = (name: string) =>
  ['src/app/communaute/page.tsx', 'src/features/community/card/explore/ExplorerDrawer.tsx', 'src/features/community/card/create/CreateDrawer.tsx'].some((file) => read(file).includes(name));

describe('Communauté v3 — contrat du fil, des tiroirs et des panneaux', () => {
  it('la page assemble les tiroirs 50 %, la recherche et le feed avec la navigation unifiée', () => {
    const page = read('src/app/communaute/page.tsx');
    expect(page).toContain('CommunityFeedTopBar');
    expect(page).toContain('CommunityStoriesBar');
    expect(page).not.toContain('<AccountBottomBar');
    expect(read('src/components/mobile-nav/MobileNavWrapper.tsx')).toContain('<NavigationBar />');
    expect(page).toContain('<CreateDrawer');
    expect(page).toContain('ExplorerDrawer');
    expect(page).toContain('onSearch');
    expect(page).not.toContain('AccountCreateSheet');
    expect(page).not.toContain('CommunityHeroCard');
    expect(page).not.toContain('CommunityGrid');
  });

  it('la pilule « Explorer » ouvre la recherche et la cloche va au Compte', () => {
    const top = read('src/features/community/feed/CommunityFeedTopBar.tsx');
    expect(top).toContain('<span>Explorer</span>');
    expect(top).toContain('aria-label="Explorer et rechercher"');
    expect(top).toContain('/compte?tab=notifications');
    expect(top).not.toContain('AccountAuthorPill');
    expect(top).toContain('Rechercher dans la communauté');
  });

  it('les drawers sont des cartes en place (plus de demi-tiroir modal)', () => {
    const css = read('src/styles/community-card.css');
    expect(css).toMatch(/\.lkdv-cd\s*\{[\s\S]*border-radius:\s*24px/);
    const explorer = read('src/features/community/card/explore/ExplorerDrawer.tsx');
    expect(explorer).toContain('<DrawerShell');
    expect(explorer).toContain('<CommunityCardDrawer');
    for (const old of ['CommunityDrawer', 'CommunityTabSelector', 'CommunitySectionsDrawer']) {
      expect(page(old), old).toBe(false);
    }
  });

  it('les cartes ont un ratio réservé, le texte reste auto', () => {
    const css = read('src/styles/community-feed.css');
    expect(css).toContain('.lkdv-feed-post--text');
    expect(css).toMatch(/\.lkdv-feed-post[\s\S]*aspect-ratio: 406 \/ 541/);
    expect(css).toMatch(/\.lkdv-feed-post--text[\s\S]*aspect-ratio: auto/);
    expect(css).toContain('height: auto');
    const post = read('src/features/community/feed/CommunityFeedPost.tsx');
    expect(post).toContain('PostAuthorPill');
    expect(post).toContain('PostCommentsPanel');
    expect(post).toContain('PostSharePanel');
  });

  it('le post auteur riche affiche le badge et la méta lieu/spot/temps', () => {
    const pill = read('src/features/community/feed/PostAuthorPill.tsx');
    expect(pill).toContain('trust_score');
    expect(pill).toContain('location');
    expect(pill).toContain('timeAgo');
    expect(pill).toContain('lkdv-post-author-badge');
  });

  it('les stories mettent la nôtre en premier et utilisent le ring du Compte', () => {
    const stories = read('src/components/communaute/CommunityStoriesBar.tsx');
    expect(stories).toContain('myStoryIndex < 0');
    expect(stories.indexOf('myStoryIndex < 0')).toBeLessThan(stories.indexOf('storyUsers.map'));
    expect(stories).toContain('lkdv-story-ring');
    expect(stories).not.toContain('conic-gradient');
  });

  it('le drawer de création ouvre 6 formulaires en place dans la carte, sans navigation', () => {
    const sheet = read('src/features/community/card/create/CreateDrawer.tsx');
    for (const kind of ['post', 'carnet', 'sortie', 'kit', 'club', 'story']) {
      expect(sheet).toContain(`'${kind}'`);
    }
    expect(sheet).toContain('<DrawerShell');
    expect(sheet).toContain('<CommunityCardDrawer');
    expect(sheet).not.toContain('/communaute/publier');
    for (const form of ['PostCreateForm', 'StoryCreateForm', 'SortieCreateForm', 'KitCreateForm', 'ClubCreateForm']) {
      expect(sheet).toContain(`<${form} {...common}`);
    }
    // Le carnet se crée par la carte (CarnetMapDrawer), jamais par un second formulaire à étapes.
    expect(sheet).not.toContain('CarnetCreateForm');
  });

  it('les anciens composants du hub et les feuilles remplacées ont disparu', () => {
    for (const path of [
      'src/components/communaute/CommunityGrid.tsx',
      'src/components/communaute/CommunityContentDrawer.tsx',
      'src/components/communaute/MobileCommunityHub.tsx',
      'src/components/communaute/MobileCommunityHeader.tsx',
      'src/components/communaute/shell/CommunityHeroCard.tsx',
      'src/components/communaute/shell/CommunityContextDrawer.tsx',
      'src/features/community/useCommunityTotals.ts',
    ]) {
      expect(existsSync(path), path).toBe(false);
    }
  });
});
