import type { TripBrief, Proposal } from '../schemas/autoGen.schema';

export type SafetyRedLineCode =
  | 'GLACIAL_ALPINISM_RESTRICTED'
  | 'MEAE_RED_ZONE'
  | 'NO_MEDICAL_PRESCRIPTION'
  | 'WATER_AUTONOMY_CRITICAL'
  | 'ECOLOGICAL_SANCTUARY_TRESPASS';

export interface SafetyRedLineViolation {
  code: SafetyRedLineCode;
  severity: 'block' | 'warning';
  message: string;
  remedy: string;
}

export interface SafetyCheckResult {
  allowed: boolean;
  violations: SafetyRedLineViolation[];
}

const MEAE_RED_ZONES = [
  'sahel',
  'mali',
  'niger',
  'somalia',
  'somalie',
  'yemen',
  'yémen',
  'syrie',
  'afghanistan',
];

/**
 * Gardien des 5 Lignes Rouges Infranchissables (§9 SAFETY_LIMITS.md).
 * Aucun voyage ne peut être publié s'il viole une contrainte vitale.
 */
export function checkSafetyRedLines(
  brief: TripBrief,
  proposals: Record<string, Proposal<any>>
): SafetyCheckResult {
  const violations: SafetyRedLineViolation[] = [];
  const rawLower = (brief.rawInput || '').toLowerCase();

  // LIGNE ROUGE 1 : Zéro Alpinisme Glaciaire Non Encadré
  const itin = proposals.itinerary;
  const isGlacialTerrain =
    itin?.value?.terrain === 'glacier_crevasse' ||
    itin?.value?.requiresCramponsIceAxe === true ||
    rawLower.includes('vallée blanche') ||
    rawLower.includes('vallee blanche') ||
    rawLower.includes('arête des bosses') ||
    rawLower.includes('arete des bosses');

  if (isGlacialTerrain) {
    violations.push({
      code: 'GLACIAL_ALPINISM_RESTRICTED',
      severity: 'block',
      message:
        'Itinéraire glaciaire crevassé détecté. L’alpinisme en autonomie présente un risque mortel objectif.',
      remedy:
        'Encadrement obligatoire par un guide de haute montagne UIAGM ou déviation sur itinéraire de randonnée pédestre balisé.',
    });
  }

  // LIGNE ROUGE 2 : Zéro Zone Rouge MEAE
  const destinationLower = brief.destinations.value
    .map((d) => `${d.country} ${d.region || ''}`)
    .join(' ')
    .toLowerCase();

  const isMeaeRed = MEAE_RED_ZONES.some(
    (zone) => rawLower.includes(zone) || destinationLower.includes(zone)
  );

  if (isMeaeRed) {
    violations.push({
      code: 'MEAE_RED_ZONE',
      severity: 'block',
      message:
        'Destination classée en zone rouge (formellement déconseillée) par le Ministère de l’Europe et des Affaires Étrangères.',
      remedy:
        'Génération interrompue pour votre sécurité. Veuillez choisir une destination en zone sécurisée.',
    });
  }

  // LIGNE ROUGE 3 : Zéro Prescription Médicale
  const safetyLayer = proposals.safety;
  const drugs = safetyLayer?.value?.recommendedDrugs || [];
  const hasMedicalDosage =
    drugs.some((d: string) => /\b\d+\s*(?:mg|ml|g)\b/i.test(d) || /par jour/i.test(d)) ||
    /diamox/i.test(JSON.stringify(safetyLayer?.value || ''));

  if (hasMedicalDosage) {
    violations.push({
      code: 'NO_MEDICAL_PRESCRIPTION',
      severity: 'block',
      message:
        'Prescription ou posologie médicamenteuse détectée. LKDV n’est pas un professionnel de santé habilité.',
      remedy:
        'LKDV ne délivre aucune ordonnance ni posologie. Consultez votre médecin traitant ou un centre de médecine de montagne. En cas d’urgence, composez le 112 ou le 15.',
    });
  }

  // LIGNE ROUGE 5 : Seuil d’Autonomie Hydrique Critique
  const waterLayer = proposals.food_water;
  const maxDryDist = waterLayer?.value?.maxDistanceWithoutWaterKm || 0;
  const waterCap = waterLayer?.value?.waterCapacityLiters || 2.0;

  if (maxDryDist > 25 && waterCap < 3.0) {
    violations.push({
      code: 'WATER_AUTONOMY_CRITICAL',
      severity: 'warning',
      message: `Section aride de plus de ${maxDryDist} km sans point d’eau certifié avec une réserve insuffisante (${waterCap} L).`,
      remedy:
        'Prévoir une capacité de transport d’eau minimale de 3,5 L par personne et un système de filtration mécanique certifié.',
    });
  }

  const hasBlockingViolation = violations.some((v) => v.severity === 'block');

  return {
    allowed: !hasBlockingViolation,
    violations,
  };
}

/**
 * LIGNE ROUGE 4 : Floutage de sécurité écologique de 1,5 km.
 * Décale déterministement les coordonnées sensibles pour préserver les biotopes fragiles.
 */
export function blurSensitiveCoordinates(
  lat: number,
  lon: number,
  radiusKm = 1.5
): {
  latitude: number;
  longitude: number;
  radiusKm: number;
  blurred: boolean;
} {
  // 1 degré de latitude ~= 111.32 km
  const deltaLat = (radiusKm / 111.32) * 0.707;
  // 1 degré de longitude ~= 111.32 * cos(lat)
  const deltaLon =
    (radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * 0.707;

  return {
    latitude: Number((lat + deltaLat).toFixed(4)),
    longitude: Number((lon + deltaLon).toFixed(4)),
    radiusKm,
    blurred: true,
  };
}
