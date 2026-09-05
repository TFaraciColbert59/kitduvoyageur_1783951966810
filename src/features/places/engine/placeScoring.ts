import type { PlaceSensitivity } from '../types/place.types';

export interface BayesianRatingInput {
  rating: number;
  has_field_proof?: boolean;
}

export interface BayesianRatingOptions {
  priorMean?: number; // m: standard is 3.5 on a 1-5 scale
  priorWeight?: number; // C: standard confidence weight is 3.0 reviews
}

/**
 * Calcul déterministe de la note moyenne bayésienne avec preuve de terrain.
 * Pondération x2 pour les avis certifiés terrain (has_field_proof = true).
 * 
 * INVARIANT CI 2 / ÉTHIQUE :
 * ZÉRO terme monétaire, ZÉRO sponsoring, ZÉRO biais publicitaire dans le calcul.
 */
export function calculateBayesianRating(
  reviews: BayesianRatingInput[],
  options?: BayesianRatingOptions
): number {
  if (!reviews || reviews.length === 0) {
    return 0.0;
  }

  const C = options?.priorWeight ?? 3.0;
  const m = options?.priorMean ?? 3.5;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const review of reviews) {
    // Validation stricte de la note
    const clampedRating = Math.max(1, Math.min(5, review.rating));
    const weight = review.has_field_proof ? 2.0 : 1.0;

    weightedSum += clampedRating * weight;
    totalWeight += weight;
  }

  const rawBayesian = (C * m + weightedSum) / (C + totalWeight);
  return Math.round(rawBayesian * 100) / 100;
}

export interface BlurringResult {
  latitude: number;
  longitude: number;
  isBlurred: boolean;
  blurRadiusMeters: number;
}

/**
 * Floutage éthique des coordonnées GPS pour la sécurité physique des personnes
 * et la préservation de la biodiversité (bivouacs fragiles, sources, sites archéologiques).
 * 
 * ROADMAP_VOYAGE §5.7 :
 * - standard : coordonnées exactes (0m floutage)
 * - sensitive : floutage serveur à ~500m (arrondi à 2 décimales)
 * - protected : floutage serveur à ~5000m (arrondi à 1 décimale)
 * 
 * Contourné uniquement si l'utilisateur est administrateur ou garde-parc autorisé.
 */
export function blurCoordinatesForSensitivity(
  latitude: number,
  longitude: number,
  sensitivity: PlaceSensitivity,
  isAdminOrAuthorized = false
): BlurringResult {
  if (isAdminOrAuthorized || sensitivity === 'standard') {
    return {
      latitude,
      longitude,
      isBlurred: false,
      blurRadiusMeters: 0,
    };
  }

  if (sensitivity === 'sensitive') {
    return {
      latitude: Math.round(latitude * 100) / 100,
      longitude: Math.round(longitude * 100) / 100,
      isBlurred: true,
      blurRadiusMeters: 500,
    };
  }

  // protected
  return {
    latitude: Math.round(latitude * 10) / 10,
    longitude: Math.round(longitude * 10) / 10,
    isBlurred: true,
    blurRadiusMeters: 5000,
  };
}
