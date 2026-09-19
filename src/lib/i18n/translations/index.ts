import type { Locale } from '../locale';
import { fr, type TranslationKeys } from './fr';
import { en } from './en';

/** Dictionnaires par locale. `TranslationKeys` garantit la parité FR/EN. */
export const translations: Record<Locale, TranslationKeys> = { fr, en };

export type { TranslationKeys };
export { fr, en };
