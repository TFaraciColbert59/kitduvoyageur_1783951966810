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
}): TrainTrip | null {
  const from = (input.fromCountry ?? '').toUpperCase();
  const to = (input.toCountry ?? '').toUpperCase();
  if (!RAIL.has(from) || !RAIL.has(to)) return null;
  if (!(input.straightKm >= 150 && input.straightKm <= 1200)) return null;
  if (input.roadKm == null || input.roadKm > input.straightKm * 1.8) return null;
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
