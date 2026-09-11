/**
 * A14 — Déclarations TypeScript du healthcheck ops (`a14_healthcheck.mjs`),
 * consommé par les tests vitest.
 */

export interface A14HealthThresholds {
  maxPendingEvents: number;
  maxOldestPendingMinutes: number;
  maxPendingGenerationRequests: number;
  maxOldestGenerationMinutes: number;
  maxFailedRunRatio: number;
  minRunsForFailureRatio: number;
  maxRpcLatencyMs: number;
  rpcSamples: number;
}

export interface A14HealthCheck {
  id: string;
  value: number;
  threshold?: number;
  sample?: number;
  samples?: number;
  ok: boolean;
}

export interface A14HealthEvaluation {
  ok: boolean;
  failures: string[];
  warnings: string[];
  checks: A14HealthCheck[];
}

export interface A14HealthSnapshot {
  generatedAt?: string;
  source?: string;
  db?: {
    runs?: Record<string, unknown>;
    queues?: Record<string, unknown>;
    rpc?: Record<string, unknown>;
  };
}

export const DEFAULT_LOCAL_DSN: string;
export const LOCAL_HOSTS: readonly string[];
export const DEFAULT_THRESHOLDS: A14HealthThresholds;

export function isLocalDsn(dsn: string): boolean;

export function assertLocalDsn(
  dsn: string,
  env?: Record<string, string | undefined>
): void;

export function evaluateHealth(
  snapshot: A14HealthSnapshot,
  thresholds?: Partial<A14HealthThresholds>
): A14HealthEvaluation;

export function formatHealthFr(
  snapshot: A14HealthSnapshot,
  evaluation: A14HealthEvaluation
): string;

export function measureRpcLatency(
  client: { query: (sql: string) => Promise<unknown> },
  samples?: number
): Promise<{ name: string; samples: number; avgMs: number; p95Ms: number }>;

export function collectSnapshot(input?: {
  databaseUrl: string;
  log?: (...args: unknown[]) => void;
}): Promise<A14HealthSnapshot>;

export function main(
  argv?: string[],
  env?: Record<string, string | undefined>,
  log?: (...args: unknown[]) => void
): Promise<number>;
