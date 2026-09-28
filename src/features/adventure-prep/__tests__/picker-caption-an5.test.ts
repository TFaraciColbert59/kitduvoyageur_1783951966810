import { describe, expect, it } from 'vitest';
import { pickerPlaceCaption } from '../components/PrepSetupSheets';
import type { PlaceRef } from '../types';

// AN5 — le tiroir Lieu ne doit pas parler en coordonnees quand il a un nom.
//
// Constat reel (2026-09-28, `proof/N4-03` -> selection de Chamonix) : une fois
// le lieu choisi, la seule ligne lue sous la carte etait
//   « 45.92375° N · 6.86933° E »
// alors que le lieu porte « Chamonix-Mont-Blanc ». La personne voit des
// nombres la ou elle a choisi un nom : elle ne peut plus verifier d'un coup
// d'oeil ce qu elle a selectionne.
//
// Regle : le NOM vient toujours en tete quand on l'a. La position reste
// affichee en second, parce qu'elle est une vraie information — mais elle ne
// remplace plus le nom, et elle ne se presente jamais comme un nom de lieu.
describe('AN5 — legende du point dans le tiroir Lieu', () => {
  const CHAMONIX: PlaceRef = {
    id: 'geo-chamonix-france-45.923-6.869',
    name: 'Chamonix-Mont-Blanc',
    country: 'France',
    lat: 45.92375,
    lon: 6.86933,
  };
  const BARE: PlaceRef = {
    id: 'point-45.9238-6.8693',
    name: '',
    country: '',
    lat: 45.92375,
    lon: 6.86933,
  };
  const COORDS = { lat: 45.92375, lon: 6.86933 };

  it('AN5-01: un lieu nomme est lu par son nom, pas par ses coordonnees', () => {
    const caption = pickerPlaceCaption(CHAMONIX, COORDS, false);
    expect(caption?.label.startsWith('Chamonix-Mont-Blanc')).toBe(true);
    // Le defaut : la coordonnee etait le titre, donc le nom n'existait pas a
    // l'ecran. On verrait des nombres la ou un nom est attendu.
    expect(caption?.label).not.toMatch(/[0-9]/);
  });

  it('AN5-02: le pays accompagne le nom quand on le connait', () => {
    expect(pickerPlaceCaption(CHAMONIX, COORDS, false)?.label).toBe(
      'Chamonix-Mont-Blanc · France',
    );
  });

  it('AN5-03: la position exacte reste lue, en second, quand le nom existe', () => {
    // On ne perd pas l'information : elle descend d'un cran au lieu de
    // disparaitre. C'est la position mesuree, elle reste vraie.
    const caption = pickerPlaceCaption(CHAMONIX, COORDS, false);
    expect(caption?.detail).toContain('45.92375° N');
    expect(caption?.detail).toContain('6.86933° E');
  });

  it('AN5-04: sans nom, la position reste le seul fait vrai et passe en titre', () => {
    // Garde-fou d'honnetete : on ne trouve pas de nom a un point nu. La
    // coordonnee est alors affichee telle quelle, sansonglet « Coordonnees »
    // qui la ferait passer pour une information deja verifiee.
    const caption = pickerPlaceCaption(BARE, COORDS, false);
    expect(caption?.label).toBe('45.92375° N · 6.86933° E');
    expect(caption?.detail).toBeNull();
  });

  it('AN5-05: le nom saisi en mode pose passe en titre des la frappe', () => {
    const caption = pickerPlaceCaption(null, COORDS, true, 'Le col');
    expect(caption?.label).toBe('Le col');
    expect(caption?.detail).toContain('45.92375° N');
  });

  it('AN5-06: un point pose sans nom reste une position, rien de plus', () => {
    const caption = pickerPlaceCaption(null, COORDS, true, '   ');
    expect(caption?.label).toBe('45.92375° N · 6.86933° E');
    expect(caption?.detail).toBeNull();
  });

  it('AN5-07: sans point affiche, aucune legende du tout', () => {
    // Pas de marqueur => la carte affiche deja son propre message
    // (« Touche la carte pour placer le point »). Un doublon serait du bruit.
    expect(pickerPlaceCaption(null, null, true)).toBeNull();
    expect(pickerPlaceCaption(null, null, false)).toBeNull();
  });

  it('AN5-08: un nom qui n est que des espaces ne compte pas comme un nom', () => {
    const caption = pickerPlaceCaption({ ...CHAMONIX, name: '   ' }, COORDS, false);
    expect(caption?.label).toBe('45.92375° N · 6.86933° E');
  });
});
