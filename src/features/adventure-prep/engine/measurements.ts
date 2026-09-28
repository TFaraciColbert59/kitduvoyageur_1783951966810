/**
 * Mesures reelles du parcours : le kilometrage et la meteo.
 *
 * Ces deux grandeurs ne s inv-entent pas, elles se mesurent :
 *   - la distance vient d OSRM, sur le RESEAU ROUTIER, jour par jour ;
 *   - la meteo vient d Open-Meteo, sur les DATES REELLES de l aventure.
 *
 * Module PUR comme le reste du moteur : le reseau est injecte, jamais importe.
 * Une source qui ne repond pas ne produit ni zero ni moyenne : elle laisse la
 * mesure a `null`, et l ecran assume « a verifier ».
 */

import { applyRouting, routeItinerary, type RoutingDeps } from './routing';
import { dateRange, type DayWeather } from './weather';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

/** Un point de mesure de la meteo : la position a interroger. */
export interface WeatherAnchor {
  readonly lat: number;
  readonly lon: number;
}

/**
 * Preleve la prevision pour une liste de dates deja calculees.
 *
 * L'ancre est passee par l'appelant plutot que recalculee ici : c'est lui qui
 * a tranche du point de depart, et une seule decision doit governer la
 * selection comme la requete.
 */
export type WeatherFetcher = (
  dates: readonly string[],
  signal: AbortSignal | undefined,
  anchor: WeatherAnchor,
) => Promise<readonly DayWeather[] | null>;

export interface MeasurementDeps {
  readonly route: RoutingDeps;
  readonly weather: WeatherFetcher;
}

/**
 * Le point d ancrage de la meteo.
 *
 * On privilegie le depart saisi : c est ce que l utilisateur a choisi. Sinon
 * on prend la premiere etape reellement situee. Sans aucun des deux, on ne
 * demande rien au fournisseur plutot que de lui faire deviner un point.
 */
export function weatherAnchor(
  draft: AdventurePrepDraft,
  model: ItineraryModel,
): WeatherAnchor | null {
  const origin = draft.route.origin;
  if (origin) return { lat: origin.lat, lon: origin.lon };
  const located = model.steps.find((step) => step.lat !== null && step.lon !== null);
  if (!located || located.lat === null || located.lon === null) return null;
  return { lat: located.lat, lon: located.lon };
}

/**
 * Rattache la meteo mesuree au modele, jour par jour, sur les dates reelles.
 *
 * Un tableau de prevision incomplet est refuse en entier : aligner la serie
 * sur les jours serait faire dire a la journee 1 la meteo d une autre date.
 */
export function applyWeather(
  model: ItineraryModel,
  startDate: string | null,
  fetched: readonly DayWeather[] | null,
): ItineraryModel {
  if (!fetched || fetched.length !== model.days) return model;
  const dates = dateRange(startDate, model.days);
  if (!dates) return model;
  const byDate = new Map(fetched.map((day) => [day.date, day]));
  return { ...model, weather: dates.map((date) => byDate.get(date) ?? null) };
}

/**
 * Enchaine routage puis meteo. Chaque etape est independante : un routage
 * muet n empeche pas la meteo, et l inverse est vrai aussi.
 */
export async function measureItinerary(
  draft: AdventurePrepDraft,
  model: ItineraryModel,
  deps: MeasurementDeps,
  signal?: AbortSignal,
): Promise<ItineraryModel> {
  // Un parcours deja annule ne part pas sur le reseau : les deps reelles
  // rejettent immediatement, autant ne pas leur demander.
  if (signal?.aborted) return model;

  // 1. Kilometrage routier et denivele, jour par jour.
  let routed = model;
  try {
    routed = await routeItinerary(model, deps.route, signal);
  } catch {
    routed = model;
  }
  if (signal?.aborted) return routed;

  // 2. Meteo des dates reelles, a l'ancre de l aventure.
  const anchor = weatherAnchor(draft, routed);
  const dates = anchor ? dateRange(draft.calendar.startDate, routed.days) : null;
  if (!anchor || !dates || dates.length === 0) return routed;

  let fetched: readonly DayWeather[] | null = null;
  try {
    fetched = await deps.weather(dates, signal, anchor);
  } catch {
    fetched = null;
  }
  if (signal?.aborted) return routed;

  return applyWeather(routed, draft.calendar.startDate, fetched);
}

/* ------------------------------------------------------------------ */
/* Assemblage des phases de mesure                                      */
/* ------------------------------------------------------------------ */

/**
 * Une phase de mesure : elle recoit le modele deja construit et en rend un
 * nouveau, mesure ou pas. C'est ce decoupage qui permet au rail de cocher
 * `trace` et `meteo` chacune APRES son propre travail, plutot que d'annoncer
 * deux phases d'un coup a la fin.
 */
export type MeasurementRunner = (
  draft: AdventurePrepDraft,
  model: ItineraryModel,
  signal: AbortSignal,
) => Promise<ItineraryModel>;

export interface MeasurementRunners {
  readonly trace: MeasurementRunner;
  readonly weather: MeasurementRunner;
}

/**
 * Le cas sans reseau : le serveur, les tests et le rendu statique. Les deux
 * runners sont alors des identites, donc le modele garde ses `null` — ce qui
 * est la seule reponse honnete quand personne n'a mesure quoi que ce soit.
 */
export const NO_MEASUREMENTS: MeasurementRunners = {
  trace: async (_draft, model) => model,
  weather: async (_draft, model) => model,
};

/** Convertit des dependances reelles en deux phases independantes. */
export function measurementRunners(deps: MeasurementDeps): MeasurementRunners {
  return {
    trace: async (_draft, model, signal) => {
      try {
        return await routeItinerary(model, deps.route, signal);
      } catch {
        return model;
      }
    },
    weather: async (draft, model, signal) => {
      const anchor = weatherAnchor(draft, model);
      const dates = anchor ? dateRange(draft.calendar.startDate, model.days) : null;
      if (!anchor || !dates || dates.length === 0) return model;
      let fetched: readonly DayWeather[] | null = null;
      try {
        fetched = await deps.weather(dates, signal, anchor);
      } catch {
        fetched = null;
      }
      return applyWeather(model, draft.calendar.startDate, fetched);
    },
  };
}

/** Re-export pratique : le trace d une journee, pour la carte du jour. */
export { applyRouting };
