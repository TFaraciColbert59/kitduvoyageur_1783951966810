/**
 * Un programme REALEMENT localise, ecrit etape par etape.
 *
 * `buildItinerary` demande le moteur et donc des donnees externes : un test du
 * tiroir ne doit pas dependre de la reponse d un fournisseur. Les positions
 * ci-dessous sont de VRAIES coordonnees de Chamonix et d Argentiere (fixtures
 * du feature), employees dans l ordre de lecture jour/rang.
 */
import type { AdventurePrepStore } from '../store/useAdventurePrepStore';
import type { DayTotals, ItineraryModel, ItineraryStep } from '../types';
import { fullDraft } from './fixtures';

const VIDE: DayTotals = {
  distanceKm: null,
  movingMin: null,
  activityMin: null,
  elevGainM: null,
  elevLossM: null,
};

function etape(entree: Partial<ItineraryStep> & Pick<ItineraryStep, 'id' | 'day' | 'order' | 'kind' | 'title'>): ItineraryStep {
  return {
    placeName: null,
    placeId: null,
    startTime: null,
    durationMin: null,
    reason: null,
    price: { amount: null, currency: 'EUR', known: false },
    state: 'a_proposer',
    kept: false,
    icon: '',
    lat: null,
    lon: null,
    ...entree,
  } as ItineraryStep;
}

/** Trois etapes : deux le premier jour, une le second, toutes localisees. */
export function programmeLocalise(): ItineraryModel {
  return {
    title: 'Chamonix - Argentiere',
    days: 2,
    steps: [
      etape({ id: 's1', day: 1, order: 1, kind: 'arret', title: 'Départ Chamonix', lat: 45.9237, lon: 6.8694 }),
      etape({ id: 's2', day: 1, order: 2, kind: 'nuit', title: 'Refuge du Requin', lat: 45.9819, lon: 6.9269 }),
      etape({ id: 's3', day: 2, order: 1, kind: 'repos', title: 'Retour', lat: 45.9237, lon: 6.8694 }),
    ],
    totals: VIDE,
    perDay: [VIDE, VIDE],
    weather: [null, null],
    metricsContext: { travelContext: null, category: null },
    travelMode: 'pieton',
    budgetPerPerson: { amount: null, currency: 'EUR', known: false },
    activityCount: 1,
    contingencies: [],
  } as unknown as ItineraryModel;
}

/** Le meme programme, mais AUCUNE position : la carte n a rien a cadrer. */
export function programmeSansPosition(): ItineraryModel {
  const base = programmeLocalise();
  return { ...base, steps: base.steps.map((step) => ({ ...step, lat: null, lon: null })) };
}

/** Brouillon complet porte par le modele fourni. */
export function draftAvec(modele: ItineraryModel | null) {
  return { ...fullDraft(), itinerary: modele };
}

/** `StepsSheet` ne lit que ces membres de l API du store. */
export function storeFactice(): AdventurePrepStore {
  return {
    setStepState: () => undefined,
    removeStep: () => undefined,
    keepStep: () => undefined,
    addStepToDay: () => undefined,
    updateStep: () => undefined,
  } as unknown as AdventurePrepStore;
}
