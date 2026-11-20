import type { Locale } from '../locale';
import { compasFr } from './compas.fr';
import { compasEn } from './compas.en';
import { compasEs } from './compas.es';
import { compasDe } from './compas.de';
import { compasIt } from './compas.it';
import type { TranslationKeys } from './fr';

type CompasDict = TranslationKeys['compas'];

/** Dictionnaires dédiés au Compas — chargés uniquement sur `/compas` et `TravellerCard`. */
export const compasTranslations: Record<Locale, CompasDict> = {
  fr: compasFr,
  en: process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_I18N_EN_ENABLED === '1' ? compasEn : compasFr,
  es: process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_I18N_ES_ENABLED === '1' ? compasEs : compasFr,
  de: process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_I18N_DE_ENABLED === '1' ? compasDe : compasFr,
  it: process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_I18N_IT_ENABLED === '1' ? compasIt : compasFr,
};
