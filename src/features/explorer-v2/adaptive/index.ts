/**
 * Barrel export du moteur adaptatif Explorer v2 (Track D + Adaptive).
 */

export * from './types';
export {
  computeExplorerReadiness,
  computeSessionLoadUnits,
  mapSportToSortieActivity,
} from './loadAndReadiness';
export {
  computeEffectiveRidgeWind,
  computeOfflineDaylight,
  computeThermalStress,
  estimateHydrationLiters,
} from './environment';
export { estimateSafeEta } from './safeEta';
export { scoreOutingFit } from './outingFit';
export { recommendActivityPreset } from './activityPreset';
export { rankContextualItems } from './contextualRanker';
