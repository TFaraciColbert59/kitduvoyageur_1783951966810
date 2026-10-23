import { describe, expect, it } from 'vitest';
import { de, en, es, fr, it as itDict, translations } from '@/lib/i18n/translations';
import { LOCALES, type Locale } from '@/lib/i18n/locale';
import { compasT, countText } from '@/features/compas/engine/compasI18n';
import {
  COMPAS_SAME_AS_FR,
  COMPAS_SAME_AS_EN,
} from '@/lib/i18n/translations/compas-same';
import { flattenKeys, placeholders } from '../../scripts/i18n/compas-coverage.mjs';

/**
 * PLAN-100 6.1 « Langues suivantes : ES, DE, IT ». Mêmes garanties que l'anglais
 * (`compas-coverage.spec.ts`) pour chaque nouvelle langue : mêmes clés que le français,
 * mêmes placeholders, aucune chaîne française ou anglaise oubliée, typographie de la
 * langue, registre de politesse (usted / Sie / Lei).
 */

type Flat = Record<string, string>;
const flat = (dict: unknown, prefix = ''): Flat =>
  flattenKeys(dict as Record<string, unknown>, prefix) as Flat;

const NEW_LOCALES = ['es', 'de', 'it'] as const;
type NewLocale = (typeof NEW_LOCALES)[number];
const DICTS: Record<NewLocale, unknown> = { es, de, it: itDict };

const flatFr = flat(fr);
const flatEn = flat(en);

/** Mots-outils français absents de l'espagnol, de l'allemand et de l'italien. */
const FRENCH_RESIDUE =
  /(?<![\p{L}\d])(avec|pour|vous|votre|vos|sont|dans|cette|très|déjà|être|été|aujourd’hui|chaque|jours?|nuits?|étapes?|voyages?|trajets?|aucune?|sans|ton|tes|ici|où)(?![\p{L}\d])|[çœæêâîôûë]/iu;

/** Mots-outils anglais absents des trois langues. */
const ENGLISH_RESIDUE =
  /(?<![\p{L}\d])(the|and|with|your|you|of|for|from|this|that|is|are|can|days?|nights?|people|trip)(?![\p{L}\d])/iu;

/** Tutoiement : interdit, le registre est usted / Sie / Lei. */
const INFORMAL: Record<NewLocale, RegExp> = {
  es: /(?<![\p{L}])(tú|tu|tus|tuyo|tuya|tienes|puedes|quieres|eres|estás|contigo|te)(?![\p{L}])/iu,
  de: /(?<![\p{L}])(du|dich|dir|dein|deine|deinen|deinem|deiner|deines|bist|hast|kannst|willst)(?![\p{L}])/iu,
  it: /(?<![\p{L}])(tu|tuo|tua|tuoi|tue|ti|te|puoi|vuoi|hai|devi|sei sicuro)(?![\p{L}])/iu,
};

/**
 * Mots communs exprès (noms propres, marques, sigles, mots repris tels quels) :
 * ils sont listés, clé par clé, dans `compas-same.ts`.
 */
const allowedSame = (list: Record<NewLocale, readonly string[]>, locale: NewLocale) =>
  new Set<string>(list[locale]);

/** Une clé dont la valeur française (ou anglaise) EST la mention imposée ou un nom propre. */
const IGNORED_RESIDUE_KEYS = new Set(['common.appTitle', 'compas.credit.geoapify']);

/** Noms propres de services, gardés dans leur langue d'origine (jamais traduits). */
const PROPER_NAMES = ['Environment and Climate Change Canada', 'National Weather Service'];

/** Texte lu par les heuristiques : sans placeholders `{…}` ni noms propres. */
const prose = (value: string) =>
  PROPER_NAMES.reduce((s, name) => s.split(name).join(' '), value).replace(
    /\{[a-zA-Z0-9_]+\}/g,
    ' '
  );

describe('i18n ES/DE/IT — les heuristiques détectent vraiment', () => {
  it('français, anglais et tutoiement repérés, placeholders et noms propres ignorés', () => {
    expect(FRENCH_RESIDUE.test(prose('Préparez votre voyage'))).toBe(true);
    expect(FRENCH_RESIDUE.test(prose('Etapa del día {day}'))).toBe(false);
    expect(ENGLISH_RESIDUE.test(prose('Plan your trip'))).toBe(true);
    expect(ENGLISH_RESIDUE.test(prose('{from} {to}, Día {day}'))).toBe(false);
    expect(ENGLISH_RESIDUE.test(prose('Avisos de Environment and Climate Change Canada'))).toBe(false);
    expect(INFORMAL.de.test('Hast du alles?')).toBe(true);
    expect(INFORMAL.de.test('Haben Sie alles?')).toBe(false);
    expect(INFORMAL.es.test('¿Tienes todo?')).toBe(true);
    expect(INFORMAL.es.test('¿Lo tiene todo?')).toBe(false);
    expect(INFORMAL.it.test('Puoi riprovare')).toBe(true);
    expect(INFORMAL.it.test('Può riprovare')).toBe(false);
  });
});

describe('i18n — langues enregistrées', () => {
  it('chaque locale déclarée a son dictionnaire', () => {
    for (const locale of LOCALES) expect(translations[locale], locale).toBeTruthy();
    expect(Object.keys(translations).sort()).toEqual([...LOCALES].sort());
  });
});

for (const locale of NEW_LOCALES) {
  const dict = DICTS[locale];
  const flatL = flat(dict);
  const compasL = Object.fromEntries(
    Object.entries(flatL).filter(([k]) => k.startsWith('compas.'))
  );

  describe(`i18n ${locale.toUpperCase()} — dictionnaire complet`, () => {
    it('mêmes clés que le français, ni plus ni moins (tout le dictionnaire)', () => {
      const onlyFr = Object.keys(flatFr).filter((k) => !(k in flatL));
      const onlyL = Object.keys(flatL).filter((k) => !(k in flatFr));
      expect(onlyFr, `clés FR sans ${locale}`).toEqual([]);
      expect(onlyL, `clés ${locale} sans FR`).toEqual([]);
      expect(Object.keys(compasL).length).toBeGreaterThan(1000);
    });

    it('aucune valeur vide et les mêmes placeholders {…} que le français', () => {
      for (const [key, value] of Object.entries(flatFr)) {
        expect(flatL[key]?.trim(), `${locale} vide : ${key}`).not.toBe('');
        expect(placeholders(flatL[key] ?? ''), `placeholders : ${key}`).toEqual(placeholders(value));
      }
    });

    it('une traduction : identique au français seulement pour les mots listés', () => {
      const allowed = allowedSame(COMPAS_SAME_AS_FR, locale);
      const same = Object.keys(flatFr).filter((k) => flatFr[k] === flatL[k] && !allowed.has(k));
      expect(same, 'identiques au français sans être listées').toEqual([]);
      const stale = [...allowed].filter((k) => flatFr[k] !== flatL[k]);
      expect(stale, 'listées mais plus identiques').toEqual([]);
    });

    it('une traduction : identique à l’anglais seulement pour les mots listés', () => {
      const allowed = allowedSame(COMPAS_SAME_AS_EN, locale);
      const same = Object.keys(flatEn).filter((k) => flatEn[k] === flatL[k] && !allowed.has(k));
      expect(same, 'identiques à l’anglais sans être listées').toEqual([]);
      const stale = [...allowed].filter((k) => flatEn[k] !== flatL[k]);
      expect(stale, 'listées mais plus identiques').toEqual([]);
    });

    it('aucune chaîne française résiduelle', () => {
      const hits = Object.entries(flatL)
        .filter(([k, v]) => !IGNORED_RESIDUE_KEYS.has(k) && FRENCH_RESIDUE.test(prose(v)))
        .map(([k, v]) => `${k} = ${v}`);
      expect(hits).toEqual([]);
    });

    it('aucune chaîne anglaise résiduelle', () => {
      const hits = Object.entries(flatL)
        .filter(([k, v]) => !IGNORED_RESIDUE_KEYS.has(k) && ENGLISH_RESIDUE.test(prose(v)))
        .map(([k, v]) => `${k} = ${v}`);
      expect(hits).toEqual([]);
    });

    it('registre de politesse : jamais de tutoiement', () => {
      const hits = Object.entries(compasL)
        .filter(([, v]) => INFORMAL[locale].test(prose(v)))
        .map(([k, v]) => `${k} = ${v}`);
      expect(hits).toEqual([]);
    });

    it('typographie : apostrophe courbe, points de suspension, pas d’espace avant : ; ? !', () => {
      for (const [key, value] of Object.entries(flatL)) {
        expect(value, `apostrophe droite : ${key}`).not.toContain("'");
        expect(value, `trois points : ${key}`).not.toContain('...');
        expect(value, `espace avant ponctuation : ${key}`).not.toMatch(/[   ][:;?!]/);
        expect(value, `espace double : ${key}`).not.toMatch(/ {2}/);
      }
    });

    if (locale === 'es') {
      it('espagnol : ¿…? et ¡…! appariés, guillemets « » sans espace intérieure', () => {
        for (const [key, value] of Object.entries(flatL)) {
          const q = (value.match(/\?/g) ?? []).length;
          const iq = (value.match(/¿/g) ?? []).length;
          expect(iq, `¿ manquant : ${key}`).toBe(q);
          const x = (value.match(/!/g) ?? []).length;
          const ix = (value.match(/¡/g) ?? []).length;
          expect(ix, `¡ manquant : ${key}`).toBe(x);
          expect(value, `guillemets : ${key}`).not.toMatch(/« | »|[“”]/);
        }
      });
    }

    if (locale === 'de') {
      it('allemand : guillemets „…“, jamais ” ni « »', () => {
        for (const [key, value] of Object.entries(flatL)) {
          expect(value, `guillemets : ${key}`).not.toMatch(/[”«»]/);
          const open = (value.match(/„/g) ?? []).length;
          const close = (value.match(/“/g) ?? []).length;
          expect(close, `guillemets non appariés : ${key}`).toBe(open);
        }
      });
    }

    if (locale === 'it') {
      it('italien : guillemets « » sans espace intérieure', () => {
        for (const [key, value] of Object.entries(flatL)) {
          expect(value, `guillemets : ${key}`).not.toMatch(/« | »|[“”]/);
        }
      });
    }
  });
}

describe('i18n ES/DE/IT — pluriels par Intl.PluralRules, nombres formatés', () => {
  const cases: Array<[Locale, number, string]> = [
    ['es', 0, '0 días'],
    ['es', 1, '1 día'],
    ['es', 3, '3 días'],
    ['de', 0, '0 Tage'],
    ['de', 1, '1 Tag'],
    ['de', 1200, '1.200 Tage'],
    ['it', 0, '0 giorni'],
    ['it', 1, '1 giorno'],
    ['it', 2, '2 giorni'],
  ];
  for (const [locale, count, expected] of cases) {
    it(`${locale} ${count}`, () => {
      const t = compasT(locale);
      expect(countText(t, locale, count, 'compas.start.daysOne', 'compas.start.daysOther')).toBe(
        expected
      );
    });
  }
});
