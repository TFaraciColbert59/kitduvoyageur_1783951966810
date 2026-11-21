/**
 * Calcul d'autonomie eau, nourriture et énergie à partir des éléments réels (P07-36, P07-37).
 */

export interface ConsumablesAutonomy {
  waterLitersNeeded: number;
  mealsNeeded: number;
  batteryHoursEstimate: number | null;
}

export function estimateConsumablesAutonomy(input: {
  partySize: number;
  remainingDays: number;
  hotWeather?: boolean;
  powerBankMah?: number | null;
}): ConsumablesAutonomy {
  const people = Math.max(1, Math.round(input.partySize || 1));
  const days = Math.max(0.5, input.remainingDays || 1);
  const litersPerPersonDay = input.hotWeather ? 3.0 : 2.0;
  const waterLitersNeeded = Math.round(people * days * litersPerPersonDay * 10) / 10;
  const mealsNeeded = Math.ceil(people * days * 3);
  // Hypothèse conservatrice : ~350 mAh/h en suivi GPS actif sur smartphone
  const batteryHoursEstimate = input.powerBankMah != null && input.powerBankMah > 0
    ? Math.round((input.powerBankMah * 0.75) / 350)
    : null;

  return { waterLitersNeeded, mealsNeeded, batteryHoursEstimate };
}
