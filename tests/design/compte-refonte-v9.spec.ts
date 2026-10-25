import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 Liquid Glass v9 — Refonte Complète', () => {
  const v8Source = read('src/components/compte/CompteLiquidGlassV8.tsx');
  const runtimeSource = read('src/components/compte/compte-liquid-glass-v8-runtime.js');

  it('1. Supprime les filtres de grille (.ig-filt) et le bouton Tribu dans les actions', () => {
    expect(runtimeSource).not.toContain('<div class="ig-filt">');
    expect(v8Source).not.toContain('class="ig-filt"');
    // Le 3e bouton "Tribu" n'est plus dans ig-actions
    expect(runtimeSource).not.toContain('>Tribu</button>');
  });

  it('2. Enforce des sélecteurs à icônes pures (aucun texte dans .ig-tabs ni .map-scale-selector)', () => {
    // Les onglets de profil contiennent des svg, pas de texte 'Grille', 'Sorties', 'Lignées', 'Tribu'
    expect(runtimeSource).not.toContain('<span>Grille</span>');
    expect(runtimeSource).not.toContain('<span>Sorties</span>');
    expect(runtimeSource).not.toContain('<span>Lignées</span>');
    expect(runtimeSource).not.toContain('<span>Tribu</span>');

    // Le sélecteur d'échelle de carte n'a pas de texte ORBITE, MASSIF, SENTIER
    expect(v8Source).not.toContain('>ORBITE</button>');
    expect(v8Source).not.toContain('>MASSIF</button>');
    expect(v8Source).not.toContain('>SENTIER</button>');
  });

  it('3. Supprime définitivement Mission Control et la barre de données .acc flottante', () => {
    expect(v8Source).not.toContain('MISSION CONTROL');
    expect(v8Source).not.toContain('class="btn-3d-fullscreen"');
    expect(v8Source).not.toContain('id="acc"');
  });

  it('4. Le dépliant pseudo en haut à gauche affiche un popover avec uniquement "Se déconnecter"', () => {
    expect(runtimeSource).toContain('Se déconnecter');
    expect(runtimeSource).toContain('signout');
  });

  it('5. Le bouton plus ouvre une sheet de création complète multi-objets', () => {
    expect(runtimeSource).toContain('openCreate');
    expect(runtimeSource).toContain('Nouveau carnet de voyage');
    expect(runtimeSource).toContain('Nouveau kit de matériel');
  });

  it('6. Le bouton en haut à droite ouvre un drawer avec Commandes, Notifications et Paramètres', () => {
    expect(runtimeSource).toContain('openDrawer');
    expect(runtimeSource).toContain('Mes Commandes');
    expect(runtimeSource).toContain('Notifications');
    expect(runtimeSource).toContain('Paramètres');
  });

  it('7. L\'onglet Voyages affiche un carrousel horizontal (.voyages-carousel)', () => {
    expect(runtimeSource).toContain('voyages-carousel');
    expect(runtimeSource).toContain('voyage-card');
  });

  it('8. L\'onglet Réseau affiche un toggle Abonnements / Abonnés', () => {
    expect(runtimeSource).toContain('reseau-toggle');
    expect(runtimeSource).toContain('Abonnements');
    expect(runtimeSource).toContain('Abonnés');
  });

  it('9. La sheet "Modifier le profil" permet d\'éditer tout le profil', () => {
    expect(runtimeSource).toContain('edit_profile_full');
    expect(runtimeSource).toContain('Allure de marche');
    expect(runtimeSource).toContain('Terrain');
    expect(runtimeSource).toContain('Autonomie');
  });

  it('10. Le calque SVG #tm est masqué pour laisser voir le Globe 3D sans obstruction', () => {
    expect(v8Source).toContain('#tm{display:none');
  });
});
