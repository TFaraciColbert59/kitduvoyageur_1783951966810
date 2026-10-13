/**
 * Compas — la ligne « Change » (PLAN-100 4.2, lot AC). Module PUR.
 *
 * La monnaie du pays visité vient de la liste ISO 4217 n° 1 publiée par SIX (`data/countryCurrencies.json`,
 * `currencyOfCountry`), celle de la personne de son profil : la devise qu'elle a choisie, sinon celle du pays où
 * elle réside (même liste). Aucun taux ici (le budget les montre, datés et sourcés) : seulement le fait que la
 * monnaie change.
 *
 * VIE PRIVÉE : la monnaie de la personne dit où elle habite ; la ligne se calcule donc à la LECTURE pour la
 * personne qui regarde (voir `papers.ts`), jamais à l'écriture. Ce module reçoit une devise et un
 * pays de résidence ; il ne lit aucun profil.
 */

import { currencyOfCountry } from './currency';

/** Préfixe de la ligne (aussi lu par `papers.ts` pour retirer une ligne rangée par erreur). */
export const CHANGE_NOTE_PREFIX = 'Change :';

let names: Intl.DisplayNames | null = null;

/** « franc suisse », « euro » : le nom français de la devise (`Intl`), sinon le code. */
function currencyName(code: string): string {
  try {
    names ??= new Intl.DisplayNames(['fr'], { type: 'currency', fallback: 'none' });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * La monnaie de la personne : sa devise déclarée, sinon celle de son pays de résidence ; null si aucune des deux
 * n'est connue (rien n'est deviné).
 */
export function readerCurrency(reader: {
  currency: string | null;
  residenceCountry: string | null;
}): string | null {
  return reader.currency ?? currencyOfCountry(reader.residenceCountry);
}

/**
 * « Change : on paie en dirham marocain (MAD) sur place, pas en euro (EUR). » Null quand le pays visité n'a pas de
 * monnaie connue, quand celle de la personne n'est pas connue, ou quand c'est la même.
 */
export function changeLineFor(
  country: string | null | undefined,
  reader: { currency: string | null; residenceCountry: string | null }
): string | null {
  const there = currencyOfCountry(country);
  const home = readerCurrency(reader);
  if (!there || !home || there === home) return null;
  return `${CHANGE_NOTE_PREFIX} on paie en ${currencyName(there)} (${there}) sur place, pas en ${currencyName(home)} (${home}).`;
}
