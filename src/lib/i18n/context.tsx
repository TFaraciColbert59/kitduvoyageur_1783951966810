'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  readCookie,
  serializeLocaleCookie,
  type Locale,
} from './locale';
import { translations, type TranslationKeys } from './translations';
import { t as translate, type TranslationKey, type TranslationVars } from './translate';

export interface LocaleContextValue {
  locale: Locale;
  dict: TranslationKeys;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: TranslationVars) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

let warnedMissingProvider = false;

/**
 * Fallback sûr : un composant monté hors `LocaleProvider` (test isolé, render
 * transitoire) affiche le FR par défaut au lieu de crasher l'arbre. La
 * sélection de langue est neutralisée jusqu'à ce que le provider soit monté.
 */
function createFallback(): LocaleContextValue {
  const dict = translations[DEFAULT_LOCALE];
  return {
    locale: DEFAULT_LOCALE,
    dict,
    setLocale: () => {},
    t: (key, vars) => translate(dict, key, vars),
  };
}

const FALLBACK = createFallback();

export function LocaleProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(
    isLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE
  );

  /**
   * Persistance cookie (SameSite=Lax, 1 an) + alignement de `document.lang`.
   * Le premier rendu client utilise `initialLocale` fourni par le serveur :
   * aucune divergence d'hydratation.
   */
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof document !== 'undefined') {
      document.cookie = serializeLocaleCookie(next);
      document.documentElement.lang = next;
    }
  }, []);

  useEffect(() => {
    // Le cookie client fait foi au montage (changement dans un autre onglet,
    // reprise de session) — correction après hydratation, sans mismatch.
    const cookieLocale = readCookie(document.cookie, LOCALE_COOKIE);
    if (cookieLocale && isLocale(cookieLocale) && cookieLocale !== locale) {
      setLocaleState(cookieLocale);
    }
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => {
    const dict = translations[locale];
    return {
      locale,
      dict,
      setLocale,
      t: (key, vars) => translate(dict, key, vars),
    };
  }, [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Contexte complet : locale, dictionnaire, changement de langue et `t`. */
export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    if (!warnedMissingProvider) {
      warnedMissingProvider = true;
      console.warn(
        '[i18n] useLocale hors LocaleProvider — fallback FR appliqué.'
      );
    }
    return FALLBACK;
  }
  return context;
}

/** Raccourci de traduction : `{ t, locale, dict }`. */
export function useTranslation(): {
  t: LocaleContextValue['t'];
  locale: Locale;
  dict: TranslationKeys;
} {
  const { t, locale, dict } = useLocale();
  return { t, locale, dict };
}
