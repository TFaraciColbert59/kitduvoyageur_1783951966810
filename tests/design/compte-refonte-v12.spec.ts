import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 Liquid Glass v12 — Header Épuré, Sélecteur Haut-Droite, Actions dans Drawer, Carte 3D Fiabilisée & Post Téléportation', () => {
  const v8Source =
    read('src/components/compte/CompteLiquidGlassV8.tsx') +
    '\n' + read('src/components/compte/compte-v8.css') +
    '\n' + read('src/components/compte/compte-apple-hig.css');
  const runtimeSource = read('src/components/compte/compte-liquid-glass-v8-runtime.js');

  it('1. Profile Header layout minimaliste : avatar sans nom/pseudo en dessous dans card(), stats recentrées', () => {
    // Vérifier que card() n'injecte plus .ig-left-meta sous l'avatar
    const cardMatch = runtimeSource.match(/card\s*=\s*function\s*\(\)\s*\{([\s\S]*?)\n\};/);
    expect(cardMatch).toBeTruthy();
    const cardBody = cardMatch ? cardMatch[1] : '';
    expect(cardBody).not.toContain('<div class="ig-left-meta">');

    // Vérifier que .ig-header et .ig-stats sont recentrés et transparents
    expect(v8Source).toMatch(/\.ig-header\s*\{[^}]*align-items:\s*center/);
    expect(v8Source).toMatch(/\.ig-stats\s*\{[^}]*justify-content:\s*space-around/);
    expect(v8Source).toMatch(/\.ig-stat\s*\{[^}]*background:\s*transparent/);
    expect(v8Source).toContain('#17402C');
    expect(v8Source).toContain('#56665D');
  });

  it('2. Sélecteur Grille/Sorties repositionné en haut à droite de la card en véritable Liquid Glass iOS 27', () => {
    // Structure HTML du sélecteur à 2 onglets sans texte
    expect(runtimeSource).toContain('class="ig-th lens"');
    expect(runtimeSource).toContain('aria-label="Grille des publications"');
    expect(runtimeSource).toContain('aria-label="Sorties et voyages faits"');

    // v14 : positionné dans le flux, aligné à droite juste au-dessus des posts
    expect(v8Source).toMatch(/\.ig-tabs-row\s*\{[^}]*justify-content:\s*flex-end/);
    expect(v8Source).toMatch(/\.ig-tabs\s*\{[^}]*position:\s*relative/);
    expect(v8Source).toMatch(/\.ig-tabs\s*\{[^}]*width:\s*88px/);
    const finalCard = runtimeSource.slice(runtimeSource.lastIndexOf('card = function ()'));
    expect(finalCard.indexOf('class="ig-tabs-float"')).toBeGreaterThan(finalCard.indexOf('renderIgTabContent(D)'));

    // Liquid Glass iOS 27 clair
    expect(v8Source).toMatch(/\.ig-tabs\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(v8Source).toMatch(/\.ig-tabs\s*\{[^}]*backdrop-filter:\s*blur\(28px\)/);
    expect(v8Source).toMatch(/\.ig-tabs\s*\{[^}]*border-radius:\s*9999px/);

    // Icônes vectorielles pures 15px et couleurs active/inactive
    expect(v8Source).toMatch(/\.ig-tabs button svg[^{]*\{[^}]*width:\s*15px/);
    expect(v8Source).toMatch(/\.ig-tabs button svg[^{]*\{[^}]*height:\s*15px/);
    expect(v8Source).toMatch(/\.ig-tabs button\[aria-selected="true"\]\s*\{[^}]*color:\s*#17402C/);
    expect(v8Source).toMatch(/\.ig-tabs button\s*\{[^}]*color:\s*#56665D/);
  });

  it('3. Boutons "Modifier le profil" et "Partager le profil" retirés de la card et placés dans account_drawer', () => {
    // Vérifier l'absence de .ig-actions au centre de card()
    const cardMatch = runtimeSource.match(/card\s*=\s*function\s*\(\)\s*\{([\s\S]*?)\n\};/);
    expect(cardMatch).toBeTruthy();
    const cardBody = cardMatch ? cardMatch[1] : '';
    expect(cardBody).not.toContain('<div class="ig-actions">');

    // Vérifier la présence des boutons prioritaires dans account_drawer
    const drawerMatch = runtimeSource.match(/account_drawer:\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\},/);
    expect(drawerMatch).toBeTruthy();
    const drawerBody = drawerMatch ? drawerMatch[1] : '';
    expect(drawerBody).toContain('data-a="drawerTab"');
    expect(drawerBody).toContain('data-v="3"');
    expect(drawerBody).toContain('Modifier le profil');
    expect(drawerBody).toContain('data-a="shareProfile"');
    expect(drawerBody).toContain('Partager le profil');

    // Vérifier la présence des handlers
    expect(runtimeSource).toContain('case "editProfile":');
    expect(runtimeSource).toContain('case "shareProfile":');
  });

  it('4. Post Detail en drawer overlay superposé laissant la carte visible + téléportation 3D sur le lieu exact', () => {
    // Drawer overlay aligné sur les bords de la card, carte visible en dessous
    expect(v8Source).toMatch(/\.post-modal-instagram\s*\{[^}]*bottom:\s*calc\(31%/);
    expect(v8Source).toMatch(/\.pmi-dialog\s*\{[^}]*border-radius:\s*(28|30|32)px/);

    // Téléportation 3D de la caméra dans openPostModal
    expect(runtimeSource).toContain('openPostModal: (id) =>');
    expect(runtimeSource).toContain('window.__lkdvCompteMap3D.flyTo');
    expect(runtimeSource).toContain('6.8894');
    expect(runtimeSource).toContain('45.9812');
    expect(runtimeSource).toContain('zoom: 14.2');
    expect(runtimeSource).toContain('pitch: 65');
    expect(runtimeSource).toContain('bearing: -20');

    // Mappage complet des coordonnées pour tous les posts principaux (Lac Blanc, Néouvielle, Glacier Blanc)
    expect(runtimeSource).toContain('Massif du Néouvielle');
    expect(runtimeSource).toContain('-0.0112');
    expect(runtimeSource).toContain('42.7324');
    expect(runtimeSource).toContain('Glacier Blanc');
    expect(runtimeSource).toContain('6.415');
    expect(runtimeSource).toContain('44.925');

    // Notification Dynamic Island du lieu et altitude
    expect(runtimeSource).toContain('Altitude');
    expect(runtimeSource).toContain('Lac Blanc');

    // Mise en valeur lumineuse du pin photo sur la carte 3D
    expect(runtimeSource).toContain('highlightMapMarker');
    expect(runtimeSource).toContain('unhighlightMapMarkers');
    expect(v8Source).toContain('.photo-marker-3d.highlight');
    expect(v8Source).toContain('pulse-marker');
  });

  it('5. Carte vivante : îlot React, worker, style.load, sources réelles et fallback', () => {
    const mapSource = read('src/components/compte/map/CompteMap.tsx');
    const mapCss = read('src/components/compte/map/compte-map.css');
    expect(mapSource).toContain("setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')");
    expect(mapSource).toContain("instance.on('style.load'");
    expect(mapSource).toContain('ResizeObserver');
    expect(mapSource).toContain('instance.resize()');
    expect(mapSource).toContain("'compte-tracks'");
    expect(mapSource).toContain('CompteMapFallback');
    expect(mapSource).not.toContain('compte-tmb-track');
    expect(mapCss).toContain('#0b101b');
    expect(mapCss).toContain('blur(4px) saturate(1.9) brightness(1.07)');
    expect(v8Source).toContain('CompteMap');
  });

  it('6. Harmonisation universelle de tous les sélecteurs de drawers en Liquid Glass iOS 27 clair', () => {
    // .flow (Identité 5 écrans & Lignées 5 onglets)
    expect(v8Source).toMatch(/\.flow\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(v8Source).toMatch(/\.flow\s*\{[^}]*backdrop-filter:\s*blur\(28px\)/);
    expect(v8Source).toMatch(/\.flow button\.cur\s*\{[^}]*background:\s*(#ffffff|linear-gradient)/);

    // .segc (Compte & Activité 3 onglets)
    expect(v8Source).toMatch(/\.segc\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(v8Source).toMatch(/\.segc\s*\{[^}]*backdrop-filter:\s*blur\(28px\)/);
    expect(v8Source).toMatch(/\.segc button\.(active|cur)[^{]*\{[^}]*background:\s*(#ffffff|linear-gradient)/);
    expect(v8Source).toMatch(/\.segc\s*\{[^}]*display:\s*flex/);
    expect(v8Source).toMatch(/\.segc \.th\s*\{[^}]*background:\s*linear-gradient/);

    // .reseau-toggle (Abonnés & Abonnements)
    expect(v8Source).toMatch(/\.reseau-toggle\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(v8Source).toMatch(/\.reseau-toggle\s*\{[^}]*backdrop-filter:\s*blur\(28px\)/);
    expect(v8Source).toMatch(/\.reseau-toggle button\.active\s*\{[^}]*background:\s*(#ffffff|linear-gradient)/);
    expect(v8Source).toMatch(/\.reseau-toggle\s*\{[^}]*display:\s*flex/);

    // Pas de boîte noire en dark mode
    expect(v8Source).not.toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[^}]*\.flow\s*\{[^}]*background:\s*rgba\(28/);
    expect(v8Source).not.toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[^}]*\.segc\s*\{[^}]*background:\s*rgba\(28/);
  });

  it('7. Invariant : 0 modification de style dans /compas (la migration des icônes LKDV V2 touche le code, pas le design)', () => {
    try {
      const diffCompas = execSync("git diff --name-only origin/main -- ':(glob)src/app/compas/**/*.css' ':(glob)src/features/compas/**/*.css'", { encoding: 'utf8' }).trim();
      expect(diffCompas).toBe('');
    } catch (_) {
      const statusCompas = execSync("git status --porcelain -- ':(glob)src/app/compas/**/*.css' ':(glob)src/features/compas/**/*.css'", { encoding: 'utf8' }).trim();
      expect(statusCompas).toBe('');
    }
  });
});
