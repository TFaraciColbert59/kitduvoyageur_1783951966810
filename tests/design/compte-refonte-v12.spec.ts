import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 Liquid Glass v12 — Header Épuré, Sélecteur Haut-Droite, Actions dans Drawer, Carte 3D Fiabilisée & Post Téléportation', () => {
  const v8Source = read('src/components/compte/CompteLiquidGlassV8.tsx');
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

    // Positionnement en haut à droite de la card
    expect(v8Source).toMatch(/\.ig-tabs\s*\{[^}]*position:\s*absolute/);
    expect(v8Source).toMatch(/\.ig-tabs\s*\{[^}]*right:\s*(12|14)px/);
    expect(v8Source).toMatch(/\.ig-tabs\s*\{[^}]*top:\s*(10|12|14)px/);
    expect(v8Source).toMatch(/\.ig-tabs\s*\{[^}]*width:\s*88px/);

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
    expect(drawerBody).toContain('data-a="editProfile"');
    expect(drawerBody).toContain('Modifier le profil');
    expect(drawerBody).toContain('data-a="shareProfile"');
    expect(drawerBody).toContain('Partager le profil');

    // Vérifier la présence des handlers
    expect(runtimeSource).toContain('case "editProfile":');
    expect(runtimeSource).toContain('case "shareProfile":');
  });

  it('4. Post Detail en drawer overlay superposé laissant la carte visible + téléportation 3D sur le lieu exact', () => {
    // Drawer overlay superposé sur la partie haute (ne couvre pas tout l'écran, carte visible en dessous)
    expect(v8Source).toMatch(/\.post-modal-instagram\s*\{[^}]*bottom:\s*calc\(40%/);
    expect(v8Source).toMatch(/\.pmi-dialog\s*\{[^}]*border-radius:\s*(28|32)px/);

    // Téléportation 3D de la caméra dans openPostModal
    expect(runtimeSource).toContain('openPostModal: (id) =>');
    expect(runtimeSource).toContain('window.__lkdvCompteMap3D.flyTo');
    expect(runtimeSource).toContain('6.8894');
    expect(runtimeSource).toContain('45.9812');
    expect(runtimeSource).toContain('zoom: 14.2');
    expect(runtimeSource).toContain('pitch: 65');
    expect(runtimeSource).toContain('bearing: -20');

    // Notification Dynamic Island du lieu et altitude
    expect(runtimeSource).toContain('Altitude');
    expect(runtimeSource).toContain('Lac Blanc');
  });

  it('5. Fiabilisation totale de la carte vivante 3D (ResizeObserver, watchers t=50/200/500/1200ms, fond #0b101b, calques 3D complets)', () => {
    // ResizeObserver natif sur #maplibre-compte-canvas
    expect(runtimeSource).toContain('ResizeObserver');
    expect(runtimeSource).toContain('ro.observe(container)');
    expect(runtimeSource).toContain('map.resize()');

    // Déclencheurs programmés
    expect(runtimeSource).toContain('50');
    expect(runtimeSource).toContain('200');
    expect(runtimeSource).toContain('500');
    expect(runtimeSource).toContain('1200');

    // Fond solide #0b101b anti-écran blanc et calques MapLibre
    expect(v8Source).toContain('#0b101b');
    expect(runtimeSource).toContain('#0b101b');
    expect(runtimeSource).toContain('background-layer');
    expect(runtimeSource).toContain('satellite-layer');
    expect(runtimeSource).toContain('hillshade-layer');
    expect(runtimeSource).toContain('compte-tmb-track');

    // Marqueurs 5 massifs, POIs sommets/refuges et photos géolocalisées
    expect(runtimeSource).toContain('massif-marker-3d');
    expect(runtimeSource).toContain('poi-marker-3d');
    expect(runtimeSource).toContain('photo-marker-3d');
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

    // .reseau-toggle (Abonnés & Abonnements)
    expect(v8Source).toMatch(/\.reseau-toggle\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(v8Source).toMatch(/\.reseau-toggle\s*\{[^}]*backdrop-filter:\s*blur\(28px\)/);
    expect(v8Source).toMatch(/\.reseau-toggle button\.active\s*\{[^}]*background:\s*(#ffffff|linear-gradient)/);

    // Pas de boîte noire en dark mode
    expect(v8Source).not.toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[^}]*\.flow\s*\{[^}]*background:\s*rgba\(28/);
    expect(v8Source).not.toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[^}]*\.segc\s*\{[^}]*background:\s*rgba\(28/);
  });

  it('7. Invariant strict : strictement 0 modification dans /compas', () => {
    try {
      const diffCompas = execSync('git diff --name-only origin/main -- src/app/compas src/features/compas', { encoding: 'utf8' }).trim();
      expect(diffCompas).toBe('');
    } catch (_) {
      const statusCompas = execSync('git status --porcelain -- src/app/compas src/features/compas', { encoding: 'utf8' }).trim();
      expect(statusCompas).toBe('');
    }
  });
});
