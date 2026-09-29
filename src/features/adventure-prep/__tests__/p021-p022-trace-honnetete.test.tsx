/**
 * P0.21 + P0.22 — l'ecran n'invente NI la panne NI le kilometre.
 *
 * Les deux items tiennent sur la meme question : que fait l'ECRAN d'un chiffre
 * que le reseau a reellement mesure, et que fait-il quand le reseau n'a rien
 * repondu ?
 *
 *   P0.21 — la phase « Calcul des distances sur le reseau » est annoncee en
 *           echec sur un parcours reellement genere. Le bandeau n'a pas
 *           menti : il a dit « je n'ai pas reussi ». Ce qui se verifie ici
 *           n'est donc pas l'absence de bandeau (elle serait triviale), mais
 *           deux invariants : un parcours MESURE n'affiche rien du tout, et
 *           le bandeau nomme la phase REELLEMENT tombee — jamais une phase
 *           supposee. C'est precisement ce que le run B du 2026-09-29 a
 *           montre : « Echec : Recherche du parcours », pas « Calcul des
 *           distances », la phase trace ayant livre.
 *
 *   P0.22 — le profil de routage etait fige sur `driving` : une marche etait
 *           annoncee en 12 min de voiture. L'absence de mesure est l'autre
 *           moitie du meme defaut : un refus du routeur ne doit produire NI
 *           « 0 km » NI un nombre plausible — seulement « A verifier »,
 *           et un total partiellement mesure ne doit JAMAIS se lire comme
 *           un total.
 *
 * ---------------------------------------------------------------------------
 * TOUTES les valeurs de ce fichier sont des REPONSES REELLES du serveur de dev,
 * relevees le 2026-09-29 sur les MEMES points :
 *   Chamonix-Mont-Blanc 6,86933 / 45,92375  ->  Les Houches 6,7983 / 45,8897
 *
 *   | mode    | HTTP | provider | distance | duree     | trace |
 *   |---------|------|----------|----------|-----------|-------|
 *   | pieton  | 200  | osrm     | 7,5869 km| 101,15 min| 530 pt |
 *   | voiture | 200  | osrm     | 8,1965 km|   9,29 min| 375 pt |
 *
 * « osrm » designe ici `routing.openstreetmap.de`, dont le PREFIXE de profil
 * vaut `routed-foot` pour `pieton` (`routed-bike` pour `velo`) : le cas qui
 * interesse P0.22 est donc bien un graphe PIETON, et la vitesse mesuree le
 * confirme — 4,50 km/h a pied contre 52,98 km/h en voiture sur les memes
 * points, soit un facteur 11,8. C'est ce facteur 11,8 qui rendait le chiffre
 * faux sans que rien ne le denonce.
 *
 * Les altitudes viennent de `/api/elevation` (Open-Meteo, HTTP 200, 59 points
 * sous-echantillonnes sur la trace pieton) : de 1 041 m a 987 m, le profil
 * reel de la vallee — D+ 47 m / D- 21 m. Elles sont volontairement minuscules :
 * un parcours de vallee n'a pas de denivele, et un « 2 491 m » affiche la ici
 * serait une trace echantillonnee sur la route carrossable, pas sur le sentier.
 */
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GENERATION_PHASES, initialGeneration, setPhaseOutcomes } from '../engine/generation';
import { routeItinerary, type RouteLeg, type RoutingDeps } from '../engine/routing';
import { offlineReadiness } from '../engine/resilience';
import {
  failedGenerationPhase,
  type DayTotals,
  type GenerationPhaseVerdict,
  type ItineraryModel,
  type ItineraryStep as ItineraryStepModel,
  type MetricsContext,
} from '../types';
import type { AdventurePrepDraft } from '../types';
import { fullDraft } from './fixtures';

const state = vi.hoisted(() => ({ current: null as { draft: AdventurePrepDraft } | null }));
vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (s: { draft: AdventurePrepDraft }) => unknown) =>
    selector(state.current as { draft: AdventurePrepDraft })) as unknown as {
    getState: () => unknown;
  };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

const { ItineraryStepScreen } = await import('../components/ItineraryStep');
const { PrepOfflineNotice } = await import('../components/AdventurePrepShell');

/* --- Les mesures reelles,-octet pour octet --------------------------------- */

const CHAMONIX = { lat: 45.92375, lon: 6.86933 };
const LES_HOUCHES = { lat: 45.8897, lon: 6.7983 };

/** Trace reelle du trajet pieton, sous-echantillonnee a 59 points. */
const TRACE_PIETON: ReadonlyArray<readonly [number, number]> = [
  [6.869385, 45.923834], [6.869076, 45.922715], [6.866927, 45.920633], [6.868108, 45.919937],
  [6.867261, 45.919042], [6.86634, 45.918382], [6.865313, 45.917764], [6.864075, 45.917223],
  [6.861347, 45.916254], [6.860134, 45.915818], [6.860025, 45.9157], [6.859593, 45.91565],
  [6.858567, 45.915451], [6.857308, 45.915254], [6.855803, 45.914978], [6.85563, 45.914751],
  [6.855372, 45.914691], [6.855134, 45.914788], [6.854017, 45.914656], [6.85263, 45.914645],
  [6.852527, 45.914614], [6.852254, 45.914614], [6.851281, 45.91439], [6.849553, 45.913409],
  [6.847548, 45.912118], [6.845701, 45.911243], [6.843573, 45.909903], [6.843653, 45.909217],
  [6.842278, 45.908174], [6.840748, 45.907308], [6.839407, 45.906445], [6.838743, 45.906017],
  [6.837409, 45.905372], [6.835755, 45.904559], [6.834961, 45.904195], [6.834825, 45.90396],
  [6.834576, 45.90356], [6.832269, 45.902644], [6.829391, 45.90177], [6.828929, 45.900755],
  [6.828066, 45.900135], [6.824721, 45.898441], [6.821683, 45.897328], [6.821385, 45.897275],
  [6.820116, 45.897069], [6.818327, 45.897305], [6.817109, 45.897478], [6.816065, 45.897232],
  [6.814189, 45.897003], [6.812381, 45.89705], [6.810387, 45.896433], [6.807409, 45.896184],
  [6.8048, 45.895585], [6.803859, 45.895252], [6.801201, 45.89378], [6.799594, 45.892147],
  [6.799043, 45.891696], [6.798728, 45.890774], [6.79806, 45.889937],
];

/** Altitudes reelles (Open-Meteo, HTTP 200), alignees point par point. */
const ALTITUDES: readonly number[] = [
  1041, 1042, 1043, 1033, 1031, 1033, 1031, 1028, 1027, 1025, 1025, 1024,
  1023, 1023, 1022, 1022, 1022, 1022, 1021, 1021, 1021, 1019, 1020, 1015,
  1016, 1033, 1026, 1026, 1017, 1014, 1014, 1011, 1007, 1002, 1002, 1004,
  1004, 1004, 1001, 1004, 999, 998, 1002, 999, 1000, 1001, 999, 1000,
  995, 995, 995, 987, 990, 987, 994, 998, 987, 1005, 1004,
];

/** La REPONSE `/api/route` en `mode=pieton`, telle que le navigateur l'a lue. */
const JAMBON_PIETON: RouteLeg = {
  distanceKm: 7.5869,
  durationMin: 101.14833333333333,
  geometry: TRACE_PIETON,
};

/** La MEME reponse en `mode=voiture` : c'est ce qui s'affichait avant P0.22. */
const JAMBON_VOITURE: RouteLeg = {
  distanceKm: 8.1965,
  durationMin: 9.285,
  geometry: TRACE_PIETON,
};

/* --- Le modele, construit a la main : etat honnete AVANT toute mesure ------ */

function etape(
  id: string,
  day: number,
  order: number,
  title: string,
  placeName: string,
  point: { lat: number; lon: number },
): ItineraryStepModel {
  return {
    id,
    day,
    order,
    kind: 'arret',
    title,
    placeName,
    placeId: null,
    startTime: null,
    durationMin: null,
    reason: null,
    price: { amount: null, currency: 'EUR', state: 'a_reserver' },
    state: 'propose',
    kept: true,
    icon: 'map-pin',
    lat: point.lat,
    lon: point.lon,
  };
}

function totalsVides(): DayTotals {
  return { distanceKm: null, movingMin: null, activityMin: null, elevGainM: null, elevLossM: null };
}

function modelVierge(context: MetricsContext, days: number): ItineraryModel {
  const steps: ItineraryStepModel[] = [];
  for (let day = 1; day <= days; day += 1) {
    steps.push(
      etape(`j${day}-a`, day, 1, 'Depart', 'Chamonix-Mont-Blanc', CHAMONIX),
      etape(`j${day}-b`, day, 2, 'Arrivee', 'Les Houches', LES_HOUCHES),
    );
  }
  return {
    title: null,
    days,
    steps,
    totals: totalsVides(),
    perDay: Array.from({ length: days }, () => totalsVides()),
    weather: Array.from({ length: days }, () => null),
    metricsContext: context,
    travelMode: context === 'voyage' ? 'voiture' : 'pieton',
    budgetPerPerson: { amount: null, currency: 'EUR', state: 'a_reserver' },
    activityCount: steps.length,
    contingencies: [],
  };
}

/* --- Les doublures du reseau --------------------------------------------- */

/** Repond comme `/api/route` en `200` sur le mode demande. */
function depsQuiRepondent(jambons: readonly RouteLeg[]): RoutingDeps {
  return {
    route: async (points) => points.slice(1).map((): RouteLeg => jambons[0]),
    elevation: async () => ALTITUDES,
  };
}

/** Repond comme `/api/route` en `503 off_network` : aucun chiffre, `null`. */
function depsQuiRefusent(): RoutingDeps {
  return { route: async () => null, elevation: async () => null };
}

/** Mesure le premier jour, REFUSE le second : le total devient partiel. */
function depsDontLeSecondJourTombe(): RoutingDeps {
  let appels = 0;
  return {
    route: async (points) => {
      appels += 1;
      if (appels === 2) return null;
      return points.slice(1).map((): RouteLeg => JAMBON_PIETON);
    },
    elevation: async () => ALTITUDES,
  };
}

/* --- L'ecran -------------------------------------------------------------- */

function ecran(model: ItineraryModel): string {
  state.current = { draft: { ...fullDraft(), itinerary: model } };
  return renderToStaticMarkup(
    React.createElement(ItineraryStepScreen, { onOpenSheet: () => undefined }),
  );
}

/** Les valeurs des tuiles de mesures, dans l'ordre ou l'ecran les affiche. */
function valeurs(html: string): string[] {
  return [...html.matchAll(/<span class="prep-metric__value"[^>]*>([^<]*)<\/span>/g)].map(
    (m) => m[1],
  );
}

function bandeau(model: ItineraryModel, verdicts: readonly GenerationPhaseVerdict[]): string {
  const generation = setPhaseOutcomes(
    { ...initialGeneration(), status: 'termine' },
    verdicts,
  );
  return renderToStaticMarkup(
    React.createElement(PrepOfflineNotice, {
      online: true,
      readiness: offlineReadiness({ model, online: true, aiEnabled: true }),
      failedPhase: failedGenerationPhase(generation),
      onRetryPhase: () => undefined,
    }),
  );
}

const TOUTES_REUSSIES: readonly GenerationPhaseVerdict[] = GENERATION_PHASES.map((phase) => ({
  id: phase.id,
  status: 'reussie',
  reason: null,
  retryable: true,
}));

function verdict(phaseId: GenerationPhaseVerdict['id']): GenerationPhaseVerdict {
  return { id: phaseId, status: 'echoue', reason: 'Le service na pas repondu', retryable: true };
}

/* ======================================================================== */
/* P0.22 — la mesure affichee est celle du mode REELLEMENT mesure          */
/* ======================================================================== */

describe('P0.22 — INVARIANT 1 : la duree affichee est celle du reseau pieteon', () => {
  it('P022-01: un parcours terrain affiche les 101 min et les 7,6 km MESURES', async () => {
    const model = await routeItinerary(
      modelVierge('terrain', 1),
      depsQuiRepondent([JAMBON_PIETON]),
    );
    // Garde-fou : la mesure doit etre REELLEMENT dans le modele, sinon le
    // test afficherait un « a verifier » et passerait pour une reussite.
    expect(model.totals.distanceKm).toBe(7.59);
    expect(model.totals.activityMin).toBe(101);

    const affiche = valeurs(ecran(model));
    expect(affiche).toEqual(['7,6 km', '47 m', '1 h 41 min']);
  });

  it('P022-02: le meme parcours ne peut pas afficher les 9 min de voiture', async () => {
    const model = await routeItinerary(
      modelVierge('terrain', 1),
      depsQuiRepondent([JAMBON_PIETON]),
    );
    const html = ecran(model);
    // « 9 min » est la duree REELLE du meme trajet en voiture, mesuree le
    // meme jour sur les memes points. Elle ne doit apparaitre nulle part.
    expect(html).not.toContain('9 min');
    expect(html).not.toContain('8,2 km');
  });
});

describe('P0.22 — CONTRE-TEMOIN : la valeur suit la mesure, elle nest pas une constante', () => {
  it('P022-03: en contexte voyage, les MEMES points donnent bien 9 min et 8,2 km', async () => {
    const model = await routeItinerary(
      modelVierge('voyage', 1),
      depsQuiRepondent([JAMBON_VOITURE]),
    );
    expect(model.totals.distanceKm).toBe(8.2);
    // Sans ce contre-temoin, P022-01 passerait avec un ecran qui imprime
    // « 1 h 41 min » en dur, quel que soit le mode mesure.
    expect(valeurs(ecran(model))).toEqual(['8,2 km', '9 min', 'À vérifier']);
  });
});

describe('P0.22 — INVARIANT 2 : un refus ne devient JAMAIS un nombre plausible', () => {
  it('P022-04: le routeur refuse -> chaque mesure affiche « À vérifier »', async () => {
    const model = await routeItinerary(modelVierge('terrain', 1), depsQuiRefusent());
    expect(model.totals.distanceKm).toBeNull();
    expect(model.totals.activityMin).toBeNull();

    const affiche = valeurs(ecran(model));
    expect(affiche.length).toBeGreaterThan(0);
    // Zéro chiffre dans les tuiles : ni « 0 km », ni « 12 min », ni meme
    // un « 0,0 km ». La seule reponse licite a une absence est l'absence.
    for (const valeur of affiche) {
      expect(valeur).toBe('À vérifier');
      expect(valeur).not.toMatch(/[0-9]/);
    }
  });

  it('P022-05: un seul jour mesure sur deux ne donne PAS un total partiel', async () => {
    const model = await routeItinerary(modelVierge('terrain', 2), depsDontLeSecondJourTombe());
    // Le jour 1, lui, a bien ete mesure.
    expect(model.perDay[0].distanceKm).toBe(7.59);
    expect(model.perDay[1].distanceKm).toBeNull();
    // Le total, lui, n'est pas une somme : 7,59 km pour deux journees
    // serait une invention, au meme titre que 123,8 km.
    expect(model.totals.distanceKm).toBeNull();
    expect(model.totals.activityMin).toBeNull();

    const affiche = valeurs(ecran(model));
    expect(affiche[0]).toBe('À vérifier');
    expect(affiche[2]).toBe('À vérifier');
  });
});

/* ======================================================================== */
/* P0.21 — le bandeau nomme la phase tombee, ou ne rend rien                */
/* ======================================================================== */

describe('P0.21 — INVARIANT 1 : un parcours reellement mesure naffiche AUCUN bandeau', () => {
  it('P021-01: sept phases reussies + un modele mesure -> rien rendu du tout', async () => {
    const model = await routeItinerary(
      modelVierge('terrain', 1),
      depsQuiRepondent([JAMBON_PIETON]),
    );
    const html = bandeau(model, TOUTES_REUSSIES);
    expect(html).toBe('');
    expect(html).not.toContain('Échec');
    expect(html).not.toContain('Réessayer');
  });
});

describe('P0.21 — INVARIANT 2 : le bandeau nomme la phase REELLEMENT tombee', () => {
  it('P021-02: trace en echec -> « Échec : Calcul des distances sur le réseau »', () => {
    const html = bandeau(modelVierge('terrain', 1), [verdict('trace')]);
    expect(html).toContain('Échec : Calcul des distances sur le réseau');
    expect(html).toContain('Réessayer');
  });

  it('P021-03: la phase AI tombee ne fait PAS accuser la phase trace', () => {
    // Le cas mesure le 2026-09-29 (run B, 3 jours) : la phase de recherche
    // du parcours a echoue, la phase trace a livre. Le bandeau doit nommer la
    // premiere. Accuser `trace` ici serait exactement le defaut P0.21.
    const html = bandeau(modelVierge('terrain', 1), [verdict('recherche_parcours')]);
    expect(html).toContain('Échec : Recherche du parcours');
    expect(html).not.toContain('Calcul des distances');
  });
});

describe('P0.21 — les deux items reunis : la phase trace livre, l ecran affiche le reel', () => {
  it('P021-04: distances mesurees + phases reussies = des chiffres, pas « À vérifier »', async () => {
    const model = await routeItinerary(
      modelVierge('terrain', 1),
      depsQuiRepondent([JAMBON_PIETON]),
    );
    expect(bandeau(model, TOUTES_REUSSIES)).toBe('');

    const affiche = valeurs(ecran(model));
    expect(affiche).not.toContain('À vérifier');
    expect(affiche).toContain('1 h 41 min');
    expect(affiche).toContain('7,6 km');
  });
});
