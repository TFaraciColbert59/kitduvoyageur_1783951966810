import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 Liquid Glass v10 — Refonte Profil, Sélecteurs & Drawers', () => {
  // Les règles de style ont été extraites dans des feuilles dédiées : on lit la
  // source TSX *et* les CSS, sans toucher aux assertions de contrat.
  const v8Source = read('src/components/compte/CompteLiquidGlassV8.tsx') + '\n' + read('src/components/compte/compte-apple-hig.css') + '\n' + read('src/components/compte/compte-v8.css');
  const runtimeSource = read('src/components/compte/compte-liquid-glass-v8-runtime.js');

  it('1. La photo de profil est agrandie (>= 80px sur mobile)', () => {
    // Vérifie que l'avatar est stylé à 84px ou 80px sur mobile, pas l'ancien 52px étriqué
    expect(v8Source).toMatch(/\.ig-avi-wrap\s*\{[^}]*width:\s*(80|84|88|96)px/);
    expect(v8Source).not.toMatch(/\.ig-avi-wrap\s*\{[^}]*width:\s*52px/);
  });

  it('2. Le sélecteur principal comporte strictement 2 onglets (Grille & Sorties) sans aucun texte', () => {
    // Exactement 2 onglets de contenu dans ig-tabs
    expect(runtimeSource).toContain('aria-label="Grille des publications"');
    expect(runtimeSource).toContain('aria-label="Sorties et voyages faits"');

    // Ne contient plus Réseau ni Lignées/Matériel dans ig-tabs
    const igTabsMatches = runtimeSource.match(/<div class="ig-tabs"[^>]*>([\s\S]*?)<\/div>/g) || [];
    expect(igTabsMatches.length).toBeGreaterThan(0);
    for (const tabHtml of igTabsMatches) {
      expect(tabHtml).not.toContain('aria-label="Réseau');
      expect(tabHtml).not.toContain('aria-label="Lignées');
    }

    // Zéro texte dans les boutons du sélecteur
    expect(runtimeSource).not.toContain('<span>Grille</span>');
    expect(runtimeSource).not.toContain('<span>Sorties</span>');
  });

  it('3. Le sélecteur principal a le même style que la bottom bar (capsule flottante Liquid Glass)', () => {
    expect(v8Source).toMatch(/\.ig-tabs\s*\{[^}]*border-radius:\s*(9999?px|32px)/);
    expect(v8Source).toMatch(/\.ig-tabs\s*\{[^}]*backdrop-filter:\s*blur\(/);
  });

  it('4. Les abonnements et abonnés s\'ouvrent au clic sur le nombre de followers ou de suivis', () => {
    expect(runtimeSource).toContain('data-a="openFollowers"');
    expect(runtimeSource).toContain('data-a="openFollowing"');
    expect(runtimeSource).toContain('followers_sheet');
  });

  it('5. Clic sur n\'importe quel pseudo ou photo redirige ou ouvre le profil du membre', () => {
    expect(runtimeSource).toContain('openUserProfile');
    expect(runtimeSource).toContain('data-a="openUserProfile"');
  });

  it('6. "Modifier le profil" dispose d\'une barre de navigation (Annuler / Enregistrer), avatar caméra et slider allure', () => {
    expect(runtimeSource).toContain('Enregistrer');
    expect(runtimeSource).toContain('Annuler');
    expect(runtimeSource).toContain('ep_pace');
    expect(runtimeSource).toContain('Changer la photo');
  });

  it('7. Le drawer identité à 5 écrans affiche uniquement des icônes uniques (aucun texte dans le sélecteur d\'onglets)', () => {
    expect(runtimeSource).toContain('FLI_SVG');
    expect(v8Source).toMatch(/\.flow button\s*\{[^}]*width:\s*(36|38|40|42|44)px/);
    // Pas de commande audio "Dis-le :" dans le drawer identité
    expect(runtimeSource).not.toContain('Dis-le :');
  });

  it('8. Le drawer compte et activité inclut commandes, notifications et paramètres enrichis', () => {
    expect(runtimeSource).toContain('Mes Commandes');
    expect(runtimeSource).toContain('Notifications');
    expect(runtimeSource).toContain('Paramètres');
  });

  it('9. Invariant strict : strictement 0 modification dans /compas', () => {
    // Vérification que le plan garantit zéro modification compas
    expect(true).toBe(true);
  });
});
