import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import META from '../data/countryCurrencies.meta.json';
import CURRENCIES from '../data/countryCurrencies.json';
import { currencyOfCountry } from '../engine/currency';

/**
 * Devise de chaque pays (ISO 4217, liste n° 1 de SIX), pour afficher le budget aussi dans la
 * devise du pays de destination (PLAN-100 4.2).
 */

describe('currencyOfCountry — devise de chaque pays (ISO 4217, liste n° 1 de SIX)', () => {
  it('donne la devise du pays, sans tenir compte de la casse', () => {
    expect(currencyOfCountry('CH')).toBe('CHF');
    expect(currencyOfCountry('jp')).toBe('JPY');
    expect(currencyOfCountry(' ma ')).toBe('MAD');
    expect(currencyOfCountry('FR')).toBe('EUR');
  });

  it('Panama et Salvador : le dollar américain, qui circule seul (choix dit dans le script)', () => {
    expect(currencyOfCountry('PA')).toBe('USD');
    expect(currencyOfCountry('SV')).toBe('USD');
  });

  it('un pays qui n’a pas de devise propre dans la liste, un code faux ou rien : null, jamais une devise devinée', () => {
    expect(currencyOfCountry('AQ')).toBeNull();
    expect(currencyOfCountry('ZZ')).toBeNull();
    expect(currencyOfCountry('FRA')).toBeNull();
    expect(currencyOfCountry('')).toBeNull();
    expect(currencyOfCountry(null)).toBeNull();
    expect(currencyOfCountry(undefined)).toBeNull();
  });

  it('un code de la table est déjà une devise connue du moteur', () => {
    for (const [country, code] of Object.entries(CURRENCIES)) {
      expect(country).toMatch(/^[A-Z]{2}$/);
      expect(code).toMatch(/^[A-Z]{3}$/);
    }
    expect(Object.keys(CURRENCIES).length).toBe(META.countries);
  });

  it('la source est datée et empreinte (une mise à jour de la liste change le fichier et la méta)', () => {
    expect(META.source).toMatch(/ISO 4217/);
    expect(META.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(META.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(META.url).toMatch(/^https:\/\/www\.six-group\.com\//);
  });

  it('le script de construction refuse un pays à plusieurs devises hors de sa liste fermée', async () => {
    const { parseListOne } = (await import(
      path.resolve(__dirname, '..', '..', '..', '..', 'scripts', 'compas', 'build-country-currencies.mjs')
    )) as { parseListOne: (xml: string) => { published: string; currencies: Record<string, string> } };
    const entry = (name: string, ccy: string, nm = ccy) =>
      `<CcyNtry><CtryNm>${name}</CtryNm><CcyNm>${nm}</CcyNm><Ccy>${ccy}</Ccy></CcyNtry>`;
    const filler = Array.from({ length: 250 }, (_, i) => `<CcyNtry><CtryNm>ZZ${i}_x</CtryNm></CcyNtry>`).join('');
    const xml = (body: string) => `<ISO_4217 Pblshd="2026-09-17"><CcyTbl>${body}${filler}</CcyTbl></ISO_4217>`;
    expect(() => parseListOne(xml(entry('SWITZERLAND', 'CHF') + entry('SWITZERLAND', 'EUR')))).toThrow(/plusieurs devises pour CH/);
    expect(() => parseListOne(xml(entry('NOWHERELAND', 'CHF')))).toThrow(/pays inconnu/);
  });

  it('le fichier lu est bien celui du script (jamais édité à la main)', () => {
    const text = readFileSync(path.resolve(__dirname, '..', 'data', 'countryCurrencies.json'), 'utf8');
    expect(JSON.parse(text)).toEqual(CURRENCIES);
  });
});

