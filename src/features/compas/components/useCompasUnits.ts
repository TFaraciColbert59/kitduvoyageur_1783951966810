'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import type { IsoWeekday, MeasurePrefs } from '@/lib/i18n/region';
import {
  readFirstDay,
  readUnitSystem,
  subscribeUnitSystem,
  unitPrefsFor,
  weekStartForLocale,
} from '@/lib/i18n/unitSetting';
import { compasFormat, type CompasFormat } from '../engine/compasI18n';

/*
 * Unités d'affichage du Compas (PLAN-100 6.3). Le réglage explicite du compte (stocké
 * dans ce navigateur, voir `lib/i18n/unitSetting`) l'emporte ; sans lui, la région de la
 * langue décide (US, LR, MM : mi, ft, lb, °F). Les données et le moteur restent
 * métriques : seule l'écriture change.
 *
 * Rendu serveur et hydratation : pas de réglage ni de navigateur, la locale seule décide ;
 * le réglage enregistré s'applique au rendu client suivant (`useSyncExternalStore`).
 */

const noSubscribe = () => () => {};
const browserLanguage = () => (typeof navigator === 'undefined' ? null : navigator.language);
const serverNull = () => null;

export function useCompasUnits(): MeasurePrefs {
  const { locale } = useTranslation();
  const system = useSyncExternalStore(subscribeUnitSystem, readUnitSystem, serverNull);
  const browserTag = useSyncExternalStore(noSubscribe, browserLanguage, serverNull);
  return useMemo(() => unitPrefsFor(locale, system, browserTag), [locale, system, browserTag]);
}

/** Premier jour de la semaine de la personne (calendriers) : sa région, pas sa nationalité. */
export function useWeekStart(): IsoWeekday {
  const { locale } = useTranslation();
  const browserTag = useSyncExternalStore(noSubscribe, browserLanguage, serverNull);
  const explicit = useSyncExternalStore(subscribeUnitSystem, readFirstDay, serverNull);
  return useMemo(() => weekStartForLocale(locale, browserTag, explicit), [locale, browserTag, explicit]);
}

/** `compasFormat` de la locale du site, dans les unités de la personne. */
export function useCompasFormat(): CompasFormat {
  const { locale } = useTranslation();
  const units = useCompasUnits();
  return useMemo(() => compasFormat(locale, units), [locale, units]);
}
