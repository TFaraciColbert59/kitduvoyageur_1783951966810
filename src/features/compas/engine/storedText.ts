/**
 * Compas — textes rangés en base par la préparation (titres d'étapes « Jour 2 · Lieu », lignes
 * de budget « 3 nuits en hébergement »), rendus à l'affichage dans la langue de la personne
 * (PLAN-100 6.1, « textes enregistrés en base remplacés par des clés et paramètres »).
 *
 * CONCEPTION RETENUE : la base garde le texte français d'avant, les voyages existants ne sont
 * pas réécrits. À la lecture, ce module reconnaît EXACTEMENT les formes que la préparation a
 * écrites (gabarit connu + paramètres numériques) et les refait par une clé `compas.engine.stored.*`
 * dans la langue demandée. Tout ce qui n'est pas reconnu (titre retouché à la main, ligne de
 * péage, nom de lieu) passe tel quel : rien n'est deviné, rien n'est perdu. En français, la
 * sortie est l'entrée, au caractère près.
 *
 * Module pur : serveur, navigateur et tests.
 */

import { formatNumber } from '@/lib/i18n/format';
import { formatDistanceIn } from '@/lib/i18n/measure';
import { measurePrefsFor, type MeasurePrefs } from '@/lib/i18n/region';
import type { Locale } from '@/lib/i18n/locale';
import { plural, type TranslationKey } from '@/lib/i18n/translate';
import { engineT } from './engineI18n';

type K = Extract<TranslationKey, `compas.engine.stored.${string}`>;

/** Distance écrite en base (toujours en kilomètres), dite dans les unités de la personne. */
const km = (n: number, locale: Locale, units: MeasurePrefs) =>
  formatDistanceIn(n, locale, { prefs: units });

/** « Jour 2 · Lieu » ou « Jour 2 » (titre d'étape rangé par la préparation). */
export function localizeStepTitle(title: string, locale: Locale = 'fr'): string {
  if (locale === 'fr') return title;
  const t = engineT(locale);
  const full = /^Jour (\d{1,3}) · ([\s\S]+)$/.exec(title); // i18n-ok : gabarit rangé en base
  if (full) return t('compas.engine.stored.day', { day: full[1], name: full[2] });
  const only = /^Jour (\d{1,3})$/.exec(title); // i18n-ok : gabarit rangé en base
  if (only) return t('compas.engine.stored.dayOnly', { day: only[1] });
  return title;
}

/**
 * Titre d'une ligne de budget écrite par la préparation ; inconnu : tel quel. Les kilomètres
 * rangés en base se disent dans `units` (réglage de la personne, sinon région de la langue).
 */
export function localizeExpenseTitle(
  title: string,
  locale: Locale = 'fr',
  units: MeasurePrefs = measurePrefsFor(locale, null)
): string {
  if (locale === 'fr') return title;
  const t = engineT(locale);
  const pl = (count: number, one: K, other: K, vars: Record<string, string | number> = {}) =>
    t(plural(locale, count, { one, other }) as K, { count: formatNumber(count, {}, locale), ...vars });
  const n = (s: string) => Number(s);
  let m: RegExpExecArray | null;

  /* eslint-disable no-cond-assign */
  // i18n-ok : les gabarits suivants sont ceux que la préparation a rangés en base.
  if (title === 'Nuits en refuge') return t('compas.engine.stored.nightsRefuge'); // i18n-ok
  if ((m = /^(\d{1,3}) nuit\(s\) en refuge \(prix à confirmer\)$/.exec(title)))
    return pl(n(m[1]), 'compas.engine.stored.nightsRefugeUnpricedOne', 'compas.engine.stored.nightsRefugeUnpricedOther');
  if ((m = /^(\d{1,3}) nuit\(s\) en hébergement$/.exec(title)))
    return pl(n(m[1]), 'compas.engine.stored.nightsStayOne', 'compas.engine.stored.nightsStayOther');
  if ((m = /^Vol aller-retour × (\d{1,3})$/.exec(title)))
    return t('compas.engine.stored.flight', { party: m[1] });
  if ((m = /^Train aller-retour × (\d{1,3})$/.exec(title)))
    return t('compas.engine.stored.train', { party: m[1] });
  if (title === 'Carburant aller-retour') return t('compas.engine.stored.fuelRound');
  if ((m = /^Carburant aller-retour \((\d{1,6}) km\)$/.exec(title)))
    return t('compas.engine.stored.fuelRoundDistance', { distance: km(n(m[1]), locale, units) });
  if ((m = /^Carburant sur place \((\d{1,6}) km\)$/.exec(title)))
    return t('compas.engine.stored.fuelSite', { distance: km(n(m[1]), locale, units) });
  if ((m = /^Location de voiture · (\d{1,3}) jour\(s\)$/.exec(title)))
    return pl(n(m[1]), 'compas.engine.stored.carRentalOne', 'compas.engine.stored.carRentalOther');
  if ((m = /^Transports sur place \((\d{1,3}) trajets?\)$/.exec(title)))
    return pl(n(m[1]), 'compas.engine.stored.localMovesOne', 'compas.engine.stored.localMovesOther');
  if ((m = /^Repas · (\d{1,3}) jour\(s\) × (\d{1,3})$/.exec(title)))
    return pl(n(m[1]), 'compas.engine.stored.mealsOne', 'compas.engine.stored.mealsOther', { party: m[2] });
  if (title === 'Location de matériel') return t('compas.engine.stored.gearRental'); // i18n-ok
  if (title === 'Matériel à acheter') return t('compas.engine.stored.gearBuy'); // i18n-ok
  if (title === 'Assurance voyage et rapatriement') return t('compas.engine.stored.insurance'); // i18n-ok
  /* eslint-enable no-cond-assign */
  return title;
}
