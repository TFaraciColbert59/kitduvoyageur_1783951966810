/**
 * Mesures reelles du parcours : le kilometrage routier et la meteo.
 *
 * Ces tests verrouillent le contrat honnete du module :
 *  1. l'ancre meteo est le depart saisi, sinon la premiere etape situee ;
 *  2. l'ancre qui decide de la selection est celle transmise a la source, pour
 *     qu il n y ait qu UNE decision et jamais deux qui divergent ;
 *  3. la meteo se rattache par DATE reelle, jamais par rang dans le tableau ;
 *  4. une source muete ne produit ni zero, ni moyenne, ni report d une autre
 *     journee : elle laisse la mesure a `null`, et l ecran assume « a verifier » ;
 *  5. le decoupage en phases `trace` / `meteo` donne exactement le meme
 *     resultat que la mesure d un seul tenant.
 *
 * Aucun appel reseau ici : le routage et la meteo sont injectes.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  NO_MEASUREMENTS,
  applyRouting,
  applyWeather,
  measureItinerary,
  measurementRunners,
  weatherAnchor,
  type MeasurementDeps,
  type WeatherAnchor,
  type WeatherFetcher,
} from '../engine/measurements';
import {
  applyRouting as applyRoutingFromRouting,
  type GeoPoint,
  type RouteLeg,
  type RoutingDeps,
} from '../engine/routing';
import { buildItinerary } from '../engine/itinerary';
import type { DayWeather } from '../engine/weather';
import type { AdventurePrepDraft, ItineraryModel } from '../types';
import { ARGENTIERE, CHAMONIX, fullDraft } from './fixtures';

const A: GeoPoint = { lat: CHAMONIX.lat, lon: CHAMONIX.lon };
const B: GeoPoint = { lat: ARGENTIERE.lat, lon: ARGENTIERE.lon };

/** L'ancre attendue quand le depart saisi est Chamonix. */
const ANCRE_CHAMONIX: WeatherAnchor = { lat: CHAMONIX.lat, lon: CHAMONIX.lon };
/** L'ancre attendue quand l'ancre doit venir de la premiere etape situee. */
const ANCRE_ARGENTIERE: WeatherAnchor = { lat: ARGENTIERE.lat, lon: ARGENTIERE.lon };

/** Un profil d altitude reel, pour que le denivele soit mesure et non suppose. */
const RAMP: readonly (readonly [number, number])[] = [
  [6.86, 45.92],
  [6.9, 45.95],
  [6.93, 45.98],
];

const START = '2026-07-11';

function draftOf(
  days: number,
  overrides: Partial<AdventurePrepDraft> = {},
  startDate: string | null = START,
): AdventurePrepDraft {
  return fullDraft({
    ...overrides,
    calendar: { startDate, durationDays: days, durationIsSuggested: false, returnDate: null },
  });
}

/** Brouillon sans depart : l'ancre ne peut plus venir que d une etape situee. */
function draftWithoutOrigin(days: number): AdventurePrepDraft {
  return draftOf(days, { route: { origin: null, destination: ARGENTIERE, shape: 'boucle' } });
}

function modelOf(days: number): ItineraryModel {
  const built = buildItinerary(draftOf(days));
  if (!built) throw new Error('modele attendu');
  return built;
}

function withCoords(model: ItineraryModel, points: readonly GeoPoint[]): ItineraryModel {
  return {
    ...model,
    steps: model.steps.map((step, index) => {
      const point = points[index % points.length];
      return { ...step, lat: point.lat, lon: point.lon };
    }),
  };
}

/** Modele dont chaque etape porte des coordonnees, A/B en alternance. */
function locatedModel(days: number): ItineraryModel {
  return withCoords(modelOf(days), [A, B]);
}

/** Modele dont les deux premieres etapes sont sans position : l'ancre doit sauter plus loin. */
function modelAnchoredLater(): ItineraryModel {
  const built = modelOf(1);
  return {
    ...built,
    steps: built.steps.map((step, index) =>
      index < 2 ? { ...step, lat: null, lon: null } : { ...step, lat: B.lat, lon: B.lon },
    ),
  };
}

/** Nombre de points situes d une journee : un trace n existe qu a partir de deux. */
function locatedCount(model: ItineraryModel, day: number): number {
  return model.steps.filter((step) => step.day === day && step.lat !== null && step.lon !== null).length;
}

function leg(
  distanceKm: number,
  durationMin: number,
  geometry: readonly (readonly [number, number])[] = [],
): RouteLeg {
  return { distanceKm, durationMin, geometry };
}

function sky(date: string, label: string): DayWeather {
  return { date, tMaxC: 24, tMinC: 11, precipMm: 0, precipProbPct: 5, windMaxKmh: 12, code: 1, label };
}

const SILENT_ROUTING: RoutingDeps = { route: async () => null, elevation: async () => null };

function depsOf(route: RoutingDeps, weather: MeasurementDeps['weather']): MeasurementDeps {
  return { route, weather };
}

const liveSignal = (): AbortSignal => new AbortController().signal;

describe('ancre meteo', () => {
  it('le depart saisi l emporte sur des etapes situees', () => {
    // Toutes les etapes sont a Argentiere : si le depart n etait pas priorise,
    // l ancre tomberait sur Argentiere. Elle doit rester Chamonix.
    const anchor = weatherAnchor(draftOf(1), withCoords(modelOf(1), [B]));
    expect(anchor).toEqual(ANCRE_CHAMONIX);
  });

  it('sans depart, l ancre est la premiere etape REELLEMENT situee', () => {
    expect(weatherAnchor(draftWithoutOrigin(1), modelAnchoredLater())).toEqual(ANCRE_ARGENTIERE);
  });

  it('ni depart ni etape situee : aucune ancre, le fournisseur n est pas sollicite', () => {
    expect(weatherAnchor(draftWithoutOrigin(1), modelOf(1))).toBeNull();
  });
});

describe('ancre transmise a la source meteo', () => {
  it('la source recoit le depart saisi, pas une etape du parcours', async () => {
    // Toutes les etapes sont a Argentiere : si l ancre transmise n etait pas
    // le depart, le fournisseur interrogerait le mauvais point.
    const weather = vi.fn(async () => [sky(START, 'J1')]);

    await measureItinerary(draftOf(1), withCoords(modelOf(1), [B]), depsOf(SILENT_ROUTING, weather));

    expect(weather).toHaveBeenCalledWith([START], undefined, ANCRE_CHAMONIX);
  });

  it('sans depart, la source recoit la premiere etape situee', async () => {
    const weather = vi.fn(async () => [sky(START, 'J1')]);

    await measureItinerary(
      draftWithoutOrigin(1),
      modelAnchoredLater(),
      depsOf(SILENT_ROUTING, weather),
    );

    expect(weather).toHaveBeenCalledWith([START], undefined, ANCRE_ARGENTIERE);
  });

  it('la phase meteo transmet la meme ancre, avec le signal de la phase', async () => {
    const weather = vi.fn(async () => [sky(START, 'J1')]);
    const runners = measurementRunners(depsOf(SILENT_ROUTING, weather));
    const controller = new AbortController();

    await runners.weather(draftOf(1), withCoords(modelOf(1), [B]), controller.signal);

    expect(weather).toHaveBeenCalledWith([START], controller.signal, ANCRE_CHAMONIX);
  });

  it('l ancre transmise est exactement celle que renvoie weatherAnchor', async () => {
    const weather = vi.fn<WeatherFetcher>(async () => [sky(START, 'J1')]);
    const draft = draftOf(1);
    const model = withCoords(modelOf(1), [B]);

    await measureItinerary(draft, model, depsOf(SILENT_ROUTING, weather));

    const troisieme = weather.mock.calls[0]?.[2];
    expect(troisieme).toEqual(weatherAnchor(draft, model));
  });
});

describe('rattachement de la meteo', () => {
  it('une serie de longueur differente du parcours est refusee en entier', () => {
    const serie = [sky('2026-07-11', 'J1'), sky('2026-07-12', 'J2')];

    const tropCourte = modelOf(3);
    expect(applyWeather(tropCourte, START, serie)).toBe(tropCourte);

    const tropLongue = modelOf(3);
    expect(
      applyWeather(tropLongue, START, [...serie, sky('2026-07-13', 'J3'), sky('2026-07-14', 'J4')]),
    ).toBe(tropLongue);

    const aucune = modelOf(3);
    expect(applyWeather(aucune, START, null)).toBe(aucune);
  });

  it('sans date de depart exploitable, rien n est rattache', () => {
    const serie = [sky(START, 'J1'), sky('2026-07-12', 'J2'), sky('2026-07-13', 'J3')];

    const sansDate = modelOf(3);
    expect(applyWeather(sansDate, null, serie)).toBe(sansDate);

    const dateInexploitable = modelOf(3);
    expect(applyWeather(dateInexploitable, '11/07/2026', serie)).toBe(dateInexploitable);
  });

  it('la serie se rattache par DATE, pas par rang dans le tableau', () => {
    const out = applyWeather(modelOf(3), START, [
      sky('2026-07-13', 'J3'),
      sky(START, 'J1'),
      sky('2026-07-12', 'J2'),
    ]);
    expect(out.weather.map((day) => day?.date)).toEqual([START, '2026-07-12', '2026-07-13']);
    expect(out.weather.map((day) => day?.label)).toEqual(['J1', 'J2', 'J3']);
  });

  it('une journee non couverte reste inconnue, elle n herite pas de la voisine', () => {
    const out = applyWeather(modelOf(3), START, [
      sky('2026-07-10', 'J0'),
      sky(START, 'J1'),
      sky('2026-07-12', 'J2'),
    ]);
    expect(out.weather[0]?.label).toBe('J1');
    expect(out.weather[1]?.label).toBe('J2');
    // Le troisieme jour n est pas prevu : il vaut inconnu, pas « la veille ».
    expect(out.weather[2]).toBeNull();
    expect(out.weather).not.toContain(sky('2026-07-12', 'J2'));
  });

  it('le modele d origine n est jamais modifie', () => {
    const model = modelOf(2);
    const before = JSON.stringify(model);
    applyWeather(model, START, [sky(START, 'J1'), sky('2026-07-12', 'J2')]);
    expect(JSON.stringify(model)).toBe(before);
    expect(model.weather).toEqual([null, null]);
  });
});

describe('mesure complete', () => {
  it('applique le trace mesure puis la meteo, sans muter le modele d origine', async () => {
    const model = locatedModel(1);
    const legs = locatedCount(model, 1) - 1;
    const route = vi.fn(async (points: readonly GeoPoint[]) => points.slice(1).map(() => leg(4, 9, RAMP)));
    const elevation = vi.fn(async () => [1000, 1060, 1120]);
    const weather = vi.fn(async () => [sky(START, 'J1')]);
    const before = JSON.stringify(model);

    const out = await measureItinerary(draftOf(1), model, depsOf({ route, elevation }, weather));

    expect(out.totals.distanceKm).toBeCloseTo(4 * legs, 2);
    expect(out.totals.movingMin).toBe(9 * legs);
    expect(out.totals.elevGainM).toBe(120);
    expect(out.totals.elevLossM).toBe(0);
    expect(out.weather[0]?.date).toBe(START);
    expect(out.weather[0]?.label).toBe('J1');
    expect(JSON.stringify(model)).toBe(before);
  });

  it('reporte le temps de trajet reel sur l etape d arrivee', async () => {
    const model = locatedModel(1);
    const route = vi.fn(async (points: readonly GeoPoint[]) => points.slice(1).map(() => leg(4, 9)));
    const out = await measureItinerary(
      draftOf(1),
      model,
      depsOf({ route, elevation: async () => null }, async () => null),
    );
    const located = out.steps.filter((step) => step.lat !== null).sort((a, b) => a.order - b.order);
    expect(located[located.length - 1].durationMin).toBe(9);
    expect(located[0].durationMin).toBeNull();
  });

  it('mesure chaque journee separement, avec sa distance et son temps', async () => {
    const model = locatedModel(2);
    const legsDayOne = locatedCount(model, 1) - 1;
    const legsDayTwo = locatedCount(model, 2) - 1;
    let call = 0;
    const route = vi.fn(async (points: readonly GeoPoint[]) => {
      call += 1;
      return points.slice(1).map(() => leg(call === 1 ? 10 : 3, call === 1 ? 20 : 6));
    });

    const out = await measureItinerary(
      draftOf(2),
      model,
      depsOf({ route, elevation: async () => null }, async () => null),
    );

    expect(route).toHaveBeenCalledTimes(2);
    expect(out.perDay[0].distanceKm).toBeCloseTo(10 * legsDayOne, 2);
    expect(out.perDay[1].distanceKm).toBeCloseTo(3 * legsDayTwo, 2);
    expect(out.totals.movingMin).toBe(20 * legsDayOne + 6 * legsDayTwo);
  });

  it('un routage qui echoue n empeche pas la meteo, et la distance reste inconnue', async () => {
    const route = vi.fn(async () => {
      throw new Error('OSRM injoignable');
    });
    const weather = vi.fn(async () => [sky(START, 'J1')]);

    const out = await measureItinerary(
      draftOf(1),
      locatedModel(1),
      depsOf({ route, elevation: async () => null }, weather),
    );

    expect(weather).toHaveBeenCalledTimes(1);
    expect(out.weather[0]?.label).toBe('J1');
    expect(out.totals.distanceKm).toBeNull();
    expect(out.totals.movingMin).toBeNull();
  });

  it('un fournisseur meteo muet laisse toute la meteo a verifier', async () => {
    const weather = vi.fn(async () => null);
    const out = await measureItinerary(draftOf(1), locatedModel(1), depsOf(SILENT_ROUTING, weather));
    expect(weather).toHaveBeenCalledTimes(1);
    expect(out.weather).toEqual([null]);
  });

  it('un fournisseur meteo en panne n invente aucune valeur', async () => {
    const weather = vi.fn(async () => {
      throw new Error('Open-Meteo injoignable');
    });
    const out = await measureItinerary(draftOf(2), locatedModel(2), depsOf(SILENT_ROUTING, weather));
    expect(weather).toHaveBeenCalledTimes(1);
    expect(out.weather).toEqual([null, null]);
  });

  it('aucune requete meteo sans ancre', async () => {
    const route = vi.fn(async () => null);
    const weather = vi.fn(async () => [sky(START, 'J1')]);

    const out = await measureItinerary(
      draftWithoutOrigin(1),
      modelOf(1),
      depsOf({ route, elevation: async () => null }, weather),
    );

    expect(route).not.toHaveBeenCalled();
    expect(weather).not.toHaveBeenCalled();
    expect(out.weather).toEqual([null]);
  });

  it('aucune requete meteo sans date de depart', async () => {
    const route = vi.fn(async () => null);
    const weather = vi.fn(async () => [sky(START, 'J1')]);

    const out = await measureItinerary(
      draftOf(1, {}, null),
      locatedModel(1),
      depsOf({ route, elevation: async () => null }, weather),
    );

    expect(weather).not.toHaveBeenCalled();
    expect(out.weather).toEqual([null]);
  });

  it('un signal deja avorte arrete la mesure avant toute prevision', async () => {
    const controller = new AbortController();
    controller.abort();
    // Un fetch reel rejette des qu il recoit un signal avorte.
    const route = vi.fn(async (_points: readonly GeoPoint[], signal?: AbortSignal) => {
      if (signal?.aborted) throw new Error('requete annulee');
      return null;
    });
    const weather = vi.fn(async () => [sky(START, 'J1')]);

    const out = await measureItinerary(
      draftOf(1),
      locatedModel(1),
      depsOf({ route, elevation: async () => null }, weather),
      controller.signal,
    );

    expect(weather).not.toHaveBeenCalled();
    expect(out.totals.distanceKm).toBeNull();
    expect(out.weather).toEqual([null]);
  });

  it('transmet le signal, les dates reelles et l ancre aux deux fournisseurs', async () => {
    const controller = new AbortController();
    const route = vi.fn(async () => null);
    const weather = vi.fn(async () => [sky(START, 'J1')]);

    await measureItinerary(
      draftOf(1),
      locatedModel(1),
      depsOf({ route, elevation: async () => null }, weather),
      controller.signal,
    );

    expect(weather).toHaveBeenCalledWith([START], controller.signal, ANCRE_CHAMONIX);
    expect(route).toHaveBeenCalledWith(expect.any(Array), controller.signal);
  });

  it('aucun repli silencieux : une aventure muete reste entierement a verifier', async () => {
    const out = await measureItinerary(
      draftOf(2),
      locatedModel(2),
      depsOf(SILENT_ROUTING, async () => null),
    );
    expect(out.totals.distanceKm).toBeNull();
    expect(out.totals.movingMin).toBeNull();
    expect(out.totals.elevGainM).toBeNull();
    expect(out.totals.elevLossM).toBeNull();
    expect(out.totals.activityMin).toBeNull();
    expect(out.perDay.map((day) => day.distanceKm)).toEqual([null, null]);
    expect(out.weather).toEqual([null, null]);
  });

  it('une journee muete ne vaut pas zero et ne contamine pas le total', async () => {
    let call = 0;
    const route = vi.fn(async (points: readonly GeoPoint[]) => {
      call += 1;
      if (call === 2) return null;
      return points.slice(1).map(() => leg(7, 12));
    });

    const out = await measureItinerary(
      draftOf(2),
      locatedModel(2),
      depsOf({ route, elevation: async () => null }, async () => null),
    );

    expect(out.perDay[0].distanceKm).not.toBeNull();
    expect(out.perDay[1].distanceKm).toBeNull();
    expect(out.totals.distanceKm).toBeNull();
  });

  it('re-exporte le meme appliquant de routage que le moteur', () => {
    expect(applyRouting).toBe(applyRoutingFromRouting);
  });
});

describe('phases de mesure', () => {
  it('la phase trace mesure le reseau routier et ne demande aucune meteo', async () => {
    const model = locatedModel(1);
    const legs = locatedCount(model, 1) - 1;
    const route = vi.fn(async (points: readonly GeoPoint[]) => points.slice(1).map(() => leg(4, 9)));
    const weather = vi.fn(async () => [sky(START, 'J1')]);
    const runners = measurementRunners(depsOf({ route, elevation: async () => null }, weather));

    const out = await runners.trace(draftOf(1), model, liveSignal());

    expect(out.totals.distanceKm).toBeCloseTo(4 * legs, 2);
    expect(weather).not.toHaveBeenCalled();
    expect(out.weather).toEqual([null]);
  });

  it('la phase trace laisse le parcours intact quand le routeur echoue', async () => {
    const route = vi.fn(async () => {
      throw new Error('OSRM injoignable');
    });
    const runners = measurementRunners(
      depsOf({ route, elevation: async () => null }, async () => null),
    );

    const out = await runners.trace(draftOf(1), locatedModel(1), liveSignal());

    expect(out.totals.distanceKm).toBeNull();
    expect(out.perDay[0].distanceKm).toBeNull();
  });

  it('la phase meteo ne touche ni au trace ni a la distance', async () => {
    const route = vi.fn(async () => null);
    const weather = vi.fn(async () => [sky(START, 'J1')]);
    const runners = measurementRunners(depsOf({ route, elevation: async () => null }, weather));

    const out = await runners.weather(draftOf(1), locatedModel(1), liveSignal());

    expect(route).not.toHaveBeenCalled();
    expect(out.weather[0]?.label).toBe('J1');
    expect(out.totals.distanceKm).toBeNull();
  });

  it('la phase meteo ne demande rien sans ancre ni sans date', async () => {
    const weather = vi.fn(async () => [sky(START, 'J1')]);
    const runners = measurementRunners(depsOf(SILENT_ROUTING, weather));
    const signal = liveSignal();

    const sansAncre = await runners.weather(draftWithoutOrigin(1), modelOf(1), signal);
    const sansDate = await runners.weather(draftOf(1, {}, null), locatedModel(1), signal);

    expect(sansAncre.weather).toEqual([null]);
    expect(sansDate.weather).toEqual([null]);
    expect(weather).not.toHaveBeenCalled();
  });

  it('la phase meteo muette ou en panne laisse toute la meteo a verifier', async () => {
    const muette = measurementRunners(depsOf(SILENT_ROUTING, async () => null));
    const enPanne = measurementRunners(
      depsOf(SILENT_ROUTING, async () => {
        throw new Error('Open-Meteo injoignable');
      }),
    );

    const premier = await muette.weather(draftOf(2), locatedModel(2), liveSignal());
    const second = await enPanne.weather(draftOf(2), locatedModel(2), liveSignal());

    expect(premier.weather).toEqual([null, null]);
    expect(second.weather).toEqual([null, null]);
  });

  it('chaque runner isole sa propre erreur : une panne trace n annule pas la meteo', async () => {
    const route = vi.fn(async () => {
      throw new Error('OSRM injoignable');
    });
    const weather = vi.fn(async () => [sky(START, 'J1')]);
    const runners = measurementRunners(depsOf({ route, elevation: async () => null }, weather));

    const apresTrace = await runners.trace(draftOf(1), locatedModel(1), liveSignal());
    const apresMeteo = await runners.weather(draftOf(1), apresTrace, liveSignal());

    expect(apresMeteo.totals.distanceKm).toBeNull();
    expect(apresMeteo.weather[0]?.label).toBe('J1');
  });

  it('sans reseau, les deux phases sont des identites', async () => {
    const model = locatedModel(2);
    const draft = draftOf(2);
    const signal = liveSignal();

    expect(await NO_MEASUREMENTS.trace(draft, model, signal)).toBe(model);
    expect(await NO_MEASUREMENTS.weather(draft, model, signal)).toBe(model);
    expect(model.totals.distanceKm).toBeNull();
    expect(model.weather).toEqual([null, null]);
  });

  it('enchainer trace puis meteo vaut exactement la mesure d un seul tenant', async () => {
    const model = locatedModel(1);
    const legs = locatedCount(model, 1) - 1;
    const deps = depsOf(
      {
        route: async (points: readonly GeoPoint[]) => points.slice(1).map(() => leg(4, 9)),
        elevation: async () => null,
      },
      async () => [sky(START, 'J1')],
    );
    const runners = measurementRunners(deps);
    const draft = draftOf(1);
    const signal = liveSignal();

    const parPhases = await runners.weather(draft, await runners.trace(draft, model, signal), signal);
    const enUnPass = await measureItinerary(draft, model, deps, signal);

    expect(parPhases.totals.distanceKm).toBeCloseTo(4 * legs, 2);
    expect(parPhases.totals.distanceKm).toBe(enUnPass.totals.distanceKm);
    expect(parPhases.totals.movingMin).toBe(enUnPass.totals.movingMin);
    expect(parPhases.weather.map((day) => day?.date)).toEqual(
      enUnPass.weather.map((day) => day?.date),
    );
    expect(parPhases.weather[0]?.label).toBe('J1');
    expect(enUnPass.weather[0]?.label).toBe('J1');
  });
});
