/**
 * Contrat public du module de planification multi-jours (Lot R04).
 * Couvre K1.13, K2.29, K2.30, K2.31, K2.32, fuseaux horaires explicites,
 * météo/conditions/fenêtres optimales et partage P01.
 */

export * from './models';
export {
  isValidTimeZone,
  assertValidTimeZone,
  getLocalDateAndHour,
  diffMinutesIso,
  type LocalDateTimeParts,
} from './timezone';
export {
  isPlanVisibleToViewerP01,
  createPlanShare,
  revokePlanShare,
  evaluateShareAccessP01,
  type CreateShareRequest,
  type ShareCreationResult,
} from './sharing';
export {
  parseMultiDaySearchQuery,
  searchMultiDayPlans,
} from './library';
export {
  haversineKm,
  computeCumulativeDistancesKm,
  computeStageMetrics,
  splitRouteIntoDays,
  previewStageBoundaryMove,
  commitStageBoundaryMove,
  anchorStageToLodging,
  type SplitRouteOptions,
  type BoundaryMoveResult,
  type AnchorLodgingOptions,
  type AnchorLodgingResult,
} from './split';
export {
  getStageLaunchReadiness,
  listNavigableStages,
} from './navigation';
export {
  createUnconfiguredWeatherFeed,
  evaluatePlanWeather,
  findOptimalWindows,
} from './weatherAndWindows';
export {
  createPlanningDrawerState,
  reducePlanningDrawerState,
  type PlanningDrawerAction,
} from './drawer';
