// Une etape sans coordonnees est une intention, pas un lieu. Tant qu elle
// reste dans la liste des etapes, elle empeche la journee d etre mesuree :
// `routeItinerary` exige que TOUTES les etapes du jour soient situees, et
// `applyActivityDurations` exige que TOUTES aient une duree. Une pause ou un
// repas ecrit en dur suffit donc a faire passer distance, denivele et duree
// a « a verifier » — alors que la base contient 98 points d interet reels
// autour de Chamonix.
//
// Ces tests verrouillent l invariant : apres attribution, plus aucune etape
// ne reste sans position. Ce qui n a pas pu etre rattache devient une note
// de journee, aff honnetement, et n empoisonne plus aucune mesure.
import { describe, expect, it } from 'vitest';
import { assignPlaces, toCandidate, type PlaceCandidate } from '../engine/places';
import { buildItinerary } from '../engine/itinerary';
import { routeItinerary, type RoutingDeps } from '../engine/routing';
import { fullDraft, CHAMONIX, ARGENTIERE } from './fixtures';
import type { DayNote, ItineraryModel } from '../types';

const CORRIDOR = [
  toCandidate({
    id: 'outdoor-1',
    name: 'Refuge du Gouter',
    category: 'refuge',
    lat: 45.8447,
    lng: 6.8427,
    tags: { price_per_night: 75 },
    is_verified: true,
  }),
  toCandidate({
    id: 'outdoor-2',
    name: 'Belvedere des Aiguilles',
    category: 'viewpoint',
    lat: 45.879,
    lng: 6.8873,
    is_verified: true,
  }),
  toCandidate({
    id: 'outdoor-3',
    name: 'Source du Merlet',
    category: 'water',
    lat: 45.88,
    lng: 6.82,
    is_verified: true,
  }),
  toCandidate({
    id: 'outdoor-4',
    name: 'Lac Blanc',
    category: 'water',
    lat: 45.91,
    lng: 6.9,
    is_verified: true,
  }),
  toCandidate({
    id: 'outdoor-5',
    name: 'Refuge du Plan de l Aiguille',
    category: 'refuge',
    lat: 45.89,
    lng: 6.88,
    is_verified: true,
  }),
].filter((candidate): candidate is PlaceCandidate => candidate !== null);

/** Brouillon complet : `buildItinerary` ne peut pas repondre `null` ici. */
function built(): ItineraryModel {
  const model = buildItinerary(fullDraft());
  if (model === null) throw new Error('le brouillon complet doit produire un modele');
  return model;
}

describe('aucune etape ne reste sans position', () => {
  it('le programme construit ne laisse aucune etape sans coordonnees', () => {
    const model = built();
    const located = assignPlaces(model, CORRIDOR, CHAMONIX, ARGENTIERE);

    const orphans = located.steps.filter(
      (step) => step.lat === null || step.lon === null,
    );

    expect(orphans.map((step) => `${step.day}:${step.title}`)).toEqual([]);
  });

  it('ce qui ne peut pas etre rattache devient une note, pas une etape fantome', () => {
    const model = built();
    // Corridor volontairement vide : rien ne peut etre rattache.
    const located = assignPlaces(model, [], CHAMONIX, ARGENTIERE);

    // Seuls les deux trajets extremes survivent : ce sont les lieux que la
    // personne a choisis, ils ne viennent pas de la base.
    expect(located.steps.map((step) => step.kind)).toEqual(['trajet', 'trajet']);
    expect(located.notes?.length ?? 0).toBeGreaterThan(0);
    expect(located.notes?.every((note) => note.title.length > 0)).toBe(true);
  });

  it('les journeys et les trajets choisis gardent toujours leur position', () => {
    const model = built();
    const located = assignPlaces(model, [], CHAMONIX, ARGENTIERE);
    const survivors = located.steps;

    expect(survivors.length).toBeGreaterThan(0);
    expect(survivors.every((step) => step.lat !== null && step.lon !== null)).toBe(true);
  });
});

describe('le programme affiche des lieux, pas des libelles generiques', () => {
  it('chaque etape affichee porte un lieu reel et un seul', () => {
    const located = assignPlaces(built(), CORRIDOR, CHAMONIX, ARGENTIERE);
    const names = located.steps.map((step) => step.placeName);

    expect(names.length).toBeGreaterThan(0);
    expect(names.every((name) => name !== null && name.length > 0)).toBe(true);
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });

  it('aucun titre generique ecrit en dur ne subsiste apres attribution', () => {
    const located = assignPlaces(built(), CORRIDOR, CHAMONIX, ARGENTIERE);
    const generiques = new Set([
      'eau et ravitaillement',
      'ravitaillement et eau',
      'repas de midi',
      'pause',
      "point d'interet sur le parcours",
    ]);
    const restants = located.steps
      .map((step) => step.title.trim().toLowerCase())
      .filter((title) => generiques.has(title));

    expect(restants).toEqual([]);
  });

  it('les intentions non rattachees restent tracees, avec leur raison', () => {
    const located = assignPlaces(built(), [], CHAMONIX, ARGENTIERE);
    const notes = located.notes ?? [];

    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((note) => note.day >= 1 && note.day <= 3)).toBe(true);
  });
});

describe('zero prouve, zero par defaut', () => {
  const NO_ROUTING: RoutingDeps = {
    route: async () => {
      throw new Error('aucun routage ne doit partir sur un jour incomplet');
    },
    elevation: async () => {
      throw new Error('aucune altitude ne doit etre demandee sur un jour incomplet');
    },
  };

  it('un jour qui a perdu une intention ne vaut pas zero : il reste a verifier', async () => {
    const partial = assignPlaces(
      built(),
      // Corridor vide : les journees se vident de leurs intentions et il ne
      // reste que les deux trajets choisis.
      [],
      CHAMONIX,
      ARGENTIERE,
    );
    const model = await routeItinerary(partial, NO_ROUTING);

    expect((partial.notes ?? []).some((note) => note.day === 3)).toBe(true);
    // « 0 km » serait une affirmation : on ne sait pas ou la personne passe.
    expect(model.perDay[2].distanceKm).toBeNull();
  });
});

// Un jour PROUVE sans deplacement (une seule etape situee, toutes les etapes
// du jour situees, aucune intention non rattachee) affiche deja « 0 km ».
// Son denivele doit etre PROUVE nul lui aussi : entre un point et lui-meme on
// ne monte pas. laisse `null`, il annulait le denivele TOTAL meme quand les
// autres journees etaient reellement mesurees.
describe('le denivele total ne se perd pas sur un jour a zero prouve', () => {
  const A = { lat: 45.9237, lon: 6.8694 };
  const B = { lat: 45.9819, lon: 6.9269 };

  // 1000 m -> 1400 m -> 1200 m : 400 m de montee puis 200 m de descente.
  // Chaque journee reellement routee vaut donc +400 / -200.
  const GEOMETRY: readonly (readonly [number, number])[] = [
    [A.lon, A.lat],
    [B.lon, B.lat],
    [A.lon, A.lat],
  ];
  const PROFILE: readonly number[] = [1000, 1400, 1200];

  const deps: RoutingDeps = {
    route: async () => [{ distanceKm: 8, durationMin: 45, geometry: GEOMETRY }],
    elevation: async () => PROFILE,
  };

  // Trois journees : deux mesurables (2 etapes) et une a zero prouve (1 etape).
  function modelWithProvenZeroDay(): ItineraryModel {
    const base = built();
    const template = base.steps[0];
    const at = (
      day: number,
      order: number,
      point: { lat: number; lon: number },
    ) => ({ ...template, id: `s${day}-${order}`, day, order, lat: point.lat, lon: point.lon });
    return {
      ...base,
      days: 3,
      steps: [at(1, 1, A), at(1, 2, B), at(2, 1, A), at(2, 2, B), at(3, 1, A)],
      notes: [],
    };
  }

  it('le jour a zero prouve affiche 0 km ET un denivele nul prouve', async () => {
    const model = await routeItinerary(modelWithProvenZeroDay(), deps);

    expect(model.perDay[2].distanceKm).toBe(0);
    expect(model.perDay[2].elevGainM).toBe(0);
    expect(model.perDay[2].elevLossM).toBe(0);
  });

  it('le denivele total additionne les journees mesurees au zero prouve', async () => {
    const model = await routeItinerary(modelWithProvenZeroDay(), deps);

    expect(model.totals.elevGainM).toBe(800);
    expect(model.totals.elevLossM).toBe(400);
  });

  it('un jour NON mesure garde son denivele a verifier', async () => {
    // Jour 3 ampute d une intention : le zero n est plus prouve, donc rien
    // ne peut etre ajoute au total.
    const note: DayNote = {
      day: 3,
      kind: 'repos',
      title: 'Pause',
      reason: 'non rattachee',
    };
    const partial = await routeItinerary(
      { ...modelWithProvenZeroDay(), notes: [note] },
      deps,
    );

    expect(partial.perDay[2].distanceKm).toBeNull();
    expect(partial.perDay[2].elevGainM).toBeNull();
    expect(partial.totals.elevGainM).toBeNull();
  });
});
