import type {
  PlannerInput,
  PlannerOutput,
  EngineCandidateData,
  GeneratedStep,
  GeneratedItem,
  PlannerWarning,
  CandidateStep,
  GenerateItineraryInput,
} from './types';
import { allocateDays } from './allocateDays';
import { checkSeasonalityForDates } from './seasonality';
import { evaluateTransit } from './travelTime';
import { selectCandidateStepsForCountry, selectCandidateItems } from './selectCandidates';
import { SEED_DESTINATION_STEPS } from '../data/destinationsSeed';

/**
 * Feature flag pour le fallback du générateur d'itinéraire (D1)
 */
export const NEXT_PUBLIC_FF_ITINERARY_FALLBACK =
  process.env.NEXT_PUBLIC_FF_ITINERARY_FALLBACK !== 'false';

/**
 * Tracés pilotes de référence (Tier 1 - Template)
 */
interface PilotStep {
  title: string;
  location: string;
  lat: number;
  lng: number;
  dist: number;
  dPlus: number;
  dMinus: number;
  is_demanding?: boolean;
}

const PILOT_TEMPLATES: Record<
  string,
  { title: string; country_code: string; steps: PilotStep[] }
> = {
  gr20: {
    title: 'GR20 (Corse)',
    country_code: 'FR',
    steps: [
      { title: 'Calenzana à Ortu di u Piobbu', location: 'Refuge d’Ortu di u Piobbu', lat: 42.4744, lng: 8.8953, dist: 11, dPlus: 1360, dMinus: 60, is_demanding: true },
      { title: 'Ortu di u Piobbu à Carrozzu', location: 'Refuge de Carrozzu', lat: 42.4839, lng: 8.9281, dist: 8, dPlus: 780, dMinus: 920 },
      { title: 'Carrozzu à Asco Stagnu', location: 'Haut-Asco', lat: 42.4042, lng: 8.9228, dist: 6, dPlus: 790, dMinus: 640 },
      { title: 'Asco Stagnu à Tighiettu par Monte Cinto', location: 'Refuge de Tighiettu', lat: 42.3683, lng: 8.9328, dist: 9, dPlus: 1200, dMinus: 1050, is_demanding: true },
      { title: 'Tighiettu à Ciottulu di i Mori', location: 'Refuge de Ciottulu di i Mori', lat: 42.3364, lng: 8.8875, dist: 7, dPlus: 620, dMinus: 280 },
      { title: 'Ciottulu di i Mori à Manganu', location: 'Refuge de Manganu', lat: 42.2789, lng: 8.9739, dist: 23, dPlus: 650, dMinus: 1050, is_demanding: true },
      { title: 'Manganu à Petra Piana (Brèche de Capitellu)', location: 'Refuge de Petra Piana', lat: 42.2133, lng: 9.0356, dist: 9, dPlus: 830, dMinus: 600 },
      { title: 'Petra Piana à l’Onda', location: 'Refuge de l’Onda', lat: 42.1625, lng: 9.0683, dist: 10, dPlus: 490, dMinus: 900 },
      { title: 'L’Onda à Vizzavona', location: 'Vizzavona', lat: 42.1289, lng: 9.1308, dist: 10, dPlus: 710, dMinus: 1220 },
      { title: 'Vizzavona aux Capanelle', location: 'Refuge de Capanelle', lat: 42.0628, lng: 9.1678, dist: 15, dPlus: 890, dMinus: 220 },
      { title: 'Capanelle à Prati', location: 'Refuge de Prati', lat: 42.0089, lng: 9.2086, dist: 17, dPlus: 890, dMinus: 600, is_demanding: true },
      { title: 'Prati à Usciolu', location: 'Refuge d’Usciolu', lat: 41.9547, lng: 9.2292, dist: 11, dPlus: 700, dMinus: 750 },
      { title: 'Usciolu à Asinao (Mont Incudine)', location: 'Refuge d’Asinao', lat: 41.8767, lng: 9.2153, dist: 15, dPlus: 850, dMinus: 1020 },
      { title: 'Asinao à Paliri (Aiguilles de Bavella)', location: 'Refuge de Paliri', lat: 41.8158, lng: 9.2894, dist: 13, dPlus: 440, dMinus: 910 },
      { title: 'Paliri à Conca (Terminus GR20)', location: 'Conca', lat: 41.7347, lng: 9.3339, dist: 12, dPlus: 160, dMinus: 970 },
      { title: 'Conca & Repos récupération', location: 'Conca', lat: 41.7347, lng: 9.3339, dist: 0, dPlus: 0, dMinus: 0 },
    ],
  },
  'gr-20': {
    title: 'GR20 (Corse)',
    country_code: 'FR',
    steps: [], // Sera résolu dynamiquement sur 'gr20'
  },
  tmb: {
    title: 'Tour du Mont-Blanc',
    country_code: 'FR',
    steps: [], // Résolu depuis SEED_DESTINATION_STEPS
  },
  'tour-du-mont-blanc': {
    title: 'Tour du Mont-Blanc',
    country_code: 'FR',
    steps: [],
  },
  chamonix: {
    title: 'Massif du Mont-Blanc (Chamonix)',
    country_code: 'FR',
    steps: [],
  },
  laugavegur: {
    title: 'Laugavegur (Islande)',
    country_code: 'IS',
    steps: [],
  },
  annapurna: {
    title: 'Tour des Annapurnas (Népal)',
    country_code: 'NP',
    steps: [],
  },
  salkantay: {
    title: 'Trek du Salkantay (Pérou)',
    country_code: 'PE',
    steps: [],
  },
  toubkal: {
    title: 'Ascension du Mont Toubkal (Maroc)',
    country_code: 'MA',
    steps: [],
  },
};

/**
 * Normalise et résout le tracé d'un template pilote
 */
function resolvePilotTemplate(slug: string): { title: string; country_code: string; steps: CandidateStep[] } | null {
  const norm = slug.toLowerCase().trim();
  const key = norm === 'gr-20' ? 'gr20' : norm;
  const pilot = PILOT_TEMPLATES[key];
  if (!pilot) return null;

  if (key === 'gr20') {
    return {
      title: 'GR20 (Corse)',
      country_code: 'FR',
      steps: PILOT_TEMPLATES.gr20.steps.map((s, idx) => ({
        id: `gr20-step-${idx + 1}`,
        country_code: 'FR',
        title: s.title,
        location_name: s.location,
        latitude: s.lat,
        longitude: s.lng,
        distance_km: s.dist,
        elevation_gain_m: s.dPlus,
        elevation_loss_m: s.dMinus,
        is_demanding: s.is_demanding,
      })),
    };
  }

  // Autres routes pilotes depuis SEED_DESTINATION_STEPS
  const countryCode = pilot.country_code;
  const seedSteps = SEED_DESTINATION_STEPS.filter((s) => s.country_code === countryCode);
  if (seedSteps.length > 0) {
    return {
      title: pilot.title,
      country_code: countryCode,
      steps: seedSteps,
    };
  }

  return null;
}

/**
 * Générateur paramétrique Naismith (Tier 2)
 * Règle Naismith : 4 km/h + 1 h par 600 m D+
 * Repos : 1 jour de repos tous les 6 jours de marche (jour 7, 14, 21, 28...)
 * Arrondi au 0,5 km, report du reliquat sur le dernier jour de marche.
 */
function generateParametricSteps(
  days: number,
  totalDistanceKm: number,
  totalElevationGainM: number,
  countryCode: string
): GeneratedStep[] {
  const effectiveDistance = Math.max(0, totalDistanceKm || 0);
  const effectiveElevation = Math.max(0, totalElevationGainM || 0);

  // Nombre de jours de repos (1 tous les 6 jours de marche -> jour 7, 14, 21...)
  const restDaysCount = Math.floor(days / 7);
  const walkingDaysCount = Math.max(1, days - restDaysCount);

  // Calcul des bases par jour de marche
  const baseKm = walkingDaysCount > 0 ? effectiveDistance / walkingDaysCount : 0;
  const dailyKm = Math.round(baseKm * 2) / 2; // Arrondi au 0,5 km le plus proche

  const baseElev = walkingDaysCount > 0 ? Math.round(effectiveElevation / walkingDaysCount) : 0;

  // Calcul du reliquat pour le dernier jour de marche afin d'avoir une somme exacte
  const remainderKm =
    walkingDaysCount > 1
      ? Math.round((effectiveDistance - dailyKm * (walkingDaysCount - 1)) * 10) / 10
      : effectiveDistance;

  const remainderElev =
    walkingDaysCount > 1
      ? effectiveElevation - baseElev * (walkingDaysCount - 1)
      : effectiveElevation;

  // Trouver l'index du tout dernier jour de marche
  let lastWalkingDay = days;
  for (let d = days; d >= 1; d--) {
    if (d % 7 !== 0) {
      lastWalkingDay = d;
      break;
    }
  }

  const steps: GeneratedStep[] = [];

  for (let d = 1; d <= days; d++) {
    const isRest = d % 7 === 0;

    if (isRest) {
      steps.push({
        day_number: d,
        order_index: 0,
        country_code: countryCode,
        title: `Jour ${d} — Repos & Récupération`,
        description:
          'Journée d’acclimatation et de repos physiologique (règle Naismith : 1 jour de repos tous les 6 jours de marche).',
        location_name: null,
        latitude: null,
        longitude: null,
        transport_mode: null,
        distance_km: 0,
        elevation_gain_m: 0,
        elevation_loss_m: 0,
        accommodation_name: 'Bivouac / Refuge',
        source: 'computed',
      });
    } else {
      const isLast = d === lastWalkingDay;
      const km = isLast ? remainderKm : dailyKm;
      const elev = isLast ? remainderElev : baseElev;
      const naismithHours = km / 4 + elev / 600;

      steps.push({
        day_number: d,
        order_index: 0,
        country_code: countryCode,
        title: `Jour ${d} — Étape de marche`,
        description: `Progression calculée : ${km} km, +${elev}m D+ (durée estimée : ${naismithHours.toFixed(
          1
        )}h selon règle Naismith).`,
        location_name: null,
        latitude: null,
        longitude: null,
        transport_mode: 'foot',
        distance_km: km,
        elevation_gain_m: elev,
        elevation_loss_m: elev,
        accommodation_name: 'Bivouac / Refuge',
        source: 'computed',
      });
    }
  }

  return steps;
}

/**
 * Générateur de squelette (Tier 3)
 * Produit N étapes libres avec bandeau explicite
 */
function generateSkeletonSteps(days: number, countryCode: string): GeneratedStep[] {
  const steps: GeneratedStep[] = [];
  for (let d = 1; d <= days; d++) {
    steps.push({
      day_number: d,
      order_index: 0,
      country_code: countryCode,
      title: `Jour ${d}`,
      description: 'Étape libre à personnaliser',
      location_name: null,
      latitude: null,
      longitude: null,
      transport_mode: null,
      distance_km: null,
      elevation_gain_m: null,
      elevation_loss_m: null,
      accommodation_name: null,
      source: 'skeleton',
    });
  }
  return steps;
}

/**
 * Générateur universel d'itinéraire respectant le contrat à 3 niveaux :
 * 1. Template (pilot routes)
 * 2. Paramétrique (Naismith)
 * 3. Squelette (aucune donnée -> N jours libres)
 * Invariant : JAMAIS de retour [], jamais d'écran vide muet.
 */
export function generateItinerary(input: GenerateItineraryInput): PlannerOutput {
  const rawDays = input.days ?? input.duration_days ?? 1;
  const days = Math.min(400, Math.max(1, Math.round(Number(rawDays) || 1)));

  const countryCode = (
    input.country ||
    (input.countries && input.countries[0]?.country_code) ||
    'FR'
  ).toUpperCase();

  const totalDistance = input.totalDistanceKm ?? 0;
  const totalElevation = input.totalElevationGainM ?? 0;

  // 1. TIER 1 : TEMPLATE
  if (input.slug) {
    const pilot = resolvePilotTemplate(input.slug);
    if (pilot && pilot.steps.length > 0) {
      const arranged = pilot.steps;
      const steps: GeneratedStep[] = [];
      for (let d = 1; d <= days; d++) {
        const candidate = arranged[(d - 1) % arranged.length];
        steps.push({
          day_number: d,
          order_index: 0,
          country_code: pilot.country_code,
          title: candidate.title,
          description: candidate.description || null,
          location_name: candidate.location_name || null,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          transport_mode: candidate.distance_km && candidate.distance_km > 0 ? 'foot' : null,
          distance_km: candidate.distance_km ?? null,
          elevation_gain_m: candidate.elevation_gain_m ?? null,
          elevation_loss_m: candidate.elevation_loss_m ?? null,
          accommodation_name: 'Bivouac / Refuge',
          source: 'template',
        });
      }

      const totalDist = steps.reduce((sum, s) => sum + (s.distance_km || 0), 0);
      const totalElev = steps.reduce((sum, s) => sum + (s.elevation_gain_m || 0), 0);

      return {
        allocations: [{ country_code: pilot.country_code, allocated_days: days, start_day: 1, end_day: days }],
        steps,
        items: [],
        warnings: [],
        total_days: days,
        total_distance_km: Math.round(totalDist * 10) / 10,
        total_elevation_gain_m: totalElev,
        source: 'template',
        sourceLabel: `D'après le tracé ${pilot.title}`,
      };
    }
  }

  // 2. TIER 2 : PARAMÉTRIQUE (si distance ou dénivelé fournis)
  if (totalDistance > 0 || totalElevation > 0) {
    const steps = generateParametricSteps(days, totalDistance, totalElevation, countryCode);
    const sumDist = steps.reduce((sum, s) => sum + (s.distance_km || 0), 0);
    const sumElev = steps.reduce((sum, s) => sum + (s.elevation_gain_m || 0), 0);

    return {
      allocations: [{ country_code: countryCode, allocated_days: days, start_day: 1, end_day: days }],
      steps,
      items: [],
      warnings: [],
      total_days: days,
      total_distance_km: Math.round(sumDist * 10) / 10,
      total_elevation_gain_m: sumElev,
      source: 'computed',
      sourceLabel: 'Itinéraire calculé (modèle Naismith)',
    };
  }

  // 3. TIER 3 : SQUELETTE (aucune donnée de référence)
  const steps = generateSkeletonSteps(days, countryCode);
  const warnings: PlannerWarning[] = [
    {
      code: 'SKELETON_ITINERARY',
      severity: 'info',
      country_code: countryCode,
      message:
        'Aucun tracé de référence pour cette destination. Ajoute tes étapes, les distances se calculeront automatiquement.',
    },
  ];

  return {
    allocations: [{ country_code: countryCode, allocated_days: days, start_day: 1, end_day: days }],
    steps,
    items: [],
    warnings,
    total_days: days,
    total_distance_km: 0,
    total_elevation_gain_m: 0,
    source: 'skeleton',
    sourceLabel: 'Squelette d’itinéraire',
  };
}

/**
 * Orchestrateur central déterministe de création d’itinéraire.
 * ZÉRO appel LLM — logique pure, reproductible bit-pour-bit.
 * Intègre le repli automatique vers Paramétrique / Squelette pour ne jamais renvoyer [].
 */
export function buildItinerary(
  input: PlannerInput,
  data: EngineCandidateData
): PlannerOutput {
  const warnings: PlannerWarning[] = [];
  const steps: GeneratedStep[] = [];
  const items: GeneratedItem[] = [];

  const effectiveDays = Math.min(400, Math.max(1, Math.round(Number(input.duration_days) || 1)));

  // 1. Répartition des jours par pays
  const allocations = allocateDays(input.countries, effectiveDays);

  // 2. Alertes de saisonnalité
  for (const country of input.countries) {
    const seasonWarnings = checkSeasonalityForDates(
      country.country_code,
      input.start_date,
      input.end_date
    );
    warnings.push(...seasonWarnings);
  }

  // 3. Sélection et ordonnancement des étapes pour chaque pays
  let lastStepCoords: { lat: number; lng: number; name: string } | null = null;
  let previousWasDemanding = false;
  let hasTemplateSteps = false;
  let hasComputedSteps = false;
  let _hasSkeletonSteps = false;

  for (const alloc of allocations) {
    if (alloc.allocated_days <= 0) continue;

    const rawSteps = selectCandidateStepsForCountry(
      data.candidateSteps,
      alloc.country_code,
      alloc.allocated_days,
      input.styles,
      input.pace
    );

    if (rawSteps.length === 0) {
      // D1 FIX: Fallback 3 niveaux au lieu d'un simple `continue`
      warnings.push({
        code: 'NO_STEPS_AVAILABLE',
        severity: 'warning',
        country_code: alloc.country_code,
        message: `Aucune étape candidate n’est disponible pour le pays ${alloc.country_code}. L’itinéraire n’invente aucun lieu et attend vos étapes personnalisées.`,
      });

      const totalDist = input.totalDistanceKm ?? 0;
      const totalElev = input.totalElevationGainM ?? 0;

      if (totalDist > 0 || totalElev > 0) {
        hasComputedSteps = true;
        const fallbackSteps = generateParametricSteps(
          alloc.allocated_days,
          totalDist,
          totalElev,
          alloc.country_code
        );
        for (let i = 0; i < fallbackSteps.length; i++) {
          fallbackSteps[i].day_number = alloc.start_day + i;
        }
        steps.push(...fallbackSteps);
      } else {
        _hasSkeletonSteps = true;
        warnings.push({
          code: 'SKELETON_ITINERARY',
          severity: 'info',
          country_code: alloc.country_code,
          message:
            'Aucun tracé de référence pour cette destination. Ajoute tes étapes, les distances se calculeront automatiquement.',
        });
        const fallbackSteps = generateSkeletonSteps(alloc.allocated_days, alloc.country_code);
        for (let i = 0; i < fallbackSteps.length; i++) {
          fallbackSteps[i].day_number = alloc.start_day + i;
        }
        steps.push(...fallbackSteps);
      }
      continue;
    }

    hasTemplateSteps = true;

    // Réorganisation des étapes pour respecter les contraintes d'effort :
    // - J1 et Dernier jour allégés
    // - Jamais deux journées exigeantes consécutives
    const arrangedSteps: CandidateStep[] = [...rawSteps];

    // Helper d'évaluation de la pénibilité
    const isStepDemanding = (s: CandidateStep) =>
      Boolean(s.is_demanding || (s.elevation_gain_m || 0) > 900 || (s.distance_km || 0) > 18);

    // Contrainte J1 (si c'est le tout premier jour de l'expédition)
    if (alloc.start_day === 1 && arrangedSteps.length > 1 && isStepDemanding(arrangedSteps[0])) {
      const lightIdx = arrangedSteps.findIndex((s) => !isStepDemanding(s));
      if (lightIdx > 0) {
        const [light] = arrangedSteps.splice(lightIdx, 1);
        arrangedSteps.unshift(light);
      }
    }

    // Contrainte Dernier Jour (si c'est la fin du voyage)
    const lastIdx = arrangedSteps.length - 1;
    if (
      alloc.end_day === effectiveDays &&
      arrangedSteps.length > 1 &&
      isStepDemanding(arrangedSteps[lastIdx])
    ) {
      const lightIdx = arrangedSteps.findIndex(
        (s, idx) => idx !== 0 && idx !== lastIdx && !isStepDemanding(s)
      );
      if (lightIdx !== -1) {
        const [light] = arrangedSteps.splice(lightIdx, 1);
        arrangedSteps.push(light);
      }
    }

    // Assignation jour par jour
    for (let dayOffset = 0; dayOffset < alloc.allocated_days; dayOffset++) {
      const dayNumber = alloc.start_day + dayOffset;
      let candidate = arrangedSteps[dayOffset % arrangedSteps.length];

      // Anti deux journées consécutives exigeantes
      if (previousWasDemanding && isStepDemanding(candidate)) {
        const altIdx = arrangedSteps.findIndex((s) => !isStepDemanding(s));
        if (altIdx !== -1) {
          candidate = arrangedSteps[altIdx];
        }
      }

      previousWasDemanding = isStepDemanding(candidate);

      // Calcul de transit entre l'étape précédente et la nouvelle
      if (lastStepCoords && candidate.latitude && candidate.longitude) {
        const transit = evaluateTransit({
          fromLat: lastStepCoords.lat,
          fromLng: lastStepCoords.lng,
          toLat: candidate.latitude,
          toLng: candidate.longitude,
          fromName: lastStepCoords.name,
          toName: candidate.location_name || candidate.title,
        });

        if (transit.requiresTransportItem && transit.transportItem) {
          items.push({
            ...transit.transportItem,
            day_number: dayNumber,
          });
        }
      }

      steps.push({
        day_number: dayNumber,
        order_index: 0,
        country_code: alloc.country_code,
        title: candidate.title,
        description: candidate.description || null,
        location_name: candidate.location_name || null,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        transport_mode: candidate.distance_km && candidate.distance_km > 0 ? 'foot' : null,
        distance_km: candidate.distance_km ?? null,
        elevation_gain_m: candidate.elevation_gain_m ?? null,
        elevation_loss_m: candidate.elevation_loss_m ?? null,
        accommodation_name: 'Bivouac / Refuge',
        source: 'template',
      });

      lastStepCoords = {
        lat: candidate.latitude,
        lng: candidate.longitude,
        name: candidate.location_name || candidate.title,
      };
    }
  }

  // 4. Matériel et équipement suggérés
  const candidateItems = selectCandidateItems(
    data.candidateItems,
    input.styles,
    input.travelers_count
  );
  items.push(...candidateItems);

  // 5. Métriques globales
  const total_distance_km = steps.reduce((sum, s) => sum + (s.distance_km || 0), 0);
  const total_elevation_gain_m = steps.reduce(
    (sum, s) => sum + (s.elevation_gain_m || 0),
    0
  );

  let source: 'template' | 'computed' | 'skeleton' = 'skeleton';
  let sourceLabel = 'Squelette d’itinéraire';

  if (hasTemplateSteps) {
    source = 'template';
    sourceLabel = 'D’après tracé de référence';
  } else if (hasComputedSteps) {
    source = 'computed';
    sourceLabel = 'Itinéraire calculé (modèle Naismith)';
  }

  return {
    allocations,
    steps,
    items,
    warnings,
    total_days: effectiveDays,
    total_distance_km: Math.round(total_distance_km * 10) / 10,
    total_elevation_gain_m,
    source,
    sourceLabel,
  };
}
