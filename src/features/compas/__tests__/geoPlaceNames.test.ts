import { describe, expect, it } from 'vitest';
import {
  createPlaceNameCollector,
  DEFAULT_NAME_LANGS,
  localPlaceName,
  parseAlternateNameLine,
  parseNameLangs,
} from '../engine/geoPlaceNames';
import { placeNameKey } from '../engine/geoPlaceSearch';

/** Une ligne d'alternateNamesV2 (10 colonnes, tabulations). */
function alt(
  id: number,
  place: number,
  lang: string,
  name: string,
  flags: { preferred?: boolean; short?: boolean; colloquial?: boolean; historic?: boolean; from?: string; to?: string } = {}
): string {
  return [
    String(id),
    String(place),
    lang,
    name,
    flags.preferred ? '1' : '',
    flags.short ? '1' : '',
    flags.colloquial ? '1' : '',
    flags.historic ? '1' : '',
    flags.from ?? '',
    flags.to ?? '',
  ].join('\t');
}

const VIENNA = 2761369;
const LANGS = new Set(['fr', 'en', 'de', 'ru', 'ja']);

describe('placeNameKey (toutes écritures)', () => {
  it('clé latine d’avant quand elle existe, sinon l’écriture d’origine, sans translittération', () => {
    expect(placeNameKey('Villard-de-Lans')).toBe('villard de lans');
    expect(placeNameKey('Bâle')).toBe('bale');
    expect(placeNameKey('Москва')).toBe('москва');
    expect(placeNameKey('東京')).toBe('東京');
    expect(placeNameKey('Москва')).not.toBe(placeNameKey('Moskva'));
  });
});

describe('parseNameLangs', () => {
  it('défaut : les langues de l’interface ; codes ISO 639 de 2 ou 3 lettres seulement', () => {
    expect([...DEFAULT_NAME_LANGS]).toEqual(['fr', 'en', 'es', 'de', 'it']);
    expect([...parseNameLangs('fr, RU,ja')]).toEqual(['fr', 'ru', 'ja']);
    expect(() => parseNameLangs('fr,link')).toThrow();
    expect(() => parseNameLangs('fr_1793')).toThrow();
  });
});

describe('parseAlternateNameLine', () => {
  it('lit un nom d’une langue retenue', () => {
    expect(parseAlternateNameLine(alt(1, VIENNA, 'fr', 'Vienne', { preferred: true }), LANGS)).toEqual({
      name: {
        alternate_name_id: 1,
        place_id: VIENNA,
        lang: 'fr',
        name: 'Vienne',
        name_key: 'vienne',
        is_preferred: true,
        is_short: false,
      },
    });
  });
  it('écarte pseudo-langues, langues non retenues, noms familiers ou historiques, lignes illisibles', () => {
    for (const lang of ['', 'link', 'post', 'iata', 'wkdt', 'fr_1793', 'abbr'])
      expect(parseAlternateNameLine(alt(1, VIENNA, lang, 'x y'), LANGS).drop).toBe('hors_langue');
    expect(parseAlternateNameLine(alt(1, VIENNA, 'es', 'Viena'), LANGS).drop).toBe('hors_langue');
    expect(parseAlternateNameLine(alt(1, VIENNA, 'fr', 'Vienne', { colloquial: true }), LANGS).drop).toBe('familier');
    expect(parseAlternateNameLine(alt(1, VIENNA, 'de', 'Vindobona', { historic: true }), LANGS).drop).toBe('historique');
    expect(parseAlternateNameLine(alt(1, VIENNA, 'de', 'Wien', { to: '1918' }), LANGS).drop).toBe('historique');
    expect(parseAlternateNameLine('1\t2', LANGS).drop).toBe('malforme');
    expect(parseAlternateNameLine(alt(1, 0, 'fr', 'Vienne'), LANGS).drop).toBe('malforme');
    expect(parseAlternateNameLine(alt(1, VIENNA, 'fr', '1234'), LANGS).drop).toBe('sans_nom');
    expect(parseAlternateNameLine(alt(1, VIENNA, 'fr', 'x'.repeat(201)), LANGS).drop).toBe('sans_nom');
  });
});

describe('createPlaceNameCollector', () => {
  it('un nom par lieu et par langue : le préféré, puis le non abrégé, puis le plus ancien', () => {
    const c = createPlaceNameCollector(LANGS);
    c.add(alt(30, VIENNA, 'fr', 'Vienne-sur-Danube'));
    c.add(alt(20, VIENNA, 'fr', 'Vienne', { preferred: true }));
    c.add(alt(10, VIENNA, 'fr', 'Vien', { short: true }));
    c.add(alt(40, VIENNA, 'ru', 'Вена'));
    c.add(alt(41, VIENNA, 'ru', 'Wena'));
    c.add(alt(50, VIENNA, 'ja', 'ウィーン', { short: true }));
    const { rows } = c.result(() => 'Vienna');
    expect(rows.map((r) => [r.lang, r.name])).toEqual([
      ['fr', 'Vienne'],
      ['ja', 'ウィーン'],
      ['ru', 'Вена'],
    ]);
  });
  it('jamais de nom identique au nom GeoNames, ni de lieu hors du référentiel', () => {
    const c = createPlaceNameCollector(LANGS);
    c.add(alt(1, VIENNA, 'en', 'Vienna', { preferred: true }));
    c.add(alt(2, VIENNA, 'de', 'Wien', { preferred: true }));
    c.add(alt(3, 999, 'fr', 'Ailleurs'));
    const res = c.result((id) => (id === VIENNA ? 'Vienna' : undefined));
    expect(res.rows.map((r) => r.name)).toEqual(['Wien']);
    expect(res.sameAsGeonames).toBe(1);
    expect(res.outsideReferential).toBe(1);
  });
  it('le préféré égal au nom GeoNames l’emporte : aucun autre nom n’est inventé à sa place', () => {
    const c = createPlaceNameCollector(LANGS);
    c.add(alt(2, VIENNA, 'en', 'Vienna', { preferred: true }));
    c.add(alt(1, VIENNA, 'en', 'Vienne Town'));
    expect(c.result(() => 'Vienna').rows).toEqual([]);
  });
  it('sans référentiel connu (essai) : tout est gardé', () => {
    const c = createPlaceNameCollector(LANGS);
    c.add(alt(1, 5, 'fr', 'Ici'));
    expect(c.result().rows).toHaveLength(1);
  });
});

describe('localPlaceName', () => {
  it('le nom dans la langue demandée s’il existe, sinon le nom GeoNames', () => {
    expect(localPlaceName({ name: 'Vienna', name_local: 'Vienne' })).toBe('Vienne');
    expect(localPlaceName({ name: 'Vienna', name_local: '  ' })).toBe('Vienna');
    expect(localPlaceName({ name: ' Vienna ', name_local: null })).toBe('Vienna');
    expect(localPlaceName({ name: 'Vienna' })).toBe('Vienna');
  });
});
