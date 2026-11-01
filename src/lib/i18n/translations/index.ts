import type { Locale } from '../locale';
import { fr, type TranslationKeys } from './fr';
import { en } from './en';
import { es } from './es';
import { de } from './de';
import { it } from './it';

/**
 * Dictionnaires par locale. `TranslationKeys` garantit la parité avec le français. Une
 * locale enregistrée ici n'est servie que si son drapeau est activé (`isLocaleEnabled`).
 *
 * Poids du JS : dans un build de production, le dictionnaire d'une langue dont le drapeau
 * `NEXT_PUBLIC_I18N_<LANGUE>_ENABLED` n'est pas `'1'` est remplacé par le français et n'est
 * pas embarqué (une langue éteinte n'est jamais choisie, ni par cookie ni par en-tête :
 * `resolveLocale`). Les drapeaux sont figés au build (voir `env` dans `next.config.mjs`),
 * ce qui permet au bundler d'élaguer la branche morte. Hors production (tests Vitest,
 * `next dev`, scripts), tous les dictionnaires restent présents.
 * Les conditions sont écrites en ligne et littérales : c'est ce qui les rend évaluables
 * à la compilation.
 */
export const translations: Record<Locale, TranslationKeys> = {
  fr,
  en: process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_I18N_EN_ENABLED === '1' ? en : fr,
  es: process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_I18N_ES_ENABLED === '1' ? es : fr,
  de: process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_I18N_DE_ENABLED === '1' ? de : fr,
  it: process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_I18N_IT_ENABLED === '1' ? it : fr,
};

export type { TranslationKeys };
export { fr, en, es, de, it };
