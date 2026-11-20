'use client';

import React, { useMemo } from 'react';
import { LocaleContext, useLocale, type LocaleContextValue } from './context';
import { compasTranslations } from './translations/compas';
import { t as translate } from './translate';
import type { TranslationKeys } from './translations/fr';

/**
 * Enrichit le contexte i18n racine avec l'espace de noms `compas` uniquement sur
 * les routes qui en ont besoin (`/compas`, `TravellerCard`), sortant ~38 Ko gzip
 * du layout racine des autres routes.
 */
export function CompasLocaleProvider({ children }: { children: React.ReactNode }) {
  const parent = useLocale();

  const value = useMemo<LocaleContextValue>(() => {
    const compas = compasTranslations[parent.locale];
    const dict = { ...parent.dict, compas } as TranslationKeys;
    return {
      locale: parent.locale,
      dict,
      setLocale: parent.setLocale,
      t: (key, vars) => translate(dict, key, vars),
    };
  }, [parent]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
