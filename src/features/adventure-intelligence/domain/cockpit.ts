/**
 * A7 — Cockpit : projection bornée des moteurs (plan A1, prédiction A3,
 * terrain A5) vers une vue unique, lisible et calme.
 *
 * Domaine pur : zéro I/O, zéro Dexie, zéro React. Les bornes UI (max 3
 * indicateurs, max 3 actions) sont imposées ici, pas dans le composant.
 */
import { categoryDisplay } from '@/features/terrain-live/lib/terrainDisplay';
import type { TerrainReportCategory, TerrainSeverity } from '../schemas/live.schema';
import { clamp01, type Confidence } from './confidence';

/** Bornes strictes de la vue cockpit (spec A7 §7.2). */
export const MAX_COCKPIT_INDICATORS = 3;
export const MAX_COCKPIT_ACTIONS = 3;
/** Difficulté personnelle : warning au-delà de 75, critical au-delà de 90. */
export const DIFFICULTY_WARNING_THRESHOLD = 75;
export const DIFFICULTY_CRITICAL_THRESHOLD = 90;
/** Batterie : warning à ≤ 20 %, critical à ≤ 10 %. */
export const BATTERY_WARNING_THRESHOLD = 20;
export const BATTERY_CRITICAL_THRESHOLD = 10;

export type CockpitTone = 'neutral' | 'positive' | 'warning' | 'critical';
export type CockpitActionKind = 'decide' | 'navigate' | 'report';
export type CockpitStrategy = 'comfort' | 'recommended' | 'fast';

export interface CockpitPlanInput {
  id: string;
  title?: string | null;
  status: string;
  confidence: Confidence;
  personalDifficulty: number | null;
  etaP50: string | null;
  etaP90: string | null;
}

export interface CockpitCriticalSegment {
  id: number;
  label: string;
  difficulty: number;
}

export interface CockpitPredictionInput {
  strategy: CockpitStrategy;
  paceRangeMinPerKm: [number, number];
  turnaroundTime: string | null;
  nextCriticalSegment: CockpitCriticalSegment | null;
  aheadBehindMinutes?: number | null;
}

export interface CockpitLiveReportInput {
  id: string;
  category: string;
  severity: TerrainSeverity;
  distanceM: number;
}

export interface CockpitDecisionInput {
  id: string;
  label: string;
  requiresConfirmation: boolean;
}

export interface CockpitInput {
  plan: CockpitPlanInput | null;
  prediction: CockpitPredictionInput | null;
  liveReports: CockpitLiveReportInput[];
  decisionsRequired: CockpitDecisionInput[];
  recalcReasons: string[];
  offline: boolean;
  batteryLevel?: number | null;
}

export interface CockpitHero {
  title: string;
  subtitle: string;
  status: string;
}

export interface CockpitIndicator {
  id: string;
  label: string;
  value: string;
  tone: CockpitTone;
}

export interface CockpitPriorityAction {
  id: string;
  label: string;
  kind: CockpitActionKind;
}

export interface CockpitAlert {
  id: string;
  label: string;
  severity: TerrainSeverity;
}

export interface CockpitEta {
  p50: string | null;
  p90: string | null;
  aheadBehindMinutes: number | null;
}

export interface CockpitView {
  hero: CockpitHero;
  indicators: CockpitIndicator[];
  priorityActions: CockpitPriorityAction[];
  alerts: CockpitAlert[];
  eta: CockpitEta;
  difficulty: { value: number | null; label: string };
  paceStrategy: { id: string; label: string } | null;
  turnaroundTime: string | null;
  confidence: Confidence | null;
  recalcReasons: string[];
  offline: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  active: 'En cours',
  completed: 'Terminée',
  archived: 'Archivée',
};

const STRATEGY_LABELS: Record<CockpitStrategy, string> = {
  comfort: 'Confort',
  recommended: 'Recommandée',
  fast: 'Rapide',
};

const SEVERITY_RANK: Record<TerrainSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function difficultyLabel(value: number | null): string {
  if (value == null) return 'Inconnue';
  if (value <= 40) return 'Facile';
  if (value <= 60) return 'Modérée';
  if (value <= DIFFICULTY_WARNING_THRESHOLD) return 'Exigeante';
  if (value <= DIFFICULTY_CRITICAL_THRESHOLD) return 'Difficile';
  return 'Très difficile';
}

function difficultyTone(value: number): CockpitTone {
  if (value > DIFFICULTY_CRITICAL_THRESHOLD) return 'critical';
  if (value > DIFFICULTY_WARNING_THRESHOLD) return 'warning';
  if (value > 50) return 'neutral';
  return 'positive';
}

function batteryTone(value: number): CockpitTone {
  if (value <= BATTERY_CRITICAL_THRESHOLD) return 'critical';
  if (value <= BATTERY_WARNING_THRESHOLD) return 'warning';
  return 'neutral';
}

function confidenceTone(confidence: Confidence): CockpitTone {
  if (confidence.level === 'high') return 'positive';
  if (confidence.level === 'medium') return 'neutral';
  return 'warning';
}

function validIsoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

function buildIndicators(input: CockpitInput): CockpitIndicator[] {
  const indicators: CockpitIndicator[] = [];

  const difficulty = input.plan?.personalDifficulty;
  if (typeof difficulty === 'number' && Number.isFinite(difficulty)) {
    const bounded = Math.min(100, Math.max(0, difficulty));
    indicators.push({
      id: 'difficulty',
      label: 'Difficulté',
      value: `${Math.round(bounded)}/100`,
      tone: difficultyTone(bounded),
    });
  }

  const reports = input.liveReports ?? [];
  if (reports.length > 0) {
    const hasCritical = reports.some((report) => report.severity === 'critical');
    const hasWarning = reports.some((report) => report.severity === 'warning');
    indicators.push({
      id: 'alerts',
      label: 'Signalements',
      value: `${reports.length}`,
      tone: hasCritical ? 'critical' : hasWarning ? 'warning' : 'neutral',
    });
  }

  if (input.decisionsRequired.length > 0) {
    indicators.push({
      id: 'decisions',
      label: 'Décisions requises',
      value: `${input.decisionsRequired.length}`,
      tone: 'warning',
    });
  }

  if (typeof input.batteryLevel === 'number' && Number.isFinite(input.batteryLevel)) {
    const bounded = Math.min(100, Math.max(0, input.batteryLevel));
    indicators.push({
      id: 'battery',
      label: 'Batterie',
      value: `${Math.round(bounded)} %`,
      tone: batteryTone(bounded),
    });
  }

  if (input.plan) {
    indicators.push({
      id: 'confidence',
      label: 'Confiance',
      value: `${Math.round(clamp01(input.plan.confidence.score) * 100)} %`,
      tone: confidenceTone(input.plan.confidence),
    });
  }

  return indicators.slice(0, MAX_COCKPIT_INDICATORS);
}

function buildActions(input: CockpitInput): CockpitPriorityAction[] {
  const actions: CockpitPriorityAction[] = [];

  const decisions = [...input.decisionsRequired].sort(
    (a, b) => Number(b.requiresConfirmation) - Number(a.requiresConfirmation)
  );
  for (const decision of decisions) {
    actions.push({ id: decision.id, label: decision.label, kind: 'decide' });
  }

  if (input.plan) {
    actions.push({ id: 'action-report', label: 'Signaler un problème', kind: 'report' });
  }

  const segment = input.prediction?.nextCriticalSegment;
  if (segment) {
    actions.push({ id: 'action-navigate', label: `Aller au segment ${segment.label}`, kind: 'navigate' });
  }

  return actions.slice(0, MAX_COCKPIT_ACTIONS);
}

function buildAlerts(input: CockpitInput): CockpitAlert[] {
  return (input.liveReports ?? [])
    .map((report) => ({
      id: report.id,
      label: `${categoryDisplay(report.category as TerrainReportCategory).label} à ${Math.max(
        0,
        Math.round(report.distanceM)
      )} m`,
      severity: report.severity,
      distanceM: report.distanceM,
    }))
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.distanceM - b.distanceM
    )
    .map(({ id, label, severity }) => ({ id, label, severity }));
}

function buildEta(input: CockpitInput): CockpitEta {
  const p50 = validIsoOrNull(input.plan?.etaP50);
  let p90 = validIsoOrNull(input.plan?.etaP90);
  if (p50 && p90 && Date.parse(p90) < Date.parse(p50)) p90 = p50;

  const ahead = input.prediction?.aheadBehindMinutes;
  return {
    p50,
    p90,
    aheadBehindMinutes: typeof ahead === 'number' && Number.isFinite(ahead) ? ahead : null,
  };
}

function buildHero(input: CockpitInput): CockpitHero {
  const status = input.plan
    ? STATUS_LABELS[input.plan.status] ?? input.plan.status
    : 'Aucune aventure';
  const title = input.plan?.title?.trim() || 'Aventure';

  let subtitle: string;
  if (input.offline) {
    subtitle = 'Mode hors-ligne — données locales';
  } else if (input.prediction?.nextCriticalSegment) {
    subtitle = `Prochain point critique : ${input.prediction.nextCriticalSegment.label}`;
  } else if (input.plan?.personalDifficulty != null) {
    subtitle = `Difficulté personnelle ${Math.round(input.plan.personalDifficulty)}/100`;
  } else if (input.plan) {
    subtitle = 'Prêt à consulter';
  } else {
    subtitle = 'Aucune aventure active';
  }

  return { title, subtitle, status };
}

/**
 * Construit la vue cockpit : un seul héro, 0-3 indicateurs, 0-3 actions,
 * alertes verticales triées gravité puis distance, ETA toujours en fourchette.
 */
export function buildCockpitView(input: CockpitInput): CockpitView {
  const difficultyValue =
    input.plan?.personalDifficulty != null && Number.isFinite(input.plan.personalDifficulty)
      ? Math.round(Math.min(100, Math.max(0, input.plan.personalDifficulty)))
      : null;

  return {
    hero: buildHero(input),
    indicators: buildIndicators(input),
    priorityActions: buildActions(input),
    alerts: buildAlerts(input),
    eta: buildEta(input),
    difficulty: { value: difficultyValue, label: difficultyLabel(difficultyValue) },
    paceStrategy: input.prediction
      ? {
          id: input.prediction.strategy,
          label: STRATEGY_LABELS[input.prediction.strategy] ?? input.prediction.strategy,
        }
      : null,
    turnaroundTime: input.prediction?.turnaroundTime ?? null,
    confidence: input.plan?.confidence ?? null,
    recalcReasons: [...input.recalcReasons],
    offline: input.offline,
  };
}
