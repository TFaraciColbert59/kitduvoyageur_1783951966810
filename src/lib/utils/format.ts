/* =============================================================================
   LKDV — Utilitaires de formatage partagés
   =============================================================================
   Fonctions pures pour éviter les imports circulaires entre page.tsx et widgets.
   ============================================================================= */

import { PlannedHike } from '@/lib/preparation/plannedHikes';
import { DepartureHikeContext } from '@/lib/preparation/SmartDepartureEngine';

/** Formate un poids en grammes vers une chaîne lisible (g ou kg) */
export function formatWeight(g: number): string {
  if (!g || g <= 0) return '0 g';
  if (g >= 1000) {
    return `${(g / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
  }
  return `${Math.round(g)} g`;
}

/** Calcule le nombre de jours restants jusqu'à une date cible */
export function daysUntil(targetDate?: string): number | null {
  if (!targetDate) return null;
  const target = new Date(`${targetDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/** Construit le contexte de randonnée pour SmartDepartureEngine */
export function buildHikeContext(h: PlannedHike): DepartureHikeContext {
  const days = (h.isOvernight && h.nightsCount ? h.nightsCount : 0) + (h.isOvernight ? 1 : 0);
  return {
    id: h.routeId || h.id,
    name: h.name,
    distanceKm: h.distanceKm,
    elevationGain: h.elevationGain,
    elevationLoss: h.elevationLoss,
    difficulty: h.difficulty,
    season: h.season,
    terrain: h.terrain,
    hasWaterPoints: h.hasWaterPoints,
    waterPointsCount: h.waterPointsCount,
    hasRefuges: h.hasRefuges,
    isOvernight: h.isOvernight,
    nightsCount: h.nightsCount,
    weather: h.weather || null,
    startDate: h.targetDate,
    durationHours: days > 0 ? days * 6 : Math.round((h.distanceKm / 3.8) * 10) / 10,
  };
}