import type {
  GearItem,
  HumanParticipant,
  DogParticipant,
  ParticipantLoad,
} from '../types/preparation.types';

export const DEFAULT_DOG_PORTAGE_RATIO = 0.15; // 15% du poids corporel max pour un chien
export const DEFAULT_HUMAN_MAX_RATIO = 0.20; // 20% du poids corporel max recommandé pour un humain

/**
 * Calcule la capacité maximale de portage sécuritaire pour un chien.
 * Règle : Poids corporel (kg) * 0.15.
 */
export function calculateDogMaxPackWeight(
  dogWeightKg: number,
  ratio: number = DEFAULT_DOG_PORTAGE_RATIO
): number {
  if (dogWeightKg <= 0) return 0;
  return Math.round(dogWeightKg * ratio * 10) / 10;
}

/**
 * Calcule les besoins hydriques quotidiens pour un chien en trek.
 * Formule : (Poids_kg * 0.05 L) + (D+ / 100m * 0.02 L) + modificateur chaleur > 25°C (+20%).
 */
export function calculateDogWaterRation(
  dogWeightKg: number,
  elevationGainM: number = 0,
  temperatureC: number = 20
): number {
  if (dogWeightKg <= 0) return 0;
  const base = dogWeightKg * 0.05;
  const elevation = (Math.max(0, elevationGainM) / 100) * 0.02;
  let total = base + elevation;
  if (temperatureC > 25) {
    total *= 1.2;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Calcule les rations de croquettes quotidiennes pour un chien actif.
 * Règle : ~28g / kg de poids de corps pour un chien avec bât, ~22g sans portage.
 */
export function calculateDogFoodRation(
  dogWeightKg: number,
  isWorking: boolean = true
): number {
  if (dogWeightKg <= 0) return 0;
  const gramsPerKg = isWorking ? 28 : 22;
  return Math.round(dogWeightKg * gramsPerKg);
}

/**
 * Calcule la répartition de charge entre les participants (humains et chiens porteurs).
 */
export function calculateParticipantLoads(
  items: GearItem[],
  humans: HumanParticipant[],
  dogs: DogParticipant[]
): ParticipantLoad[] {
  const loads: ParticipantLoad[] = [];

  // Poids total des items dans le sac
  const packedItems = items.filter((i) => i.status === 'packed' && !i.isWorn);

  for (const human of humans) {
    // Si des items sont spécifiquement assignés à ce participant, calculer la somme
    const assignedItems = packedItems.filter((i) => i.assignedParticipantId === human.id);
    const assignedWeightKg = assignedItems.length > 0
      ? assignedItems.reduce((acc, i) => acc + (i.weightGrams * (i.quantity || 1)), 0) / 1000
      : human.publicData.packWeightKg;

    const bodyWeightKg = human.publicData.bodyWeightKg || 70;
    const maxSafeWeightKg = Math.round(bodyWeightKg * DEFAULT_HUMAN_MAX_RATIO * 10) / 10;
    const loadPercentage = maxSafeWeightKg > 0 ? Math.round((assignedWeightKg / maxSafeWeightKg) * 100) : 0;

    loads.push({
      participantId: human.id,
      name: human.publicData.firstName,
      type: 'human',
      allocatedWeightKg: Math.round(assignedWeightKg * 10) / 10,
      maxSafeWeightKg,
      loadPercentage,
      isOverloaded: assignedWeightKg > maxSafeWeightKg,
      roleOrBreed: human.publicData.role === 'guide' ? 'Guide' : human.publicData.role === 'medic' ? 'Secouriste' : 'Équipier',
    });
  }

  for (const dog of dogs) {
    const allocatedWeightKg = dog.isCarryingPack ? dog.packWeightKg : 0;
    const maxSafeWeightKg = dog.maxCarryingCapacityKg || calculateDogMaxPackWeight(dog.weightKg);
    const loadPercentage = maxSafeWeightKg > 0 ? Math.round((allocatedWeightKg / maxSafeWeightKg) * 100) : 0;

    loads.push({
      participantId: dog.id,
      name: dog.name,
      type: 'dog',
      allocatedWeightKg: Math.round(allocatedWeightKg * 10) / 10,
      maxSafeWeightKg,
      loadPercentage,
      isOverloaded: allocatedWeightKg > maxSafeWeightKg,
      roleOrBreed: dog.breed,
    });
  }

  return loads;
}
