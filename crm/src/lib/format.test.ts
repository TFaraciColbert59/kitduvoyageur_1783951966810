import { describe, expect, it } from 'vitest';
import { euros, firstName, maskEmail, relativeFr } from './format';

/**
 * Couche 2 : formatage. Deux règles du bundle : aucune donnée inventée
 * (« non renseigné ») et aucune donnée personnelle complète à l'écran (§ 8 contrôle 21).
 */

/** Les espaces insécables d'Intl (U+00A0, U+202F) sont normalisés pour comparer. */
const plain = (text: string): string => text.replace(/[\u00a0\u202f\s]/g, '');

describe('maskEmail', () => {
  it('ne laisse jamais voir plus de deux caractères de la partie locale', () => {
    expect(maskEmail('tony@example.test')).toBe('to•••@example.test');
    expect(maskEmail('a@example.test')).toBe('a•••@example.test');
    expect(maskEmail('ab@example.test')).toBe('ab•••@example.test');
  });

  it('conserve le domaine et masque systématiquement la partie locale', () => {
    const masked = maskEmail('verylonglocalpart@example.test');
    expect(masked.endsWith('@example.test')).toBe(true);
    expect(masked).not.toContain('verylonglocalpart');
    expect(masked.startsWith('ve•••@')).toBe(true);
  });

  it('affiche « non renseigné » pour une valeur absente ou qui n’est pas un e-mail', () => {
    expect(maskEmail(null)).toBe('non renseigné');
    expect(maskEmail(undefined)).toBe('non renseigné');
    expect(maskEmail('')).toBe('non renseigné');
    expect(maskEmail('pas-un-email')).toBe('non renseigné');
  });
});

describe('euros', () => {
  it('formate en euros français à partir de centimes', () => {
    expect(plain(euros(0))).toBe('0,00€');
    expect(plain(euros(5))).toBe('0,05€');
    expect(plain(euros(1234))).toBe('12,34€');
    expect(plain(euros(100000))).toBe('1000,00€');
    expect(plain(euros(-500))).toBe('-5,00€');
  });

  it('garde le symbole euro et deux décimales, sans arrondi flottant visible', () => {
    const text = euros(1999);
    expect(text).toContain('€');
    expect(plain(text)).toBe('19,99€');
    expect(plain(euros(1))).toBe('0,01€');
  });

  it('affiche « non renseigné » plutôt qu’un chiffre inventé', () => {
    expect(euros(null)).toBe('non renseigné');
    expect(euros(undefined)).toBe('non renseigné');
    expect(euros(Number.NaN)).toBe('non renseigné');
    expect(euros(Number.POSITIVE_INFINITY)).toBe('non renseigné');
    expect(euros(Number.NEGATIVE_INFINITY)).toBe('non renseigné');
  });
});

describe('firstName', () => {
  it('garde le premier mot d’un nom complet', () => {
    expect(firstName('Tony Martin')).toBe('Tony');
    expect(firstName('  Tony   Martin ')).toBe('Tony');
    expect(firstName('Tony')).toBe('Tony');
  });

  it('affiche « non renseigné » quand le nom manque', () => {
    expect(firstName(null)).toBe('non renseigné');
    expect(firstName(undefined)).toBe('non renseigné');
    expect(firstName('')).toBe('non renseigné');
    expect(firstName('   ')).toBe('non renseigné');
  });
});

describe('relativeFr', () => {
  const now = Date.parse('2026-11-09T12:00:00.000Z');
  const before = (minutes: number): string => new Date(now - minutes * 60_000).toISOString();

  it('écrit un temps relatif court en français', () => {
    expect(relativeFr(before(0), now)).toBe("à l'instant");
    expect(relativeFr(before(1), now)).toBe('il y a 1 min');
    expect(relativeFr(before(45), now)).toBe('il y a 45 min');
    expect(relativeFr(before(180), now)).toBe('il y a 3 h');
    expect(relativeFr(before(24 * 60), now)).toBe('hier');
    expect(relativeFr(before(3 * 24 * 60), now)).toBe('il y a 3 j');
  });

  it('affiche « non renseigné » pour une date absente', () => {
    expect(relativeFr(null, now)).toBe('non renseigné');
    expect(relativeFr(undefined, now)).toBe('non renseigné');
    expect(relativeFr('', now)).toBe('non renseigné');
  });
});
