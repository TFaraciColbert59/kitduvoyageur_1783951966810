import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 Liquid Glass v15 — sélecteur superposé, drawers sur les bords de la card & post minimal', () => {
  // Les règles de style ont été extraites dans des feuilles dédiées : on lit la
  // source TSX *et* les CSS, sans toucher aux assertions de contrat.
  const v8Source = read('src/components/compte/CompteLiquidGlassV8.tsx') + '\n' + read('src/components/compte/compte-apple-hig.css') + '\n' + read('src/components/compte/compte-v8.css');
  const runtimeSource = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const v15Source = v8Source.slice(v8Source.indexOf('Compte iOS 27 v15'));
  const finalCard = runtimeSource.slice(runtimeSource.lastIndexOf('card = function ()'));
  const postModalSource = runtimeSource.slice(
    runtimeSource.indexOf('function renderPostModal'),
    runtimeSource.indexOf('/* ---------- Actions ---------- */')
  );

  it('1. La card a une seule couche scrollable et le sélecteur flotte au-dessus des posts', () => {
    expect(finalCard).toContain('<div class="card-scroll">');
    expect(finalCard).toContain('<div class="ig-tabs-float">');
    expect(finalCard.indexOf('class="ig-tabs-float"')).toBeGreaterThan(finalCard.indexOf('renderIgTabContent(D)'));
    expect(v15Source).toMatch(/#card\.cs\s*>\s*\.card-scroll\s*\{[^}]*overflow-y:\s*auto/);
    expect(v15Source).toMatch(/\.ig-tabs-float\s*\{[^}]*position:\s*absolute/);
    expect(v15Source).toMatch(/\.ig-tabs-float\s*\{[^}]*right:\s*10px/);
    expect(v15Source).toMatch(/\.ig-tabs-float\s*\{[^}]*bottom:\s*10px/);
  });

  it('2. Le sélecteur reprend le verre de référence et non un bouton plein', () => {
    expect(v15Source).toMatch(/\.ig-tabs-float \.ig-tabs\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(v15Source).toMatch(/\.ig-tabs-float \.ig-tabs\s*\{[^}]*backdrop-filter:\s*blur\(28px\)/);
    expect(v15Source).toMatch(/\.ig-tabs-float \.ig-tabs \.ig-th\s*\{[^}]*linear-gradient/);
    expect(v15Source).not.toContain('#17402C !important;\n  background: #17402C');
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
    expect(v8Source).toMatch(/\.flow,\s*\.segc,\s*\.reseau-toggle,\s*\.ig-sub\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(v8Source).toMatch(/\.flow,\s*\.segc,\s*\.reseau-toggle,\s*\.ig-sub\s*\{[^}]*backdrop-filter:\s*blur\(28px\)/);
    expect(v8Source).toMatch(/\.sel-lens\s*\{[^}]*linear-gradient/);
    expect(runtimeSource).toContain('aria-label="Mes Commandes"');
    expect(runtimeSource).not.toContain('>Mes Commandes</button>');
    expect(runtimeSource).toContain('ic(ligIcons[i]');
    expect(runtimeSource).toContain('aria-selected="');
    const drawerBody = runtimeSource.slice(runtimeSource.indexOf('account_drawer: () =>'), runtimeSource.indexOf('note: () =>'));
    expect(drawerBody).toContain('tabHeader,');
    expect(drawerBody).not.toContain('profileActions,');
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
    expect(runtimeSource).toContain('openSheet(\'post_comments\', 0, \'card\', { postId: id })');
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

  it('9. Invariant strict : 0 modification dans /compas', () => {
    try {
      const diffCompas = execSync('git diff --name-only origin/main -- src/app/compas src/features/compas', { encoding: 'utf8' }).trim();
      expect(diffCompas).toBe('');
    } catch (_) {
      const statusCompas = execSync('git status --porcelain -- src/app/compas src/features/compas', { encoding: 'utf8' }).trim();
      expect(statusCompas).toBe('');
    }
  });
});
