import { describe, expect, it } from 'vitest';
import { famousTrailIn, isNamedTrail, parseIntentRules } from '../engine/intent';
import { understandRequest } from '../engine/request';
import { leadingProperName, subPlaceQueries } from '../engine/places';

/**
 * Relecture 3 de la PR #108 (23 oct.) : une expression régulière dont le séparateur (« - ») était aussi une
 * lettre du mot essayait 2^n découpages quand la suite manquait (« de Ab-Ab-… x » : 10 s pour 94 caractères,
 * 3 min pour 100). La lecture tourne au serveur (phrase de 280 caractères) et à chaque frappe dans le Compas
 * vide : une phrase de 300 caractères, quelle qu'elle soit, se lit en moins de 50 ms.
 */
const TODAY = '2026-10-23';
const rep = (s: string, n: number) => s.repeat(n);

/** Le plus court de trois essais (le premier essai paie la mise en route), en ms. */
function fastest(f: () => unknown): number {
  let best = Infinity;
  for (let i = 0; i < 3; i += 1) {
    const t = performance.now();
    f();
    best = Math.min(best, performance.now() - t);
  }
  return best;
}

describe('lecture de la demande : jamais d’explosion sur une phrase hostile', () => {
  it('« de Ab-Ab-… x » (120 maillons) : lu en moins de 50 ms, au serveur comme à l’écran', () => {
    const text = 'de ' + rep('Ab-', 120) + ' x';
    expect(fastest(() => parseIntentRules(text, TODAY, 'fr'))).toBeLessThan(50);
    expect(fastest(() => parseIntentRules(text, TODAY, 'fr', { activity: 'hiking' }))).toBeLessThan(50);
    expect(fastest(() => understandRequest(text, TODAY, {}, 'fr'))).toBeLessThan(50);
  });

  // Toutes les formes « nom propre à tirets » derrière les lectures de la phrase, et quelques autres
  // répétitions, coupées à 300 caractères.
  const HOSTILE: Record<string, string> = {
    'de X à Y sans à': 'de ' + rep('Ab-', 100) + ' x',
    'de X à Y, tirets et espaces': 'de ' + rep('Ab- ', 80) + ' x',
    'de X à Y, apostrophes': 'de ' + rep("Ab'-", 80) + ' x',
    'lieu en tête sans durée': rep('Ab-', 100) + ' x',
    'lieu en tête, « de »': rep('Ab-de-', 60) + ' x',
    'près de': 'rando dans les Alpes près de ' + rep('Ab-', 90) + ' x',
    'au pays, à la ville': 'au Maroc à ' + rep('Ab-', 95) + ' x',
    'au départ de': 'au départ de ' + rep('Ab-', 95) + ' x',
    'depuis': 'depuis ' + rep('Ab-', 98) + ' x',
    'dernier recours': 'alpinisme 4 jours ' + rep('Ab-', 95) + ' x',
    'dernier recours, « de la »': 'alpinisme 4 jours ' + rep('Ab de la ', 32) + ' x',
    'nom commun de lieu': rep('lac de ', 42) + 'Ab à Cd',
    'du nom commun': 'du ' + rep('lac de Ab ', 29) + 'à Cd',
    'sur le sentier': 'sur le ' + rep('a ', 145) + 'x',
    'GR20 est': 'le GR20 ' + rep('est ', 72),
    'anglais': 'trip to ' + rep('Ab-', 97) + ' x',
    'anglais, mots': 'hiking in the ' + rep('Ab ', 95) + 'x',
    'prénoms': 'avec ma femme, ' + rep('Paul et ', 35) + 'x',
    'tour du': 'tour du ' + rep('Ab-', 97) + ' x',
    'minuscules': 'randoo dans les ' + rep('ab ', 95) + 'x',
    // Mots sans lettre (relecture sécurité, 24 oct.) : `subPlaceQueries` en faisait des milliers de morceaux.
    'points médians': rep('· ', 150),
    'emoji': rep('🏔️ ', 100),
  };
  for (const [name, raw] of Object.entries(HOSTILE)) {
    it(`${name} (300 caractères) : moins de 50 ms`, () => {
      const text = raw.slice(0, 300);
      expect(fastest(() => parseIntentRules(text, TODAY, 'fr')), 'fr').toBeLessThan(50);
      expect(fastest(() => parseIntentRules(text, TODAY, 'en')), 'en').toBeLessThan(50);
      expect(fastest(() => understandRequest(text, TODAY, {}, 'fr')), 'écran').toBeLessThan(50);
      expect(fastest(() => [famousTrailIn(text), isNamedTrail(text), leadingProperName(text), subPlaceQueries(text)]), 'lieux').toBeLessThan(50);
    });
  }

  it('les noms à tirets restent lus (« Saint-Jean-Pied-de-Port », « Boulogne-sur-Mer »)', () => {
    const route = (t: string) => {
      const r = parseIntentRules(t, TODAY);
      const o = r.find((a) => a.type === 'set_origin');
      const d = r.find((a) => a.type === 'set_destination');
      return [o?.type === 'set_origin' ? o.place : null, d?.type === 'set_destination' ? d.place.split(',')[0] : null];
    };
    expect(route('rando de Saint-Jean-Pied-de-Port à Roncevaux')).toEqual(['Saint-Jean-Pied-de-Port', 'Roncevaux']);
    expect(route('à vélo de Calais à Boulogne-sur-Mer')).toEqual(['Calais', 'Boulogne-sur-Mer']);
    expect(route('rando de Le Monastier à Saint-Jean-du-Gard')).toEqual(['Le Monastier', 'Saint-Jean-du-Gard']);
    expect(parseIntentRules('Saint-Malo 3 jours', TODAY)).toContainEqual({ type: 'set_destination', place: 'Saint-Malo' });
  });
});
