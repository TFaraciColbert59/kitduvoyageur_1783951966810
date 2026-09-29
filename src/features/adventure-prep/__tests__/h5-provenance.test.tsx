/**
 * H5 — La provenance, du point d'integration laisse en attente a l'ecran.
 *
 * `engine/provenance.ts` et `components/PrepDataSource.tsx` existaient,
 * testes (15 cas), et n'etaient appeles par PERSONNE : le module那时候 ne
 * faisait qu'une description, la ligne n'apparaitait sur aucun ecran. Une
 * distance affichee sans origine reste un chiffre qu'on ne peut pas verifier.
 *
 * La regle qui rend l'item serieux, et que ces tests verrouillent : le
 * `provider` vient de la REPONSE serveur, jamais du mode demande. Ecrire
 * `'osrm'` en dur parce qu'on a demande OSRM nommerait un moteur qui a pu
 * repondre « valhalla » — ou n'avoir repondu de rien du tout. Un refus ne
 * porte aucun fournisseur, donc l'ecran dit « source inconnue ».
 *
 * Couverture en trois plans, du plus bas au plus haut :
 *   1. le CHEMIN DU RUNNER : le callback ne part que d une reponse nommee ;
 *   2. la DERIVATION PURE : `buildProvenance` ;
 *   3. l'ECRAN : la ligne est rendue sous la tuile.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { browserRoutingDeps, readRouteProvider } from '../browserMeasurements';
import { buildItinerary } from '../engine/itinerary';
import { measureItinerary, type MeasurementDeps } from '../engine/measurements';
import { assignPlaces, type PlaceCandidate } from '../engine/places';
import type { RouteLeg, RoutingDeps } from '../engine/routing';
import { metricsFor, type PrepMetric } from '../engine/metrics';
import { describeDataSource, SOURCE_INCONNUE, DATA_SOURCE_LABELS } from '../engine/provenance';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

const state = vi.hoisted(() => ({ current: null as { draft: AdventurePrepDraft } | null }));
vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (s: { draft: AdventurePrepDraft }) => unknown) =>
    selector(state.current as { draft: AdventurePrepDraft })) as unknown as { getState: () => unknown };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

const { ItineraryStepScreen, buildProvenance } = await import('../components/ItineraryStep');

const PTS = [
  { lat: 45.9237, lon: 6.8694 },
  { lat: 45.9819, lon: 6.9269 },
];

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

/**
 * Une reponse `/api/route` reelle, dans la forme que `readRouteResponse`
 * lit : `distanceKm`, `durationMin`, et une geometrie en paires
 * `[lon, lat]`. Un corps en GeoJSON brut passerait pour une panne de
 * reseau — et le test echouerait pour la mauvaise raison.
 */
function routeOk(provider: string): unknown {
  return {
    status: 'ok',
    provider,
    legs: [
      {
        distanceKm: 1,
        durationMin: 1,
        geometry: [
          [6.8694, 45.9237],
          [6.9269, 45.9819],
        ],
      },
    ],
  };
}

describe('H5-1 — le fournisseur vient de la REPONSE, jamais du mode demande', () => {
  it('H5-01: une reponse nommee declenche le callback, avec CE nom-la', async () => {
    const vus: string[] = [];
    // Le mode demande ici est 'pieton' et la reponse nomme 'valhalla' :
    // si le callback recopiait le mode, ce test verrait passer un runner
    // qui n aurait jamais ouvert le corps de la reponse.
    const deps = browserRoutingDeps(async () => jsonResponse(routeOk('valhalla')), (p) => vus.push(p));
    const legs = await deps.route(PTS, 'pieton', new AbortController().signal);
    expect(legs).not.toBeNull();
    // Le mode demande n'intervient pas : c'est le CORPS de la reponse qui
    // parle. Un runner qui renverrait « osrm » par defaut passerait ce test
    // en changeant seulement la chaine attendue — d'ou le nom reel ci-dessus.
    expect(vus).toEqual(['valhalla']);
  });

  it('H5-02: un REFUS ne nomme personne — aucun callback', async () => {
    const vus: string[] = [];
    // Le refus du moteur : le corps ne porte pas de `legs`. C'est le cas
    // exact qu'un `?? 'osrm'` maquillerait en « source OpenStreetMap ».
    const deps = browserRoutingDeps(async () => jsonResponse({ status: 'refus' }), (p) => vus.push(p));
    const legs = await deps.route(PTS, 'pieton', new AbortController().signal);
    expect(legs).toBeNull();
    expect(vus).toEqual([]);
  });

  it('H5-03: une reponse sans champ provider ne nomme personne non plus', async () => {
    const vus: string[] = [];
    const { provider: _ignored, ...sansProvider } = routeOk('osrm') as { provider: string };
    const deps = browserRoutingDeps(
      async () => jsonResponse(sansProvider),
      (p) => vus.push(p)
    );
    await deps.route(PTS, 'pieton', new AbortController().signal);
    expect(readRouteProvider(sansProvider)).toBeNull();
    expect(vus).toEqual([]);
  });

  it('H5-04: un fournisseur inconnu dans la reponse ne devient pas un nom affiche', () => {
    // Un serveur d'une version future ne doit pas produire un libelle bricole.
    expect(readRouteProvider({ provider: 'graphhopper' })).toBeNull();
  });
});

describe('H5-2 — la derivation pure, mesure par mesure', () => {
  function metric(id: PrepMetric['id'], value: number | null): PrepMetric {
    return {
      id,
      label: id,
      value,
      unit: id === 'distance' ? 'km' : 'm',
      state: value === null ? 'a_verifier' : 'connue',
      formatted: 'x',
    };
  }

  it('H5-05: le routeur repondu nomme la distance', () => {
    const entries = buildProvenance([metric('distance', 12.4), metric('denivele', 800)], 'brouter');
    expect(entries).toHaveLength(2);
    expect(entries[0].source).toBe('brouter');
    expect(describeDataSource(entries[0])).toContain(DATA_SOURCE_LABELS.brouter);
  });

  it('H5-06: aucune reponse = « source inconnue », jamais le routeur par defaut', () => {
    const entries = buildProvenance([metric('distance', 12.4)], null);
    expect(entries[0].source).toBeNull();
    expect(describeDataSource(entries[0])).toContain(SOURCE_INCONNUE);
    // Le nombre, lui, reste affiche : c'est la MESURE qui est honnete, c'est
    // son origine qui manque. On ne cache pas la mesure pour autant.
    expect(describeDataSource(entries[0])).toContain('12,4');
  });

  it('H5-07: le denivele ne porte pas le nom du routeur', () => {
    // Le denivele sort de la grille d altitudes, pas du routeur. Lui prêter
    // le fournisseur du routage serait une attribution FAUSSE, meme si le
    // chiffre est bon.
    const entries = buildProvenance([metric('distance', 10), metric('denivele', 500)], 'osrm');
    expect(entries[1].source).toBeNull();
  });

  it('H5-08: une mesure non relevee ne recoit pas de ligne', () => {
    // « Distance : À verifier · source inconnue » sous une tuile qui dit deja
    // « À verifier », c'est deux fois la meme absence et zero information.
    expect(buildProvenance([metric('distance', null), metric('denivele', null)], 'osrm')).toEqual([]);
  });

  it('H5-09: seules la distance et le denivele sont concernes', () => {
    const entrees = buildProvenance(
      [
        metric('duree', 6),
        metric('nuitees', 2),
        metric('budget', 90),
        metric('distance', 10),
      ],
      'osrm'
    );
    expect(entrees.map((e) => e.metric)).toEqual(['distance']);
  });
});

describe('H5-3 — la ligne est sur l ecran, sous la tuile', () => {
  function located(): ItineraryModel {
    // UN seul jour, et deux etapes localisees : c est le minimum qu un trace
    // routier exige. Sur trois jours, `assignPlaces` ne localise qu une
    // etape les jours 2 et 3 — le kilometrage resterait a `null`, ce qui est
    // honnete mais ne prouverait rien sur la ligne de provenance.
    const complet = fullDraft();
    const draft = fullDraft({
      ...complet,
      calendar: {
        ...complet.calendar,
        durationDays: 1,
        durationIsSuggested: false,
        startDateIsSuggested: false,
        returnDate: null,
      },
    });
    const base = buildItinerary(draft);
    if (!base) throw new Error('modele attendu');
    const c = (id: string, name: string, lat: number, lon: number): PlaceCandidate => ({
      id,
      name,
      category: 'refuge',
      lat,
      lon,
      description: null,
      region: null,
      country: 'France',
      pricePerNight: null,
      phone: null,
      website: null,
      isVerifiable: true,
    });
    return assignPlaces(
      base,
      [c('lac', 'Lac Blanc', 45.9339, 6.8852), c('aig', 'Aiguille', 45.8785, 6.8873)],
      draft.route.origin,
      draft.route.destination
    );
  }

  /**
   * Un modele dont la distance vient d une MESURE, jamais d une valeur ecrite.
   *
   * `buildItinerary` seul laisse `totals.distanceKm` a `null` : c est l etat
   * honnete d un parcours qui n a pas encore ete mesure. Le depot de la
   * provenance se prouve donc sur un modele passe dans `measureItinerary`,
   * avec un routage INJECTE — la meme voie que `/api/route`, et la valeur
   * affichee sort de la reponse simulee, pas d un nombre place a la main.
   */
  async function measured(): Promise<ItineraryModel> {
    const draft = fullDraft();
    const route: RoutingDeps = {
      route: async (points) =>
        points.slice(1).map(
          (): RouteLeg => ({
            distanceKm: 1,
            durationMin: 1,
            geometry: [
              [6.8694, 45.9237],
              [6.9269, 45.9819],
            ],
          })
        ),
      elevation: async () => null,
    };
    const deps: MeasurementDeps = { route, weather: async () => null };
    return measureItinerary(draft, located(), deps);
  }

  it('H5-10: la provenance est rendue, et le composant PrepDataSource est utilise', async () => {
    const model = await measured();
    const metrics = metricsFor(model, 'aventure');
    // Garde-fou : sans valeur reelle, il n'y a rien a attribuer et le test
    // ne prouverait rien.
    expect(metrics.some((m) => m.id === 'distance' && m.value !== null)).toBe(true);

    state.current = { draft: { ...fullDraft(), itinerary: model } };
    const html = renderToStaticMarkup(
      React.createElement(ItineraryStepScreen, { onOpenSheet: () => undefined })
    );
    // Sans run de mesure dans ce rendu, le fournisseur est inconnu : c'est
    // l'etat HONNETE, et il doit apparaitre tel quel.
    expect(html).toContain('Distance :');
    expect(html).toContain(SOURCE_INCONNUE);
  });

  it('H5-11: l ecran passe bien le callback de fournisseur AU runner', () => {
    // Le test precedent observe l'affichage ; celui-ci observe le RACCORDEMENT.
    // Sans lui, l'ecran pourrait afficher « source inconnue » en permanence
    // tout en passantant un proprio - et les deux tests passeraient.
    const src = readFileSync(
      join(__dirname, '..', 'components', 'ItineraryStep.tsx'),
      'utf8'
    );
    expect(src).toContain('browserMeasurementRunners(fetch, (provider) => setRouteProvider(provider))');
    expect(src).toContain('<PrepDataSource');
    // Et le state est remis a zero entre deux runs : sinon un refus du second
    // run afficherait le routeur du premier.
    expect(src).toContain('setRouteProvider(null)');
  });
});
