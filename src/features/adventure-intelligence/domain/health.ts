/**
 * Contrats santé futurs (Phase 1) — AUCUN connecteur réel.
 *
 * `ExternalReadinessProvider` fige l'interface qu'un futur connecteur
 * (HealthKit, Health Connect, etc.) devrait respecter. En Phase 1, seul le
 * `NoopReadinessProvider` existe : aucune lecture, aucun stockage, aucune
 * transmission de donnée de santé. `external_readiness` reste non octroyable.
 */
import type { Confidence } from './confidence';

export const READINESS_DATA_CATEGORIES = [
  'sleep',
  'recovery',
  'resting_heart_rate',
  'hrv',
  'activity',
  'workout',
] as const;

export type ReadinessDataCategory = (typeof READINESS_DATA_CATEGORIES)[number];

export interface AuthorizationResult {
  granted: boolean;
  categories: ReadinessDataCategory[];
  reason?: string;
}

/** Instantané de forme de jour agrégé — jamais une donnée brute de capteur. */
export interface ExternalReadinessSnapshot {
  date: string;
  readinessScore: number;
  sleepScore?: number;
  recoveryScore?: number;
  recentLoad?: number;
  restingHeartRateDelta?: number;
  hrvDelta?: number;
  fatigueDeclared?: number;
  painDeclared?: number;
  confidence: Confidence;
  sourceProviderId: string;
  sourceSummary: string;
  computedAt: string;
}

export interface ExternalReadinessProvider {
  readonly providerId: string;
  isAvailable(): Promise<boolean>;
  requestAuthorization(categories: ReadinessDataCategory[]): Promise<AuthorizationResult>;
  getDailyReadiness(date: string): Promise<ExternalReadinessSnapshot | null>;
}
