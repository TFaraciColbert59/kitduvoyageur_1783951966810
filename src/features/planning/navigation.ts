/**
 * K2.32 — Collection automatique et navigation par étape.
 * Permet de lancer chaque journée individuellement dans Explorer (« Démarrer cette étape »)
 * avec sa propre révision, sous réserve d'existence, de correspondance sport et d'autorisation P01.
 */

import type {
  MultiDayPlan,
  NavigableStageCard,
  SportKind,
  StageLaunchDecision,
  ViewerContextP01,
} from './models';
import { isPlanVisibleToViewerP01 } from './sharing';

export function getStageLaunchReadiness(
  plan: MultiDayPlan,
  dayNumber: number,
  viewer: ViewerContextP01,
  activeSport?: SportKind | null,
): StageLaunchDecision {
  if (!isPlanVisibleToViewerP01(plan, viewer)) {
    return { visible: false, launchable: false, reason: 'forbidden_p01' };
  }

  if (activeSport && activeSport !== plan.sport) {
    return { visible: false, launchable: false, reason: 'sport_mismatch' };
  }

  const stage = plan.stages.find((s) => s.dayNumber === dayNumber);
  if (!stage) {
    return { visible: false, launchable: false, reason: 'not_found' };
  }

  if (!stage.standaloneLaunchable || stage.points.length < 2) {
    return { visible: false, launchable: false, reason: 'not_standalone' };
  }

  return {
    visible: true,
    launchable: true,
    payload: {
      planId: plan.id,
      stageId: stage.stageId,
      dayNumber: stage.dayNumber,
      stageRevision: stage.revision,
      planRevision: plan.revision,
      sport: plan.sport,
      timezone: plan.timezone,
      startCoord: stage.startCoord,
      endCoord: stage.endCoord,
      points: stage.points,
      offline: { ...stage.offline },
    },
  };
}

export function listNavigableStages(
  plan: MultiDayPlan,
  viewer: ViewerContextP01,
  activeSport?: SportKind | null,
): NavigableStageCard[] {
  if (!isPlanVisibleToViewerP01(plan, viewer)) {
    return [];
  }

  const sportMatches = !activeSport || activeSport === plan.sport;

  return plan.stages.map((stage) => ({
    stageId: stage.stageId,
    dayNumber: stage.dayNumber,
    stageRevision: stage.revision,
    distanceKm: stage.distanceKm,
    elevationGainM: stage.elevationGainM,
    estimatedHours: stage.estimatedHours,
    endLodgingName: stage.endLodging ? stage.endLodging.name : null,
    canStartStage: sportMatches && stage.standaloneLaunchable && stage.points.length >= 2,
    offline: { ...stage.offline },
  }));
}
