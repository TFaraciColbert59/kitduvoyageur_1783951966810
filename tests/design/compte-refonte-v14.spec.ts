import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 Liquid Glass v14 — card aérée, drawers carte, post immersif & contrôles unifiés', () => {
  // Les règles de style ont été extraites dans des feuilles dédiées : on lit la
  // source TSX *et* les CSS, sans toucher aux assertions de contrat.
  const v8Source = read('src/components/compte/CompteLiquidGlassV8.tsx') + '\n' + read('src/components/compte/compte-apple-hig.css') + '\n' + read('src/components/compte/compte-v8.css');
  const runtimeSource = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const v14Source = v8Source.slice(v8Source.indexOf('Compte iOS 27 v14'));
  const finalCard = runtimeSource.slice(runtimeSource.lastIndexOf('card = function ()'));
  const postModalSource = runtimeSource.slice(
    runtimeSource.indexOf('function renderPostModal'),
    runtimeSource.indexOf('/* ---------- Actions ---------- */')
  );

  it('1. Le sélecteur Grille/Sorties est flottant au-dessus des posts', () => {
    expect(runtimeSource).toContain('class="ig-tabs-float"');
    expect(finalCard.indexOf('class="ig-tabs-float"')).toBeGreaterThan(finalCard.indexOf('renderIgTabContent(D)'));
    expect(v14Source).toMatch(/\.ig-tabs\s*\{[^}]*position:\s*relative/);
  });

  it('2. La note sur la photo de profil est supprimée et la card remonte', () => {
    expect(finalCard).not.toContain('ig-note');
    expect(runtimeSource).not.toContain('<span class="ig-note"');
    expect(v14Source).toMatch(/\.ig-note\s*\{[^}]*display:\s*none/);
    expect(v14Source).toMatch(/\.ig-header\s*\{[^}]*padding:\s*2px 2px 0/);
    expect(v14Source).toMatch(/#card\.cs\s*\{[^}]*overflow-y:\s*auto/);
  });

  it('3. Les sorties ne sont plus coupées : card scrollable, grille et carrousel non rognés', () => {
    expect(v14Source).toMatch(/#card\.cs\s*\{[^}]*overflow-y:\s*auto/);
    expect(v14Source).toMatch(/\.ig-grid-wrap\s*\{[^}]*margin:\s*0 -12px -14px/);
    expect(v14Source).toMatch(/\.ig-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,/);
    expect(v14Source).toMatch(/\.ig-tile\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/);
    expect(v14Source).toMatch(/\.voyages-carousel\s*\{[^}]*overflow-x:\s*auto/);
    expect(v14Source).toMatch(/\.voyage-card\s*\{[^}]*flex:\s*0 0 78%/);
  });

  it('4. Tous les drawers s’ouvrent en hauteur carte, ancrés sur la card', () => {
    expect(runtimeSource).toContain('let openSheet = function(k = "step", tab = 0, det = "card"');
    expect(runtimeSource).toContain('if (S.sh.det !== "closed") S.sh.det = "card";');
    expect(runtimeSource).toContain('S.sh = { tab: 0, page: 0, det: "card", ...o };');
    expect(v14Source).toMatch(/\.sw-wrap\[data-det="card"\] \.sheet\s*\{[^}]*top:\s*48px/);
    expect(v14Source).toMatch(/\.sw-wrap\[data-det="card"\] \.sheet\s*\{[^}]*bottom:\s*calc\(31% \+ 46px\)/);
    expect(v14Source).toMatch(/\.sw-wrap\[data-det="card"\] \.sh-b\s*\{[^}]*overflow-y:\s*auto/);
    expect(v14Source).toMatch(/\.sw-wrap\[data-det="card"\] \.scrim\s*\{[^}]*opacity:\s*0/);
  });

  it('5. Les sélecteurs de drawers sont en verre translucide, icônes seules, correctement alignées', () => {
    expect(v8Source).toMatch(/\.flow,\s*\.segc,\s*\.reseau-toggle,\s*\.ig-sub\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(v8Source).toMatch(/\.flow,\s*\.segc,\s*\.reseau-toggle,\s*\.ig-sub\s*\{[^}]*backdrop-filter:\s*blur\(28px\)/);
    expect(v8Source).toMatch(/\.sel-lens\s*\{[^}]*linear-gradient/);
    expect(runtimeSource).toContain('aria-label="Mes Commandes"');
    expect(runtimeSource).not.toContain('>Mes Commandes</button>');
    expect(runtimeSource).toContain('aria-label="Abonnements (');
    expect(runtimeSource).not.toContain('>Abonnements (');
    expect(runtimeSource).toContain('ic(ligIcons[i]');
    expect(runtimeSource).toContain('aria-selected="');
    expect(v8Source).toMatch(/\.sel-lens\s*\{[^}]*rgba\(255,\s*255,\s*255,\s*0\.5\)/);
  });

  it('6. Le post drawer est immersif : pas de barres blanches, actions flottantes, options, swipe et grabber', () => {
    expect(postModalSource).toContain('pmi-author');
    expect(postModalSource).toContain('data-a="closePostModal"');
    expect(postModalSource).not.toContain('pmi-close-btn');
    expect(postModalSource).toContain('pmi-post-actions');
    expect(postModalSource).toContain('pmi-more-pill');
    expect(postModalSource).toContain('openPostOptions');
    expect(postModalSource).toContain('pmi-options-menu');
    expect(postModalSource).toContain('pmi-grabber');
    expect(postModalSource).not.toContain('pmi-comment-bar .pmi-c-av');
    expect(postModalSource).toContain('aria-pressed="${likeData.userLiked}"');
    expect(runtimeSource).toContain("modalEl.addEventListener('pointerdown'");
    expect(runtimeSource).toContain('copyPostLink');
    expect(runtimeSource).toContain("notifyHostAction('reportPost'");
    expect(v14Source).toMatch(/\.post-modal-instagram\s*\{[^}]*bottom:\s*calc\(31% \+ 46px\)/);
    expect(v14Source).toMatch(/\.pmi-header\s*\{[^}]*background:\s*transparent/);
    expect(v14Source).toMatch(/\.pmi-comment-bar\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(v14Source).toMatch(/\.pmi-action-pill\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
  });

  it('7. Le pseudo est blanc et doux, les contrôles de carte adoptent le même verre', () => {
    expect(v14Source).toMatch(/\.ig-handle\s*\{[^}]*color:\s*rgba\(255,\s*255,\s*255,\s*0\.94\)/);
    expect(v14Source).toMatch(/\.mctl\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(v14Source).toMatch(/\.map-scale-selector\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(v14Source).toMatch(/\.mctl\s*\{[^}]*backdrop-filter:\s*blur\(28px\)/);
    expect(v14Source).toMatch(/\.map-scale-selector button\.active\s*\{[^}]*color:\s*#17402C/);
  });

  it('8. Les écrans de drawers reçoivent le polissage partagé (10+ améliorations)', () => {
    expect(v14Source).toContain('.sheet .li.nt');
    expect(v14Source).toContain('.sheet .cap');
    expect(v14Source).toContain('.sheet .mbtn');
    expect(v14Source).toContain('.sheet .menu2');
    expect(v14Source).toContain('.sheet .chips');
    expect(v14Source).toContain('.sheet .sh-f');
    expect(v14Source).toContain('@keyframes sheetRowIn');
    expect(v14Source).toContain('prefers-reduced-motion');
    expect(v14Source).toContain('.sh-h-spacer');
    expect(v14Source).toContain('.grab span');
  });

  it('9. Les liens de post utilisent la route /carnets et le vrai identifiant', () => {
    expect(runtimeSource).toContain('/carnets/');
    expect(runtimeSource).toContain('t.realId || id');
    expect(runtimeSource).toContain("notifyHostAction('reportPost'");
  });

  it('10. Invariant strict : 0 modification dans /compas', () => {
    try {
      const diffCompas = execSync('git diff --name-only origin/main -- src/app/compas src/features/compas', { encoding: 'utf8' }).trim();
      expect(diffCompas).toBe('');
    } catch (_) {
      const statusCompas = execSync('git status --porcelain -- src/app/compas src/features/compas', { encoding: 'utf8' }).trim();
      expect(statusCompas).toBe('');
    }
  });
});
