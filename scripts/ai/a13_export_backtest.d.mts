/**
 * A13 (S8) — Déclarations TypeScript du module d'export anonymisé
 * (`a13_export_backtest.mjs`), consommé par les tests vitest.
 */

export type BacktestTerrainBucket = 'flat' | 'ascent' | 'descent' | 'technical';

export interface AnonymizedBacktestSample {
  predictedP50Seconds: number;
  predictedP90Seconds: number;
  actualSeconds: number;
  predictedDifficulty: number | null;
  feltDifficulty: number | null;
  terrainBucket: BacktestTerrainBucket | null;
  source: 'route' | 'segment';
  userHash: string | null;
  sessionHash: string | null;
  modelVersion: string | null;
}

export interface BacktestExportCounts {
  routeRows: number;
  segmentRows: number;
  routeSamples: number;
  segmentSamples: number;
  skippedRouteRows: number;
  skippedSegmentRows: number;
  samples: number;
  usersHashed: number;
  minSamples: number;
  sufficient: boolean;
}

export interface BacktestExportDatabaseCounts {
  routePredictions?: number | null;
  segmentPredictions?: number | null;
  hikeSessions?: number | null;
  sessionSegmentPassages?: number | null;
  [key: string]: number | null | undefined;
}

export interface BacktestExportReadError {
  scope?: string;
  message?: string;
}

export interface BuildBacktestSamplesInput {
  routeRows?: readonly Record<string, unknown>[];
  segmentRows?: readonly Record<string, unknown>[];
  salt?: string;
  minSamples?: number;
}

export interface BacktestExportResult {
  samples: AnonymizedBacktestSample[];
  counts: BacktestExportCounts;
  outputPath: string;
  database: BacktestExportDatabaseCounts;
  errors: BacktestExportReadError[];
}

export const MIN_BACKTEST_SAMPLES: number;
export const MAX_BACKTEST_SAMPLES: number;
export const SAMPLE_KEYS: readonly string[];
export const TECHNICAL_SAC_SCALES: readonly string[];
export const TECHNICAL_SURFACES: readonly string[];

export function hashAnonymousId(value: unknown, salt?: string): string | null;

export function deriveTerrainBucket(input?: {
  gainM?: unknown;
  lossM?: unknown;
  sacScale?: unknown;
  surface?: unknown;
}): BacktestTerrainBucket | null;

export function buildSamplesFromRows(input?: BuildBacktestSamplesInput): {
  samples: AnonymizedBacktestSample[];
  counts: BacktestExportCounts;
};

export function serializeSamplesJsonl(samples: readonly AnonymizedBacktestSample[]): string;

export function formatExportSummaryFr(input?: {
  counts?: Partial<BacktestExportCounts> | null;
  outputPath?: string | null;
  database?: BacktestExportDatabaseCounts | null;
  errors?: readonly BacktestExportReadError[];
}): string;

export function loadDatabaseUrl(env?: Record<string, string | undefined>): string | null;

export function formatCountsLine(input: {
  counts: BacktestExportCounts;
  database: BacktestExportDatabaseCounts;
  errors: readonly BacktestExportReadError[];
  outputPath: string;
}): string;

export function exportBacktestSamples(input: {
  databaseUrl: string;
  salt?: string;
  log?: (...args: unknown[]) => void;
}): Promise<BacktestExportResult>;
