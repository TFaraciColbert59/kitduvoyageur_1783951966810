import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Communauté v3 — contrat du fil, des tiroirs et des panneaux', () => {
  it('la page assemble les tiroirs 50 %, la recherche, le feed et la barre Compte', () => {
    const page = read('src/app/communaute/page.tsx');
    expect(page).toContain('CommunityFeedTopBar');
    expect(page).toContain('CommunityStoriesBar');
    expect(page).toContain('AccountBottomBar');
    expect(page).toContain('CommunityCreateDrawer');
    expect(page).toContain('CommunitySectionsDrawer');
    expect(page).toContain('onSearch');
    expect(page).not.toContain('AccountCreateSheet');
    expect(page).not.toContain('CommunityHeroCard');
    expect(page).not.toContain('CommunityGrid');
  });

  it('la pillule est texte « Pour toi » + chevron et la cloche va au Compte', () => {
    const top = read('src/features/community/feed/CommunityFeedTopBar.tsx');
    expect(top).toContain('Pour toi');
    expect(top).toContain('/compte?tab=notifications');
    expect(top).not.toContain('AccountAuthorPill');
    expect(top).toContain('Rechercher dans la communauté');
  });

  it('le demi-tiroir est plafonné à 50dvh et le sélecteur fait 48 px', () => {
    const css = read('src/styles/community-feed.css');
    expect(css).toMatch(/\.lkdv-half-drawer[\s\S]*height: 50dvh/);
    expect(css).toMatch(/\.lkdv-half-drawer[\s\S]*max-height: 50dvh/);
    expect(css).toMatch(/\.lkdv-tab-selector[\s\S]*height: 48px/);
    expect(css).toMatch(/\.lkdv-tab-lens[\s\S]*width: calc/);
  });

  it('toutes les cartes sont carrées, texte compris', () => {
    const css = read('src/styles/community-feed.css');
    expect(css).toContain('.lkdv-feed-post--text');
    expect(css).toMatch(/\.lkdv-feed-post--text[\s\S]*aspect-ratio: 1 \/ 1/);
    expect(css).toContain('height: auto !important');
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

  it('le drawer de création a 5 tuiles, sans composeur de post', () => {
    const sheet = read('src/features/community/feed/CommunityCreateDrawer.tsx');
    expect(sheet).toContain('/carnets/nouveau');
    expect(sheet).toContain('/voyages');
    expect(sheet).toContain('/materiel');
    expect(sheet).toContain('/clubs/nouveau');
    expect(sheet).toContain('onStory');
    expect(sheet).not.toContain('/communaute/publier');
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
