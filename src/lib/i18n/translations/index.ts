import type { Locale } from '../locale';
import { fr, type TranslationKeys } from './fr';
import { en } from './en';
import { es } from './es';
import { de } from './de';
import { it } from './it';

/**
 * Dictionnaires par locale. `TranslationKeys` garantit la parité avec le français. Une
 * locale enregistrée ici n'est servie que si son drapeau est activé (`isLocaleEnabled`).
 */
export const translations: Record<Locale, TranslationKeys> = { fr, en, es, de, it };

export type { TranslationKeys };
export { fr, en, es, de, it };
