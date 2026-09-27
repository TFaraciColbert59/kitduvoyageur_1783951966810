import { MEAL_SLOT_LABELS, type ItineraryModel, type MealNeed, type MealSlot, type WaterNeed } from '../types';
import { daySteps } from './itinerary';

const SLOTS: readonly MealSlot[] = ['petit_dejeuner', 'dejeuner', 'diner'];

/**
 * Un besoin d'eau par journee. Le volume reste `null` tant qu'aucune source ne
 * donne la longueur du segment : mieux vaut une question qu'un chiffre faux.
 */
export function waterNeeds(model: ItineraryModel | null): WaterNeed[] {
  if (!model) return [];
  const needs: WaterNeed[] = [];
  for (let day = 1; day <= model.days; day += 1) {
    const steps = daySteps(model, day);
    if (steps.length === 0) continue;
    const anchor = steps[0];
    const refill = steps.find((step) => step.kind === 'ravitaillement');
    needs.push({
      stepId: anchor.id,
      litersPerPerson: null,
      confidence: refill ? 'fiable' : 'incertaine',
      refillPlaceName: refill ? refill.placeName : null,
      alternativePlaceName: null,
    });
  }
  return needs;
}

/** Trois repas par journee, couverts seulement si une etape le dit. */
export function mealNeeds(model: ItineraryModel | null): MealNeed[] {
  if (!model) return [];
  const needs: MealNeed[] = [];
  for (let day = 1; day <= model.days; day += 1) {
    const steps = daySteps(model, day);
    for (const slot of SLOTS) {
      const covered = steps.find((step) => step.kind === 'ravitaillement' && step.mealSlot === slot);
      needs.push({
        day,
        slot,
        coveredByStepId: covered ? covered.id : null,
        label: MEAL_SLOT_LABELS[slot],
      });
    }
  }
  return needs;
}

export function uncoveredMeals(needs: readonly MealNeed[]): MealNeed[] {
  return needs.filter((need) => need.coveredByStepId === null);
}
