import { describe, expect, it } from 'vitest';
import { departureFromBrief, pickNamedDeparture, samePlaceName } from '../engine/briefDeparture';

describe('departureFromBrief — le départ écrit dans la phrase', () => {
  it.each([
    [
      'Deux jours dans le Vercors au départ de Villard-de-Lans, nuit au refuge de la Molière',
      'Villard-de-Lans',
    ],
    ['3 jours depuis Chamonix pour voir les glaciers', 'Chamonix'],
    ['départ de Saint Pierre de Chartreuse et retour par les crêtes', 'Saint Pierre de Chartreuse'],
    ['en partant de Annecy vers le Semnoz', 'Annecy'],
    ['Au départ de Gavarnie.', 'Gavarnie'],
  ])('« %s » → %s', (brief, expected) => {
    expect(departureFromBrief(brief)).toBe(expected);
  });

  it.each([
    ['une rando douce au départ du lac'],
    ['un week-end tranquille en bivouac'],
    ['depuis longtemps je rêve du GR20'],
    [''],
  ])('CONTRE-EXEMPLE — « %s » : aucun départ affirmé', (brief) => {
    expect(departureFromBrief(brief)).toBeNull();
  });
});

describe('pickNamedDeparture — la commune posée comme départ', () => {
  const commune = (name: string, lat: number, lon: number) => ({
    name,
    lat,
    lon,
    precision: 'commune' as const,
  });
  const villard = commune('Villard-de-Lans', 45.07, 5.55);

  it('une seule commune du même nom : elle est posée', () => {
    expect(pickNamedDeparture('Villard-de-Lans', [villard], null)).toBe(villard);
  });

  it('une rue ou un nom voisin ne sont jamais posés', () => {
    const rue = { ...villard, name: 'Rue de Villard-de-Lans', precision: 'inexact' as const };
    const voisin = commune('Villard-Bonnot', 45.24, 5.89);
    expect(pickNamedDeparture('Villard-de-Lans', [rue, voisin], null)).toBeNull();
  });

  it('deux réponses pour la même commune ne font pas un homonyme', () => {
    const doublon = commune('Villard de Lans', 45.071, 5.551);
    expect(pickNamedDeparture('Villard-de-Lans', [villard, doublon], null)).toBe(villard);
  });

  it('CONTRE-EXEMPLE — homonymes sans arrivée : rien n’est posé', () => {
    const a = commune('Saint-Pierre', 45.9, 6.2);
    const b = commune('Saint-Pierre', 43.3, 2.1);
    expect(pickNamedDeparture('Saint-Pierre', [a, b], null)).toBeNull();
  });

  it('homonymes avec une arrivée : le plus proche d’elle', () => {
    const a = commune('Saint-Pierre', 45.9, 6.2);
    const b = commune('Saint-Pierre', 43.3, 2.1);
    expect(pickNamedDeparture('Saint-Pierre', [a, b], { lat: 43.4, lon: 2.3 })).toBe(b);
  });
});

describe('samePlaceName', () => {
  it('ignore casse, accents, tirets et espaces', () => {
    expect(samePlaceName('Villard-de-Lans', 'villard de lans')).toBe(true);
    expect(samePlaceName('Saint Pierre de Chartreuse', 'Saint-Pierre-de-Chartreuse')).toBe(true);
    expect(samePlaceName('Rue de Villard de Lans', 'Villard-de-Lans')).toBe(false);
  });
});
