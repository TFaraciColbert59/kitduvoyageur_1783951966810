/**
 * Barrel public du domaine Adventure Intelligence (domain + schemas + providers).
 *
 * N'exporte JAMAIS `server/consents.ts` (`import 'server-only'`) : un composant
 * client qui importe ce barrel ne doit tirer aucun code serveur.
 */
export * from './domain/confidence';
export * from './domain/provenance';
export * from './domain/engine';
export * from './domain/events';
export * from './domain/constraints';
export * from './domain/decisions';
export * from './domain/adventurePlan';
export * from './domain/health';
export * from './schemas';
export * from './providers/noopReadinessProvider';
