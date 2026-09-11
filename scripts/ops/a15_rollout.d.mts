/**
 * A15 — Déclarations TypeScript du rollout ops (`a15_rollout.mjs`), consommé
 * par les tests vitest.
 */

export interface PgClientLike {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
}

export const DEFAULT_LOCAL_DSN: string;
export const LOCAL_HOSTS: readonly string[];
export const ROLLOUT_TIERS: readonly number[];
export const DEFAULT_FLAG_ID: string;
export const DEFAULT_SAMPLE_SIZE: number;
export const TIER_TOLERANCE_POINTS: number;

export interface A9StopThresholds {
  errorRateMultiplier: number;
  minRequestsForErrorRate: number;
  minEtaCoverageP90: number;
  minEtaSampleSize: number;
  maxTerrainCriticalFalseReports: number;
  maxBatteryPctPerHour: number;
}

export interface RolloutMetrics {
  source?: string;
  dataLeakOrRlsCritical?: boolean;
  requests24h?: number | null;
  errorRate24h?: number | null;
  baselineErrorRate24h?: number | null;
  etaCoverageP90?: number | null;
  etaSampleSize?: number | null;
  terrainCriticalFalseReports?: number | null;
  moderationFailure?: boolean;
  batteryPctPerHour?: number | null;
  debounceOk?: boolean;
  monthlyCostOverBudget?: boolean;
  sessionCorruption?: boolean;
  offlineSyncDestructive?: boolean;
}

export interface StopEvaluation {
  decision: 'stop' | 'continue' | 'insufficient_data';
  stops: string[];
  warnings: string[];
  insufficient: string[];
}

export interface TierOutcome {
  ok: boolean | null;
  verdict: 'pass' | 'fail' | 'inconclusive';
  observedPct: number;
  expectedPct: number;
  deltaPoints?: number;
  reason: string | null;
  bucketMismatches?: number;
  allowChecks?: { userId: string; expected: boolean; actual: boolean }[];
}

export const A9_STOP_THRESHOLDS: A9StopThresholds;

export function isLocalDsn(dsn: string): boolean;

export function assertLocalDsn(dsn: string, env?: Record<string, string | undefined>): void;

export function sha256Hex(value: string): string;

export function cohortBucket(userId: string): number;

export function sampleUserIds(count: number, seed: string): string[];

export function evaluateTierOutcome(input: {
  percentage: number;
  total: number;
  enabledCount: number;
  tolerancePoints?: number;
  minSample?: number;
}): TierOutcome;

export function evaluateStopCriteria(
  metrics: RolloutMetrics | null,
  thresholds?: Partial<A9StopThresholds>
): StopEvaluation;

export function snapshotFlag(
  client: PgClientLike,
  flagId: string
): Promise<{ flag: { id: string; enabled: boolean }; cohort: Record<string, unknown> | null }>;

export function applyTier(
  client: PgClientLike,
  flagId: string,
  percentage: number,
  options?: { allowlist?: string[]; exclusions?: string[] }
): Promise<void>;

export function restoreFlag(
  client: PgClientLike,
  flagId: string,
  snapshot: { flag: { id: string; enabled: boolean }; cohort: Record<string, unknown> | null }
): Promise<void>;

export function verifyTier(
  client: PgClientLike,
  options: {
    flagId: string;
    percentage: number;
    sampleSize?: number;
    seed?: string;
    allowlist?: string[];
    exclusions?: string[];
  }
): Promise<TierOutcome>;

export function collectLocalMetrics(client: PgClientLike): Promise<RolloutMetrics>;

export function verifyAllTiers(options: {
  dsn: string;
  flagId?: string;
  sampleSize?: number;
  tiers?: readonly number[];
  log?: (...args: unknown[]) => void;
}): Promise<{
  results: (TierOutcome & { percentage: number; boundary?: string })[];
  restored: boolean;
  initialEnabled: boolean;
}>;

export function main(
  argv?: string[],
  env?: Record<string, string | undefined>,
  log?: (...args: unknown[]) => void
): Promise<number>;
