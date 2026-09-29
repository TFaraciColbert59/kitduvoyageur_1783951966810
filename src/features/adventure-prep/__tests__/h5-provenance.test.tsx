/**
 * H5 — La provenance, du point d'integration laisse en attente a l'ecran.
 *
 * `engine/provenance.ts` et `components/PrepDataSource.tsx` existaient,
 * testes (15 cas), et n'etaient appeles par PERSONNE : le module ne faisait
 * qu'une description, la ligne n'apparaitait sur aucun ecran. Une
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
import {
  describeDataSource,
  SOURCE_INCONNUE,
  DATA_SOURCE_LABELS,
  type MeasureProviderId,
} from '../engine/provenance';
import { PrepDataSource } from '../components/PrepDataSource';
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
type MeasureSeries = import('../components/ItineraryStep').MeasureSeries;

/**
 * Les enregistrements de credit, nommes par ce qu ils prouvent.
 *
 * `buildProvenance` ne lit plus UN `MeasureProviderId` mais un credit PAR
 * serie : les deux routes de mesure partagent un identifiant, donc un credit
 * unique ne saurait pas dire laquelle des deux a repondu. Ces quatre constantes
 * rendent cette separation explicite dans chaque test, et permettent d ecrire
 * le cas piege — une serie qui parle, l autre qui se tait — sans ecrire a la
 * main un objet qui pourrait se tromper de cle.
 */
const SANS_SERIE: MeasureSeries = { denivele: null, meteo: null };
const ALTITUDE_NOMME: MeasureSeries = { denivele: 'open-meteo', meteo: null };
const METEO_NOMME: MeasureSeries = { denivele: null, meteo: 'open-meteo' };
const DEUX_SERIES_NOMMEES: MeasureSeries = { denivele: 'open-meteo', meteo: 'open-meteo' };

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

/**
 * Une MESURE, pas une ligne de provenance deja ecrite a la main.
 *
 * Le helper vit au niveau du module parce que la derivation (`buildProvenance`)
 * est elle aussi globale : un test qui verifierait `metricDataSource` sur une
 * entree fabriquee a la main ne prouverait que le composant, jamais le
 * raccordement entre la mesure et le credit.
 */
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
  it('H5-05: le routeur repondu nomme la distance', () => {
    const entries = buildProvenance(
      [metric('distance', 12.4), metric('denivele', 800)],
      'brouter',
      SANS_SERIE
    );
    expect(entries).toHaveLength(2);
    expect(entries[0].source).toBe('brouter');
    expect(describeDataSource(entries[0])).toContain(DATA_SOURCE_LABELS.brouter);
  });

  it('H5-06: aucune reponse = « source inconnue », jamais le routeur par defaut', () => {
    const entries = buildProvenance([metric('distance', 12.4)], null, SANS_SERIE);
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
    //
    // Le cas le plus piegeux est donne ici : le canal des series PARLE
    // ('open-meteo'), et le routeur repond lui aussi ('osrm'). Le denivele doit
    // alors porter LE credit de la serie, et surtout pas celui du routeur —
    // sinon un moteur qui ne mesure aucune altitude signerait l'ecran.
    const entries = buildProvenance(
      [metric('distance', 10), metric('denivele', 500)],
      'osrm',
      DEUX_SERIES_NOMMEES
    );
    expect(entries[1].source).not.toBe('osrm');
    expect(entries[1].source).toBe('open-meteo-elevation');
  });

  it('H5-08: une mesure non relevee ne recoit pas de ligne', () => {
    // « Distance : À verifier · source inconnue » sous une tuile qui dit deja
    // « À verifier », c'est deux fois la meme absence et zero information.
    expect(
      buildProvenance([metric('distance', null), metric('denivele', null)], 'osrm', ALTITUDE_NOMME)
    ).toEqual([]);
  });

  it('H5-09: seules la distance et le denivele sont concernes', () => {
    const entrees = buildProvenance(
      [
        metric('duree', 6),
        metric('nuitees', 2),
        metric('budget', 90),
        metric('distance', 10),
      ],
      'osrm',
      DEUX_SERIES_NOMMEES
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

  it('H5-11: l ecran branche les DEUX canaux de fournisseur sur le runner', () => {
    // Le test precedent observe l'affichage ; celui-ci observe le RACCORDEMENT.
    // Sans lui, l'ecran pourrait afficher « source inconnue » en permanence
    // tout en passantant un proprio - et les deux tests passeraient.
    //
    // `browserMeasurementRunners` expose DEUX familles de fournisseur depuis le
    // lot aval : le routeur, et le service de mesure. Brancher le premier seul
    // laissait le second mort — le composant pouvait donc tourner, mesurer,
    // afficher un denivele, et n'avoir JAMAIS de quoi le nommer.
    const src = readFileSync(
      join(__dirname, '..', 'components', 'ItineraryStep.tsx'),
      'utf8'
    );
    // Les DEUX familles de fournisseur restent branchees : le routeur, et le
    // service de mesure. Brancher le premier seul laissait le second mort.
    expect(src).toMatch(
      /browserMeasurementRunners\(\s*fetch,\s*\(provider\) => setRouteProvider\(provider\),/
    );
    expect(src).toContain('<PrepDataSource');
    // Et l'etat est remis a zero entre deux runs : sinon un refus du second
    // run afficherait le routeur du premier. Les DEUX etats, pour la meme
    // raison — une serie refusee au second run ne doit pas heriter du credit
    // du premier. Les deux SLOTS, cette fois, parce qu il y a deux series.
    expect(src).toContain('setRouteProvider(null)');
    expect(src).toContain('setSeries({ denivele: null, meteo: null })');
    // Enfin la remise, sans laquelle l'etat resterait une variable orpheline :
    // la tuile afficherait « source inconnue » alors que la mesure est la.
    expect(src).toContain('buildProvenance(metrics, routeProvider, series)');
  });

  it('H5-12: le denivele nomme la serie qui l a relevee', () => {
    const entries = buildProvenance([metric('denivele', 500)], null, ALTITUDE_NOMME);
    expect(entries[0].source).toBe('open-meteo-elevation');
    const ligne = describeDataSource(entries[0]);
    expect(ligne).toContain(DATA_SOURCE_LABELS['open-meteo-elevation']);
    // La precision qui se perd dans un credit juste en apparence : un
    // denivele affiche « Open-Meteo (previsions) » nommerait le bon service
    // et la mauvaise serie. Les deux libelles partagent leur prefixe, donc
    // l'assertion porte sur le libelle COMPLET.
    expect(ligne).not.toContain(DATA_SOURCE_LABELS['open-meteo']);
  });

  it('H5-13: sans reponse de la serie, le denivele ne nomme PERSONNE', () => {
    // Le refus — pas de `provider` dans le corps, ou serie refusee — laisse le
    // parametre a `null`. C'est le cas que la serie de tests amont rend
    // ombrable : nommer Open-Meteo « parce qu on l appelle toujours »
    // attribuerait un credit a une mesure que personne n a certifiee.
    const entries = buildProvenance([metric('denivele', 500)], 'osrm', SANS_SERIE);
    expect(entries[0].source).toBeNull();
    expect(describeDataSource(entries[0])).toContain(SOURCE_INCONNUE);
    // Le chiffre, lui, reste : c'est la MESURE qui est honnete.
    expect(describeDataSource(entries[0])).toContain('500');
  });

  it('H5-14: la distance ne recoit jamais le credit des series de mesure', () => {
    // Le piege symetrique de H5-07 : un `metricDataSource` trop permissif
    // poserait « Open-Meteo (previsions) » sous un kilometrage. Le service de
    // mesure ne mesure aucune distance, et la ligne le dirait.
    const entries = buildProvenance([metric('distance', 10)], null, METEO_NOMME);
    expect(entries[0].source).toBeNull();
    expect(describeDataSource(entries[0])).toContain(SOURCE_INCONNUE);
  });

  it('H5-15: un fournisseur de serie inconnu ne devient pas un libelle', () => {
    // Un serveur d'une version future, ou un corps bricole. Le cast est
    // volontaire : il imite la realite TypeScript, ou la cle entrante est
    // `unknown` et ne rejoint jamais un fournisseur connu.
    const inconnu = 'meteo-france' as MeasureProviderId;
    const entries = buildProvenance([metric('denivele', 500)], 'osrm', { denivele: inconnu, meteo: null });
    expect(entries[0].source).toBeNull();
  });

  it('H5-16: la ligne rendue sous la tuile porte le nom de la serie', () => {
    // Le dernier maillon de l affichage : l'entree de provenance ne suffit
    // pas, il faut que le COMPOSANT la rende. `PrepDataSource` est donc monte
    // sur l'entree produite par la derivation, pas sur une entree ecrite a la
    // main — sinon le test prouverait le composant, pas le raccordement.
    const entries = buildProvenance([metric('denivele', 500)], null, ALTITUDE_NOMME);
    const html = renderToStaticMarkup(
      React.createElement(PrepDataSource, { entry: entries[0] })
    );
    const visible = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    expect(visible).toContain('Dénivelé');
    expect(visible).toContain('Open-Meteo (altitudes)');
  });

  it('H5-17: le credit d une serie ne deborde jamais sur l autre', () => {
    // LE piege de ce lot, et la raison du troisieme parametre de
    // `buildProvenance`. `/api/elevation` et `/api/weather` rendent le meme
    // service, donc le meme identifiant `open-meteo`, et
    // `browserMeasurementRunners` n'expose qu UN canal pour les deux. Un
    // composant qui l'ecoute tout court stocke le dernier annonce : des que la
    // meteo est disponible, le denivele porte « Open-Meteo (altitudes) » — meme
    // apres un 503 de l'elevation, ou apres une reponse sans `provider`. Le
    // credit est alors vrai en apparence et faux dans sa precision : on
    // attribue au denivele un service qui ne l'a pas mesure.
    //
    // Ici la meteo parle, le denivele se tait. Le denivele ne doit donc nommer
    // PERSONNE.
    const entries = buildProvenance(
      [metric('distance', 10), metric('denivele', 500)],
      'osrm',
      METEO_NOMME
    );
    expect(entries.find((e) => e.metric === 'denivele')!.source).toBeNull();
    expect(describeDataSource(entries.find((e) => e.metric === 'denivele')!)).toContain(
      SOURCE_INCONNUE
    );
    // Et le routeur garde le sien : la separation des series ne doit rien
    // casser du routage.
    expect(entries.find((e) => e.metric === 'distance')!.source).toBe('osrm');
  });

  it('H5-18: le composant encadre les deux phases, il ne stocke pas un credit unique', () => {
    // H5-17 prouve le contrat de la derivation. Ce test prouve qu il est
    // atteignable : sans encadrage des phases dans `ItineraryStep.tsx`, le
    // composant ne peut pas savoir de quelle serie vient une annonce, et
    // repasserait a un seul etat — exactement le defaut que H5-17 condamne.
    // C est un garde-fou STRUCTUREL, voluntary complementaire du test de bout
    // en bout (`h5r-raccord-fournisseur.test.ts`, H5R-13 a H5R-15).
    const src = readFileSync(join(__dirname, '..', 'components', 'ItineraryStep.tsx'), 'utf8');
    // Le point de partage des deux phases : chacune est encadree par le nom de
    // SA serie. C'est cette correspondance qui empeche le credit de la meteo
    // de se poser sur le denivele, alors que les deux repondent le meme
    // identifiant.
    expect(src).toContain("trace: encadrer('denivele', base.trace)");
    expect(src).toContain("weather: encadrer('meteo', base.weather)");
    // Le marquage est pose AVANT l'appel de la phase, et retire DANS un
    // `finally` : sans ce retrait, une phase qui echoue laisserait son credit a
    // la suivante.
    expect(src).toContain('measuring.current = nom;');
    expect(src).toMatch(/finally\s*\{\s*measuring\.current = null;/);
    // Un etat unique de credit de mesure serait la regression : il n'y en a
    // donc pas, et la remise a zero efface bien les DEUX slots.
    expect(src).not.toMatch(/useState<MeasureProviderId \| null>/);
  });
});
