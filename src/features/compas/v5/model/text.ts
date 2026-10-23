/**
 * Lecture typée des textes des tiroirs Nous et Budget : une clé inconnue ne compile pas (le suffixe est vérifié
 * contre le dictionnaire généré), et jamais un texte d'interface n'est écrit en dur dans un composant.
 */
import { countText, type CompasT } from '../../components/compasTypes';
import type { Locale } from '@/lib/i18n/locale';
import type { TranslationKey, TranslationVars } from '@/lib/i18n/translate';

type Suffix<K, P extends string> = K extends `${P}${infer S}` ? S : never;

export type NousKey = Suffix<TranslationKey, 'compas.v5.nous.'>;
export type BudgetKey = Suffix<TranslationKey, 'compas.v5.budget.'>;

/** Bases de pluriel (`…One` / `…Other`) de chaque zone. */
export type NousCount = 'people' | 'group.gearDone' | 'group.gearTodo' | 'group.gearDistributed';
export type BudgetCount = 'settle.excluded';

export interface NousText {
  (key: NousKey, vars?: TranslationVars): string;
  count: (n: number, base: NousCount, vars?: TranslationVars) => string;
}
export interface BudgetText {
  (key: BudgetKey, vars?: TranslationVars): string;
  count: (n: number, base: BudgetCount, vars?: TranslationVars) => string;
}

export function nousText(t: CompasT, locale: Locale): NousText {
  const read = ((key: NousKey, vars?: TranslationVars) => t(`compas.v5.nous.${key}` as TranslationKey, vars)) as NousText;
  read.count = (n, base, vars) =>
    countText(t, locale, n, `compas.v5.nous.${base}One` as TranslationKey, `compas.v5.nous.${base}Other` as TranslationKey, vars);
  return read;
}

export function budgetText(t: CompasT, locale: Locale): BudgetText {
  const read = ((key: BudgetKey, vars?: TranslationVars) => t(`compas.v5.budget.${key}` as TranslationKey, vars)) as BudgetText;
  read.count = (n, base, vars) =>
    countText(t, locale, n, `compas.v5.budget.${base}One` as TranslationKey, `compas.v5.budget.${base}Other` as TranslationKey, vars);
  return read;
}
