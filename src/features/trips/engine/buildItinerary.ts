import type {
  PlannerInput,
  PlannerOutput,
  EngineCandidateData,
  GeneratedStep,
  GeneratedItem,
  PlannerWarning,
  CandidateStep,
} from './types';
import { allocateDays } from './allocateDays';
import { checkSeasonalityForDates } from './seasonality';
import { evaluateTransit } from './travelTime';
import { selectCandidateStepsForCountry, selectCandidateItems } from './selectCandidates';

/**
 * Orchestrateur central déterministe de création d’itinéraire.
 * ZÉRO appel LLM — logique pure, reproductible bit-pour-bit.
 */
export function buildItinerary(
  input: PlannerInput,
  data: EngineCandidateData
): PlannerOutput {
  const warnings: PlannerWarning[] = [];
  const steps: GeneratedStep[] = [];
  const items: GeneratedItem[] = [];

  // 1. Répartition des jours par pays
  const allocations = allocateDays(input.countries, input.duration_days);

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
      warnings.push({
        code: 'NO_STEPS_AVAILABLE',
        severity: 'warning',
        country_code: alloc.country_code,
        message: `Aucune étape candidate n’est disponible pour le pays ${alloc.country_code}. L’itinéraire n’invente aucun lieu et attend vos étapes personnalisées.`,
      });
      continue;
    }

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
      alloc.end_day === input.duration_days &&
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
        // Cherche un remplaçant non exigeant dans les étapes restantes
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
        source: 'import',
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

  return {
    allocations,
    steps,
    items,
    warnings,
    total_days: input.duration_days,
    total_distance_km: Math.round(total_distance_km * 10) / 10,
    total_elevation_gain_m,
  };
}
