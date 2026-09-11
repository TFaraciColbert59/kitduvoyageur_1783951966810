/**
 * A6 — Versionnement du plan.
 *
 * `diffPlanVersions` compare section par section et expose impacts + gravités ;
 * les sections sensibles (sécurité, budget, réservations, réglementation)
 * exigent une confirmation. `nextVersionMeta` produit les métadonnées de la
 * version suivante (le planId est ajouté par l'appelant).
 */
import {
  ADVENTURE_PLAN_SECTION_KEYS,
  type AdventurePlan,
  type AdventurePlanSectionKey,
  type PlanVersionMeta,
} from './adventurePlan';
import type { Confidence } from './confidence';
import type { EngineSeverity, PlanImpact } from './engine';

export interface PlanChange {
  path: string;
  before: unknown;
  after: unknown;
  requiresConfirmation: boolean;
}

export interface PlanDiff {
  reason: string;
  changes: PlanChange[];
  impacts: PlanImpact[];
}

const CONFIRMATION_SECTIONS = new Set<AdventurePlanSectionKey>([
  'safetyPlan',
  'budget',
  'bookings',
  'regulations',
]);

const CRITICAL_SECTIONS = new Set<AdventurePlanSectionKey>(['safetyPlan']);

const SECTION_LABELS: Record<AdventurePlanSectionKey, string> = {
  transport: 'Transport',
  localMobility: 'Mobilité locale',
  accommodations: 'Hébergements',
  dailyStages: 'Étapes quotidiennes',
  activityRoutes: 'Itinéraires d’activité',
  terrainAnalysis: 'Analyse du terrain',
  personalDifficulty: 'Difficulté personnelle',
  groupDifficulty: 'Difficulté du groupe',
  paceStrategies: 'Stratégies d’allure',
  foodAndWater: 'Alimentation et eau',
  gearPlan: 'Plan d’équipement',
  budget: 'Budget',
  bookings: 'Réservations',
  documents: 'Documents',
  regulations: 'Réglementation',
  safetyPlan: 'Plan de sécurité',
  offlinePackage: 'Pack hors-ligne',
  liveConditions: 'Conditions en direct',
  alternatives: 'Alternatives',
};

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => deepEqual(aRecord[key], bRecord[key]));
}

function sectionOf(path: string): AdventurePlanSectionKey | null {
  const prefix = 'sections.';
  if (!path.startsWith(prefix)) return null;
  const key = path.slice(prefix.length) as AdventurePlanSectionKey;
  return (ADVENTURE_PLAN_SECTION_KEYS as readonly string[]).includes(key) ? key : null;
}

function severityFor(key: AdventurePlanSectionKey): EngineSeverity {
  if (CRITICAL_SECTIONS.has(key)) return 'critical';
  if (CONFIRMATION_SECTIONS.has(key)) return 'warning';
  return 'info';
}

export function diffPlanVersions(prev: AdventurePlan, next: AdventurePlan): PlanDiff {
  const changes: PlanChange[] = [];

  for (const key of ADVENTURE_PLAN_SECTION_KEYS) {
    const before = prev.sections[key];
    const after = next.sections[key];
    if (deepEqual(before, after)) continue;
    changes.push({
      path: `sections.${key}`,
      before,
      after,
      requiresConfirmation: CONFIRMATION_SECTIONS.has(key),
    });
  }

  const impacts: PlanImpact[] = changes.flatMap((change) => {
    const key = sectionOf(change.path);
    if (key === null) return [];
    return [
      {
        id: `impact-${change.path}`,
        section: change.path,
        label: `${SECTION_LABELS[key]} mis à jour`,
        severity: severityFor(key),
      },
    ];
  });

  const reason =
    changes.length === 0
      ? 'Aucun changement détecté'
      : `Mise à jour : ${changes
          .map((change) => {
            const key = sectionOf(change.path);
            return key ? SECTION_LABELS[key] : change.path;
          })
          .join(', ')}`;

  return { reason, changes, impacts };
}

/** Métadonnées de la version suivante : `planId` doit être ajouté par l'appelant. */
export function nextVersionMeta(
  version: number,
  reason: string,
  generatedBy: string,
  confidence: Confidence
): Omit<PlanVersionMeta, 'planId'> {
  return {
    version: Math.trunc(version) + 1,
    reason,
    generatedBy,
    confidence,
    createdAt: new Date().toISOString(),
  };
}
