import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Communauté — contrat du fil Instagram', () => {
  it('la page est un fil : top bar, stories, feed, barre Compte, drawer de création', () => {
    const page = read('src/app/communaute/page.tsx');
    expect(page).toContain('CommunityFeedShell');
    expect(page).toContain('CommunityFeedTopBar');
    expect(page).toContain('CommunityStoriesBar');
    expect(page).toContain('AccountBottomBar');
    expect(page).toContain('AccountCreateSheet');
    expect(page).not.toContain('CommunityHeroCard');
    expect(page).not.toContain('CommunityGrid');
    expect(page).not.toContain('?tab=');
  });

  it('la barre basse reprend les 5 onglets du Compte, sans actif', () => {
    const bar = read('src/components/account/AccountBottomBar.tsx');
    for (const label of ['Explorer', 'Compas', 'Matériel', 'Hub', 'Compte']) {
      expect(bar).toContain(`label: '${label}'`);
    }
    expect(bar).toContain('opacity: 0');
    expect(bar).not.toContain("aria-current");
  });

  it('le post reprend la capsule 3 × 34 et le menu 4 lignes du Compte', () => {
    const actions = read('src/components/account/AccountActionPill.tsx');
    const menu = read('src/components/account/AccountMoreMenu.tsx');
    const css = read('src/styles/account-glass.css');
    expect(actions.match(/pmi-post-btn/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(menu).toContain('Enregistrer');
    expect(menu).toContain('Republier');
    expect(menu).toContain('Copier le lien');
    expect(menu).toContain('Signaler');
    expect(css).toContain('bottom: 12px');
    expect(css).toContain('width: 34px');
  });

  it('le post image est carré et le post texte est plafonné au carré', () => {
    const css = read('src/styles/community-feed.css');
    expect(css).toContain('aspect-ratio: 1 / 1');
    expect(css).toContain('.lkdv-feed-post--text');
    expect(css).toContain('max-height: 100cqw');
    expect(css).toContain('min-height: 120px');
  });

  it('le drawer de création a exactement 5 lignes, sans composeur de post', () => {
    const sheet = read('src/components/account/AccountCreateSheet.tsx');
    expect(sheet).toContain('/carnets/nouveau');
    expect(sheet).toContain('/voyages');
    expect(sheet).toContain('/materiel');
    expect(sheet).toContain('/clubs/nouveau');
    expect(sheet).toContain("action: 'story'");
    expect(sheet).not.toContain('/communaute/publier');
  });

  it('les anciens composants du hub ont disparu', () => {
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
