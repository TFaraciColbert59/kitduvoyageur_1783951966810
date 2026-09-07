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

export interface BlurredCoordinates {
  latitude: number;
  longitude: number;
  radiusKm: number;
  blurred: boolean;
  isIrreversible: boolean;
}

/**
 * LIGNE ROUGE 4 : Floutage de sécurité écologique (D17).
 * Alignement sur grille avec arrondi destructif (non réversible).
 * Deux coordonnées voisines dans la même cellule sont projetées sur le même point de grille,
 * rendant mathématiquement impossible la déduction de la coordonnée réelle par inversion analytique.
 */
export function blurSensitiveCoordinates(
  lat: number,
  lon: number,
  radiusKm = 1.5
): BlurredCoordinates {
  // 1 degré de latitude ~= 111.32 km
  const gridStepLat = radiusKm / 111.32;
  const cosLat = Math.cos((lat * Math.PI) / 180) || 1;
  const gridStepLon = radiusKm / (111.32 * Math.abs(cosLat));

  // Alignement sur grille (quantification destructive many-to-one)
  const cellY = Math.floor(lat / gridStepLat);
  const cellX = Math.floor(lon / gridStepLon);

  // Projection au centre de la cellule de grille + arrondi destructif à 3 décimales (~110 m)
  const rawBlurredLat = (cellY + 0.5) * gridStepLat;
  const rawBlurredLon = (cellX + 0.5) * gridStepLon;

  let blurredLat = Number(rawBlurredLat.toFixed(3));
  let blurredLon = Number(rawBlurredLon.toFixed(3));

  // Garantie que le point flouté ne coïncide pas exactement avec la coordonnée d'entrée
  if (Math.abs(blurredLat - lat) < 0.0005) {
    blurredLat = Number((rawBlurredLat + gridStepLat * 0.3).toFixed(3));
  }
  if (Math.abs(blurredLon - lon) < 0.0005) {
    blurredLon = Number((rawBlurredLon + gridStepLon * 0.3).toFixed(3));
  }

  return {
    latitude: blurredLat,
    longitude: blurredLon,
    radiusKm,
    blurred: true,
    isIrreversible: true,
  };
}
