import { describe, it, expect } from 'vitest';
import { en, fr } from '@/lib/i18n/translations';
import {
  EXPANSION_RATIO,
  extractPlaceholders,
  flattenDictionary,
  pseudoLocalizeDictionary,
  pseudoLocalizeText,
} from '../../scripts/i18n/pseudo-localize.mjs';

const flatFr = flattenDictionary(fr) as Record<string, string>;
const flatEn = flattenDictionary(en) as Record<string, string>;
const pseudoEn = pseudoLocalizeDictionary(en);
const flatPseudo = flattenDictionary(pseudoEn) as Record<string, string>;

/**
 * Clés critiques des surfaces P6 : elles doivent exister, être traduites en EN
 * et supporter l'expansion +40 % sans troncature au niveau des données.
 */
const CRITICAL_KEYS = [
  'nav.adventures',
  'nav.explorer',
  'nav.gear',
  'nav.community',
  'nav.me',
  'common.loading',
  'common.empty',
  'common.error',
  'common.offline',
  'auth.signIn',
  'auth.signUp',
  'auth.forgotPassword',
  'auth.email',
  'auth.password',
  'auth.errorInvalidCredentials',
  'auth.errorGeneric',
  'progression.title',
  'progression.pointsLifetime',
  'progression.pointsSeason',
  'progression.level',
  'progression.rank',
  'progression.nextChallenge',
  'progression.usableBalance',
  'progression.skills',
  'progression.challenges',
  'progression.distinctions',
  'progression.leaderboard',
  'progression.communityForming',
  'progression.challengeNone',
  'progression.distinctionNone',
  'progression.gainsNone',
  'progression.loadingProfile',
  'progression.leaderboardUnavailable',
  'account.progression',
  'account.rewards',
  'account.settings',
];

describe('P6 — Pseudo-localisation +40 % (données, pas de rendu pixel)', () => {
  it('FR et EN partagent exactement la même structure de clés', () => {
    expect(Object.keys(flatEn)).toEqual(Object.keys(flatFr));
  });

  it('chaque chaîne EN non vide supporte l’expansion +40 %', () => {
    const failures = Object.entries(flatEn)
      .filter(([key, value]) => {
        if (typeof value !== 'string' || value.length === 0) return false;
        return (
          flatPseudo[key].length <
          Math.ceil(value.length * (1 + EXPANSION_RATIO))
        );
      })
      .map(([key]) => key);
    expect(failures).toEqual([]);
  });

  it('les clés critiques existent en FR/EN et s’expansent', () => {
    for (const key of CRITICAL_KEYS) {
      expect(flatFr[key], `FR manquant: ${key}`).toBeTruthy();
      expect(flatEn[key], `EN manquant: ${key}`).toBeTruthy();
      expect(flatPseudo[key].length).toBeGreaterThanOrEqual(
        Math.ceil(flatEn[key].length * (1 + EXPANSION_RATIO))
      );
    }
  });

  it('applique les accents pseudo-localisés', () => {
    const pseudo = pseudoLocalizeText('Points');
    expect(pseudo.startsWith('Þóíñţš')).toBe(true);
    expect(pseudo).toContain('·');
  });

  it('préserve les placeholders `{var}` à l’identique', () => {
    const withPlaceholders = Object.entries(flatEn).filter(
      ([, value]) => extractPlaceholders(value).length > 0
    );
    expect(withPlaceholders.length).toBeGreaterThan(0);
    for (const [key, value] of withPlaceholders) {
      expect(extractPlaceholders(flatPseudo[key]), `placeholders: ${key}`).toEqual(
        extractPlaceholders(value)
      );
    }
  });

  it('ne tronque pas la source : le préfixe pseudo conserve la chaîne complète', () => {
    for (const [key, value] of Object.entries(flatEn)) {
      if (typeof value !== 'string' || value.length === 0) continue;
      const accented = pseudoLocalizeText(value, { expansion: 0 });
      expect(
        flatPseudo[key].startsWith(accented),
        `préfixe tronqué: ${key}`
      ).toBe(true);
      expect(
        flatPseudo[key].length,
        `expansion exacte: ${key}`
      ).toBe(accented.length + Math.ceil(value.length * EXPANSION_RATIO));
    }
  });

  it('pseudoLocalizeDictionary préserve la structure du dictionnaire', () => {
    expect(Object.keys(pseudoEn)).toEqual(Object.keys(en));
    expect(Object.keys(pseudoEn.progression)).toEqual(Object.keys(en.progression));
  });
});
