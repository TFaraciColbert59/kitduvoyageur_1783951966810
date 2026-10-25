import type { PlannerPace } from './types';

export interface PaceRuleConfig {
  pace: PlannerPace;
  label: string;
  description: string;
  maxDailyActivities: number;
  maxDailyTransitHours: number;
  maxDailyHikingKm: number;
  maxDailyElevationM: number;
}

export const PACE_CONFIGS: Record<PlannerPace, PaceRuleConfig> = {
  chill: {
    pace: 'chill',
    label: 'Rythme Posé (Chill)',
    description: 'Prendre son temps, explorer sans se presser, étapes courtes et contemplation.',
    maxDailyActivities: 2,
    maxDailyTransitHours: 2.0,
    maxDailyHikingKm: 10,
    maxDailyElevationM: 500,
  },
  standard: {
    pace: 'standard',
    label: 'Rythme Équilibré (Standard)',
    description: 'Le bon compromis entre découverte active, belles étapes et récupération.',
    maxDailyActivities: 3,
    maxDailyTransitHours: 4.0,
    maxDailyHikingKm: 18,
    maxDailyElevationM: 1000,
  },
  intense: {
    pace: 'intense',
    label: 'Rythme Sportif / Engagé (Intense)',
    description: 'Grandes journées de marche, étapes techniques, optimisé pour les trekkeurs affûtés.',
    maxDailyActivities: 5,
    maxDailyTransitHours: 6.0,
    maxDailyHikingKm: 28,
    maxDailyElevationM: 1600,
  },
};

export function getPaceRules(pace: PlannerPace = 'standard'): PaceRuleConfig {
  return PACE_CONFIGS[pace] || PACE_CONFIGS.standard;
}
