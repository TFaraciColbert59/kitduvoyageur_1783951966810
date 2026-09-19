import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  isLocale,
  normalizeLocale,
  parseAcceptLanguage,
  readCookie,
  resolveLocale,
  serializeLocaleCookie,
  toIntlLocale,
} from '@/lib/i18n/locale';
import {
  getTranslation,
  interpolate,
  plural,
  t,
  type TranslationKey,
} from '@/lib/i18n/translate';
import { en, fr } from '@/lib/i18n/translations';
import { formatCurrency, formatDate, formatNumber } from '@/lib/i18n/format';
import {
  DESTINATIONS,
  getDestinationLabel,
} from '@/components/mobile-nav/destinationRegistry';

describe('P6 — Infrastructure i18n', () => {
  describe('locale', () => {
    it('expose fr comme défaut et fr/en comme locales supportées', () => {
      expect(DEFAULT_LOCALE).toBe('fr');
      expect(LOCALES).toEqual(['fr', 'en']);
      expect(LOCALE_COOKIE).toBe('lkdv_locale');
      expect(isLocale('fr')).toBe(true);
      expect(isLocale('en')).toBe(true);
      expect(isLocale('de')).toBe(false);
      expect(toIntlLocale('fr')).toBe('fr-FR');
      expect(toIntlLocale('en')).toBe('en-US');
    });

    it('normalise les balises (en-US, fr_CA, casse)', () => {
      expect(normalizeLocale('en-US')).toBe('en');
      expect(normalizeLocale('FR_ca')).toBe('fr');
      expect(normalizeLocale('de-DE')).toBeNull();
      expect(normalizeLocale('')).toBeNull();
      expect(normalizeLocale(null)).toBeNull();
    });

    it('parse Accept-Language en respectant les facteurs q', () => {
      expect(parseAcceptLanguage('en-US,en;q=0.9,fr;q=0.8')).toBe('en');
      expect(parseAcceptLanguage('fr-CA,fr;q=0.9,en;q=0.8')).toBe('fr');
      expect(parseAcceptLanguage('de-DE,de;q=0.9')).toBeNull();
      expect(parseAcceptLanguage('de;q=0.9,en;q=0.5')).toBe('en');
      expect(parseAcceptLanguage(null)).toBeNull();
    });

    it('resolveLocale : cookie prioritaire, puis Accept-Language, puis fr', () => {
      expect(resolveLocale({ cookie: 'en', acceptLanguage: 'fr-FR,fr;q=0.9' })).toBe('en');
      expect(resolveLocale({ cookie: 'inconnu', acceptLanguage: 'en-GB,en;q=0.9' })).toBe('en');
      expect(resolveLocale({ cookie: null, acceptLanguage: 'de-DE' })).toBe('fr');
      expect(resolveLocale()).toBe('fr');
      expect(resolveLocale('en')).toBe('en');
    });

    it('sérialise et relit le cookie de locale (SameSite=Lax, 1 an)', () => {
      const serialized = serializeLocaleCookie('en');
      expect(serialized).toContain('lkdv_locale=en');
      expect(serialized).toContain('path=/');
      expect(serialized).toContain('SameSite=Lax');
      expect(serialized).toContain(`max-age=${60 * 60 * 24 * 365}`);
      expect(readCookie(serialized + '; theme=dark', LOCALE_COOKIE)).toBe('en');
      expect(readCookie('theme=dark', LOCALE_COOKIE)).toBeNull();
      expect(readCookie(null, LOCALE_COOKIE)).toBeNull();
    });
  });

  describe('translate', () => {
    it('interpole les variables sans toucher aux placeholders inconnus', () => {
      expect(interpolate('Bonjour {name}', { name: 'Ada' })).toBe('Bonjour Ada');
      expect(interpolate('{a} et {b}', { a: 1, b: 2 })).toBe('1 et 2');
      expect(interpolate('Reste {inconnu}')).toBe('Reste {inconnu}');
      expect(interpolate('Aucune variable')).toBe('Aucune variable');
    });

    it('lit une clé pointée et retourne la clé si absente (jamais d’exception)', () => {
      expect(t(fr, 'nav.adventures')).toBe('Aventures');
      expect(t(en, 'nav.adventures')).toBe('Adventures');
      expect(t(fr, 'auth.confirmationBodyPrefix' as TranslationKey)).toBe(
        'Un email a été envoyé à'
      );
      const missing = 'progression.cleInexistante' as TranslationKey;
      expect(getTranslation(fr, missing)).toBeNull();
      expect(t(fr, missing)).toBe('progression.cleInexistante');
    });

    it('pluriels Intl.PluralRules : FR 0/1 → one, EN 1 → one', () => {
      const forms = { one: 'un', other: 'plusieurs' };
      expect(plural('fr', 0, forms)).toBe('un');
      expect(plural('fr', 1, forms)).toBe('un');
      expect(plural('fr', 2, forms)).toBe('plusieurs');
      expect(plural('en', 0, forms)).toBe('plusieurs');
      expect(plural('en', 1, forms)).toBe('un');
      expect(plural('en', 2, forms)).toBe('plusieurs');
    });
  });

  describe('format', () => {
    it('formate les dates selon la locale', () => {
      const frDate = formatDate('2026-07-10', undefined, 'fr');
      const enDate = formatDate('2026-07-10', undefined, 'en');
      expect(frDate).toContain('10');
      expect(frDate).toContain('juil.');
      expect(enDate).toContain('10');
      expect(enDate).toContain('Jul');
      expect(formatDate(null, undefined, 'fr')).toBe('');
      expect(formatDate('pas-une-date', undefined, 'fr')).toBe('');
    });

    it('formate les nombres selon la locale', () => {
      expect(formatNumber(1234.5, {}, 'fr')).toMatch(/1[\s\u202f\u00a0]234,5/);
      expect(formatNumber(1234.5, {}, 'en')).toBe('1,234.5');
    });

    it('formate les montants via formatters.ts (aucune duplication)', () => {
      expect(formatCurrency(45.5, 'EUR', 'fr')).toMatch(/45,50\s?€/);
      expect(formatCurrency(1200, 'USD', 'en')).toBe('$1,200.00');
    });
  });

  describe('dictionnaires', () => {
    it('expose les 5 destinations nav en FR et EN', () => {
      expect(fr.nav).toEqual({
        adventures: 'Aventures',
        explorer: 'Explorer',
        gear: 'Matériel',
        community: 'Communauté',
        me: 'Moi',
      });
      expect(en.nav).toEqual({
        adventures: 'Adventures',
        explorer: 'Explore',
        gear: 'Gear',
        community: 'Community',
        me: 'Me',
      });
    });

    it('getDestinationLabel lit les libellés du registre sans le modifier', () => {
      for (const destination of DESTINATIONS) {
        expect(getDestinationLabel(destination.id, 'fr')).toBe(destination.label.fr);
        expect(getDestinationLabel(destination.id, 'en')).toBe(destination.label.en);
      }
      expect(getDestinationLabel('adventures', 'fr')).toBe('Aventures');
      expect(getDestinationLabel('adventures', 'en')).toBe('Adventures');
    });
  });
});
