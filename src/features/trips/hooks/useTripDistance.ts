import { useMemo } from 'react';

/**
 * Sélecteur unique des distances et dénivelés d'un voyage (Règle Z-R3).
 *
 * Résout le défaut Z-D24 : « +54 m / +422 m D+ » — deux valeurs dans un champ
 * dénivelé. Certaines données d'étapes peuvent contenir une valeur composite
 * (ex : "54 / 422") au lieu d'un nombre. Le sélecteur sanctionne chaque cellule
 * pour produire UN SEUL nombre fini, sans jamais propager de slash dans l'UI.
 */

export interface TripDistanceInput {
  distance_km?: number | string | null;
  elevation_gain_m?: number | string | null;
  elevation_loss_m?: number | string | null;
}

export interface TripDistance {
  /** Distance totale en km (arrondie à 2 décimales). */
  totalKm: number;
  /** Dénivelé positif total en mètres (entier, jamais de slash). */
  dPlus: number;
  /** Dénivelé négatif total en mètres (entier, jamais de slash). */
  dMinus: number;
}

/**
 * Convertit une valeur en un nombre fini unique.
 * Si la cellule contient "54 / 422", on retient le PREMIER jeton numérique (54)
 * afin de ne jamais afficher deux valeurs dans un seul champ D+.
 */
function sanitizeNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const s = String(value).trim();
  if (!s) return 0;
  const tokens = s.match(/-?\d+(?:[.,]\d+)?/g);
  if (!tokens) return 0;
  return Number(tokens[0].replace(',', '.'));
}

export function getTripDistance(
  steps: TripDistanceInput[] | undefined | null
): TripDistance {
  const list = Array.isArray(steps) ? steps : [];

  let totalKm = 0;
  let dPlus = 0;
  let dMinus = 0;

  for (const s of list) {
    totalKm += sanitizeNumber(s?.distance_km);
    dPlus += sanitizeNumber(s?.elevation_gain_m);
    dMinus += sanitizeNumber(s?.elevation_loss_m);
  }

  return {
    totalKm: Math.round(totalKm * 100) / 100,
    dPlus: Math.round(dPlus),
    dMinus: Math.round(dMinus),
  };
}

export function useTripDistance(
  trip: { steps?: TripDistanceInput[] | null }
): TripDistance {
  return useMemo(() => getTripDistance(trip?.steps), [trip]);
}
