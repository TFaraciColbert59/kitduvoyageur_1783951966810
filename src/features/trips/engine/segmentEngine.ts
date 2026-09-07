import type { TripStep } from '@/features/trips/types/trip.types';

export interface ReusableSegmentStep {
  title: string;
  description?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  accommodationName?: string;
  transportMode?: string;
  distanceKm?: number;
  elevationGainM?: number;
  elevationLossM?: number;
}

export interface ReusableSegment {
  id: string;
  title: string;
  description?: string;
  countryCode: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  tags: string[];
  steps: ReusableSegmentStep[];
}

export const REUSABLE_SEGMENTS_CATALOG: ReusableSegment[] = [
  {
    id: 'seg-tmb-01',
    title: 'TMB — Étape 1 : Les Houches vers Refuge de Miage',
    description: 'Montée vers le Col de Voza avec vue sur l’Aiguille de Bionnassay puis descente vers les chalets de Miage.',
    countryCode: 'FR',
    difficulty: 'medium',
    distanceKm: 12.5,
    elevationGainM: 850,
    elevationLossM: 320,
    tags: ['tmb', 'mont-blanc', 'refuge', 'alpin'],
    steps: [
      {
        title: 'Les Houches -> Col de Voza',
        description: 'Sentier forestier régulier jusqu’au col panoramique',
        locationName: 'Col de Voza',
        latitude: 45.8672,
        longitude: 6.7725,
        distanceKm: 6.0,
        elevationGainM: 650,
        elevationLossM: 50,
      },
      {
        title: 'Col de Voza -> Chalets de Miage',
        description: 'Traversée du torrent et arrivée au cirque glaciaire',
        locationName: 'Refuge de Miage',
        latitude: 45.8541,
        longitude: 6.7412,
        accommodationName: 'Refuge de Miage',
        distanceKm: 6.5,
        elevationGainM: 200,
        elevationLossM: 270,
      },
    ],
  },
  {
    id: 'seg-gr20-01',
    title: 'GR20 — Étape 1 : Calenzana vers Refuge d’Ortu di u Piobbu',
    description: 'Première étape exigeante sous le soleil corse menant au premier refuge du massif.',
    countryCode: 'FR',
    difficulty: 'hard',
    distanceKm: 11.2,
    elevationGainM: 1360,
    elevationLossM: 60,
    tags: ['gr20', 'corse', 'technique', 'refuge'],
    steps: [
      {
        title: 'Départ Calenzana -> Bocca u Saltu',
        description: 'Montée raide dans le maquis',
        locationName: 'Bocca u Saltu',
        latitude: 42.4921,
        longitude: 8.8752,
        distanceKm: 6.0,
        elevationGainM: 800,
        elevationLossM: 20,
      },
      {
        title: 'Bocca u Saltu -> Refuge Ortu di u Piobbu',
        description: 'Ligne de crête rocheuse vers 1570m',
        locationName: 'Refuge Ortu di u Piobbu',
        latitude: 42.4745,
        longitude: 8.8912,
        accommodationName: 'Refuge Ortu di u Piobbu',
        distanceKm: 5.2,
        elevationGainM: 560,
        elevationLossM: 40,
      },
    ],
  },
  {
    id: 'seg-is-laugavegur-01',
    title: 'Laugavegur — Étape 1 : Landmannalaugar vers Hrafntinnusker',
    description: 'Champs de rhyolite multicolores, sources chaudes et névés d’altitude.',
    countryCode: 'IS',
    difficulty: 'medium',
    distanceKm: 12.0,
    elevationGainM: 470,
    elevationLossM: 50,
    tags: ['islande', 'volcanique', 'bivouac', 'hautes-terres'],
    steps: [
      {
        title: 'Landmannalaugar -> Brennisteinsalda',
        description: 'Passage entre les fumerolles d’obsidienne',
        locationName: 'Brennisteinsalda',
        latitude: 63.9852,
        longitude: -19.0621,
        distanceKm: 4.5,
        elevationGainM: 250,
        elevationLossM: 20,
      },
      {
        title: 'Plateau désertique -> Refuge Hrafntinnusker',
        description: 'Plateau venteux de basalte noir souvent enneigé',
        locationName: 'Hrafntinnusker',
        latitude: 63.9331,
        longitude: -19.1685,
        accommodationName: 'Refuge Hrafntinnusker (Réservation impérative)',
        distanceKm: 7.5,
        elevationGainM: 220,
        elevationLossM: 30,
      },
    ],
  },
];

/**
 * Récupère les segments réutilisables du catalogue avec filtres optionnels
 */
export function getReusableSegments(filter?: {
  countryCode?: string;
  difficulty?: string;
}): ReusableSegment[] {
  let list = [...REUSABLE_SEGMENTS_CATALOG];
  if (filter?.countryCode) {
    const code = filter.countryCode.toUpperCase();
    list = list.filter((s) => s.countryCode.toUpperCase() === code);
  }
  if (filter?.difficulty) {
    list = list.filter((s) => s.difficulty === filter.difficulty);
  }
  return list;
}

/**
 * Insère un segment réutilisable dans une liste d'étapes existantes.
 * Décale proprement les numéros de jours suivants pour éviter toute collision temporelle.
 */
export function insertSegmentIntoTripSteps(
  existingSteps: TripStep[],
  segment: ReusableSegment,
  targetStartDay: number
): TripStep[] {
  const stepsToInsertCount = segment.steps.length;
  const tripId = existingSteps[0]?.trip_id || 'imported-trip';

  // 1. Découper les étapes existantes : celles avant le jour cible et celles au jour cible ou après
  const beforeSteps = existingSteps.filter((s) => s.day_number < targetStartDay);
  const afterSteps = existingSteps
    .filter((s) => s.day_number >= targetStartDay)
    .map((s) => ({
      ...s,
      day_number: s.day_number + stepsToInsertCount,
    }));

  // 2. Transformer les étapes du segment en TripStep complètes
  const newSteps: TripStep[] = segment.steps.map((step, idx) => ({
    id: `seg-step-${segment.id}-${idx + 1}-${Date.now()}`,
    trip_id: tripId,
    day_number: targetStartDay + idx,
    order_index: idx,
    title: step.title,
    description: step.description || null,
    location_name: step.locationName || null,
    latitude: step.latitude ?? null,
    longitude: step.longitude ?? null,
    accommodation_name: step.accommodationName || null,
    transport_mode: (step.transportMode as any) || 'foot',
    distance_km: step.distanceKm ?? null,
    elevation_gain_m: step.elevationGainM ?? null,
    elevation_loss_m: step.elevationLossM ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  // 3. Assembler et ordonner par jour croissant
  const merged = [...beforeSteps, ...newSteps, ...afterSteps].sort((a, b) => {
    if (a.day_number !== b.day_number) return a.day_number - b.day_number;
    return a.order_index - b.order_index;
  });

  return merged;
}
