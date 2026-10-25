import type { GeneratedItem } from './types';

export type TransportMode = 'foot' | 'car' | 'bus' | 'train' | 'plane' | 'boat' | 'bike';

export interface TransitEvaluationParams {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  fromName: string;
  toName: string;
  isMountain?: boolean;
}

export interface TransitEvaluationResult {
  distanceKm: number;
  durationHours: number;
  transportMode: TransportMode;
  requiresTransportItem: boolean;
  transportItem: GeneratedItem | null;
}

/**
 * Calcul géodésique de distance (formule de Haversine).
 * Retourne la distance en kilomètres arrondie à 1 décimale.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const R = 6371; // Rayon moyen de la Terre en km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  return Math.round(d * 10) / 10;
}

/**
 * Barème des temps de déplacement :
 * - marche à pied : 4 km/h
 * - vélo / bikepacking : 15 km/h
 * - route en montagne : 45 km/h
 * - route en plaine : 70 km/h
 * - avion (> 700 km) : forfait de 4h (embarquement/transit) + vol à 750 km/h
 */
export function estimateTravelTimeHours(
  distanceKm: number,
  mode: TransportMode = 'car',
  isMountain = false
): number {
  if (distanceKm <= 0) return 0;

  switch (mode) {
    case 'plane':
      return Math.round((4.0 + distanceKm / 750) * 100) / 100;
    case 'foot':
      return Math.round((distanceKm / 4.0) * 100) / 100;
    case 'bike':
      return Math.round((distanceKm / 15.0) * 100) / 100;
    case 'car':
    case 'bus':
    default: {
      const speed = isMountain ? 45.0 : 70.0;
      return Math.round((distanceKm / speed) * 100) / 100;
    }
  }
}

/**
 * Évalue le transit entre deux étapes et génère un trip_item de transport si trajet > 90 min (1.5h).
 */
export function evaluateTransit(params: TransitEvaluationParams): TransitEvaluationResult {
  const { fromLat, fromLng, toLat, toLng, fromName, toName, isMountain = false } = params;
  const distanceKm = calculateDistanceKm(fromLat, fromLng, toLat, toLng);

  let transportMode: TransportMode = 'car';
  let durationHours = 0;

  if (distanceKm > 700) {
    transportMode = 'plane';
    durationHours = estimateTravelTimeHours(distanceKm, 'plane', false);
  } else {
    transportMode = 'car';
    durationHours = estimateTravelTimeHours(distanceKm, 'car', isMountain);
  }

  // Déclenchement d'un item si le temps de transit dépasse 90 minutes (1.5h)
  const requiresTransportItem = durationHours >= 1.5;

  let transportItem: GeneratedItem | null = null;
  if (requiresTransportItem) {
    const isFlight = transportMode === 'plane';
    const itemName = isFlight
      ? `Vol intérieur / régional : ${fromName} → ${toName} (~${Math.round(durationHours)}h)`
      : `Transit routier (${Math.round(durationHours * 10) / 10}h) : ${fromName} → ${toName}`;

    transportItem = {
      item_name: itemName,
      category: 'Transport & Transit',
      quantity: 1,
      weight_grams: null,
      status: 'needed',
      source: 'import',
      ref_type: 'custom',
    };
  }

  return {
    distanceKm,
    durationHours,
    transportMode,
    requiresTransportItem,
    transportItem,
  };
}
