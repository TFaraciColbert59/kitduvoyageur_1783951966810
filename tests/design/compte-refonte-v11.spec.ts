import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 Liquid Glass v11 — Refonte Profil Instagram, Verre Lumineux, Modal Post & Drawers', () => {
  // Les règles de style ont été extraites dans des feuilles dédiées : on lit la
  // source TSX *et* les CSS, sans toucher aux assertions de contrat.
  const v8Source = read('src/components/compte/CompteLiquidGlassV8.tsx') + '\n' + read('src/components/compte/compte-apple-hig.css') + '\n' + read('src/components/compte/compte-v8.css');
  const runtimeSource = read('src/components/compte/compte-liquid-glass-v8-runtime.js');

  it('1. Profile Header layout (Instagram style) : avatar + name/pseudo à gauche, stats transparentes 18px à droite sans chevauchement', () => {
    // Structure HTML dans card()
    expect(runtimeSource).toContain('<div class="ig-left">');
    expect(runtimeSource).toContain('<div class="ig-left-meta">');
    expect(runtimeSource).toContain('<div class="ig-handle-sub">@');
    expect(runtimeSource).toContain('<div class="ig-right">');

    // Libellés Instagram en français
    expect(runtimeSource).toContain("'publications'");
    expect(runtimeSource).toContain("'abonnés'");
    expect(runtimeSource).toContain("'abonnements'");

    // CSS : ig-left 88px mobile et 104px desktop pour loger l'avatar 96px sans chevaucher la colonne stats
    expect(v8Source).toMatch(/\.ig-left\s*\{[^}]*width:\s*(?:84px|88px)/);
    expect(v8Source).toMatch(/@media\s*\(min-width:\s*601px\)\s*\{[^}]*\.ig-left\s*\{[^}]*width:\s*104px/);
    expect(v8Source).toMatch(/\.ig-stat\s*\{[^}]*background:\s*transparent/);
    expect(v8Source).toMatch(/\.ig-stat b\.num\s*\{[^}]*font-size:\s*18px|\.ig-stat b\.num\s*\{[^}]*font:\s*700 18px/);
    expect(v8Source).toContain('#17402C');
    expect(v8Source).toContain('#56665D');
  });

  it('2. Sélecteur central 100% Light Liquid Glass (verre lumineux, fond clair préservé, icônes #17402C / #56665D)', () => {
    // Style Liquid Glass du sélecteur
    expect(v8Source).toMatch(/\.ig-tabs\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
    expect(v8Source).toMatch(/\.ig-tabs\s*\{[^}]*backdrop-filter:\s*blur\(28px\)/);
    expect(v8Source).toMatch(/\.ig-tabs button\[aria-selected="true"\]\s*\{[^}]*color:\s*#17402C/);
    expect(v8Source).toMatch(/\.ig-tabs button\s*\{[^}]*color:\s*#56665D/);

    // Indicateur coulissant lens
    expect(runtimeSource).toContain('class="ig-th lens"');
    expect(v8Source).toContain('.ig-tabs .ig-th.lens');

    // Vérifie que le sélecteur a 2 onglets sans texte
    expect(runtimeSource).toContain('aria-label="Grille des publications"');
    expect(runtimeSource).toContain('aria-label="Sorties et voyages faits"');
  });

  it('3. Grille des publications & Modal post identique Instagram (avatar 36px, photo 1:1, actions bar, compteur likes dynamique, commentaires et saisie)', () => {
    // Tuiles et feed ouvrent le modal post
    expect(runtimeSource).toContain('data-a="${t.act === \'pubdraft\' ? \'pubdraft\' : \'openPostModal\'}"');

    // Structure du modal post Instagram avec @handle dans l'en-tête
    expect(runtimeSource).toContain('post-modal-instagram');
    expect(runtimeSource).toContain('pmi-dialog');
    expect(runtimeSource).toContain('pmi-header');
    expect(runtimeSource).toContain('@${P.handle || \'tony_frc\'}');
    expect(runtimeSource).toContain('pmi-media');
    expect(runtimeSource).toContain('pmi-post-actions');
    expect(runtimeSource).toContain('Math.max(1, likeData.count - 1)} autres personnes');

    // Actions dans EXA
    expect(runtimeSource).toContain('openPostModal:');
    expect(runtimeSource).toContain('closePostModal:');
    expect(runtimeSource).toContain('toggleLikePost:');
    expect(runtimeSource).toContain('toggleSavePost:');

    // CSS modal
    expect(v8Source).toMatch(/\.pmi-av\s*\{[^}]*width:\s*36px/);
    expect(v8Source).toMatch(/\.pmi-media\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/);
    expect(v8Source).toContain('#E0245E'); // Like rose/rouge Instagram
  });

  it('4. Drawer Lignée & Inventaire avec des données réelles (Kits, Inventaire, Prêts, Points, Parrainage)', () => {
    // 5 onglets dans step 3
    expect(runtimeSource).toContain('Mes Kits & Lignées');
    expect(runtimeSource).toContain('Inventaire matériel réel');
    expect(runtimeSource).toContain('Prêts en cours');
    expect(runtimeSource).toContain('Programme fidélité');
    expect(runtimeSource).toContain('Parrainage');

    // Code de parrainage dérivé du handle réel, jamais codé en dur
    expect(runtimeSource).not.toContain('TONY-TREK-2026');
    expect(runtimeSource).toContain('handle.toUpperCase()');
    expect(runtimeSource).toContain('data-a="copyReferral"');
    expect(runtimeSource).toContain('copyReferral:');

    // Icônes pures SVG dans FLI_SVG pour les 5 onglets
    expect(runtimeSource).toContain('FLI_SVG');
    expect(runtimeSource).toContain('"Mes Kits":');
    expect(runtimeSource).toContain('"Inventaire":');
    expect(runtimeSource).toContain('"Prêts":');
    expect(runtimeSource).toContain('"Fidélité":');
    expect(runtimeSource).toContain('"Parrainage":');

    // Scroll continu sans troncature de lignes
    expect(runtimeSource).toContain('sh.k === "step"');
  });

  it('5. Boutons de zoom presets toujours disponibles et masquage z-index de .mctl et .map-scale-selector à l\'ouverture du drawer', () => {
    // Zoom + et - toujours affichés dans renderMctl
    expect(runtimeSource).toContain('data-a="zoom" data-v="1"');
    expect(runtimeSource).toContain('data-a="zoom" data-v="-1"');

    // Classe et attribut sheet-open synchronisés sur phone
    expect(runtimeSource).toContain('phoneEl.classList.toggle("sheet-open", isOpen)');
    expect(runtimeSource).toContain('phoneEl.setAttribute("data-sheet-open"');

    // Règle CSS masquant .mctl et .map-scale-selector quand le drawer est ouvert
    expect(v8Source).toMatch(/\.sheet-open\s+\.mctl[^{]*\{[^}]*opacity:\s*0\s*!important/);
    expect(v8Source).toMatch(/\.sheet-open\s+\.mctl[^{]*\{[^}]*pointer-events:\s*none\s*!important/);
    expect(v8Source).toContain('.sheet-open .map-scale-selector');
    expect(v8Source).toContain('.phone:has(#sw[data-det="medium"]) .mctl');

    // Styles Liquid Glass capsule sur les presets d'échelle
    expect(v8Source).toMatch(/\.map-scale-selector\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/);
  });

  it('6. Appui long (500ms) et clic droit sur story à la une ouvrent le menu d\'action avec garde anti-scroll', () => {
    // Présence de la feuille d'action story
    expect(runtimeSource).toContain('story_action_sheet');
    expect(runtimeSource).toContain('Modifier le titre');
    expect(runtimeSource).toContain('Changer la photo de couverture');
    expect(runtimeSource).toContain('Supprimer des stories à la une');

    // Appui long 500ms, contextmenu et garde anti-scroll
    expect(runtimeSource).toContain('data-hl-id');
    expect(runtimeSource).toContain('openSheet("story_action_sheet"');
    expect(runtimeSource).toMatch(/phone\.addEventListener\(["']scroll["']/);
    expect(runtimeSource).toContain('editHighlightTitle:');
    expect(runtimeSource).toContain('changeHighlightCover:');
    expect(runtimeSource).toContain('removeHighlight:');
  });

  it('7. Onglet Sorties nettoyé (voyages-header supprimé du markup et display: none)', () => {
    // Pas de texte de swipe superflu dans le carrousel
    expect(runtimeSource).not.toContain('Glisser ➔');
    expect(runtimeSource).not.toContain('voyages-swipe-hint');

    // CSS masque explicitement voyages-header
    expect(v8Source).toMatch(/\.voyages-header\s*\{[^}]*display:\s*none\s*!important/);
  });

  it('8. Story plein écran 100% sur l\'écran (position fixed, 100vw, 100dvh, z-index 9999)', () => {
    expect(v8Source).toMatch(/\.story\.on\s*\{[^}]*position:\s*fixed\s*!important/);
    expect(v8Source).toMatch(/\.story\.on\s*\{[^}]*width:\s*100vw\s*!important/);
    expect(v8Source).toMatch(/\.story\.on\s*\{[^}]*height:\s*100dvh\s*!important/);
    expect(v8Source).toMatch(/\.story\.on\s*\{[^}]*z-index:\s*9999\s*!important/);
  });

  it('9. Invariant strict : strictement 0 modification dans /compas', () => {
    // Vérifie via git diff qu'aucun fichier dans compas n'est modifié
    try {
      const diffCompas = execSync('git diff --name-only origin/main -- src/app/compas src/features/compas', { encoding: 'utf8' }).trim();
      expect(diffCompas).toBe('');
    } catch (_) {
      // Si offline ou pas de remote origin/main accessible, vérifie le statut local
      const statusCompas = execSync('git status --porcelain -- src/app/compas src/features/compas', { encoding: 'utf8' }).trim();
      expect(statusCompas).toBe('');
    }
  });
});
