'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useTranslation } from './context';
import type { MeasurePrefs } from './region';
import {
  readUnitSystem,
  subscribeUnitSystem,
  unitPrefsFor,
} from './unitSetting';

const noSubscribe = () => () => {};
const browserLanguage = () => (typeof navigator === 'undefined' ? null : navigator.language);
const serverNull = () => null;

/**
 * Unités d'affichage de la personne, partagées par le Compas, Explorer et la
 * carte « Langue et unités » du compte. Le réglage explicite (localStorage +
 * cookie) l'emporte ; sans lui, la région de la langue décide. Les données
 * restent métriques : seule l'écriture change.
 */
export function useMeasurePrefs(): MeasurePrefs {
  const { locale } = useTranslation();
  const system = useSyncExternalStore(subscribeUnitSystem, readUnitSystem, serverNull);
  const browserTag = useSyncExternalStore(noSubscribe, browserLanguage, serverNull);
  return useMemo(() => unitPrefsFor(locale, system, browserTag), [locale, system, browserTag]);
}
