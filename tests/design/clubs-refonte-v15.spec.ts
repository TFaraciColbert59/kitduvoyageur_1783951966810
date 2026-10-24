import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = process.cwd();
const tsxPath = path.join(root, 'src/components/clubs/ClubLiquidGlassV8.tsx');
const jsPath = path.join(root, 'src/components/clubs/club-liquid-glass-v8-runtime.js');
const pagePath = path.join(root, 'src/app/clubs/[id]/page.tsx');

const tsx = fs.existsSync(tsxPath) ? fs.readFileSync(tsxPath, 'utf8') : '';
const js = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf8') : '';
const page = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : '';

const v15Idx = tsx.indexOf('/* ==============================================================================\n   Club iOS 27 v15');
const v15Css = v15Idx >= 0 ? tsx.slice(v15Idx) : '';

describe('Clubs iOS 27 Refonte v15 — Parité stricte avec Compte v15, Drawers Card, Icônes Pures & Carte 3D', () => {
  it('0. route /clubs/[id] monte ClubLiquidGlassV8', () => {
    expect(fs.existsSync(tsxPath)).toBe(true);
    expect(fs.existsSync(jsPath)).toBe(true);
    expect(page).toContain('ClubLiquidGlassV8');
  });

  it('1. 1 seule couche scrollable (#card.cs > .card-scroll) et sélecteur (.ig-tabs-float) superposé en bas à droite', () => {
    expect(v15Css).toContain('#card.cs {\n  overflow: hidden !important;');
    expect(v15Css).toContain('#card.cs > .card-scroll {');
    expect(v15Css).toContain('overflow-y: auto !important;');

    // Le sélecteur flottant est en position absolute (superposé à la grille) en bas à droite
    expect(v15Css).toContain('#card.cs > .ig-tabs-float {');
    expect(v15Css).toContain('position: absolute !important;');
    expect(v15Css).toContain('right: 10px !important;');
    expect(v15Css).toContain('bottom: 10px !important;');

    // Dans le runtime JS, ig-tabs-float est en dehors de .card-scroll
    const cardFnStart = js.indexOf('function card()');
    const cardFnEnd = js.indexOf('function renderTop(', cardFnStart);
    const cardFn = js.slice(cardFnStart, cardFnEnd);
    const tabContentIdx = cardFn.indexOf('renderIgTabContent');
    const floatIdx = cardFn.indexOf('ig-tabs-float');
    expect(tabContentIdx).toBeGreaterThan(-1);
    expect(floatIdx).toBeGreaterThan(tabContentIdx);
  });

  it('2. les boutons de sélection Grille/Sorties sont en pur verre dépoli transparent (sans fond vert foncé)', () => {
    expect(v15Css).toContain('#card.cs > .ig-tabs-float .ig-tabs {');
    expect(v15Css).toContain('background: rgba(255, 255, 255, 0.65) !important;');
    expect(v15Css).toContain('backdrop-filter: blur(28px) saturate(210%) !important;');

    // Lens active avec dégradé verre transparent et bordure lumineuse (zéro fond vert #17402C plein)
    expect(v15Css).toContain('#card.cs > .ig-tabs-float .ig-th {');
    expect(v15Css).toContain('background: linear-gradient(145deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.72) 100%) !important;');
    const igThStart = v15Css.indexOf('#card.cs > .ig-tabs-float .ig-th {');
    const igThBlock = v15Css.slice(igThStart, v15Css.indexOf('}', igThStart));
    expect(igThBlock).not.toContain('background: #17402C');
  });

  it('3. tous les drawers (Club, Membres, Création, Commentaires) et la vue post prennent exactement la taille et position de la card', () => {
    expect(js).toContain('function syncCardBounds()');
    expect(js).toContain("phone.style.setProperty('--card-top'");
    expect(js).toContain("phone.style.setProperty('--card-bottom'");
    expect(js).toContain("phone.style.setProperty('--card-radius'");

    expect(v15Css).toContain('#sheet.sheet.open[data-det="card"]');
    expect(v15Css).toContain('top: var(--card-top, calc(var(--sat, 54px) + 52px)) !important;');
    expect(v15Css).toContain('bottom: var(--card-bottom, 10px) !important;');
    expect(v15Css).toContain('border-radius: var(--card-radius, 28px) !important;');

    expect(v15Css).toContain('#post_modal_instagram.post-modal-instagram {');
  });

  it('4. les drawers ont la même transparence et teinte que la card principale et des sous-cartes non blanches', () => {
    expect(v15Css).toContain('background: linear-gradient(\n    172deg,\n    rgba(255, 255, 255, calc(var(--ga, 0.65) + 0.14)) 0%');
    expect(v15Css).toContain('backdrop-filter: blur(calc(var(--gb, 28) * 1px)) saturate(calc(var(--gsat, 210) * 1%)) !important;');

    const subCardsStart = v15Css.indexOf('.sheet .li.nt,');
    const subCardsBlock = v15Css.slice(subCardsStart, v15Css.indexOf('}', subCardsStart));
    expect(subCardsBlock).toContain('rgba(255, 255, 255, 0.82)');
    expect(subCardsBlock).not.toContain('0.96');
  });

  it('5. tous les sélecteurs des drawers ont le même design Liquid Glass que ceux de la card, en icônes pures sans texte', () => {
    // Sélecteurs des drawers unifiés sur le verre 0.65 + blur(28px) + lens active brillante
    expect(v15Css).toContain('.sheet .flow, .sheet .segc, .sheet .reseau-toggle, .ig-sub {');
    expect(v15Css).toContain('.sheet .flow .sel-lens, .sheet .segc .sel-lens, .sheet .reseau-toggle .sel-lens, .ig-sub .sel-lens {');

    // Sélecteur du drawer Club (Infos/Groupes/Modération) : icônes pures sans span de texte, placé au-dessus des boutons d'action
    const clubStart = js.indexOf('club_drawer:()=>');
    const clubEnd = js.indexOf('members_sheet:()=>', clubStart);
    const clubBlock = js.slice(clubStart, clubEnd);
    expect(clubBlock).toContain('aria-label="Infos et Charte"');
    expect(clubBlock).toContain('aria-label="Groupes et Logistique"');
    expect(clubBlock).toContain('aria-label="Modération et Paramètres"');
    expect(clubBlock.indexOf('const tabHeader')).toBeLessThan(clubBlock.indexOf('return grab+head+tabHeader+clubActions'));

    // Sélecteur du drawer Membres (Membres actifs / Équipe & Modérateurs) : icônes pures sans texte
    const memStart = js.indexOf('members_sheet:()=>');
    const memEnd = js.indexOf('post_comments:()=>', memStart);
    const memBlock = js.slice(memStart, memEnd);
    expect(memBlock).toContain('aria-label="Membres actifs"');
    expect(memBlock).toContain('aria-label="Équipe et Modérateurs"');
  });

  it('6. le drawer de post est ultra-minimaliste : photo plein cadre, profil haut-gauche, actions haut-droite, saisie commentaire en bas', () => {
    const pmiStart = js.indexOf('function renderPostModal(postId)');
    const pmiEnd = js.indexOf('function render(', pmiStart);
    const pmiBlock = js.slice(pmiStart, pmiEnd);

    expect(pmiBlock).toContain('pmi-profile-pill');
    expect(pmiBlock).toContain('pmi-action-pill pmi-actions');
    expect(pmiBlock).toContain('pmi-more-pill');
    expect(pmiBlock).toContain('pmi-grabber');
    expect(pmiBlock).toContain('pmi-comment-bar');
    expect(pmiBlock).toContain('pmi-caption-pill');

    // Aucun panneau blanc d'infos/commentaires en bas de la photo dans le post modal
    expect(pmiBlock).not.toContain('pmi-content-glass');
    expect(pmiBlock).not.toContain('pmi-social-counter');
    expect(pmiBlock).not.toContain('pmi-comments-list');

    expect(v15Css).toContain('.pmi-content-glass {\n  display: none !important;\n}');
  });

  it('6 bis. le bouton commentaire du post ouvre un drawer dédié aux commentaires de la taille de la card', () => {
    const pmiStart = js.indexOf('function renderPostModal(postId)');
    const pmiEnd = js.indexOf('function render(', pmiStart);
    const pmiBlock = js.slice(pmiStart, pmiEnd);

    expect(pmiBlock).toContain('data-a="openPostComments"');
    expect(js).toContain('post_comments:()=>');
    expect(js).toContain('openPostComments:(id)=>');
    expect(js).toContain('submitPostComment:(id)=>');
    expect(js).toContain("openSheet('post_comments',0,'card',{postId:id})");
  });

  it('7. les contrôles de la carte (boussole 3D, recentrage, échelle) ont le même verre dépoli que les sélecteurs', () => {
    expect(v15Css).toContain('.mctl, .map-scale-selector {');
    expect(v15Css).toContain('.mctl.active, .map-scale-btn.active {');
    const mapCtrlStart = v15Css.indexOf('.mctl, .map-scale-selector {');
    const mapCtrlBlock = v15Css.slice(mapCtrlStart, v15Css.indexOf('/* 7.', mapCtrlStart));
    expect(mapCtrlBlock).toContain('rgba(255, 255, 255, 0.65)');
    expect(mapCtrlBlock).toContain('backdrop-filter: blur(28px) saturate(210%)');
    expect(mapCtrlBlock).toContain('linear-gradient(145deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.72) 100%)');
    expect(mapCtrlBlock).toContain('color: #17402C !important;');
  });

  it('8. les boutons dans les drawers ont la même transparence et teinte que ceux de la card principale', () => {
    expect(v15Css).toContain('.sheet .reseau-btn.primary,');
    expect(v15Css).toContain('.sheet .reseau-btn.active,');
    const btnStart = v15Css.indexOf('/* 7. BOUTONS DANS LES DRAWERS');
    const btnBlock = v15Css.slice(btnStart);
    expect(btnBlock).toContain('background: var(--pg) !important;');
    expect(btnBlock).toContain('background: rgba(255, 255, 255, 0.62) !important;');
  });

  it('9. Sécurité & Data Truth : résolution des profils en 2 étapes (fetchPublicProfilesWith) et échappement XSS esc()', () => {
    expect(tsx).toContain('fetchPublicProfilesWith');
    expect(js).toContain('function esc(s)');
    expect(js).toContain('__lkdvHydrateClub');
  });

  it('10. Invariant strict : 0 modification dans src/app/compas et src/features/compas', () => {
    const diff = execSync('git status --porcelain src/app/compas src/features/compas', { encoding: 'utf8' }).trim();
    expect(diff).toBe('');
  });
});
