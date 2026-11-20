import type { Locale } from '../locale';
import { coreFr, type CoreTranslationKeys } from './core.fr';
import { coreEn } from './core.en';
import { coreEs } from './core.es';
import { coreDe } from './core.de';
import { coreIt } from './core.it';

/**
 * Dictionnaires hors Compas, embarqués dans le layout racine (~4 Ko gzip vs ~42 Ko
 * avec les dictionnaires Compas). Les pages `/compas` et `TravellerCard` ajoutent
 * l'espace de noms `compas` via `<CompasLocaleProvider>`.
 */
export const coreTranslations: Record<Locale, CoreTranslationKeys> = {
  fr: coreFr,
  en: process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_I18N_EN_ENABLED === '1' ? coreEn : coreFr,
  es: process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_I18N_ES_ENABLED === '1' ? coreEs : coreFr,
  de: process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_I18N_DE_ENABLED === '1' ? coreDe : coreFr,
  it: process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_I18N_IT_ENABLED === '1' ? coreIt : coreFr,
};

export type { CoreTranslationKeys };
