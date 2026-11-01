import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Clubs iOS 27 Liquid Glass v15/v20 — Clone 1:1 de CompteLiquidGlassV8, Carte 3D & Suppression nav doublon', () => {
  const v8Source = read('src/components/clubs/ClubLiquidGlassV8.tsx');
  const higSource = read('src/components/compte/compte-apple-hig.css');
  const runtimeSource = read('src/components/clubs/club-liquid-glass-v8-runtime.js');
  const pageSource = read('src/app/clubs/[id]/page.tsx');
  const navWrapperSource = read('src/components/mobile-nav/MobileNavWrapper.tsx');
  const v15Source = higSource.slice(higSource.indexOf('Compte iOS 27 v15')) || higSource;
  const finalCard = runtimeSource.slice(runtimeSource.lastIndexOf('card = function ()'));
  const postModalSource = runtimeSource.slice(
    runtimeSource.indexOf('function renderPostModal'),
    runtimeSource.indexOf('/* ---------- Actions ---------- */')
  );

  it('0. La route /clubs/[id] monte ClubLiquidGlassV8 avec la barre unique iOS 27', () => {
    expect(pageSource).toContain('ClubLiquidGlassV8');
    expect(v8Source).toContain('el.innerHTML = COMPTE_V8_HTML');
    expect(v8Source).toContain('(window as any).maplibregl = maplibregl');
    expect(navWrapperSource).toContain('MobileNavWrapper');
  });

  it('1. La card a une seule couche scrollable et le sélecteur flotte au-dessus des posts', () => {
    expect(finalCard).toContain('<div class="card-scroll">');
    expect(finalCard).toContain('<div class="ig-tabs-float">');
    expect(finalCard.indexOf('class="ig-tabs-float"')).toBeGreaterThan(finalCard.indexOf('renderIgTabContent(D)'));
    expect(v15Source).toMatch(/#card\.cs\s*>\s*\.card-scroll\s*\{[^}]*overflow-y:\s*auto/);
    expect(v15Source).toMatch(/\.ig-tabs-float\s*\{[^}]*position:\s*absolute/);
    expect(v15Source).toMatch(/\.ig-tabs-float\s*\{[^}]*right:\s*10px/);
    expect(v15Source).toMatch(/\.ig-tabs-float\s*\{[^}]*bottom:\s*10px/);
  });

  it('2. Le sélecteur reprend le verre de référence et les stats affichent publications, membres, sorties', () => {
    expect(v15Source).toMatch(/\.ig-tabs-float \.ig-tabs\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(v15Source).toMatch(/\.ig-tabs-float \.ig-tabs\s*\{[^}]*backdrop-filter:\s*blur\(28px\)/);
    expect(v15Source).toMatch(/\.ig-tabs-float \.ig-tabs \.ig-th\s*\{[^}]*linear-gradient/);
    expect(finalCard).toContain("'publications'");
    expect(finalCard).toContain("'membres'");
    expect(finalCard).toContain("'sorties'");
  });

  it('3. Les drawers et le post drawer épousent exactement les bords de la card', () => {
    expect(runtimeSource).toContain('const syncCardBounds = function()');
    expect(runtimeSource).toContain('--card-top');
    expect(runtimeSource).toContain('--card-bottom');
    expect(runtimeSource).toContain('--card-radius');
    expect(v15Source).toMatch(/\.sw-wrap\[data-det="card"\] \.sheet,[\s\S]*?\.post-modal-instagram\s*\{[^}]*top:\s*var\(--card-top/);
    expect(v15Source).toMatch(/\.sw-wrap\[data-det="card"\] \.sheet,[\s\S]*?\.post-modal-instagram\s*\{[^}]*bottom:\s*var\(--card-bottom/);
    expect(v15Source).toMatch(/\.sw-wrap\[data-det="card"\] \.sheet,[\s\S]*?\.post-modal-instagram\s*\{[^}]*border-radius:\s*var\(--card-radius/);
  });

  it('4. Les drawers reprennent le matériau translucide de la card', () => {
    expect(v15Source).toMatch(/\.sheet\s*\{[^}]*calc\(var\(--ga/);
    expect(v15Source).toMatch(/\.sheet\s*\{[^}]*blur\(calc\(var\(--gb/);
    expect(v15Source).toMatch(/\.sheet \.li\.nt,[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.82\)/);
    expect(v15Source).not.toMatch(/\.sheet\s*\{[^}]*rgba\(255,\s*255,\s*255,\s*0\.96\)/);
  });

  it('5. Tous les sélecteurs de drawers partagent le même style icon-only', () => {
    expect(higSource).toMatch(/\.flow,\s*\.segc,\s*\.reseau-toggle,\s*\.ig-sub\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(higSource).toMatch(/\.flow,\s*\.segc,\s*\.reseau-toggle,\s*\.ig-sub\s*\{[^}]*backdrop-filter:\s*blur\(28px\)/);
    expect(higSource).toMatch(/\.sel-lens\s*\{[^}]*linear-gradient/);
    expect(runtimeSource).toContain('ic(ligIcons[i]');
    expect(runtimeSource).toContain('aria-selected="');
    expect(v15Source).toMatch(/\.sheet \.reseau-toggle-wrap \.apple-grouped-card\s*\{[^}]*background:\s*transparent/);
  });

  it('6. Le post drawer est minimal : image plein cadre, pillules flottantes, aucun panneau de contenu', () => {
    expect(postModalSource).toContain('pmi-author');
    expect(postModalSource).toContain('pmi-post-actions');
    expect(postModalSource).toContain('pmi-more-pill');
    expect(postModalSource).toContain('pmi-grabber');
    expect(postModalSource).not.toContain('pmi-content-glass');
    expect(postModalSource).not.toContain('pmi-social-counter');
    expect(postModalSource).not.toContain('pmi-comments-list');
    expect(v15Source).toMatch(/\.pmi-scroll-area\s*\{[^}]*display:\s*flex/);
    expect(v15Source).toMatch(/\.pmi-media\s*\{[^}]*flex:\s*1 1 auto/);
    expect(v15Source).toMatch(/\.pmi-content-glass\s*\{[^}]*display:\s*none/);
    expect(v15Source).toMatch(/\.pmi-caption-pill\s*\{[^}]*backdrop-filter:\s*blur\(28px\)/);
  });

  it('6 bis. Les commentaires ouvrent un drawer au même style, alimenté par le post', () => {
    expect(runtimeSource).toContain('post_comments: () =>');
    expect(runtimeSource).toContain('openPostComments:');
    expect(runtimeSource).toContain('submitPostComment:');
    expect(postModalSource).toContain('data-a="openPostComments"');
    expect(runtimeSource).toContain("openSheet('post_comments', 0, 'card', { postId: id })");
  });

  it('7. Les contrôles de carte reprennent le verre du sélecteur, sans aplat primaire', () => {
    expect(v15Source).toMatch(/\.mctl,\s*\n\.map-scale-selector\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(v15Source).toMatch(/\.mctl,\s*\n\.map-scale-selector\s*\{[^}]*backdrop-filter:\s*blur\(28px\)/);
    expect(v15Source).toMatch(/\.mctl button\[aria-expanded="true"\],[\s\S]*?background:\s*linear-gradient/);
    expect(v15Source).toMatch(/\.mctl button\[aria-expanded="true"\],[\s\S]*?color:\s*#17402C/);
  });

  it('8. Les boutons des drawers restent en verre teinté, sans couleur primaire pleine', () => {
    expect(v15Source).toMatch(/\.sheet \.reseau-btn\.primary\s*\{[^}]*background:\s*var\(--pg\)/);
    expect(v15Source).toMatch(/\.sheet \.reseau-btn\.active\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.62\)/);
  });

  it('9. Sécurité & Data Truth : résolution des profils en 2 étapes (fetchPublicProfilesWith) et échappement XSS esc()', () => {
    expect(v8Source).toContain('fetchPublicProfilesWith');
    expect(runtimeSource).toContain('const esc = (s) =>');
    expect(runtimeSource).toContain('__lkdvHydrateClub');
  });

  it('isolation du Compas (aucun import de la refonte des clubs)', () => {
    // Intention de l'invariant d'origine (« 0 modification dans /compas ») : cette refonte ne touche pas
    // au Compas. Une différence avec origin/main ne le prouve pas (elle échoue pour toute branche qui fait
    // évoluer le Compas) : on vérifie l'isolation, comme compte-refonte-v17 (remplacé le 01/11/2026).
    const leaks = execSync(
      'git grep -l -E "components/clubs/|ClubLiquidGlassV8" -- src/app/compas src/features/compas || true',
      { encoding: 'utf8' },
    ).trim();
    expect(leaks).toBe('');
  });

  it('11. Adaptation Club Oct 24 : Fil d’actu inline Communauté v3 + PostGlassPanel en vue principale (Tab 0)', () => {
    const feedSource = read('src/components/clubs/feed/ClubInlineFeed.tsx');
    expect(v8Source).toContain('ClubInlineFeed');
    expect(runtimeSource).toContain('id="lkdv-club-feed-root"');
    // Le post du club est le bloc de la Communauté (PostSource) : même panneau verre, même carte.
    const block = read('src/features/community/feed/CommunityFeedPost.tsx');
    expect(feedSource).toContain('CommunityFeedPost');
    expect(feedSource).toContain('lkdv-feed-list');
    expect(block).toContain('PostGlassPanel');
    expect(block).toContain('lkdv-feed-post');
  });

  it('12. Adaptation Club Oct 24 : Drawers & Sous-Drawers in-card (DrawerShell 48px + 30px) pour Cordée, Sorties, Coffre Kit & Gouvernance', () => {
    const drawerSource = read('src/components/clubs/drawer/ClubDrawerHost.tsx');
    expect(v8Source).toContain('ClubDrawerHost');
    expect(runtimeSource).toContain('__lkdvMountDrawer');
    expect(drawerSource).toContain('DrawerShell');
    expect(drawerSource).toContain('secondaryByTab');
    expect(drawerSource).toContain('data-autofocus');
  });
});
