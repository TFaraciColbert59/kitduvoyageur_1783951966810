/**
 * Lecture locale des tours FIT/TCX déjà extraits par les parseurs.
 *
 * Ce module ne persiste rien et ne dérive aucune valeur : il recopie les
 * champs réellement présents dans le tour (`null` reste `null`). Il sert à
 * l'aperçu avant enregistrement, pas au détail d'une sortie rechargée : aucun
 * contrat de `hike_sessions` ou `trace_imports` ne stocke aujourd'hui les
 * tours.
 */

import type { NormalizedTraceImport, NormalizedTraceLap } from './model';

/** Nombre maximal de tours détaillés dans l'aperçu (le fichier peut en contenir 10 000). */
export const TRACE_IMPORT_PREVIEW_LAP_LIMIT = 50;

export interface TraceImportLapSummary {
  index: number;
  startedAt: string | null;
  startedAtLocal: string | null;
  elapsedSeconds: number | null;
  distanceM: number | null;
  averageSpeedMps: number | null;
  maxSpeedMps: number | null;
  caloriesKcal: number | null;
  averageHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  averageCadenceRpm: number | null;
  averageCadenceSpm: number | null;
  maxPowerW: number | null;
  intensity: string | null;
  triggerMethod: string | null;
  pointCount: number;
  trackCount: number;
}

const TRIGGER_LABELS: Readonly<Record<string, string>> = {
  manual: 'manuel',
  time: 'temps',
  distance: 'distance',
  position_start: 'position de départ',
  position_lap: 'position de tour',
  position_waypoint: 'point de passage',
  position_marked: 'position marquée',
  session_end: 'fin de séance',
  fitness_equipment: 'équipement',
};

const INTENSITY_LABELS: Readonly<Record<string, string>> = {
  active: 'actif',
  rest: 'récupération',
  warmup: 'échauffement',
  cooldown: 'retour au calme',
  recovery: 'récupération',
  interval: 'intervalle',
  other: 'autre',
};

function lapSummary(lap: NormalizedTraceLap): TraceImportLapSummary {
  return {
    index: lap.index,
    startedAt: lap.startedAt,
    startedAtLocal: lap.startedAtLocal,
    elapsedSeconds: lap.elapsedSeconds,
    distanceM: lap.distanceM,
    averageSpeedMps: lap.averageSpeedMps,
    maxSpeedMps: lap.maxSpeedMps,
    caloriesKcal: lap.caloriesKcal,
    averageHeartRateBpm: lap.averageHeartRateBpm,
    maxHeartRateBpm: lap.maxHeartRateBpm,
    averageCadenceRpm: lap.averageCadenceRpm,
    averageCadenceSpm: lap.averageCadenceSpm,
    maxPowerW: lap.maxPowerW,
    intensity: lap.intensity,
    triggerMethod: lap.triggerMethod,
    pointCount: lap.pointCount,
    trackCount: lap.tracks.length,
  };
}

/**
 * Résumé borné des tours, dans l'ordre du fichier. Aucun tour n'est créé,
 * fusionné ou complété : un fichier sans tour retourne un tableau vide.
 */
export function buildTraceImportLapSummaries(
  trace: Pick<NormalizedTraceImport, 'laps'>,
  limit = TRACE_IMPORT_PREVIEW_LAP_LIMIT
): TraceImportLapSummary[] {
  const max = Number.isFinite(limit) && limit >= 1
    ? Math.min(Math.floor(limit), TRACE_IMPORT_PREVIEW_LAP_LIMIT)
    : TRACE_IMPORT_PREVIEW_LAP_LIMIT;
  return trace.laps.slice(0, max).map(lapSummary);
}

/** Vrai si au moins un tour porte une métrique au-delà de son simple rang. */
export function traceLapsHaveMetrics(laps: readonly TraceImportLapSummary[]): boolean {
  return laps.some(
    (lap) =>
      lap.startedAt !== null
      || lap.startedAtLocal !== null
      || lap.elapsedSeconds !== null
      || lap.distanceM !== null
      || lap.averageSpeedMps !== null
      || lap.maxSpeedMps !== null
      || lap.caloriesKcal !== null
      || lap.averageHeartRateBpm !== null
      || lap.maxHeartRateBpm !== null
      || lap.averageCadenceRpm !== null
      || lap.averageCadenceSpm !== null
      || lap.maxPowerW !== null
      || lap.intensity !== null
      || lap.triggerMethod !== null
  );
}

export function lapTriggerLabel(value: string | null): string | null {
  if (value === null) return null;
  return TRIGGER_LABELS[value] ?? value;
}

export function lapIntensityLabel(value: string | null): string | null {
  if (value === null) return null;
  return INTENSITY_LABELS[value] ?? value;
}
