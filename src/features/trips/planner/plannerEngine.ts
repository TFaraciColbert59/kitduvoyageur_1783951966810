import { calculateDistanceKm } from '@/features/trips/engine/travelTime';

export interface PlannerStep {
  id: string;
  trip_id: string;
  day_number: number;
  order_index: number;
  title: string;
  description?: string | null;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accommodation_name?: string | null;
  transport_mode?: string | null;
  distance_km?: number | null;
  elevation_gain_m?: number | null;
  elevation_loss_m?: number | null;
}

export interface DayMetrics {
  totalDistanceKm: number;
  totalElevationGainM: number;
  totalElevationLossM: number;
  estimatedDurationMinutes: number;
  stepsCount: number;
}

/**
 * Calcule les métriques cumulées d'une journée à partir de ses étapes.
 * Déterministe pur (ZÉRO LLM).
 */
export function recalculateDayMetrics(steps: PlannerStep[]): DayMetrics {
  if (!steps || steps.length === 0) {
    return {
      totalDistanceKm: 0,
      totalElevationGainM: 0,
      totalElevationLossM: 0,
      estimatedDurationMinutes: 0,
      stepsCount: 0,
    };
  }

  // Tri par ordre chronologique/index
  const sorted = [...steps].sort((a, b) => a.order_index - b.order_index);

  let totalDistanceKm = 0;
  let totalElevationGainM = 0;
  let totalElevationLossM = 0;
  let estimatedDurationMinutes = 0;

  for (let i = 0; i < sorted.length; i++) {
    const step = sorted[i];

    // Dénivelés
    if (step.elevation_gain_m && step.elevation_gain_m > 0) {
      totalElevationGainM += step.elevation_gain_m;
    }
    if (step.elevation_loss_m && step.elevation_loss_m > 0) {
      totalElevationLossM += step.elevation_loss_m;
    }

    // Distance : soit explicite, soit calculée entre points consécutifs
    if (step.distance_km != null && step.distance_km > 0) {
      totalDistanceKm += step.distance_km;
    } else if (
      i > 0 &&
      step.latitude != null &&
      step.longitude != null &&
      sorted[i - 1].latitude != null &&
      sorted[i - 1].longitude != null
    ) {
      const dist = calculateDistanceKm(
        sorted[i - 1].latitude!,
        sorted[i - 1].longitude!,
        step.latitude,
        step.longitude
      );
      totalDistanceKm += dist;
    }

    // Estimation de la durée selon le transport et l'effort
    const dist = step.distance_km || 0;
    const dPlus = step.elevation_gain_m || 0;
    const mode = (step.transport_mode || '').toLowerCase();

    if (mode === 'flight' || mode === 'plane') {
      estimatedDurationMinutes += 120 + Math.round((dist / 700) * 60);
    } else if (mode === 'train') {
      estimatedDurationMinutes += 30 + Math.round((dist / 100) * 60);
    } else if (mode === 'car' || mode === 'bus') {
      estimatedDurationMinutes += 15 + Math.round((dist / 60) * 60);
    } else if (mode === 'boat') {
      estimatedDurationMinutes += 30 + Math.round((dist / 25) * 60);
    } else if (mode === 'bike') {
      estimatedDurationMinutes += Math.round((dist / 15) * 60);
    } else {
      // Randonnée / Marche : Règle de Naismith (4 km/h + 1h pour 600m D+)
      const walkTimeHours = dist / 4 + dPlus / 600;
      estimatedDurationMinutes += Math.max(30, Math.round(walkTimeHours * 60));
    }
  }

  return {
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalElevationGainM,
    totalElevationLossM,
    estimatedDurationMinutes,
    stepsCount: sorted.length,
  };
}

/**
 * Réordonne une étape d'un cran vers le haut ou vers le bas.
 * Renumérote strictement les `order_index` 0, 1, 2...
 */
export function reorderStepList(
  steps: PlannerStep[],
  stepIdToMove: string,
  direction: 'up' | 'down'
): PlannerStep[] {
  const sorted = [...steps].sort((a, b) => a.order_index - b.order_index);
  const currentIndex = sorted.findIndex((s) => s.id === stepIdToMove);

  if (currentIndex === -1) return steps;
  if (direction === 'up' && currentIndex === 0) return steps;
  if (direction === 'down' && currentIndex === sorted.length - 1) return steps;

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  const [removed] = sorted.splice(currentIndex, 1);
  sorted.splice(targetIndex, 0, removed);

  return sorted.map((step, idx) => ({
    ...step,
    order_index: idx,
  }));
}

/**
 * Réordonne les étapes selon un tableau d'identifiants ordonné.
 */
export function reorderStepsByIds(
  steps: PlannerStep[],
  orderedIds: string[]
): PlannerStep[] {
  const stepMap = new Map<string, PlannerStep>();
  for (const step of steps) {
    stepMap.set(step.id, step);
  }

  const result: PlannerStep[] = [];
  for (let i = 0; i < orderedIds.length; i++) {
    const step = stepMap.get(orderedIds[i]);
    if (step) {
      result.push({
        ...step,
        order_index: i,
      });
      stepMap.delete(orderedIds[i]);
    }
  }

  // Si des étapes n'étaient pas dans orderedIds, on les ajoute à la suite
  let nextIdx = result.length;
  for (const step of stepMap.values()) {
    result.push({
      ...step,
      order_index: nextIdx++,
    });
  }

  return result;
}

/**
 * Compacte les order_index pour garantir une séquence continue 0, 1, 2... sans trou.
 */
export function compactOrderIndices(steps: PlannerStep[]): PlannerStep[] {
  const sorted = [...steps].sort((a, b) => a.order_index - b.order_index);
  return sorted.map((step, idx) => ({
    ...step,
    order_index: idx,
  }));
}

/**
 * Déplace une étape d'un jour vers un autre jour.
 * Compacte les indices dans le jour source et le jour cible.
 */
export function moveStepBetweenDays(
  allSteps: PlannerStep[],
  stepId: string,
  targetDayNumber: number,
  targetOrderIndex?: number
): PlannerStep[] {
  const stepToMove = allSteps.find((s) => s.id === stepId);
  if (!stepToMove) return allSteps;

  const sourceDayNumber = stepToMove.day_number;
  if (sourceDayNumber === targetDayNumber && targetOrderIndex === undefined) {
    return allSteps;
  }

  // Autres étapes qui ne sont ni dans source ni dans target
  const otherDaysSteps = allSteps.filter(
    (s) => s.id !== stepId && s.day_number !== sourceDayNumber && s.day_number !== targetDayNumber
  );

  // Jour source sans l'étape déplacée
  const sourceDaySteps = allSteps
    .filter((s) => s.id !== stepId && s.day_number === sourceDayNumber)
    .sort((a, b) => a.order_index - b.order_index)
    .map((s, idx) => ({ ...s, order_index: idx }));

  // Jour cible
  const targetDaySteps = allSteps
    .filter((s) => s.id !== stepId && s.day_number === targetDayNumber)
    .sort((a, b) => a.order_index - b.order_index);

  const updatedStepToMove: PlannerStep = {
    ...stepToMove,
    day_number: targetDayNumber,
    order_index: 0,
  };

  if (targetOrderIndex != null && targetOrderIndex >= 0 && targetOrderIndex <= targetDaySteps.length) {
    targetDaySteps.splice(targetOrderIndex, 0, updatedStepToMove);
  } else {
    targetDaySteps.push(updatedStepToMove);
  }

  const compactedTargetDaySteps = targetDaySteps.map((s, idx) => ({
    ...s,
    order_index: idx,
  }));

  return [...otherDaysSteps, ...sourceDaySteps, ...compactedTargetDaySteps];
}

/**
 * Décale les numéros de jour (day_number) d'un delta (+1 ou -1) à partir de fromDayNumber.
 */
export function shiftDayNumbers(
  steps: PlannerStep[],
  fromDayNumber: number,
  delta: number
): PlannerStep[] {
  return steps.map((s) => {
    if (s.day_number >= fromDayNumber) {
      return {
        ...s,
        day_number: s.day_number + delta,
      };
    }
    return s;
  });
}
