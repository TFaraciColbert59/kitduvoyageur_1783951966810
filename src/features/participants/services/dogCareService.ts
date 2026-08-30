/**
 * Domain Service for Canine Outdoor Care & Portage calculations.
 */

export const DEFAULT_DOG_PORTAGE_RATIO = 0.15; // 15% of body weight max

/**
 * Calculates maximum safe carrying capacity for a dog.
 * @param dogWeightKg Weight of the dog in kg
 * @param capacityRatio Ratio of body weight (default 0.15 = 15%)
 * @returns Max pack weight in kg, rounded to 1 decimal
 */
export function calculateDogMaxPackWeight(
  dogWeightKg: number,
  capacityRatio: number = DEFAULT_DOG_PORTAGE_RATIO
): number {
  if (dogWeightKg <= 0) return 0;
  const raw = dogWeightKg * capacityRatio;
  return Math.round(raw * 10) / 10;
}

/**
 * Calculates daily water requirements for a hiking dog.
 * Formula from outdoor veterinary specifications:
 * Besoins_Chiens = (poids_chien_kg * 0.05 L) + (denivele_positif / 100 m * 0.02 L)
 * Heat modifier: If temperature > 25°C, total * 1.20
 * @param dogWeightKg Weight in kg
 * @param elevationGainM Cumulative elevation gain in meters (D+)
 * @param temperatureC Ambient temperature in °C
 * @returns Daily water ration in liters, rounded to 2 decimals
 */
export function calculateDogWaterRation(
  dogWeightKg: number,
  elevationGainM: number = 0,
  temperatureC: number = 20
): number {
  if (dogWeightKg <= 0) return 0;

  const baseNeeds = dogWeightKg * 0.05;
  const elevationNeeds = (Math.max(0, elevationGainM) / 100) * 0.02;
  let total = baseNeeds + elevationNeeds;

  if (temperatureC > 25) {
    total *= 1.2;
  }

  return Math.round(total * 100) / 100;
}

/**
 * Calculates daily food ration for an active trail dog.
 * Standard rule: ~25g to 30g of high-protein outdoor kibble per kg of body weight for active days.
 * @param dogWeightKg Weight in kg
 * @param isWorking true if hiking with pack
 * @returns Food ration in grams per day
 */
export function calculateDogFoodRation(
  dogWeightKg: number,
  isWorking: boolean = true
): number {
  if (dogWeightKg <= 0) return 0;
  const gramsPerKg = isWorking ? 28 : 22;
  return Math.round(dogWeightKg * gramsPerKg);
}
