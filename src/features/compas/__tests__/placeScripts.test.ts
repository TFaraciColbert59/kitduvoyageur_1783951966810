import { describe, expect, it } from 'vitest';
import { matchKey, scriptKey } from '../engine/nameKey';
import { aliasMatches, homonymsFarApart, pickDestination, samePlaceName, type CompasPlace } from '../engine/places';
import { mergeReferential } from '../engine/geoPlaces';

/**
 * Noms en écriture non latine (cyrillique, arabe, chinois, devanagari…) : la clé latine d'avant
 * (`[^a-z0-9]` → espace) les réduisait tous à « », si bien qu'aucune recherche ne retrouvait
 * « Москва » et que deux villages arabes voisins passaient pour le même. `matchKey` garde la clé
 * latine d'avant à l'identique dès qu'elle n'est pas vide, et sinon replie l'écriture d'origine
 * (casse, signes diacritiques, voyelles courtes arabes) sans rien translittérer.
 */

const place = (name: string, over: Partial<CompasPlace> = {}): CompasPlace => ({
  name,
  lat: 55.75,
  lon: 37.61,
  countryCode: 'RU',
  country: null,
  kind: 'city',
  settlement: true,
  settlementRank: 5,
  extent: null,
  ...over,
});

describe('matchKey : la clé latine d’avant, sinon l’écriture d’origine repliée', () => {
  it('latin : exactement la clé d’avant (accents, casse, ponctuation)', () => {
    const legacy = (v: string) =>
      v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    for (const v of ['Genève', 'Saint-Étienne', 'Tromsø', 'Łódź', 'Straße', 'Imlil ⵉⵎⵍⵉⵍ إمليل', "L'Isle", 'Hà Nội', 'Ærø', '12'])
      expect(matchKey(v)).toBe(legacy(v));
  });
  it('cyrillique, arabe, chinois, grec, devanagari : une clé non vide, propre à chaque nom', () => {
    expect(scriptKey('Москва')).toBe('москва');
    expect(scriptKey('МОСКВА')).toBe('москва');
    expect(scriptKey('Санкт-Петербург')).toBe('санкт петербург');
    expect(scriptKey('Йошкар-Ола')).toBe(scriptKey('Иошкар-Ола'));
    // Voyelles courtes et hamza (signes) : « مُرَّاكُش » et « مراكش » sont le même nom.
    expect(scriptKey('مُرَّاكُش')).toBe(scriptKey('مراكش'));
    expect(scriptKey('أكادير')).toBe(scriptKey('اكادير'));
    expect(scriptKey('北京')).toBe('北京');
    expect(scriptKey('Αθήνα')).toBe('αθηνα');
    expect(scriptKey('स्याफ्रु बेसी')).not.toBe('');
    expect(matchKey('Москва')).not.toBe(matchKey('Химки'));
    expect(matchKey('  ')).toBe('');
  });
});

describe('correspondance des noms non latins', () => {
  it('pickDestination retrouve « Москва » sous ce nom (avant : rien)', () => {
    expect(pickDestination([place('Moscow'), place('Москва')], 'москва')?.name).toBe('Москва');
    expect(pickDestination([place('Moscow')], 'Москва')).toBeNull();
  });
  it('un nom latin ne correspond jamais à un nom non latin', () => {
    expect(pickDestination([place('Москва')], 'Moskva')).toBeNull();
    expect(samePlaceName('Moskva', 'Москва')).toBe(false);
  });
  it('samePlaceName, aliasMatches, homonymes : même règle', () => {
    expect(samePlaceName('القاهرة', 'القاهرة')).toBe(true);
    expect(samePlaceName('القاهرة', 'الجيزة')).toBe(false);
    expect(aliasMatches(place('Moscow', { aliases: ['Москва'] }), 'Москва')).toBe(true);
    expect(homonymsFarApart([place('Москва'), place('Москва', { lat: 40, lon: 0 })], 'Москва')).toBe(true);
  });
  it('mergeReferential : deux lieux non latins voisins de noms différents restent deux', () => {
    const ref = [{ id: 'g1', name: 'إمليل', lat: 31.137, lon: -7.919, kind: 'village' as const, population: 1500, eleM: null }];
    const merged = mergeReferential(ref, [
      { id: 'n2', name: 'أرمد', lat: 31.125, lon: -7.91, kind: 'village', population: null, eleM: null },
      { id: 'n3', name: 'إمليل', lat: 31.14, lon: -7.93, kind: 'village', population: null, eleM: null },
    ]);
    expect(merged.map((p) => p.id)).toEqual(['g1', 'n2']);
  });
});
