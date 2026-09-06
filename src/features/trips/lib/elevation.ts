import type { TripFull } from '../types/trip.types';

export type ElevationSource = 'stages' | 'route_template' | 'places' | 'country_fallback';
export type ElevationConfidence = 'high' | 'medium' | 'low';

export interface ElevationProfile {
  maxM: number;
  minM: number;
  gainM: number;
  source: ElevationSource;
  confidence: ElevationConfidence;
}

/**
 * Données d'élévation des tracés et massifs pilotes connus
 */
const PILOT_ELEVATIONS: Array<{
  keywords: string[];
  maxM: number;
  minM: number;
  typicalGainM: number;
}> = [
  {
    keywords: ['mont-blanc', 'tmb', 'chamonix', 'tour-du-mont-blanc'],
    maxM: 2537, // Grand Col Ferret
    minM: 990,
    typicalGainM: 10000,
  },
  {
    keywords: ['gr20', 'gr-20', 'corse'],
    maxM: 2183, // Bocca Minuta / Pointe des Éboulis
    minM: 60,
    typicalGainM: 11000,
  },
  {
    keywords: ['toubkal', 'atlas'],
    maxM: 4167, // Jbel Toubkal
    minM: 1740,
    typicalGainM: 3200,
  },
  {
    keywords: ['annapurna', 'thorong'],
    maxM: 5416, // Col Thorong La
    minM: 820,
    typicalGainM: 12000,
  },
  {
    keywords: ['salkantay', 'machu'],
    maxM: 4630, // Col du Salkantay
    minM: 2000,
    typicalGainM: 6000,
  },
  {
    keywords: ['laugavegur', 'hrafntinnusker'],
    maxM: 1050, // Refuge d'Hrafntinnusker
    minM: 200,
    typicalGainM: 1700,
  },
];

/**
 * Altitudes par défaut selon les pays (fallback de dernier recours)
 */
const COUNTRY_FALLBACKS: Record<string, { maxM: number; minM: number }> = {
  FR: { maxM: 480, minM: 0 },
  IS: { maxM: 500, minM: 0 },
  MA: { maxM: 1200, minM: 200 },
  NP: { maxM: 3500, minM: 1000 },
  PE: { maxM: 3400, minM: 500 },
};

/**
 * Source unique de calcul du profil d'altitude d'un voyage.
 * Résout le défaut D2 (confusion dénivelé étape / altitude maximale).
 * 
 * Priorités strictes :
 * 1. Étapes réelles avec champ explicite elevation_max (stages) -> high
 * 2. Template de route pilote reconnu (route_template) -> medium
 * 3. Lieux / POIs géoréférencés (places) -> medium
 * 4. Valeur de repli pays (country_fallback) -> low
 */
export function getTripElevationProfile(trip: TripFull): ElevationProfile {
  const steps = trip.steps || [];
  const totalGainM = steps.reduce((sum, s) => sum + (s.elevation_gain_m || 0), 0);

  // 1. PRIORITÉ 1 : Étapes réelles avec altitude max explicite (stages)
  const stepsWithMax = steps.filter(
    (s) =>
      typeof (s as any).elevation_max_m === 'number' &&
      (s as any).elevation_max_m > 0
  );

  if (stepsWithMax.length > 0) {
    const maxM = Math.max(...stepsWithMax.map((s) => (s as any).elevation_max_m));
    const minCandidates = steps
      .map((s) => (s as any).elevation_min_m)
      .filter((m): m is number => typeof m === 'number' && m >= 0);
    const minM = minCandidates.length > 0 ? Math.min(...minCandidates) : 0;

    return {
      maxM,
      minM,
      gainM: totalGainM,
      source: 'stages',
      confidence: 'high',
    };
  }

  // 2. PRIORITÉ 2 : Template de route pilote reconnu (route_template)
  const tripIdentifier = `${trip.slug || ''} ${trip.title || ''} ${trip.destination_name || ''}`.toLowerCase();
  for (const pilot of PILOT_ELEVATIONS) {
    if (pilot.keywords.some((k) => tripIdentifier.includes(k))) {
      return {
        maxM: pilot.maxM,
        minM: pilot.minM,
        gainM: totalGainM > 0 ? totalGainM : pilot.typicalGainM,
        source: 'route_template',
        confidence: 'medium',
      };
    }
  }

  // 3. PRIORITÉ 3 : Lieux géoréférencés / POIs attachés (places)
  const metaPlaces: any[] = Array.isArray((trip.metadata as any)?.places)
    ? (trip.metadata as any).places
    : [];
  const placesWithElev = metaPlaces.filter(
    (p) => typeof p.elevation_m === 'number' && p.elevation_m > 0
  );

  if (placesWithElev.length > 0) {
    const maxM = Math.max(...placesWithElev.map((p) => p.elevation_m));
    const minM = Math.min(...placesWithElev.map((p) => p.elevation_m));
    return {
      maxM,
      minM,
      gainM: totalGainM,
      source: 'places',
      confidence: 'medium',
    };
  }

  // 4. PRIORITÉ 4 : Valeur de repli par pays (country_fallback)
  const countryCode = trip.destination_country_code?.toUpperCase();
  if (countryCode && COUNTRY_FALLBACKS[countryCode]) {
    const fallback = COUNTRY_FALLBACKS[countryCode];
    return {
      maxM: fallback.maxM,
      minM: fallback.minM,
      gainM: totalGainM,
      source: 'country_fallback',
      confidence: 'low',
    };
  }

  // 5. Absence totale de données
  return {
    maxM: 0,
    minM: 0,
    gainM: totalGainM,
    source: 'country_fallback',
    confidence: 'low',
  };
}
