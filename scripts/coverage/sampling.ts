/**
 * Phase 4 — Étape 10 du pipeline : échantillonnage humain.
 *
 * Le pipeline ne décide JAMAIS qu'une région est bonne : il prépare un plan
 * d'échantillonnage déterministe (mêmes entrées ⇒ mêmes parcours) et vérifie
 * qu'un humain a rendu un verdict sur au moins 20 parcours.
 */
import type { NormalizedRoute } from './types';
import { routeFingerprint } from './dedupe';

export interface SamplingPlanEntry {
  routeKey: string;
  externalId: string;
  name: string;
  fingerprint: string;
}

export interface SamplingPlan {
  required: number;
  entries: SamplingPlanEntry[];
  /** Vrai si le catalogue contient au moins `required` parcours. */
  achievable: boolean;
}

export interface SamplingChecklistEntry {
  routeKey: string;
  reviewer: string;
  reviewedAt: string;
  verdict: 'ok' | 'problem';
  notes?: string;
}

export interface SamplingEvaluation {
  complete: boolean;
  okCount: number;
  failures: string[];
}

export const REQUIRED_SAMPLES = 20;

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Plan déterministe : tri par empreinte puis sélection sans remise guidée par
 * une graine textuelle. Aucune préférence esthétique, aucun biais de nom.
 */
export function buildSamplingPlan(
  routes: readonly NormalizedRoute[],
  options: { size?: number; seed?: string } = {}
): SamplingPlan {
  const required = options.size ?? REQUIRED_SAMPLES;
  const seed = options.seed ?? 'phase4';
  const candidates = routes
    .map((route) => ({
      externalId: route.externalId,
      name: route.name,
      fingerprint: routeFingerprint(route),
    }))
    .sort((left, right) =>
      left.fingerprint === right.fingerprint
        ? left.externalId.localeCompare(right.externalId)
        : left.fingerprint.localeCompare(right.fingerprint)
    );

  const random = mulberry32(hashSeed(seed));
  const pool = [...candidates];
  const entries: SamplingPlanEntry[] = [];
  const target = Math.min(required, pool.length);

  for (let index = 0; index < target; index += 1) {
    const picked = Math.floor(random() * pool.length);
    const [candidate] = pool.splice(picked, 1);
    entries.push({ ...candidate, routeKey: candidate.fingerprint });
  }

  return { required, entries, achievable: candidates.length >= required };
}

export function evaluateSampling(
  checklist: readonly SamplingChecklistEntry[],
  plan: SamplingPlan
): SamplingEvaluation {
  const failures: string[] = [];
  const expectedKeys = new Set(plan.entries.map((entry) => entry.routeKey));
  const reviewed = new Map<string, SamplingChecklistEntry>();

  for (const entry of checklist) {
    if (!expectedKeys.has(entry.routeKey)) {
      failures.push(`Échantillon hors plan : ${entry.routeKey} (aucune revue attendue).`);
      continue;
    }
    if (!entry.reviewer || entry.reviewer.trim().length === 0) {
      failures.push(`Échantillon ${entry.routeKey} sans relecteur identifié.`);
      continue;
    }
    if (!entry.reviewedAt || Number.isNaN(new Date(entry.reviewedAt).getTime())) {
      failures.push(`Échantillon ${entry.routeKey} sans date de revue valide.`);
      continue;
    }
    if (reviewed.has(entry.routeKey)) {
      failures.push(`Échantillon ${entry.routeKey} revu plusieurs fois.`);
      continue;
    }
    reviewed.set(entry.routeKey, entry);
  }

  const okCount = [...reviewed.values()].filter((entry) => entry.verdict === 'ok').length;

  for (const entry of plan.entries) {
    const review = reviewed.get(entry.routeKey);
    if (!review) {
      failures.push(`Parcours non échantillonné : ${entry.externalId}.`);
      continue;
    }
    if (review.verdict !== 'ok') {
      failures.push(`Parcours signalé (problème) : ${entry.externalId}.`);
    }
  }

  const complete = failures.length === 0 && plan.entries.length === plan.required;
  return { complete, okCount, failures };
}
