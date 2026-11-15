/**
 * Contrat O02 S6.25 — Estimation de carbone évité sur trajets éligibles &
 * séparation stricte des agrégats institutionnels (type Strava Metro).
 *
 * Invariants O02 & CONTRATS_COMMUNS :
 * - Zéro != manquant : une sortie loisir non éligible ou sans distance retourne
 *   `kgCo2Avoided: null`, jamais `0`.
 * - Les métriques carbone exposent toujours hypothèses et périmètre (facteur
 *   voiture thermique ADEME 0,193 kg CO2e/km).
 * - Les agrégats institutionnels sont STRICTEMENT séparés de l'application
 *   grand public : audience institutionnelle + licence active + consentement P01
 *   `collective_terrain` + anonymat k >= 5 contributeurs distincts.
 */

export const ADEME_CAR_BASELINE_KG_CO2_PER_KM = 0.193;
export const EBIKE_FOOTPRINT_KG_CO2_PER_KM = 0.011;

export type CarbonTripPurpose = 'commute' | 'utility_trip' | 'bikepacking' | 'leisure' | 'race';

export interface AvoidedCarbonInput {
  sport: string | null | undefined;
  distanceKm: number | null | undefined;
  purpose?: CarbonTripPurpose | null;
  replacesCarTrip?: boolean;
  /** Indique si la règle utilisateur/visibilité autorise l'affichage de la métrique. */
  authorized?: boolean;
  /** Permet de détecter un trajet vélotaf via titre/note/tag existants. */
  titleOrTags?: string | null;
}

export interface AvoidedCarbonResult {
  eligible: boolean;
  kgCo2Avoided: number | null;
  factorKgPerKm: number | null;
  baselineKgPerKm: number;
  assumptions: string;
  scope: string;
  reason: string;
}

const HUMAN_POWERED_SPORTS = new Set([
  'velo',
  'vélo',
  'cycling',
  'gravel',
  'vtt',
  'course',
  'running',
  'trail',
  'marche',
  'walking',
  'rando',
  'randonnee',
  'randonnée',
]);

const E_ASSIST_SPORTS = new Set(['vae', 'ebike', 'e-bike', 'e_bike', 'vttae']);

const COMMUTE_HINT_RE = /\b(v[eé]lotaf|trajet|commute|domicile[- ]travail|mobilit[eé])\b/i;

export function estimateAvoidedCarbon(input: AvoidedCarbonInput): AvoidedCarbonResult {
  const assumptions = `Hypothèse : remplacement d’une voiture thermique individuelle (référence ADEME ${ADEME_CAR_BASELINE_KG_CO2_PER_KM} kg CO2e/km).`;
  const scope = 'Périmètre : émissions directes d’usage évitées (hors fabrication du matériel).';

  if (input.authorized === false) {
    return {
      eligible: false,
      kgCo2Avoided: null,
      factorKgPerKm: null,
      baselineKgPerKm: ADEME_CAR_BASELINE_KG_CO2_PER_KM,
      assumptions,
      scope,
      reason: 'Affichage non autorisé pour cette audience.',
    };
  }

  if (
    input.distanceKm === null ||
    input.distanceKm === undefined ||
    !Number.isFinite(input.distanceKm) ||
    input.distanceKm <= 0
  ) {
    return {
      eligible: false,
      kgCo2Avoided: null,
      factorKgPerKm: null,
      baselineKgPerKm: ADEME_CAR_BASELINE_KG_CO2_PER_KM,
      assumptions,
      scope,
      reason: 'Distance manquante ou nulle.',
    };
  }

  const normalizedSport = (input.sport ?? '').trim().toLowerCase();
  const isEAssist = E_ASSIST_SPORTS.has(normalizedSport);
  const isHumanPowered = HUMAN_POWERED_SPORTS.has(normalizedSport);

  if (!isHumanPowered && !isEAssist) {
    return {
      eligible: false,
      kgCo2Avoided: null,
      factorKgPerKm: null,
      baselineKgPerKm: ADEME_CAR_BASELINE_KG_CO2_PER_KM,
      assumptions,
      scope,
      reason: 'Sport non éligible au report modal voiture.',
    };
  }

  const inferredCommute =
    input.replacesCarTrip === true ||
    input.purpose === 'commute' ||
    input.purpose === 'utility_trip' ||
    (typeof input.titleOrTags === 'string' && COMMUTE_HINT_RE.test(input.titleOrTags));

  if (!inferredCommute) {
    return {
      eligible: false,
      kgCo2Avoided: null,
      factorKgPerKm: null,
      baselineKgPerKm: ADEME_CAR_BASELINE_KG_CO2_PER_KM,
      assumptions,
      scope,
      reason: 'Sortie de loisir sans report modal déclaré : carbone évité non applicable.',
    };
  }

  const ownFootprintPerKm = isEAssist ? EBIKE_FOOTPRINT_KG_CO2_PER_KM : 0;
  const factorKgPerKm = Number((ADEME_CAR_BASELINE_KG_CO2_PER_KM - ownFootprintPerKm).toFixed(3));
  const kgCo2Avoided = Number((input.distanceKm * factorKgPerKm).toFixed(2));

  return {
    eligible: true,
    kgCo2Avoided,
    factorKgPerKm,
    baselineKgPerKm: ADEME_CAR_BASELINE_KG_CO2_PER_KM,
    assumptions: isEAssist
      ? `${assumptions} Déduction recharge VAE (${EBIKE_FOOTPRINT_KG_CO2_PER_KM} kg CO2e/km).`
      : assumptions,
    scope,
    reason: 'Trajet actif éligible au calcul de report modal.',
  };
}

export type InstitutionalAudience = 'consumer_app' | 'institutional_partner';

export interface CorridorPassageObservation {
  corridorId: string;
  contributorHash: string;
  collectiveConsent: boolean;
  tripCount: number;
  commuteTripCount: number;
  totalDistanceKm: number;
}

export interface InstitutionalCorridorAggregate {
  corridorId: string;
  distinctContributors: number;
  totalTrips: number;
  commuteTrips: number;
  totalDistanceKm: number;
  estimatedAvoidedCarbonKg: number;
}

export type InstitutionalExportResult =
  | {
      allowed: true;
      kAnonymityThreshold: number;
      corridors: InstitutionalCorridorAggregate[];
      suppressedCorridors: number;
      assumptions: string;
    }
  | {
      allowed: false;
      code: 'forbidden_consumer_surface' | 'license_expired' | 'license_revoked';
      reason: string;
      corridors: [];
    };

export const INSTITUTIONAL_K_ANONYMITY_MIN = 5;

/**
 * Construit un agrégat institutionnel de type Metro strictement séparé de
 * l'interface grand public.
 */
export function buildInstitutionalMetroAggregate(params: {
  audience: InstitutionalAudience;
  licenseActive: boolean;
  licenseExpired?: boolean;
  licenseRevoked?: boolean;
  observations: readonly CorridorPassageObservation[];
}): InstitutionalExportResult {
  if (params.audience !== 'institutional_partner') {
    return {
      allowed: false,
      code: 'forbidden_consumer_surface',
      reason:
        'Les agrégats institutionnels type Metro sont strictement séparés de l’application grand public.',
      corridors: [],
    };
  }
  if (params.licenseRevoked) {
    return {
      allowed: false,
      code: 'license_revoked',
      reason: 'Licence institutionnelle révoquée.',
      corridors: [],
    };
  }
  if (!params.licenseActive || params.licenseExpired) {
    return {
      allowed: false,
      code: 'license_expired',
      reason: 'Licence institutionnelle expirée ou absente.',
      corridors: [],
    };
  }

  const byCorridor = new Map<
    string,
    {
      contributors: Set<string>;
      totalTrips: number;
      commuteTrips: number;
      totalDistanceKm: number;
    }
  >();

  for (const obs of params.observations) {
    if (!obs.collectiveConsent || !obs.contributorHash) continue;
    const entry = byCorridor.get(obs.corridorId) ?? {
      contributors: new Set<string>(),
      totalTrips: 0,
      commuteTrips: 0,
      totalDistanceKm: 0,
    };
    entry.contributors.add(obs.contributorHash);
    entry.totalTrips += Math.max(0, obs.tripCount);
    entry.commuteTrips += Math.max(0, obs.commuteTripCount);
    entry.totalDistanceKm += Math.max(0, obs.totalDistanceKm);
    byCorridor.set(obs.corridorId, entry);
  }

  const corridors: InstitutionalCorridorAggregate[] = [];
  let suppressedCorridors = 0;

  for (const [corridorId, agg] of byCorridor.entries()) {
    if (agg.contributors.size < INSTITUTIONAL_K_ANONYMITY_MIN) {
      suppressedCorridors += 1;
      continue;
    }
    const commuteRatio = agg.totalTrips > 0 ? agg.commuteTrips / agg.totalTrips : 0;
    const commuteDistanceKm = agg.totalDistanceKm * commuteRatio;
    corridors.push({
      corridorId,
      distinctContributors: agg.contributors.size,
      totalTrips: agg.totalTrips,
      commuteTrips: agg.commuteTrips,
      totalDistanceKm: Number(agg.totalDistanceKm.toFixed(1)),
      estimatedAvoidedCarbonKg: Number(
        (commuteDistanceKm * ADEME_CAR_BASELINE_KG_CO2_PER_KM).toFixed(2),
      ),
    });
  }

  return {
    allowed: true,
    kAnonymityThreshold: INSTITUTIONAL_K_ANONYMITY_MIN,
    corridors,
    suppressedCorridors,
    assumptions: `Agrégat anonyme (k >= ${INSTITUTIONAL_K_ANONYMITY_MIN} contributeurs consentants P01, base ADEME ${ADEME_CAR_BASELINE_KG_CO2_PER_KM} kg CO2e/km sur trajets utilitaires).`,
  };
}
