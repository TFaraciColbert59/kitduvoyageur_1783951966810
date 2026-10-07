/**
 * Compas — le train pour venir, par règle.
 *
 * Ardennes, Vendée, Bruges depuis Annecy partaient en avion : la route était
 * trop longue pour un week-end, et l'avion était le seul autre moyen. En
 * Europe de l'Ouest, à moins de 1 200 km à vol d'oiseau, le train est la
 * réponse. Ordres de grandeur pour préparer (barème du Compas), jamais un
 * horaire ni un prix réels : Résa · Trajets les donne.
 */

import { COSTS_VERSION } from './costs';

/** Pays reliés entre eux par un réseau à grande vitesse (Royaume-Uni par l'Eurostar). */
const RAIL = new Set('FR BE NL LU DE CH IT ES AT GB'.split(' '));

/**
 * Grandes îles des pays reliés, sans train depuis le continent : la route
 * mesurée y passe par un ferry sans toujours paraître plus longue (Annecy →
 * Cagliari : 1,6 fois le vol d'oiseau), d'où ces emprises [sud, ouest, nord, est].
 */
const ISLANDS: Array<[number, number, number, number]> = [
  [41.3, 8.5, 43.1, 9.6], // Corse
  [38.8, 8.1, 41.35, 9.9], // Sardaigne
  [36.6, 12.4, 38.35, 15.7], // Sicile
  [38.6, 1.15, 40.1, 4.35], // Baléares
  [27.6, -18.2, 29.5, -13.3], // Canaries
  [42.7, 10.0, 42.9, 10.45], // Elbe
];

function onIsland(p: { lat: number; lon: number }): boolean {
  return ISLANDS.some(([s, w, n, e]) => p.lat >= s && p.lat <= n && p.lon >= w && p.lon <= e);
}

/** Distance par la voie ≈ vol d'oiseau × 1,25. */
const RAIL_DETOUR = 1.25;
/** Billet réservé 1 à 3 mois avant, par km de voie (barème Compas). */
const EUR_PER_RAIL_KM = 0.13;
/** Moyenne correspondances comprises (km/h), plus 30 min pour rejoindre la gare. */
const RAIL_KMH = 110;

export interface TrainTrip {
  railKm: number;
  minutesOneWay: number;
  /** Aller-retour, par personne. */
  eurRoundTrip: number;
  basis: string;
}

/**
 * Temps de train à l'aller qu'un voyage supporte : un week-end à Barcelone ne
 * passe pas 6 h 30 dans le train à l'aller (l'avion reste plus sensé).
 */
export function maxTrainMinutes(days: number | null | undefined): number {
  const d = days ?? 99;
  if (d <= 2) return 330;
  if (d === 3) return 420;
  return 600;
}

/**
 * Le train remplace l'avion quand les deux pays sont reliés, que la distance
 * s'y prête (150 à 1 200 km), que la route mesurée ne trahit pas une île ou
 * un détour (plus de 1,8 fois le vol d'oiseau : ferry pour la Corse, 3,7 fois),
 * et que le trajet tient dans la durée du voyage.
 */
export function trainTrip(input: {
  fromCountry: string | null | undefined;
  toCountry: string | null | undefined;
  straightKm: number;
  /** Route mesurée (km), si elle l'a été. */
  roadKm?: number | null;
  /** Durée du voyage (jours), pour le temps de train admissible. */
  days?: number | null;
  /** Lieu d'arrivée : une grande île n'a pas de train depuis le continent. */
  to?: { lat: number; lon: number } | null;
}): TrainTrip | null {
  const from = (input.fromCountry ?? '').toUpperCase();
  const to = (input.toCountry ?? '').toUpperCase();
  if (!RAIL.has(from) || !RAIL.has(to)) return null;
  if (!(input.straightKm >= 150 && input.straightKm <= 1200)) return null;
  if (input.roadKm == null || input.roadKm > input.straightKm * 1.8) return null;
  if (input.to && onIsland(input.to)) return null;
  const railKm = Math.round(input.straightKm * RAIL_DETOUR);
  const minutesOneWay = Math.round((railKm / RAIL_KMH) * 60 + 30);
  if (minutesOneWay > maxTrainMinutes(input.days)) return null;
  const eurRoundTrip = 2 * Math.max(30, Math.round(railKm * EUR_PER_RAIL_KM));
  const h = Math.round(minutesOneWay / 30) / 2;
  return {
    railKm,
    minutesOneWay,
    eurRoundTrip,
    basis: `barème Compas ${COSTS_VERSION} · train aller-retour, environ ${railKm} km de voie et ${String(h).replace('.', ',')} h · vrais horaires et prix dans Résa · Trajets`,
  };
}
