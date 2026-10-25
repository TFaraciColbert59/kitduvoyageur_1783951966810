import { extractTripBrief } from './tripBriefExtractor';
import { solveCoherence } from './coherenceSolver';
import { findClosestBlueprint } from '../blueprints/blueprintRegistry';
import type { TripBrief, Proposal } from '../schemas/autoGen.schema';

export interface AutoGenPipelineOutput {
  brief: TripBrief;
  blueprintId: string;
  layers: Record<string, Proposal<any>>;
  tradeoffsLog: string[];
  executionTimeMs: number;
}

/**
 * Pipeline d'Auto-Génération Intégral en 6 Étages (U13).
 * Exécute l'analyse d'intention, la sélection de blueprint k-NN, l'assemblage
 * des 12 couches fonctionnelles et le solveur de cohérence déterministe.
 */
export async function runAutoGenPipeline(
  rawInput: string,
  userProfile?: any
): Promise<AutoGenPipelineOutput> {
  const startTime = performance.now();

  // Étage 1 : Parsing d'intention déterministe
  const brief = extractTripBrief(rawInput, userProfile);

  // Étage 2 : Sélection du Blueprint canonique le plus proche
  const blueprint = findClosestBlueprint(brief);

  // Étage 3 : Instanciation & Clonage des couches
  const clonedLayers: Record<string, Proposal<any>> = JSON.parse(
    JSON.stringify(blueprint.layers)
  );

  // Étage 4 : Solveur de cohérence et arbitrage de compromis
  const { resolvedLayers, tradeoffsLog } = solveCoherence({
    layers: clonedLayers,
    maxBudgetEur: brief.budget.value.totalEur,
    userBodyWeightKg: 70,
    intensity: brief.intensity.value,
  });

  const executionTimeMs = performance.now() - startTime;

  return {
    brief,
    blueprintId: blueprint.id,
    layers: resolvedLayers,
    tradeoffsLog,
    executionTimeMs,
  };
}
