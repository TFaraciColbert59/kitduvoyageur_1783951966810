/**
 * A10 (10.11) — Montage du cockpit sur les données réelles du hub.
 *
 * Projection PURE (zéro I/O, zéro React) des lignes réellement persistées
 * (`adventure_plans`, `adventure_plan_decisions`, `route_predictions`,
 * signalements Terrain Live) vers l'entrée de `buildCockpitView`.
 *
 * Règle absolue : aucune valeur inventée. Une donnée absente reste `null`
 * (jamais de P50/P90, de difficulté ou de signalement synthétiques), et le
 * gating `terrain_live` s'applique ici, pas dans l'UI.
 */
import { COLD_CONFIDENCE, type Confidence } from './confidence';
import type {
  CockpitDecisionInput,
  CockpitInput,
  CockpitLiveReportInput,
  CockpitPlanInput,
  CockpitPredictionInput,
  CockpitStrategy,
} from './cockpit';
import { confidenceSchema } from '../schemas/adventurePlan.schema';
import type { TerrainSeverity } from '../schemas/live.schema';

/** Plafond de signalements montrés/montés depuis le hub (vue calme). */
export const HUB_TERRAIN_REPORT_LIMIT = 5;

export interface HubPlanRow {
  id: string;
  title: string | null;
  status: string;
  confidence: unknown;
  updatedAt: string | null;
}

export interface HubPredictionRow {
  strategy: string;
  etaP50: string | null;
  etaP90: string | null;
  paceP25: number | null;
  paceP50: number | null;
  paceP75: number | null;
  turnaroundTime: string | null;
  personalDifficulty: number | null;
}

export interface HubDecisionRow {
  id: string;
  proposal: string;
  requiresConfirmation: boolean;
}

export interface HubTerrainReportInput {
  id: string;
  category: string;
  severity: TerrainSeverity;
  distanceM: number;
}

export interface HubCockpitMountingRows {
  plan: HubPlanRow | null;
  prediction: HubPredictionRow | null;
  decisions: readonly HubDecisionRow[];
  terrainEnabled: boolean;
  terrainReports: readonly HubTerrainReportInput[];
}

const COCKPIT_STRATEGIES: readonly CockpitStrategy[] = ['comfort', 'recommended', 'fast'];

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampDifficulty(value: number | null): number | null {
  if (value === null) return null;
  return Math.min(100, Math.max(0, value));
}

/** Confiance persistée valide, sinon confiance froide explicite (jamais inventée). */
export function parsePlanConfidence(value: unknown): Confidence {
  const parsed = confidenceSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return { ...COLD_CONFIDENCE, reasons: [...COLD_CONFIDENCE.reasons] };
}

/** Plan réel → héro cockpit. Les ETA viennent des prédictions persistées, sinon `null`. */
export function planInputFromRow(
  plan: HubPlanRow | null,
  prediction: HubPredictionRow | null
): CockpitPlanInput | null {
  if (!plan) return null;
  return {
    id: plan.id,
    title: plan.title,
    status: plan.status,
    confidence: parsePlanConfidence(plan.confidence),
    personalDifficulty: clampDifficulty(finiteOrNull(prediction?.personalDifficulty)),
    etaP50: prediction?.etaP50 ?? null,
    etaP90: prediction?.etaP90 ?? null,
  };
}

/** Prédiction de route persistée → stratégie, fourchette d'allure, demi-tour. Sans allure : `null`. */
export function predictionInputFromRow(
  row: HubPredictionRow | null
): CockpitPredictionInput | null {
  if (!row) return null;
  const strategy = COCKPIT_STRATEGIES.find((candidate) => candidate === row.strategy);
  if (!strategy) return null;

  const low = finiteOrNull(row.paceP25) ?? finiteOrNull(row.paceP50);
  const high = finiteOrNull(row.paceP75) ?? finiteOrNull(row.paceP50);
  if (low === null || high === null) return null;

  return {
    strategy,
    paceRangeMinPerKm: [Math.min(low, high), Math.max(low, high)],
    turnaroundTime: row.turnaroundTime,
    nextCriticalSegment: null,
    aheadBehindMinutes: null,
  };
}

/** Décisions proposées réelles (proposition non vide uniquement). */
export function decisionInputsFromRows(
  rows: readonly HubDecisionRow[]
): CockpitDecisionInput[] {
  return rows
    .filter((row) => row.proposal.trim().length > 0)
    .map((row) => ({
      id: row.id,
      label: row.proposal,
      requiresConfirmation: row.requiresConfirmation,
    }));
}

/**
 * Gating `terrain_live` : flag inactif ⇒ zéro signalement monté (rien n'est
 * rendu), flag actif ⇒ liste bornée. Ne mute jamais l'entrée.
 */
export function gateHubTerrainReports<T>(enabled: boolean, reports: readonly T[]): T[] {
  if (!enabled) return [];
  return reports.slice(0, HUB_TERRAIN_REPORT_LIMIT);
}

/** Lignes réelles → entrée cockpit complète (`offline` résolu côté client). */
export function buildHubCockpitInput(
  rows: HubCockpitMountingRows
): Omit<CockpitInput, 'offline'> {
  const terrain = gateHubTerrainReports(rows.terrainEnabled, rows.terrainReports);
  return {
    plan: planInputFromRow(rows.plan, rows.prediction),
    prediction: predictionInputFromRow(rows.prediction),
    liveReports: terrain.map(
      (report): CockpitLiveReportInput => ({
        id: report.id,
        category: report.category,
        severity: report.severity,
        distanceM: report.distanceM,
      })
    ),
    decisionsRequired: decisionInputsFromRows(rows.decisions),
    recalcReasons: [],
  };
}
