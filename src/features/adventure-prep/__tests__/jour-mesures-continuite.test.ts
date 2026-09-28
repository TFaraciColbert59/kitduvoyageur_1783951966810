/**
 * Lot 2 — ce que l'utilisateur lit sur CHAQUE journee, et la continuite du
 * voyage. Ces tests verrouillent quatre contrats honne tes :
 *
 *  1. A4 — le libelle « Denivele + » ne porte pas de « + » parasite ;
 *  2. A6 — la meteo est interrogee A L ANCRE DE CHAQUE JOUR, groupee par
 *     ancre distincte, et reassemblee par date reelle. Un fournisseur muet
 *     pour une ancre n efface pas les jours deja mesures ailleurs ;
 *  3. A7 — l apostrophe du francais est typographique, pas une esperluette ;
 *  4. A8 — chaque journee commence la ou la precedente s est terminee, et une
 *     journee qui bouge voit ses mesures TOMBER a « a verifier » plutot que
 *     d afficher un kilometrage perime.
 *
 * Aucun appel reseau : le routage et la meteo sont injectes.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  applyDayWeather,
  dayWeatherAnchors,
  measurementRunners,
  type MeasurementDeps,
  type WeatherFetcher,
} from '../engine/measurements';
import { enforceDayContinuity, CONTINUITY_LEG_KM } from '../engine/continuity';
import { de } from '../engine/frenchText';
import { metricsFor } from '../engine/metrics';
import { haversineKm } from '../engine/routing';
import type { DayWeather } from '../engine/weather';
import type {
  AdventurePrepDraft,
  ItineraryModel,
  ItineraryStep,
  ItineraryStepKind,
} from '../types';
import { ARGENTIERE, CHAMONIX, fullDraft } from './fixtures';

const START = '2026-07-11';
const PRICE = { amount: null, currency: 'EUR', state: 'a_reserver' } as const;

function stepOf(
  id: string,
  day: number,
  order: number,
  kind: ItineraryStepKind,
  title: string,
  point: { lat: number; lon: number } | null,
  placeName: string | null = null,
): ItineraryStep {
  return {
    id,
    day,
    order,
    kind,
    title,
    placeName,
    startTime: null,
    durationMin: null,
    reason: null,
    price: { ...PRICE },
    state: 'propose',
    kept: false,
    icon: 'map-pin',
    lat: point?.lat ?? null,
    lon: point?.lon ?? null,
  };
}

const UNKNOWN = {
  distanceKm: null,
  movingMin: null,
  activityMin: null,
  elevGainM: null,
  elevLossM: null,
} as const;

function modelOf(days: number, steps: readonly ItineraryStep[]): ItineraryModel {
  return {
    days,
    steps,
    totals: { distanceKm: 63, movingMin: 300, activityMin: 600, elevGainM: 1203, elevLossM: 900 },
    perDay: Array.from({ length: days }, () => ({ ...UNKNOWN })),
    weather: Array.from({ length: days }, () => null),
    metricsContext: 'voyage',
    budgetPerPerson: { ...PRICE },
    activityCount: days,
    contingencies: [],
  };
}

function draftOf(overrides: Partial<AdventurePrepDraft> = {}): AdventurePrepDraft {
  return fullDraft(overrides);
}

function dayOf(iso: string, label: string): DayWeather {
  return {
    date: iso,
    tMaxC: 20,
    tMinC: 8,
    precipMm: 0,
    precipProbPct: 10,
    windMaxKmh: 15,
    code: 2,
    label,
  };
}

/* ================================================================== */
/* A4 — libelle                                                        */
/* ================================================================== */

describe('A4 — libelles de metriques', () => {
  it('A4-01 : « Denivele + » ne porte pas de « + » parasite', () => {
    // Le denivele n apparait que dans le contexte « terrain ».
    const terrain = { ...modelOf(3, []), metricsContext: 'terrain' as const };
    const labels = metricsFor(terrain, 'jour', 1).map((metric) => metric.label);
    expect(labels).toContain('Dénivelé');
    expect(labels).not.toContain('Dénivelé +');
  });
});

/* ================================================================== */
/* A6 — meteo par journee                                             */
/* ================================================================== */

describe('A6 — meteo interrogee a l ancre de chaque journee', () => {
  // Jour 1 au refuge du Gouter, jour 3 a Argentiere : deux ancres distinctes.
  const steps = [
    stepOf('j1-nuit', 1, 0, 'nuit', 'Nuit au refuge', { lat: 45.8447, lon: 6.8427 }, 'Refuge du Gouter'),
    stepOf('j2-traj', 2, 0, 'trajet', 'Trajet vers le col', { lat: 45.87, lon: 6.83 }),
    stepOf('j3-nuit', 3, 0, 'nuit', 'Nuit a Argentiere', { lat: ARGENTIERE.lat, lon: ARGENTIERE.lon }, 'Argentière'),
  ];

  // Les journees 1 et 2 dorment au meme refuge : une seule ancre, donc une
  // seule requete pour les deux. La journee 3 est ailleurs : sa propre requete.
  const stepsDeuxAncres = [
    stepOf('j1-nuit', 1, 0, 'nuit', 'Nuit au refuge', { lat: 45.8447, lon: 6.8427 }, 'Refuge du Gouter'),
    stepOf('j2-traj', 2, 0, 'trajet', 'Detour depuis le refuge', { lat: 45.8447, lon: 6.8427 }, 'Refuge du Gouter'),
    stepOf('j3-nuit', 3, 0, 'nuit', 'Nuit a Argentiere', { lat: ARGENTIERE.lat, lon: ARGENTIERE.lon }, 'Argentière'),
  ];

  it('A6-01 : une ancre par journee, alignee sur `days`', () => {
    const anchors = dayWeatherAnchors(draftOf(), modelOf(3, steps));
    expect(anchors).toHaveLength(3);
    // Jour 1 : le depart saisi. Jour 2 : sa premiere etape situee. Jour 3 : la sienne.
    expect(anchors[0]).toEqual({ lat: CHAMONIX.lat, lon: CHAMONIX.lon });
    expect(anchors[1]).toEqual({ lat: 45.87, lon: 6.83 });
    expect(anchors[2]).toEqual({ lat: ARGENTIERE.lat, lon: ARGENTIERE.lon });
  });

  it('A6-08 : le jour 1 suit le depart saisi, meme si le programme commence ailleurs', () => {
    // Le refuge est la premiere etape SITUEE du jour 1, a plusieurs km du
    // depart. Lui preferer le refuge reviendrait a substituer une proposition
    // du programme au choix que l utilisateur a fait lui-meme.
    const refuge = { lat: 45.8447, lon: 6.8427 };
    expect(haversineKm(CHAMONIX, refuge)).toBeGreaterThan(5);
    const anchors = dayWeatherAnchors(draftOf(), modelOf(3, steps));
    expect(anchors[0]).toEqual({ lat: CHAMONIX.lat, lon: CHAMONIX.lon });
    // Les jours suivants, eux, suivent le programme.
    expect(anchors[1]).toEqual({ lat: 45.87, lon: 6.83 });
  });

  it('A6-02 : un jour sans etape situee retombe sur l ancre du voyage', () => {
    const partial = [
      stepOf('j1-nuit', 1, 0, 'nuit', 'Nuit au refuge', { lat: 45.8447, lon: 6.8427 }, 'Refuge du Gouter'),
      stepOf('j2-note', 2, 0, 'arret', 'Pause libre', null),
    ];
    const anchors = dayWeatherAnchors(
      draftOf({ route: { origin: CHAMONIX, destination: ARGENTIERE, shape: 'aller_simple' } }),
      modelOf(2, partial),
    );
    expect(anchors[1]).toEqual({ lat: CHAMONIX.lat, lon: CHAMONIX.lon });
  });

  it('A6-03 : sans aucun lieu, on ne demande rien au fournisseur', () => {
    const anchors = dayWeatherAnchors(
      draftOf({ route: { origin: null, destination: null, shape: 'boucle' } }),
      modelOf(2, [stepOf('j1', 1, 0, 'arret', 'Libre', null)]),
    );
    expect(anchors).toEqual([null, null]);
  });

  it('A6-04 : chaque journee reçoit LA meteo de SON ancre', async () => {
    const calls: { anchor: { lat: number; lon: number }; dates: readonly string[] }[] = [];
    const weather: WeatherFetcher = async (dates, _signal, anchor) => {
      calls.push({ anchor, dates });
      // Le premier jour du lot est l ancre du refuge, le dernier celle d Argentiere.
      return anchor.lat === 45.8447
        ? [dayOf('2026-07-11', 'Ensole'), dayOf('2026-07-12', 'Ensole')]
        : [dayOf('2026-07-13', 'Averses')];
    };
    const deps: MeasurementDeps = {
      route: { route: async () => null } as unknown as MeasurementDeps['route'],
      weather,
    };
    const measured = await measurementRunners(deps).weather(
      draftOf({ route: { origin: null, destination: null, shape: 'boucle' } }),
      modelOf(3, stepsDeuxAncres),
      new AbortController().signal,
    );
    // Deux ancres DISTINCTES => deux requetes, et non une seule pour trois jours.
    expect(calls).toHaveLength(2);
    expect(measured.weather[0]?.label).toBe('Ensole');
    expect(measured.weather[1]?.label).toBe('Ensole');
    expect(measured.weather[2]?.label).toBe('Averses');
  });

  it('A6-05 : une ancre muete n efface pas les jours deja mesures', async () => {
    const weather: WeatherFetcher = async (_dates, _signal, anchor) =>
      anchor.lat === 45.8447 ? [dayOf('2026-07-11', 'Ensole'), dayOf('2026-07-12', 'Ensole')] : null;
    const deps: MeasurementDeps = {
      route: { route: async () => null } as unknown as MeasurementDeps['route'],
      weather,
    };
    const measured = await measurementRunners(deps).weather(
      draftOf({ route: { origin: null, destination: null, shape: 'boucle' } }),
      modelOf(3, stepsDeuxAncres),
      new AbortController().signal,
    );
    expect(measured.weather[0]?.label).toBe('Ensole');
    expect(measured.weather[1]?.label).toBe('Ensole');
    // Le troisieme jour reste inconnu : jamais reporte, jamais emprunte a J1.
    expect(measured.weather[2]).toBeNull();
  });

  it('A6-06 : sans ancres, le fournisseur n est jamais appele', async () => {
    const weather = vi.fn<WeatherFetcher>(async () => null);
    const deps: MeasurementDeps = {
      route: { route: async () => null } as unknown as MeasurementDeps['route'],
      weather,
    };
    const measured = await measurementRunners(deps).weather(
      draftOf({ route: { origin: null, destination: null, shape: 'boucle' } }),
      modelOf(2, [stepOf('j1', 1, 0, 'arret', 'Libre', null)]),
      new AbortController().signal,
    );
    expect(weather).not.toHaveBeenCalled();
    expect(measured.weather).toEqual([null, null]);
  });

  it('A6-07 : applyDayWeather rattache par DATE, jamais par rang', () => {
    // Le fournisseur du jour 2 repond dans le desordre : la serie doit suivre
    // la date, sinon le jour 2 afficherait la meteo du jour 1.
    const applied = applyDayWeather(modelOf(3, steps), START, [
      [dayOf('2026-07-11', 'Ensole')],
      [dayOf('2026-07-13', 'Averses'), dayOf('2026-07-12', 'Orage')],
      null,
    ]);
    expect(applied.weather.map((day) => day?.label ?? null)).toEqual(['Ensole', 'Orage', null]);
  });
});

/* ================================================================== */
/* A7 — apostrophe typographique                                       */
/* ================================================================== */

describe('A7 — apostrophe francaise', () => {
  it('A7-01 : l apostrophe est typographique, jamais une esperluette', () => {
    expect(de('Argentière')).toBe('d’Argentière');
    expect(de('Orcières')).toBe('d’Orcières');
    expect(de('Hôtel')).toBe('d’Hôtel');
  });

  it('A7-02 : le h aspire garde l article plein', () => {
    expect(de('Haute-Savoie')).toBe('de Haute-Savoie');
  });
});

/* ================================================================== */
/* A8 — continuite du voyage                                           */
/* ================================================================== */

describe('A8 — continuite du voyage', () => {
  // Jour 1 se termine tres loin (Le Bourguin, Rasse), jour 2 reparait a Chamonix :
  // c'est exactement la rupture que l'ecran doit corriger.
  const finJour1 = { lat: 45.715, lon: 6.79 };
  const stepsDiscontinus = [
    stepOf('j1-dep', 1, 0, 'trajet', 'Depart', { lat: CHAMONIX.lat, lon: CHAMONIX.lon }, 'Chamonix'),
    stepOf('j1-nuit', 1, 1, 'nuit', 'Nuit au Bourguin', finJour1, 'Le Bourguin'),
    stepOf('j2-traj', 2, 0, 'trajet', 'Trajet vers la suite', { lat: CHAMONIX.lat, lon: CHAMONIX.lon }, 'Chamonix'),
    stepOf('j2-nuit', 2, 1, 'nuit', 'Nuit a Argentiere', { lat: ARGENTIERE.lat, lon: ARGENTIERE.lon }, 'Argentière'),
  ];

  it('A8-01 : le jour 2 demarre la ou le jour 1 s est termine', () => {
    const fixed = enforceDayContinuity(modelOf(2, stepsDiscontinus), draftOf());
    const premier = fixed.steps.find((step) => step.id === 'j2-traj');
    expect(premier?.lat).toBe(finJour1.lat);
    expect(premier?.lon).toBe(finJour1.lon);
  });

  it('A8-02 : le titre nomme le lieu REEL de depart, pas un lieu invente', () => {
    const fixed = enforceDayContinuity(modelOf(2, stepsDiscontinus), draftOf());
    const premier = fixed.steps.find((step) => step.id === 'j2-traj');
    expect(premier?.title).toContain('Le Bourguin');
    expect(premier?.placeName).toBe('Le Bourguin');
  });

  it('A8-03 : un jour deja continu n est pas retouche', () => {
    const coherent = [
      stepOf('j1-nuit', 1, 0, 'nuit', 'Nuit au refuge', { lat: 45.8447, lon: 6.8427 }, 'Refuge du Gouter'),
      stepOf('j2-traj', 2, 0, 'trajet', 'Trajet vers le col', { lat: 45.87, lon: 6.83 }, 'Col'),
    ];
    const fixed = enforceDayContinuity(modelOf(2, coherent), draftOf());
    expect(fixed.steps.find((step) => step.id === 'j2-traj')?.title).toBe('Trajet vers le col');
  });

  it('A8-04 : une journee deplacee voit ses mesures tomber a « a verifier »', () => {
    const measured = modelOf(2, stepsDiscontinus);
    const withTotals: ItineraryModel = {
      ...measured,
      perDay: [
        { distanceKm: 31, movingMin: 200, activityMin: 400, elevGainM: 900, elevLossM: 800 },
        { distanceKm: 28, movingMin: 190, activityMin: 380, elevGainM: 800, elevLossM: 700 },
      ],
    };
    const fixed = enforceDayContinuity(withTotals, draftOf());
    // Le jour 2 a bouge : ses chiffres sont perimes, ils doivent tomber a null.
    expect(fixed.perDay[1]?.distanceKm).toBeNull();
    expect(fixed.perDay[1]?.activityMin).toBeNull();
    // Le jour 1 n a pas bouge : ses mesures restent laes.
    expect(fixed.perDay[0]?.distanceKm).toBe(31);
  });

  it('A8-05 : en aller simple, la derniere journee se termine sur l arrivee', () => {
    const sansRetour = [
      stepOf('j1-nuit', 1, 0, 'nuit', 'Nuit au refuge', { lat: 45.8447, lon: 6.8427 }, 'Refuge du Gouter'),
    ];
    const fixed = enforceDayContinuity(
      modelOf(1, sansRetour),
      draftOf({ route: { origin: CHAMONIX, destination: ARGENTIERE, shape: 'aller_simple' } }),
    );
    const dernier = fixed.steps[fixed.steps.length - 1];
    expect(dernier?.lat).toBe(ARGENTIERE.lat);
    expect(dernier?.lon).toBe(ARGENTIERE.lon);
    expect(dernier?.title).toContain('Argentière');
  });

  it('A8-06 : en boucle, aucun retour vers l arrivee n est invente', () => {
    const fixed = enforceDayContinuity(
      modelOf(1, [stepOf('j1-nuit', 1, 0, 'nuit', 'Nuit au refuge', { lat: 45.8447, lon: 6.8427 }, 'Refuge du Gouter')]),
      draftOf({ route: { origin: CHAMONIX, destination: ARGENTIERE, shape: 'boucle' } }),
    );
    expect(fixed.steps).toHaveLength(1);
  });

  it('A8-07 : sans lieu de reference, rien n est invente', () => {
    const sansPoint = [
      stepOf('j1', 1, 0, 'arret', 'Jour 1 libre', null),
      stepOf('j2', 2, 0, 'arret', 'Jour 2 libre', null),
    ];
    const fixed = enforceDayContinuity(modelOf(2, sansPoint), draftOf());
    expect(fixed.steps).toHaveLength(2);
    expect(fixed.steps[1]?.lat).toBeNull();
  });

  it('A8-08 : le seuil de rupture est un parametre teste, pas une constante cachee', () => {
    // A 1 km de la fin de la veille, le voyage est considere comme continu.
    const proche = [
      stepOf('j1-nuit', 1, 0, 'nuit', 'Nuit au refuge', { lat: 45.8447, lon: 6.8427 }, 'Refuge du Gouter'),
      stepOf('j2-traj', 2, 0, 'trajet', 'Trajet', { lat: 45.855, lon: 6.850 }, 'Col'),
    ];
    expect(haversineKm({ lat: 45.8447, lon: 6.8427 }, { lat: 45.855, lon: 6.85 })).toBeLessThan(CONTINUITY_LEG_KM);
    const fixed = enforceDayContinuity(modelOf(2, proche), draftOf());
    expect(fixed.steps.find((step) => step.id === 'j2-traj')?.lat).toBe(45.855);
  });
});
