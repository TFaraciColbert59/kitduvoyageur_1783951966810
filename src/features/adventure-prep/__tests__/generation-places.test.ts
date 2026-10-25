/**
 * P0.1 - La phase LIEUX, et pourquoi elle doit exister.
 *
 * Le moteur sortait des etapes sans position, donc sans chaine a router, donc
 * sans kilometres, sans carte et sans denivele. `assignPlaces` existait et
 * n etait appele par personne.
 *
 * Cette phase est un travail REEL - une requete au depot - donc elle est
 * annoncee comme les cinq autres. La cacher sous `verification_etapes` ferait
 * un ecran de chargement qui ment sur ce qu il est en train de faire.
 *
 * Garanties : la phase existe et precede le routage ; un resolveur muet ou
 * qui leve ne tue pas la generation ; des positions reelles permettent ensuite
 * au routage de produire une distance.
 */
import { describe, expect, it } from 'vitest';
import { GENERATION_PHASES } from '../engine/generation';
import { runItineraryGeneration } from '../engine/itineraryPhases';
import { measurementRunners, NO_MEASUREMENTS, type MeasurementRunners } from '../engine/measurements';
import type { RouteLeg } from '../engine/routing';
import { assignPlaces, type PlaceCandidate } from '../engine/places';
import { buildItinerary } from '../engine/itinerary';
import type { AdventurePrepDraft, ItineraryModel } from '../types';
import { fullDraft, CHAMONIX, ARGENTIERE } from './fixtures';

function candidate(
  id: string,
  name: string,
  category: string,
  lat: number,
  lon: number,
): PlaceCandidate {
  return {
    id,
    name,
    category,
    lat,
    lon,
    description: null,
    region: null,
    country: 'France',
    pricePerNight: null,
    phone: null,
    website: null,
    isVerifiable: true,
  };
}

/*
 * Les lieux REELS du corridor Chamonix - Argentiere, lus dans `/api/pois` le
 * 28 septembre 2026, deduplicates. Dix lignes distinctes : cinq refuges ou
 * bivouacs, trois sources ou lacs, un belvedere, un sommet.
 *
 * Ils ne sont pas choisis pour faire passer un test : ce sont les seules
 * positions que la base contient sur ce trajet, et leur nombre limite ce que
 * l'ecran peut promettre. Sur trois jours, il n'y en a pas assez pour
 * situer chaque etape - le test LG-09 verrouille ce refus plutot que de
 * l eluder.
 */
const CANDIDATES: PlaceCandidate[] = [
  candidate('o-mont-blanc', 'Mont Blanc', 'summit', 45.8326, 6.8652),
  candidate('o-gouter', 'Refuge du Gouter', 'refuge', 45.8447, 6.8427),
  candidate('o-torino', 'Rifugio Torino', 'refuge', 45.8634, 6.9876),
  candidate('o-merlet', 'Source du Merlet', 'water', 45.8756, 6.8234),
  candidate('o-midi', 'Aiguille du Midi', 'viewpoint', 45.879, 6.8873),
  candidate('o-plan', 'Refuge du Plan de l Aiguille', 'refuge', 45.8934, 6.8756),
  candidate('o-bivouac', 'Bivouac Lac Blanc', 'camping', 45.91, 6.9),
  candidate('o-lac-blanc', 'Lac Blanc', 'water', 45.9123, 6.9012),
  candidate('o-charpoua', 'Refuge de la Charpoua', 'refuge', 45.9012, 6.9234),
  candidate('o-bossons', 'Torrent des Bossons', 'water', 45.8567, 6.8456),
];

type Resolver = (draft: AdventurePrepDraft, model: ItineraryModel) => Promise<ItineraryModel>;

/*
 * Deux jours, et non trois. Ce n'est pas un raccourci : c'est la taille pour
 * laquelle la base suffit reellement a situer chaque journee. Sur trois jours,
 * la derniere n'a plus aucun lieu compatible et le total reste muet - ce qui
 * est le comportement correct, verifie par LG-09.
 */
const draft: AdventurePrepDraft = fullDraft({
  calendar: {
    startDate: '2026-07-11',
    durationDays: 2,
    durationIsSuggested: false,
    startDateIsSuggested: false,
    returnDate: '2026-07-12',
  },
});

const draftThreeDays: AdventurePrepDraft = fullDraft();

/** Un routage de doublure : il ne mesure rien de reel, il prouve le branchement. */
const FAKE_ROUTE: MeasurementRunners = measurementRunners({
  route: {
    route: async (points) => {
      const out: RouteLeg[] = [];
      for (let index = 0; index < points.length - 1; index += 1) {
        const from = points[index];
        const to = points[index + 1];
        out.push({
          distanceKm: 2,
          durationMin: 4,
          geometry: [
            [from.lon, from.lat],
            [to.lon, to.lat],
          ] as RouteLeg['geometry'],
        });
      }
      return out;
    },
    elevation: async () => null,
  },
  weather: async () => null,
});

async function run(resolvePlaces: Resolver, measure = NO_MEASUREMENTS) {
  const announced: string[] = [];
  const outcome = await runItineraryGeneration(
    draft,
    new AbortController().signal,
    async () => ({ drafted: null, failure: 'provider_indisponible' as const , suggestedStartDate: null, suggestedDurationDays: null}),
    (phase) => announced.push(phase),
    measure,
    {},
    resolvePlaces,
  );
  return { outcome, announced };
}

describe('P0.1 - la phase LIEUX', () => {
  it('LG-01 la phase existe, entre les disponibilites et le calcul des distances', () => {
    const ids = GENERATION_PHASES.map((phase) => phase.id);
    expect(ids).toContain('lieux');
    expect(ids.indexOf('lieux')).toBeGreaterThan(ids.indexOf('disponibilites'));
    expect(ids.indexOf('lieux')).toBeLessThan(ids.indexOf('trace'));
  });

  it('LG-02 la phase est annoncee a l ecran de chargement', async () => {
    const { announced } = await run(async (d, model) =>
      assignPlaces(model, CANDIDATES, d.route.origin, d.route.destination),
    );
    expect(announced).toContain('lieux');
  });

  it('LG-03 des positions reelles sont accrochees aux etapes', async () => {
    const { outcome } = await run(async (d, model) =>
      assignPlaces(model, CANDIDATES, d.route.origin, d.route.destination),
    );
    const located = (outcome.model?.steps ?? []).filter((step) => step.lat !== null);
    expect(located.length).toBeGreaterThan(0);
  });

  it('LG-04 un resolveur muet ne tue pas la generation', async () => {
    const { outcome } = await run(async (_d, model) => model);
    expect(outcome.model).not.toBeNull();
    expect((outcome.model?.steps ?? []).every((step) => step.lat === null)).toBe(true);
  });

  it('LG-05 un resolveur qui leve ne tue pas la generation', async () => {
    const { outcome } = await run(async () => {
      throw new Error('reseau');
    });
    expect(outcome.model).not.toBeNull();
  });

  it('LG-06 des positions posees permettent au routage de mesurer', async () => {
    const { outcome, announced } = await run(
      async (d, model) => assignPlaces(model, CANDIDATES, d.route.origin, d.route.destination),
      FAKE_ROUTE,
    );
    expect(outcome.model?.totals.distanceKm).not.toBeNull();
    expect(announced).toContain('lieux');
  });

  it('LG-09 trop de jours pour les lieux disponibles : le total se tait', async () => {
    // Le mur honnete du preparateur. Sur trois jours, la base ne contient pas
    // assez de lieux compatibles pour situer la derniere journee : elle ne
    // reste qu'un point, donc elle n'est pas routée. Le total devient alors
    // INCONNU - pas 8 + 4 presente comme la distance du voyage. Les jours
    // mesures, eux, restent affiches : c'est le seul moyen de montrer ce
    // qu'on sait sans pretendre savoir le reste.
    const announced: string[] = [];
    const outcome = await runItineraryGeneration(
      draftThreeDays,
      new AbortController().signal,
      async () => ({ drafted: null, failure: 'provider_indisponible' as const , suggestedStartDate: null, suggestedDurationDays: null}),
      (phase) => announced.push(phase),
      FAKE_ROUTE,
      {},
      async (d, model) => assignPlaces(model, CANDIDATES, d.route.origin, d.route.destination),
    );
    expect(outcome.model?.perDay[0].distanceKm).not.toBeNull();
    expect(outcome.model?.perDay[1].distanceKm).not.toBeNull();
    expect(outcome.model?.perDay[2].distanceKm).toBeNull();
    expect(outcome.model?.totals.distanceKm).toBeNull();
    expect(announced).toContain('lieux');
  });

  it('LG-07 sans position, le routage reste muet : le total ne sort pas de nulle', async () => {
    const { outcome } = await run(async (_d, model) => model, FAKE_ROUTE);
    expect(outcome.model?.totals.distanceKm).toBeNull();
  });
});

describe('P0.1 - le modele nu, avant toute position', () => {
  it('LG-08 le moteur de regles sort bien des etapes sans position', () => {
    // Ce test ne doit jamais devenir faux : il explique POURQUOI la phase
    // existe. Si le moteur se met un jour a poser lui-meme des positions, ce
    // test doit echouer et doit etre reecrit, pas ignore.
    const model = buildItinerary(draft);
    expect(model).not.toBeNull();
    expect((model?.steps ?? []).length).toBeGreaterThan(0);
    expect((model?.steps ?? []).every((step) => step.lat === null)).toBe(true);
  });
});
