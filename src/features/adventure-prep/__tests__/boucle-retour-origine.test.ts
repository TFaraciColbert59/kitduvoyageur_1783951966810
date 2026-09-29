/**
 * A9 — une BOUCLE doit revenir au point de depart. Elle le promettait, elle ne
 * le faisait pas.
 *
 * Le defaut mesure : le titre propose par le modele annoncait « Boucle du
 * Mont-Blanc en 2 jours » alors que le programme mesurait 67 km et s arretait
 *ailleurs. La cause n est pas le modele, il est deux lignes plus bas :
 *
 *  - uildItinerary n ajoute une etape de retour que pour ller_simple ;
 *  - nforceDayContinuity ne rattrape le retour que pour ller_simple.
 *
 * Or shape: boucle se deduit de l absence d arrivee, et le motif du jour 1
 * ecrit noir sur blanc « parcours EN et on revient au point de depart ».
 * L ecran promettait donc un retour que rien ne produisait : le titre etait
 * faux, et surtout le kilometrage ne comptait pas le retour reel.
 *
 * Aucun appel reseau : tout est donne. Les positions sont de vraies
 * coordinates, les mesures sont explicitement posees ou absentes.
 */
import { describe, expect, it } from 'vitest';
import { buildItinerary } from '../engine/itinerary';
import { assignPlaces } from '../engine/places';
import { enforceDayContinuity } from '../engine/continuity';
import { haversineKm } from '../engine/routing';
import type { AdventurePrepDraft, ItineraryModel, ItineraryStep, ItineraryStepKind } from '../types';
import { ARGENTIERE, CHAMONIX, fullDraft } from './fixtures';

const PRIX = { amount: null, currency: 'EUR', state: 'a_reserver' } as const;

function etape(
  id: string,
  day: number,
  order: number,
  kind: ItineraryStepKind,
  titre: string,
  point: { lat: number; lon: number } | null,
  placeName: string | null = null,
): ItineraryStep {
  return {
    id, day, order, kind, title: titre, placeName,
    placeId: null,
    startTime: null, durationMin: null, reason: null,
    price: { ...PRIX }, state: 'propose', kept: false, icon: 'map-pin',
    lat: point?.lat ?? null, lon: point?.lon ?? null,
  };
}

const INCONNU = {
  distanceKm: null, movingMin: null, activityMin: null, elevGainM: null, elevLossM: null,
} as const;

function modelOf(days: number, steps: readonly ItineraryStep[]): ItineraryModel {
  return {
    title: null, days, steps,
    totals: { distanceKm: 67, movingMin: 1020, activityMin: 1050, elevGainM: 4304, elevLossM: 4100 },
    perDay: Array.from({ length: days }, () => ({ ...INCONNU })),
    weather: Array.from({ length: days }, () => null),
    metricsContext: 'voyage',
    budgetPerPerson: { ...PRIX },
    activityCount: days,
    contingencies: [],
  };
}

function draftBoucle(overrides: Partial<AdventurePrepDraft> = {}): AdventurePrepDraft {
  return fullDraft({
    route: { origin: CHAMONIX, destination: null, shape: 'boucle' },
    calendar: { startDate: '2026-07-11', startDateIsSuggested: false, durationDays: 2, durationIsSuggested: false, returnDate: null },
    ...overrides,
  });
}

function derniere(modele: ItineraryModel): ItineraryStep {
  return modele.steps[modele.steps.length - 1] as ItineraryStep;
}

describe('A9-1 — la regle des lieux promet un retour, elle doit le produire', () => {
  it('A9-01 : un parcours en boucle se termine par un retour au depart', () => {
    const modele = buildItinerary(draftBoucle());
    expect(modele).not.toBeNull();
    const fin = derniere(modele as ItineraryModel);
    expect(fin.placeName).toBe(CHAMONIX.name);
  });

  it('A9-02 : ce retour finit sur les VRAIES coordonnees du depart', () => {
    // Les coordonnees ne sont pas posees par la regle : elles sont accrochees
    // par la phase « lieux », comme tous les autres lieux du programme. On
    // mesure donc la fin REELLE du pipeline, pas un etat intermediaire.
    const modele = buildItinerary(draftBoucle()) as ItineraryModel;
    const programme = assignPlaces(modele, [], CHAMONIX, null);
    // Sans cette precision le test passe a vide : la phase « lieux » SUPPRIME
    // une etape sans position, et un programme reduit a son seul depart
    // finit lui aussi sur le depart. On exige donc un vrai retour.
    const retours = programme.steps.filter((step) => step.kind === 'trajet' && step.lat !== null);
    expect(retours.length).toBeGreaterThanOrEqual(2);
    const fin = derniere(programme);
    expect(fin.kind).toBe('trajet');
    expect(fin.lat).toBe(CHAMONIX.lat);
    expect(fin.lon).toBe(CHAMONIX.lon);
  });

  it('A9-03 : la promesse ecrite « on revient au point de depart » est tenue', () => {
    // Le motif du jour 1 annonce deja le retour. On ne tolere pas un ecran
    // qui ecrit une chose et en fait une autre.
    const modele = buildItinerary(draftBoucle()) as ItineraryModel;
    const premier = modele.steps[0] as ItineraryStep;
    expect(premier.reason ?? '').toContain('revient au point de départ');
    const programme = assignPlaces(modele, [], CHAMONIX, null);
    const fin = derniere(programme);
    expect(haversineKm({ lat: fin.lat as number, lon: fin.lon as number }, CHAMONIX)).toBeLessThan(0.5);
  });

  it('A9-04 : en aller simple, le retour va a l arrivee, PAS au depart', () => {
    const modele = buildItinerary(
      fullDraft({
        route: { origin: CHAMONIX, destination: ARGENTIERE, shape: 'aller_simple' },
        calendar: { startDate: '2026-07-11', startDateIsSuggested: false, durationDays: 2, durationIsSuggested: false, returnDate: '2026-07-12' },
      }),
    ) as ItineraryModel;
    const fin = derniere(modele);
    expect(fin.placeName).toBe(ARGENTIERE.name);
  });
});

describe('A9-2 — la continuite rattrape une boucle que le modele laisse ouverte', () => {
  const finLoin = { lat: 45.8447, lon: 6.8427 }; // Refuge du Gouter, 10 km de Chamonix.

  it('A9-05 : une boucle qui s arrete ailleurs se termine sur le depart', () => {
    const programme = [
      etape('j1-dep', 1, 0, 'trajet', 'Depart', CHAMONIX, CHAMONIX.name),
      etape('j1-nuit', 1, 1, 'nuit', 'Nuit au refuge', finLoin, 'Refuge du Gouter'),
    ];
    const corrige = enforceDayContinuity(modelOf(1, programme), draftBoucle({ calendar: { startDate: '2026-07-11', startDateIsSuggested: false, durationDays: 1, durationIsSuggested: false, returnDate: null } }));
    const fin = derniere(corrige);
    expect(fin.lat).toBe(CHAMONIX.lat);
    expect(fin.lon).toBe(CHAMONIX.lon);
  });

  it('A9-06 : une boucle DEJA revenue ne recoit pas d etape redondante', () => {
    const programme = [
      etape('j1-dep', 1, 0, 'trajet', 'Depart', CHAMONIX, CHAMONIX.name),
      etape('j1-nuit', 1, 1, 'nuit', 'Nuit au refuge', finLoin, 'Refuge du Gouter'),
      etape('j1-retour', 1, 2, 'trajet', 'Retour Chamonix', CHAMONIX, CHAMONIX.name),
    ];
    const corrige = enforceDayContinuity(modelOf(1, programme), draftBoucle({ calendar: { startDate: '2026-07-11', startDateIsSuggested: false, durationDays: 1, durationIsSuggested: false, returnDate: null } }));
    expect(corrige.steps).toHaveLength(3);
  });

  it('A9-07 : en boucle, aucun retour vers l arrivee n est invente', () => {
    // Propriete A8-06 conservee : meme dans un etat impossible ou la forme
    // vaut boucle et une arrivee traine, le retour vise le DEPART.
    const programme = [etape('j1-nuit', 1, 0, 'nuit', 'Nuit au refuge', finLoin, 'Refuge du Gouter')];
    const corrige = enforceDayContinuity(
      modelOf(1, programme),
      fullDraft({ route: { origin: CHAMONIX, destination: ARGENTIERE, shape: 'boucle' } }),
    );
    expect(corrige.steps.some((s) => s.lat === ARGENTIERE.lat && s.lon === ARGENTIERE.lon)).toBe(false);
  });

  it('A9-08 : le retour ajoute invalide les mesures perimees du dernier jour', () => {
    const programme = [etape('j1-nuit', 1, 0, 'nuit', 'Nuit au refuge', finLoin, 'Refuge du Gouter')];
    const mesure: ItineraryModel = {
      ...modelOf(1, programme),
      perDay: [{ distanceKm: 44.9, movingMin: 890, activityMin: 1050, elevGainM: 4304, elevLossM: 4100 }],
    };
    const corrige = enforceDayContinuity(mesure, draftBoucle({ calendar: { startDate: '2026-07-11', startDateIsSuggested: false, durationDays: 1, durationIsSuggested: false, returnDate: null } }));
    expect(corrige.perDay[0]?.distanceKm).toBeNull();
  });

  it('A9-09 : sans depart choisi, rien n est invente', () => {
    const programme = [etape('j1', 1, 0, 'arret', 'Jour libre', null)];
    const corrige = enforceDayContinuity(
      modelOf(1, programme),
      draftBoucle({ route: { origin: null, destination: null, shape: 'boucle' } }),
    );
    expect(corrige.steps).toHaveLength(1);
  });
});
