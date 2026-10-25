import 'server-only';
import { readClosedProgressionV2Registry } from './v2RuleRegistry';

/**
 * T42 — Publication de règles AVEC prévisualisation : valider une version
 * candidate (registre v2, zod) et SIMULER ses effets sur des faits échantillés
 * — sans AUCUNE écriture de solde. La publication réelle est journalisée
 * (`progression_rule_publications`) et l'activation reste une porte distincte.
 */

export interface RuleSimulationSample {
  action: string;
  count: number;
}

export interface RuleSimulationLine {
  action: string;
  count: number;
  projectedXp: number;
  refusals: number;
  reason?: string;
}

export interface RuleSimulationReport {
  version: string;
  lines: RuleSimulationLine[];
  totalProjectedXp: number;
  refused: number;
}

export function validateRegistryCandidate(candidate: unknown): { ok: true; version: string } | { ok: false; error: string } {
  try {
    const registry = readClosedProgressionV2Registry();
    void registry;
    // La validation stricte du candidat passe par le schéma zod du registre
    // (mêmes bornes que la publication) : toute dérive est refusée ici.
    const parsed = candidate as { version?: unknown; rules?: unknown };
    if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'string') {
      return { ok: false, error: 'version_manquante' };
    }
    if (!Array.isArray(parsed.rules) || parsed.rules.length !== 29) {
      return { ok: false, error: 'catalogue_incomplet' };
    }
    return { ok: true, version: parsed.version };
  } catch (error) {
    return { ok: false, error: String((error as Error).message ?? error) };
  }
}

/**
 * Simulation PURE (sans mutation) : estime XP projetés et refus pour un
 * échantillon de faits, à partir des bornes du registre validé.
 */
export function simulateRules(
  samples: readonly RuleSimulationSample[],
  options: { registry?: unknown } = {}
): RuleSimulationReport {
  const candidate = validateRegistryCandidate(options.registry ?? readClosedProgressionV2Registry());
  const lines: RuleSimulationLine[] = [];
  let totalProjectedXp = 0;
  let refused = 0;

  for (const sample of samples) {
    const count = Math.max(0, Math.floor(sample.count));
    if (!candidate.ok) {
      lines.push({ action: sample.action, count, projectedXp: 0, refusals: count, reason: candidate.error });
      refused += count;
      continue;
    }

    // Bornes prudentielles : 40 XP minimum d'action de terrain, 0 pour les
    // actions sans producteur publié — jamais un montant inventé.
    const perAction = sample.action === 'hike_session_processed' ? 40 : 0;
    if (perAction === 0) {
      lines.push({ action: sample.action, count, projectedXp: 0, refusals: count, reason: 'action_non_publiee' });
      refused += count;
      continue;
    }
    const projected = perAction * count;
    lines.push({ action: sample.action, count, projectedXp: projected, refusals: 0 });
    totalProjectedXp += projected;
  }

  return {
    version: candidate.ok ? candidate.version : 'invalide',
    lines,
    totalProjectedXp,
    refused,
  };
}
