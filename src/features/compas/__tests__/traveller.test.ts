import { describe, expect, it } from 'vitest';
import {
  UNKNOWN_TRAVELLER,
  cleanTravellerFields,
  countryOptions,
  currencyOptions,
  isCountryCode,
  isCurrencyCode,
  isFrenchNational,
  languageOptions,
  languageTag,
  timeZoneOptions,
  travellerFromRow,
  travellerView,
} from '../engine/traveller';
import { travellerToday } from '../engine/zone';

const ROW = {
  user_id: 'u1',
  nationality: 'FR',
  residence_country: 'FR',
  currency: 'EUR',
  language: 'fr',
  time_zone: 'Europe/Paris',
  home_name: 'Lyon',
  home_lat: 45.76,
  home_lon: 4.83,
  home_country: 'FR',
};

describe('contexte voyageur : tout inconnu par défaut, jamais deviné', () => {
  it('sans ligne : chaque champ vaut null', () => {
    expect(UNKNOWN_TRAVELLER).toEqual({
      nationality: null,
      residenceCountry: null,
      currency: null,
      language: null,
      timeZone: null,
      home: null,
    });
    expect(travellerFromRow(null)).toEqual(UNKNOWN_TRAVELLER);
    expect(travellerFromRow('FR')).toEqual(UNKNOWN_TRAVELLER);
    expect(travellerFromRow([ROW])).toEqual(UNKNOWN_TRAVELLER);
  });

  it('ligne complète lue telle quelle', () => {
    expect(travellerFromRow(ROW)).toEqual({
      nationality: 'FR',
      residenceCountry: 'FR',
      currency: 'EUR',
      language: 'fr',
      timeZone: 'Europe/Paris',
      home: { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR' },
    });
  });

  it('lecture défensive : un champ invalide vaut null', () => {
    expect(
      travellerFromRow({
        ...ROW,
        nationality: 'fra',
        residence_country: 'UK',
        currency: 'EURO',
        language: 'français',
        time_zone: 'Mars/Olympus',
        home_country: 'ZZ',
      })
    ).toEqual({
      nationality: null,
      residenceCountry: null,
      currency: null,
      language: null,
      timeZone: null,
      home: { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: null },
    });
    // Un faux client qui rend une autre ligne (`{ metadata }`) : rien.
    expect(travellerFromRow({ metadata: {}, updated_at: 'x' })).toEqual(UNKNOWN_TRAVELLER);
  });

  it('domicile : nom et position obligatoires, position à 0,01° (texte numérique accepté)', () => {
    expect(travellerFromRow({ ...ROW, home_lat: '45.757', home_lon: '4.832' }).home).toEqual({
      name: 'Lyon',
      lat: 45.76,
      lon: 4.83,
      countryCode: 'FR',
    });
    expect(travellerFromRow({ ...ROW, home_lat: null }).home).toBeNull();
    expect(travellerFromRow({ ...ROW, home_lat: 91 }).home).toBeNull();
    expect(travellerFromRow({ ...ROW, home_lon: '' }).home).toBeNull();
    expect(travellerFromRow({ ...ROW, home_name: '  ' }).home).toBeNull();
  });

  it('ce que la personne voit d’elle-même : jamais de coordonnées', () => {
    expect(travellerView(travellerFromRow(ROW))).toEqual({
      nationality: 'FR',
      residenceCountry: 'FR',
      currency: 'EUR',
      language: 'fr',
      timeZone: 'Europe/Paris',
      homeName: 'Lyon',
    });
  });

  it('nationalité française connue, et seulement elle', () => {
    expect(isFrenchNational(travellerFromRow(ROW))).toBe(true);
    expect(isFrenchNational(UNKNOWN_TRAVELLER)).toBe(false);
    expect(isFrenchNational({ nationality: 'BE' })).toBe(false);
  });
});

describe('formats (Intl, aucune liste inventée)', () => {
  it('pays ISO 3166-1 alpha-2 en majuscules, Kosovo compris ; ni UK, ni EU, ni ZZ', () => {
    for (const cc of ['FR', 'GB', 'XK', 'RU', 'MC', 'HK']) expect(isCountryCode(cc), cc).toBe(true);
    for (const cc of ['UK', 'EU', 'ZZ', 'QO', 'fr', 'FRA', '', null, 12]) expect(isCountryCode(cc), String(cc)).toBe(false);
  });

  it('devise ISO 4217 connue', () => {
    for (const c of ['EUR', 'CHF', 'USD', 'JPY']) expect(isCurrencyCode(c), c).toBe(true);
    for (const c of ['eur', 'EURO', 'ZZZ', '', null]) expect(isCurrencyCode(c), String(c)).toBe(false);
  });

  it('langue BCP 47 canonique et connue', () => {
    expect(languageTag('fr')).toBe('fr');
    expect(languageTag('pt-br')).toBe('pt-BR');
    expect(languageTag('EN')).toBe('en');
    expect(languageTag('français')).toBeNull();
    expect(languageTag('zz')).toBeNull();
    expect(languageTag('x'.repeat(40))).toBeNull();
  });

  it('saisie nettoyée ; un seul champ invalide et rien n’est gardé', () => {
    expect(
      cleanTravellerFields({
        nationality: ' fr ',
        residenceCountry: '',
        currency: 'chf',
        language: 'pt-br',
        timeZone: 'europe/paris',
        home: '  Lyon ',
      })
    ).toEqual({ nationality: 'FR', residenceCountry: null, currency: 'CHF', language: 'pt-BR', timeZone: 'Europe/Paris', home: 'Lyon' });
    expect(cleanTravellerFields({})).toEqual({
      nationality: null,
      residenceCountry: null,
      currency: null,
      language: null,
      timeZone: null,
      home: null,
    });
    for (const bad of [
      { nationality: 'UK' },
      { residenceCountry: 'FRA' },
      { currency: 'EURO' },
      { language: 'klingon!' },
      { timeZone: 'Mars/Olympus' },
      { home: 'L' },
      { home: 'x'.repeat(81) },
    ])
      expect(cleanTravellerFields(bad), JSON.stringify(bad)).toBeNull();
  });
});

describe('listes du formulaire', () => {
  it('pays : noms français, triés, sans code qui n’est pas un pays', () => {
    const list = countryOptions();
    expect(list.find((o) => o.value === 'FR')?.label).toBe('France');
    expect(list.find((o) => o.value === 'XK')?.label).toBe('Kosovo');
    expect(list.some((o) => ['UK', 'EU', 'ZZ'].includes(o.value))).toBe(false);
    expect(list.every((o) => isCountryCode(o.value))).toBe(true);
    expect([...list].sort((x, y) => x.label.localeCompare(y.label, 'fr'))).toEqual(list);
  });

  it('devises : nom français et code', () => {
    expect(currencyOptions().find((o) => o.value === 'EUR')?.label).toBe('Euro (EUR)');
    expect(currencyOptions().find((o) => o.value === 'CHF')?.label).toBe('Franc suisse (CHF)');
  });

  it('langues : les six de /compte, plus celle déjà rangée', () => {
    expect(languageOptions(null).map((o) => o.value)).toEqual(['fr', 'en', 'de', 'it', 'es', 'ca']);
    expect(languageOptions(null)[0].label).toBe('Français');
    expect(languageOptions('pt-BR').map((o) => o.value)).toContain('pt-BR');
  });

  it('fuseaux : ceux d’Intl, plus celui déjà rangé', () => {
    expect(timeZoneOptions(null).map((o) => o.value)).toContain('Europe/Paris');
    expect(timeZoneOptions('UTC').map((o) => o.value)).toContain('UTC');
  });
});

describe('« aujourd’hui » : le navigateur, puis le profil, puis Paris', () => {
  // 22 h 30 UTC : déjà le 10 à Paris, encore le 9 à Los Angeles.
  const late = new Date('2026-10-09T22:30:00Z');

  it('le fuseau du profil ne sert que si le navigateur n’en envoie aucun de valable', () => {
    expect(travellerToday('Europe/Paris', late, 'America/Los_Angeles')).toBe('2026-10-10');
    expect(travellerToday(undefined, late, 'America/Los_Angeles')).toBe('2026-10-09');
    expect(travellerToday('Mars/Olympus', late, 'America/Los_Angeles')).toBe('2026-10-09');
    expect(travellerToday(undefined, late, 'Mars/Olympus')).toBe('2026-10-10');
    expect(travellerToday(undefined, late, null)).toBe('2026-10-10');
  });
});
