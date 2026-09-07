import type { Proposal } from '../schemas/autoGen.schema';

export interface CoherenceSolverInput {
  layers: Record<string, Proposal<any>>;
  maxBudgetEur?: number;
  userBodyWeightKg?: number;
  intensity?: {
    dailyKmMax?: number;
    dailyGainMax?: number;
    restEvery?: number;
  };
}

export interface CoherenceSolverOutput {
  resolvedLayers: Record<string, Proposal<any>>;
  tradeoffsLog: string[];
}

/**
 * Solveur de Cohérence Déterministe (Loi 2, Loi 3, Loi 4).
 * Ajuste les compromis (Tradeoffs) en respectant strictement les verrous (locked: true).
 */
export function solveCoherence(input: CoherenceSolverInput): CoherenceSolverOutput {
  const resolvedLayers: Record<string, Proposal<any>> = { ...input.layers };
  const tradeoffsLog: string[] = [];

  const maxBudget = input.maxBudgetEur;
  const userBodyWeight = input.userBodyWeightKg || 70;
  const maxPackWeightKg = userBodyWeight * 0.20; // Seuil physiologique max de 20%

  // 1. Règle Budgétaire (Tradeoff Hébergement si dépassement)
  if (maxBudget !== undefined && maxBudget > 0) {
    const budgetLayer = resolvedLayers.budget;
    const currentTotal = budgetLayer?.value?.totalPerPersonEur ?? budgetLayer?.value?.totalEur;
    const accomLayer = resolvedLayers.accommodations;

    const accomPrice = accomLayer?.value?.priceEur || 0;
    const isOverBudget = (currentTotal !== undefined && currentTotal > maxBudget) || (accomPrice > maxBudget);

    if (isOverBudget && accomLayer) {
      if (accomLayer.locked) {
        // Loi 3: L'utilisateur a verrouillé cet hébergement, le solveur ne touche à rien
        tradeoffsLog.push(
          `Contrainte dure maintenue : hébergement "${accomLayer.value.name || 'sélectionné'}" verrouillé par l'utilisateur malgré le dépassement de budget.`
        );
      } else if (accomLayer.alternatives && accomLayer.alternatives.length > 0) {
        // Recherche de la meilleure alternative économique
        const cheaperAlt = accomLayer.alternatives.reduce((cheapest, current) => {
          const currentPrice = current.value?.priceEur ?? Infinity;
          const cheapestPrice = cheapest.value?.priceEur ?? Infinity;
          return currentPrice < cheapestPrice ? current : cheapest;
        }, accomLayer.alternatives[0]);

        if (cheaperAlt && (cheaperAlt.value?.priceEur ?? Infinity) < accomPrice) {
          const originalName = accomLayer.value?.name || 'Hébergement initial';
          const newName = cheaperAlt.value?.name || 'Alternative économique';
          const newPrice = cheaperAlt.value?.priceEur ?? 0;

          resolvedLayers.accommodations = {
            ...cheaperAlt,
            impacts: Array.from(new Set([...(cheaperAlt.impacts || []), 'slot-budget'])),
          };

          if (budgetLayer && budgetLayer.value) {
            const savings = accomPrice - newPrice;
            resolvedLayers.budget = {
              ...budgetLayer,
              value: {
                ...budgetLayer.value,
                totalPerPersonEur: Math.max(0, (currentTotal || maxBudget) - savings),
              },
            };
          }

          tradeoffsLog.push(
            `Ajustement budget : bascule de l'hébergement ("${originalName}" à ${accomPrice}€) vers "${newName}" (${newPrice}€) pour respecter le budget cible de ${maxBudget}€.`
          );
        }
      }
    }
  }

  // 2. Règle Poids de Sac / Autonomie
  const kitLayer = resolvedLayers.kit;
  if (kitLayer && kitLayer.value?.targetWeightKg) {
    const currentWeight = kitLayer.value.targetWeightKg;
    if (currentWeight > maxPackWeightKg) {
      if (kitLayer.locked) {
        tradeoffsLog.push(
          `Contrainte dure maintenue : kit d'équipement verrouillé à ${currentWeight} kg (> seuil recommandé de ${maxPackWeightKg.toFixed(1)} kg).`
        );
      } else if (kitLayer.alternatives && kitLayer.alternatives.length > 0) {
        const lighterAlt = kitLayer.alternatives.find(
          (alt) => (alt.value?.targetWeightKg ?? Infinity) <= maxPackWeightKg
        ) || kitLayer.alternatives[0];

        if (lighterAlt && (lighterAlt.value?.targetWeightKg ?? Infinity) < currentWeight) {
          resolvedLayers.kit = lighterAlt;
          tradeoffsLog.push(
            `Ajustement portage : kit allégé à ${lighterAlt.value.targetWeightKg} kg pour respecter la limite ergonomique des 20% du poids de corps (${maxPackWeightKg.toFixed(1)} kg).`
          );
        }
      }
    }
  }

  // 3. Règle Ravitaillement Alimentation / Eau
  const foodLayer = resolvedLayers.food_water;
  if (foodLayer && resolvedLayers.kit?.value?.targetWeightKg > 12 && !foodLayer.locked) {
    // Si portage lourd, augmenter la fréquence de ravitaillement pour porter moins de nourriture
    if (foodLayer.value?.resupplyEveryDays > 2) {
      resolvedLayers.food_water = {
        ...foodLayer,
        value: {
          ...foodLayer.value,
          resupplyEveryDays: 2,
        },
      };
      tradeoffsLog.push(
        `Optimisation ravitaillement : ravitaillement rapproché tous les 2 jours pour réduire la charge de vivres portée.`
      );
    }
  }

  return {
    resolvedLayers,
    tradeoffsLog,
  };
}
