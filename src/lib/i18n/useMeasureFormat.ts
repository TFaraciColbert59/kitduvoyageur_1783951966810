'use client';

import { useMemo } from 'react';
import { useTranslation } from './context';
import type { MeasurePrefs } from './region';
import { intlTag } from './region';
import {
  formatDistanceIn,
  formatElevationCompactIn,
  formatElevationIn,
  formatPaceIn,
  formatSpeedIn,
  formatTemperatureIn,
  formatWeightIn,
} from './measure';
import { useMeasurePrefs } from './useMeasurePrefs';

const KM_PER_MI = 1.609344;
const KMH_PER_MPH = 1.609344;

export interface MeasureFormat {
  /** Locale d'affichage, pour les dates et les séparateurs. */
  locale: string;
  /** Unités résolues (réglage explicite, sinon région de la langue). */
  prefs: MeasurePrefs;
  distanceUnit: 'km' | 'mi';
  elevationUnit: 'm' | 'ft';
  speedUnit: 'km/h' | 'mph';
  /** Distance complète : « 12,5 km » ; zéro reste « 0 km ». */
  distance(km: number | null | undefined): string;
  /** Distance sans unité : « 12,5 ». */
  distanceValue(km: number | null | undefined): string;
  /** Altitude/dénivelé complet : « 1 200 m ». */
  elevation(m: number | null | undefined): string;
  /** Altitude sans unité : « 1 200 ». */
  elevationValue(m: number | null | undefined): string;
  /** Dénivelé compact : « 20,2 k m ». */
  elevationCompact(m: number | null | undefined): string;
  /** Allure complète : « 8'20"/km ». */
  pace(secondsPerKm: number | null | undefined): string;
  /** Allure sans unité : « 8'20" ». */
  paceValue(secondsPerKm: number | null | undefined): string;
  /** Vitesse complète : « 4,8 km/h ». */
  speed(kmh: number | null | undefined): string;
  /** Vitesse sans unité : « 4,8 ». */
  speedValue(kmh: number | null | undefined): string;
  weight(grams: number | null | undefined): string;
  temperature(celsius: number | null | undefined): string;
  /** Nombre localisé, sans unité. */
  number(value: number | null | undefined, digits?: number): string;
}

const absent = (value: number | null | undefined): value is null | undefined =>
  value == null || !Number.isFinite(value);

/**
 * Unités d'affichage prêtes à écrire, partagées par les surfaces carte, profil
 * et navigation. Les valeurs métier restent en km, m, g, s/km et km/h : ce hook
 * ne convertit qu'à l'affichage. Il s'appuie sur `useMeasurePrefs`, donc le
 * réglage « Langue et unités » du compte s'applique sans rechargement.
 */
export function useMeasureFormat(): MeasureFormat {
  const { locale } = useTranslation();
  const prefs = useMeasurePrefs();

  return useMemo<MeasureFormat>(() => {
    const distanceUnit = prefs.distance;
    const elevationUnit = prefs.elevation;
    const speedUnit = distanceUnit === 'mi' ? 'mph' : 'km/h';

    const number = (value: number | null | undefined, digits = 1): string => {
      if (absent(value)) return '—';
      return new Intl.NumberFormat(intlTag(locale), {
        maximumFractionDigits: digits,
      }).format(Math.abs(value) < 0.5 / 10 ** digits ? 0 : value);
    };

    const distanceValue = (km: number | null | undefined): string => {
      if (absent(km)) return '—';
      return number(distanceUnit === 'mi' ? km / KM_PER_MI : km, 1);
    };

    const elevationValue = (m: number | null | undefined): string => {
      if (absent(m)) return '—';
      return number(elevationUnit === 'ft' ? m / 0.3048 : m, 0);
    };

    const paceValue = (secondsPerKm: number | null | undefined): string => {
      if (absent(secondsPerKm) || secondsPerKm <= 0) return '—';
      const seconds = distanceUnit === 'mi' ? secondsPerKm * KM_PER_MI : secondsPerKm;
      const total = Math.round(seconds);
      const minutes = Math.floor(total / 60);
      const rest = total % 60;
      return `${minutes}'${String(rest).padStart(2, '0')}"`;
    };

    const speedValue = (kmh: number | null | undefined): string => {
      if (absent(kmh) || kmh < 0) return '—';
      return number(speedUnit === 'mph' ? kmh / KMH_PER_MPH : kmh, 1);
    };

    return {
      locale,
      prefs,
      distanceUnit,
      elevationUnit,
      speedUnit,
      distance: (km) => {
        if (absent(km)) return '—';
        // `formatDistanceIn` réserve « — » à l'absence ; une distance nulle
        // réellement mesurée doit rester lisible au départ d'une sortie.
        if (km === 0) return `${distanceValue(0)} ${distanceUnit}`;
        return formatDistanceIn(km, locale, { prefs });
      },
      distanceValue,
      elevation: (m) => formatElevationIn(m, locale, { prefs }),
      elevationValue,
      elevationCompact: (m) => formatElevationCompactIn(m, locale, { prefs }),
      pace: (secondsPerKm) => formatPaceIn(secondsPerKm, locale, { prefs }),
      paceValue,
      speed: (kmh) => formatSpeedIn(kmh, locale, { prefs }),
      speedValue,
      weight: (grams) => formatWeightIn(grams, locale, { prefs }),
      temperature: (celsius) => formatTemperatureIn(celsius, locale, { prefs }),
      number,
    };
  }, [locale, prefs]);
}
