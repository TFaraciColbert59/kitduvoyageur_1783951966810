import { describe, expect, it } from 'vitest';
import type { Locale } from '@/lib/i18n/locale';
import { localizeExpenseTitle, localizeStepTitle } from '../engine/storedText';

/*
 * PLAN-100 6.1 : les titres rangés en base par la préparation (français) sont rendus à
 * l'affichage dans la langue de la personne. Les voyages existants ne sont pas réécrits ;
 * ce qui n'est pas reconnu passe tel quel ; en français, la sortie est l'entrée.
 */

const LOCALES: Locale[] = ['fr', 'en', 'es', 'de', 'it'];

const EXPENSES = [
  'Nuits en refuge',
  '2 nuit(s) en refuge (prix à confirmer)',
  '1 nuit(s) en hébergement',
  'Vol aller-retour × 3',
  'Train aller-retour × 2',
  'Carburant aller-retour',
  'Carburant aller-retour (840 km)',
  'Carburant sur place (120 km)',
  'Location de voiture · 4 jour(s)',
  'Transports sur place (1 trajet)',
  'Transports sur place (3 trajets)',
  'Repas · 5 jour(s) × 2',
  'Location de matériel',
  'Matériel à acheter',
  'Assurance voyage et rapatriement',
];

describe('titres de budget rangés en base', () => {
  it('français : identique, au caractère près', () => {
    for (const e of EXPENSES) expect(localizeExpenseTitle(e, 'fr')).toBe(e);
    expect(localizeExpenseTitle(EXPENSES[1])).toBe(EXPENSES[1]);
  });

  it('anglais : pluriels et paramètres', () => {
    const en = (s: string) => localizeExpenseTitle(s, 'en');
    expect(en('2 nuit(s) en refuge (prix à confirmer)')).toBe('2 nights in mountain huts (price to confirm)');
    expect(en('1 nuit(s) en hébergement')).toBe('1 night in lodging');
    expect(en('Vol aller-retour × 3')).toBe('Return flight × 3');
    expect(en('Carburant aller-retour (840 km)')).toBe('Return fuel (840 km)');
    expect(en('Carburant sur place (1200 km)')).toBe('Fuel on site (1,200 km)');
    expect(en('Transports sur place (1 trajet)')).toBe('Local transport (1 trip)');
    expect(en('Transports sur place (3 trajets)')).toBe('Local transport (3 trips)');
    expect(en('Repas · 5 jour(s) × 2')).toBe('Meals · 5 days × 2');
    expect(en('Assurance voyage et rapatriement')).toBe('Travel and repatriation insurance');
  });

  it('espagnol, allemand, italien', () => {
    expect(localizeExpenseTitle('Location de voiture · 4 jour(s)', 'es')).toBe('Alquiler de coche · 4 días');
    expect(localizeExpenseTitle('Location de voiture · 1 jour(s)', 'de')).toBe('Mietwagen · 1 Tag');
    expect(localizeExpenseTitle('Nuits en refuge', 'it')).toBe('Notti in rifugio');
  });

  it('chaque forme est reconnue dans chaque langue (jamais de clé brute)', () => {
    for (const l of LOCALES)
      for (const e of EXPENSES) {
        const out = localizeExpenseTitle(e, l);
        expect(out, `${l} · ${e}`).not.toMatch(/compas\.engine/);
        if (l !== 'fr') expect(out, `${l} · ${e}`).not.toBe(e);
      }
  });

  it('inconnu ou retouché à la main : tel quel', () => {
    for (const l of LOCALES) {
      expect(localizeExpenseTitle('Resto du refuge', l)).toBe('Resto du refuge');
      expect(localizeExpenseTitle('Repas · 5 jour(s) × deux', l)).toBe('Repas · 5 jour(s) × deux');
      expect(localizeExpenseTitle('Péage A9 · voiture', l)).toBe('Péage A9 · voiture');
    }
  });
});

describe('titres d’étapes rangés en base', () => {
  it('« Jour N · Lieu » : le numéro est traduit, le lieu reste celui de la base', () => {
    expect(localizeStepTitle('Jour 2 · Refuge de la Pilatte', 'fr')).toBe('Jour 2 · Refuge de la Pilatte');
    expect(localizeStepTitle('Jour 2 · Refuge de la Pilatte', 'en')).toBe('Day 2 · Refuge de la Pilatte');
    expect(localizeStepTitle('Jour 2 · Refuge de la Pilatte', 'de')).toBe('Tag 2 · Refuge de la Pilatte');
    expect(localizeStepTitle('Jour 2 · Refuge de la Pilatte', 'es')).toBe('Día 2 · Refuge de la Pilatte');
    expect(localizeStepTitle('Jour 12', 'it')).toBe('Giorno 12');
  });
  it('un titre écrit à la main passe tel quel', () => {
    for (const l of LOCALES) {
      expect(localizeStepTitle('Pique-nique au lac', l)).toBe('Pique-nique au lac');
      expect(localizeStepTitle('Jour de repos', l)).toBe('Jour de repos');
    }
  });
});
