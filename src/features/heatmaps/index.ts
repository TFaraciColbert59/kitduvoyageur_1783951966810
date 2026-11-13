/**
 * Lot C02 — Point d'entrée public du module `src/features/heatmaps/`.
 *
 * Couvre les fiches :
 * - K3.07 : Heatmap communautaire par sport
 * - K3.08 : Heatmap personnelle par sport
 * - K7.06 : Opt-out strict de la heatmap mondiale
 * - S3.16 : Heatmap globale
 * - S3.17 : Heatmap des sept derniers jours
 * - S3.18 : Heatmap nocturne (entre coucher et lever du soleil)
 * - S3.19 : Heatmap personnelle (sport, période et comparaison)
 * - S6.17 : Contrôle granulaire de contribution aux données agrégées
 *
 * Ainsi que l'application stricte des invariants P01 (K7.05 / S6.14 : exclusion
 * des zones privées, activités privées et k-anonymat fail-closed).
 */

export * from './types';
export * from './consent';
export * from './privacyMask';
export * from './temporal';
export * from './spatialGrid';
export * from './personalHeatmap';
export * from './cacheAndRevocation';
export * from './drawerState';
