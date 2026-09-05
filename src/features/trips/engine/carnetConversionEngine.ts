/**
 * LKDV — Moteur de Rétrospective & Conversion en Carnet Communautaire
 * Chantier 8 : Boucle de fin — Voyage vécu -> Carnet, REX & Preuve Terrain
 *
 * Moteur pur déterministe (zéro I/O, zéro appel LLM).
 */

import type { TripFull } from '@/features/trips/types/trip.types';

export interface TripRetrospectiveMetrics {
  totalKm: number;
  totalElevationGainM: number;
  totalElevationLossM: number;
  durationDays: number;
  nbNuits: number;
  stepsCount: number;
  visitedPoisCount: number;
  packedGearCount: number;
  packedWeightKg: number;
  totalExpenses: number;
  currency: string;
}

export interface CertifiedPlaceCandidate {
  placeId: string;
  name: string;
  category?: string | null;
}

export interface CarnetRowPayload {
  title: string;
  destination: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  visibility: 'public' | 'private';
  distance_km: number;
  denivele_m: number;
  nb_nuits: number;
  nb_voyageurs: number;
  country_iso: string | null;
  trip_id: string;
  author_id: string;
  tags: string[];
}

export interface CarnetMomentPayload {
  jour_numero: number;
  citation: string;
  auteur_nom: string;
  auteur_id: string;
  lieu?: string | null;
}

export interface CarnetKitItemPayload {
  nom: string;
  detail: string;
  poids_g: number;
  couleur_tag: string;
  sort_order: number;
}

export interface CarnetConversionResult {
  carnet: CarnetRowPayload;
  moments: CarnetMomentPayload[];
  kitItems: CarnetKitItemPayload[];
  metrics: TripRetrospectiveMetrics;
}

/**
 * Calcule fidèlement l'ensemble des métriques de bilan du voyage
 */
export function calculateTripRetrospectiveMetrics(trip: TripFull): TripRetrospectiveMetrics {
  const steps = trip.steps || [];
  const items = trip.items || [];
  const expenses = trip.expenses || [];
  const pois = trip.pois || [];

  // Distance totale (arrondie à 1 décimale)
  const totalKmRaw = steps.reduce((sum, s) => sum + (s.distance_km || 0), 0);
  const totalKm = Math.round(totalKmRaw * 10) / 10;

  // Dénivelé
  const totalElevationGainM = steps.reduce((sum, s) => sum + (s.elevation_gain_m || 0), 0);
  const totalElevationLossM = steps.reduce((sum, s) => sum + (s.elevation_loss_m || 0), 0);

  // Durée en jours et nuits
  let durationDays = 1;
  if (trip.start_date && trip.end_date) {
    const start = new Date(trip.start_date).getTime();
    const end = new Date(trip.end_date).getTime();
    const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    durationDays = diffDays > 0 ? diffDays : 1;
  } else if (steps.length > 0) {
    durationDays = Math.max(...steps.map(s => s.day_number), 1);
  }
  const nbNuits = Math.max(1, durationDays - 1);

  // Sac et matériel emporté (is_packed = true)
  const packedItems = items.filter(i => i.is_packed);
  const packedGearCount = packedItems.length;
  const packedWeightG = packedItems.reduce(
    (sum, i) => sum + (Number(i.weight_grams) || 0) * (i.quantity || 1),
    0
  );
  const packedWeightKg = Math.round((packedWeightG / 1000) * 100) / 100;

  // Dépenses réelles
  const totalExpensesRaw = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalExpenses = Math.round(totalExpensesRaw * 100) / 100;

  // POIs visités
  const visitedPoisCount = pois.filter(p => p.visited).length;

  return {
    totalKm,
    totalElevationGainM,
    totalElevationLossM,
    durationDays,
    nbNuits,
    stepsCount: steps.length,
    visitedPoisCount,
    packedGearCount,
    packedWeightKg,
    totalExpenses,
    currency: trip.budget_currency || 'EUR',
  };
}

/**
 * Extrait les lieux visités pendant le voyage pouvant faire l'objet d'un avis certifié terrain (has_field_proof)
 */
export function extractCertifiedPlaceCandidates(trip: TripFull): CertifiedPlaceCandidate[] {
  const map = new Map<string, CertifiedPlaceCandidate>();

  // 1. Depuis les POIs visités
  (trip.pois || []).forEach(poi => {
    if (poi.visited && poi.osm_id) {
      map.set(poi.osm_id, {
        placeId: poi.osm_id,
        name: poi.name,
        category: poi.category,
      });
    }
  });

  return Array.from(map.values());
}

/**
 * Convertit un voyage complet en données prêtes à être publiées dans la table `carnets`
 * et ses tables filles (`carnet_moments`, `carnet_kit_items`).
 *
 * GARANTIE RGPD : N'expose AUCUN document d'identité ni AUCUNE dépense financière privée nominative.
 */
export function convertTripToCarnetData(
  trip: TripFull,
  options?: {
    customTitle?: string;
    description?: string;
    isPublic?: boolean;
    authorName?: string;
  }
): CarnetConversionResult {
  const metrics = calculateTripRetrospectiveMetrics(trip);

  const title = options?.customTitle || trip.title;
  const destination = trip.destination_name || 'Expédition outdoor';
  const description =
    options?.description ||
    trip.description ||
    `Récit d'expédition : ${trip.title}, ${metrics.totalKm} km et ${metrics.totalElevationGainM} m D+.`;

  // Construction des tags
  const rawTags = [
    trip.primary_activity,
    trip.difficulty,
    trip.destination_name,
    trip.destination_country_code,
  ].filter(Boolean) as string[];
  const tags = Array.from(new Set(rawTags));

  // Map des lieux par jour pour enrichir les moments
  const stepLocationsByDay = new Map<number, string>();
  (trip.steps || []).forEach(s => {
    if (s.location_name && !stepLocationsByDay.has(s.day_number)) {
      stepLocationsByDay.set(s.day_number, s.location_name);
    }
  });

  // Construction du payload Carnet
  const carnet: CarnetRowPayload = {
    title,
    destination,
    description,
    start_date: trip.start_date,
    end_date: trip.end_date,
    visibility: options?.isPublic ? 'public' : 'private',
    distance_km: metrics.totalKm,
    denivele_m: metrics.totalElevationGainM,
    nb_nuits: metrics.nbNuits,
    nb_voyageurs: (trip.collaborators && trip.collaborators.length > 0) ? trip.collaborators.length : 1,
    country_iso: trip.destination_country_code || null,
    trip_id: trip.id,
    author_id: trip.user_id,
    tags,
  };

  // Transformation des trip_notes en carnet_moments
  const moments: CarnetMomentPayload[] = (trip.notes || []).map(note => {
    const day = note.day_number || 1;
    const citation = note.title ? `${note.title} : ${note.content}` : note.content;
    const auteurNom = note.author?.full_name || options?.authorName || 'Explorateur';
    const lieu = stepLocationsByDay.get(day) || null;

    return {
      jour_numero: day,
      citation,
      auteur_nom: auteurNom,
      auteur_id: note.author_id,
      lieu,
    };
  });

  // Transformation des items emportés en kitItems
  const packedItems = (trip.items || []).filter(i => i.is_packed);
  const kitItems: CarnetKitItemPayload[] = packedItems.map((item, index) => {
    const poidsG = Math.round(Number(item.weight_grams) || 0);
    const couleurTag = item.priority === 'vital' ? '#17402C' : '#5B7F55';

    return {
      nom: item.item_name,
      detail: item.category || '',
      poids_g: poidsG,
      couleur_tag: couleurTag,
      sort_order: index,
    };
  });

  return {
    carnet,
    moments,
    kitItems,
    metrics,
  };
}
