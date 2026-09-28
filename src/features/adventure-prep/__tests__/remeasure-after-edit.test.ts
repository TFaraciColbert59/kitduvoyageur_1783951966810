/**
 * E11 / E12 - la remesure apres edition du parcours.
 *
 * Le defaut : `insertWaypoint` mettait `perDay[day-1]` et `totals` a `null` -
 * a juste titre, ces valeurs decrivaient un trace qui n'existait plus - et
 * AUCUNE action ne les remesurait ensuite. `applyAdjustment` ne touchait ni
 * `perDay` ni `totals`, et l'ecran promettait « le trajet et les distances se
 * recalculent aussitot » : une promesse FAUSSE, tenue par personne.
 *
 * Ces tests verrouillent le raccordement manquant :
 *   1. une edition de geometrie remonte des mesures FRAICHES ;
 *   2. `totals` reste coherent avec la somme des journees ;
 *   3. un fournisseur muet laisse `null` (« a verifier »), jamais 0 ;
 *   4. une remesure annulee n'ecrit rien : pas de course perimee.
 *
 * Le fournisseur injecte ici est un routeur EN MEMOIRE, place exactement la ou
 * le produit branche `browserMeasurementRunners()`. Il mesure la MEME
 * geometrie que le vrai fournisseur - `haversineKm` entre les coordonnees
 * REELLES du programme - : aucune distance de ces tests n'est ecrite a la
 * main, elle sort des points du parcours. La seule constante libre est la
 * vitesse, qui ne sert qu'a ramener des minutes coherentes entre elles. Le
 * reseau reel reste couvert ailleurs : `browser-measurements.test.ts` et
 * `routing.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  measurementRunners,
  type MeasurementRunners,
  type WeatherFetcher,
} from '../engine/measurements';
import { haversineKm, type GeoPoint, type RoutingDeps, type TravelMode } from '../engine/routing';
import { buildItinerary, createStep } from '../engine/itinerary';
import type { DayTotals, ItineraryModel, ItineraryStep, ItineraryStepKind } from '../types';
import { fullDraft } from './fixtures';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';

/**
 * Le quadruple de `browserMeasurements` : c'est le SEUL endroit ou le produit
 * touche `/api/route` et `/api/weather`, donc le seul point a brancher. Le
 * test y installe un fournisseur en memoire, le produit y installe le reseau.
 */
const etat = vi.hoisted(() => ({ runners: null as MeasurementRunners | null }));

vi.mock('../browserMeasurements', () => ({
  browserMeasurementRunners: () => {
    if (!etat.runners) throw new Error('fournisseur de test absent');
    return etat.runners;
  },
}));

/** Vitesse du routeur de test. Elle ne produit AUCUNE donnee reelle. */
const VITESSE_TEST_KMH = 4.5;

interface Journal {
  readonly appels: Array<{ points: readonly GeoPoint[]; mode: TravelMode }>;
  /** Appels rendus alors que leur signal etait deja annule. */
  readonly annules: number[];
}

interface Fournisseur {
  readonly runners: MeasurementRunners;
  readonly journal: Journal;
}

interface OptionsFournisseur {
  /** `false` : le fournisseur ne repond a rien, comme un reseau tombe. */
  readonly repondre?: boolean;
  /** Porte attendue avant de repondre : sert a tenir un run en vol. */
  readonly avant?: Promise<void>;
}

function fournisseurEnMemoire(options: OptionsFournisseur = {}): Fournisseur {
  const journal: Journal = { appels: [], annules: [] };
  const repondre = options.repondre ?? true;

  const route: RoutingDeps['route'] = async (points, mode, signal) => {
    journal.appels.push({ points, mode });
    if (options.avant) await options.avant;
    if (signal?.aborted) journal.annules.push(1);
    if (!repondre) return null;
    return points.slice(0, -1).map((point, index) => {
      const suivant = points[index + 1];
      const distanceKm = haversineKm(point, suivant);
      return {
        distanceKm,
        durationMin: Math.round((distanceKm / VITESSE_TEST_KMH) * 60),
        geometry: [
          [point.lon, point.lat],
          [suivant.lon, suivant.lat],
        ],
      };
    });
  };

  const weather: WeatherFetcher = async () => null;

  return {
    journal,
    runners: measurementRunners({
      route: { route, elevation: async () => null },
      weather,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Le parcours de reference                                           */
/* ------------------------------------------------------------------ */

/** Les points sont REELS : ce sont les coordonnees memes que les fixtures. */
const CHAMONIX: GeoPoint = { lat: 45.9237, lon: 6.8694 };
const ARGENTIERE: GeoPoint = { lat: 45.9819, lon: 6.9269 };
const SERVOZ: GeoPoint = { lat: 45.8331, lon: 6.8994 };
const BOURG_D_OISANS: GeoPoint = { lat: 45.7403, lon: 6.8344 };

/** Un point pose a la main, volontairement HORS de l'axe du parcours. */
const WAYPOINT: GeoPoint = { lat: 45.8704, lon: 7.0102 };

interface Gabarit {
  readonly id: string;
  readonly kind: ItineraryStepKind;
  readonly point: GeoPoint;
  readonly title: string;
}

const JOUR_1: readonly Gabarit[] = [
  { id: 'j1-trajet', kind: 'trajet', point: CHAMONIX, title: 'Depart de Chamonix' },
  { id: 'j1-arret', kind: 'arret', point: ARGENTIERE, title: 'Pause a Argentiere' },
  { id: 'j1-repos', kind: 'repos', point: SERVOZ, title: 'Pause orageuse' },
];

const JOUR_2: readonly Gabarit[] = [
  { id: 'j2-trajet', kind: 'trajet', point: SERVOZ, title: 'Descente vers Servoz' },
  { id: 'j2-nuit', kind: 'nuit', point: BOURG_D_OISANS, title: 'Nuit a Bourg d Oisans' },
];

function nonMesure(): DayTotals {
  return {
    distanceKm: null,
    movingMin: null,
    activityMin: null,
    elevGainM: null,
    elevLossM: null,
  };
}

function etape(gabarit: Gabarit, day: number, order: number): ItineraryStep {
  const base = createStep(gabarit.id, day, order, gabarit.kind, {
    title: gabarit.title,
    placeName: gabarit.title,
  });
  return { ...base, lat: gabarit.point.lat, lon: gabarit.point.lon };
}

const CALENDRIER = {
  startDate: '2026-07-11',
  startDateIsSuggested: false,
  durationDays: 2,
  durationIsSuggested: false,
  returnDate: '2026-07-12',
} as const;

/** Deux journees situees, entierement non mesurees : l'etat de depart. */
function modelDepart(): ItineraryModel {
  const base = buildItinerary(fullDraft({ calendar: CALENDRIER }));
  if (!base) throw new Error('fixture : le brouillon doit etre construisible');
  if (base.days !== 2) throw new Error(`fixture : 2 journees attendues, ${base.days} construites`);
  return {
    ...base,
    steps: [
      ...JOUR_1.map((gabarit, index) => etape(gabarit, 1, index + 1)),
      ...JOUR_2.map((gabarit, index) => etape(gabarit, 2, index + 1)),
    ],
    perDay: [nonMesure(), nonMesure()],
    totals: nonMesure(),
  };
}

function charger(model: ItineraryModel): void {
  useAdventurePrepStore.setState({
    draft: fullDraft({
      calendar: CALENDRIER,
      itinerary: model,
      currentStep: 'itinerary',
      completedSteps: ['destination'],
    }),
    remeasuring: null,
  });
}

function parcours(): ItineraryModel {
  const model = useAdventurePrepStore.getState().draft.itinerary;
  if (!model) throw new Error('le parcours doit exister');
  return model;
}

/* ------------------------------------------------------------------ */
/* L invariant honnete                                                 */
/* ------------------------------------------------------------------ */

const CHAMPS = ['distanceKm', 'movingMin', 'activityMin', 'elevGainM', 'elevLossM'] as const;

function sommeOuNull(valeurs: readonly (number | null)[]): number | null {
  if (valeurs.length === 0) return null;
  if (valeurs.some((valeur) => valeur === null)) return null;
  return valeurs.reduce<number>((acc, valeur) => acc + (valeur as number), 0);
}

/** Le total du parcours ne vaut que la somme de ses journees, ou `null`. */
function attenduCoherent(model: ItineraryModel): void {
  expect(model.perDay).toHaveLength(model.days);
  for (const champ of CHAMPS) {
    const somme = sommeOuNull(model.perDay.map((jour) => jour[champ]));
    const total = model.totals[champ];
    if (somme === null) {
      expect(total, `${champ} : un total sans mesure reste a verifier`).toBeNull();
    } else {
      expect(total, `${champ} : le total vaut la somme des journees`).toBeCloseTo(somme, 6);
    }
  }
}

beforeEach(() => {
  charger(modelDepart());
});

/* ------------------------------------------------------------------ */
/* Les tests                                                          */
/* ------------------------------------------------------------------ */

describe('E11 / E12 - la remesure apres edition', () => {
  it('E11-1: un point de passage remonte des distances remesurees, pas des null', async () => {
    const { runners, journal } = fournisseurEnMemoire();
    etat.runners = runners;
    charger(modelDepart());
    // Parcours deja mesure : la comparaison porte sur une mesure de reference.
    await useAdventurePrepStore.getState().remeasure('manuel');
    const avantJour1 = parcours().perDay[0].distanceKm;
    expect(avantJour1).not.toBeNull();
    expect(avantJour1 as number).toBeCloseTo(
      haversineKm(CHAMONIX, ARGENTIERE) + haversineKm(ARGENTIERE, SERVOZ),
      1,
    );
    const appelsAvant = journal.appels.length;

    await useAdventurePrepStore.getState().addWaypoint(WAYPOINT, 1);

    const apres = parcours();
    expect(apres.steps.filter((step) => step.day === 1)).toHaveLength(4);
    // Le reseau a ete interroge une seconde fois : c est la remesure.
    expect(journal.appels.length).toBeGreaterThan(appelsAvant);
    // Le point entre dans la chaine mesuree, donc la journee s allonge.
    const jour1 = apres.perDay[0].distanceKm;
    expect(jour1).not.toBeNull();
    expect(jour1 as number).toBeGreaterThan(avantJour1 as number);
    attenduCoherent(apres);
    expect(useAdventurePrepStore.getState().remeasuring).toBeNull();
  });

  it('E11-2: un ajustement RECALCULE les mesures au lieu de laisser les anciennes', async () => {
    const { runners } = fournisseurEnMemoire();
    etat.runners = runners;
    charger(modelDepart());
    await useAdventurePrepStore.getState().remeasure('manuel');
    const avant = parcours().totals.distanceKm;
    expect(avant).not.toBeNull();
    expect(avant as number).toBeCloseTo(
      haversineKm(CHAMONIX, ARGENTIERE) +
        haversineKm(ARGENTIERE, SERVOZ) +
        haversineKm(SERVOZ, BOURG_D_OISANS),
      1,
    );

    await useAdventurePrepStore.getState().adjust('moins_cher');

    const apres = parcours();
    // Les etapes facultatives ont disparu...
    expect(apres.steps.some((step) => step.id === 'j1-arret')).toBe(false);
    expect(apres.steps.some((step) => step.id === 'j1-repos')).toBe(false);
    // ...et les mesures ont suivi, elles ne sont pas restees celles d avant.
    for (const jour of apres.perDay) expect(jour.distanceKm).not.toBeNull();
    expect(apres.totals.distanceKm).not.toBe(avant);
    expect(apres.totals.distanceKm as number).toBeCloseTo(
      haversineKm(SERVOZ, BOURG_D_OISANS),
      1,
    );
    attenduCoherent(apres);
  });

  it('E11-3: une edition sur un reseau muet reste honnete - null, jamais zero', async () => {
    etat.runners = fournisseurEnMemoire({ repondre: false }).runners;
    charger(modelDepart());
    await useAdventurePrepStore.getState().addWaypoint(WAYPOINT, 1);

    const apres = parcours();
    for (const jour of apres.perDay) {
      expect(jour.distanceKm).toBeNull();
      expect(jour.movingMin).toBeNull();
      expect(jour.elevGainM).toBeNull();
    }
    expect(apres.totals.distanceKm).toBeNull();
    expect(apres.totals.movingMin).toBeNull();
    // Un zero presente comme une mesure serait un mensonge : il est refuse aussi.
    expect(apres.perDay.some((jour) => jour.distanceKm === 0)).toBe(false);
    // La meteo, muette elle aussi, reste « a verifier » sur chaque journee.
    expect(apres.weather).toHaveLength(apres.days);
    expect(apres.weather.every((jour) => jour === null)).toBe(true);
    attenduCoherent(apres);
  });

  it('E12-4: une remesure annulee n ecrit rien - pas de course perimee', async () => {
    let ouvrir = (): void => undefined;
    const porte = new Promise<void>((resolve) => {
      ouvrir = resolve;
    });

    const lent = fournisseurEnMemoire({ avant: porte });
    etat.runners = lent.runners;
    charger(modelDepart());

    const premier = useAdventurePrepStore.getState().remeasure('manuel');
    // La deuxieme edition arrive et annule le premier run, deja parti sur le net.
    const vif = fournisseurEnMemoire();
    etat.runners = vif.runners;
    const second = useAdventurePrepStore.getState().addWaypoint(WAYPOINT, 1);
    expect(useAdventurePrepStore.getState().remeasuring).not.toBeNull();

    ouvrir();
    await premier;

    // Le run perime a bien ete tente, et il a bien vu l annulation...
    expect(lent.journal.appels.length).toBeGreaterThan(0);
    expect(lent.journal.annules.length).toBeGreaterThan(0);
    // ...mais il n a rien ecrit : le point de passage est toujours la, et ses
    // mesures sont toujours celles que l edition vient d effacer.
    const entre = parcours();
    expect(entre.steps.filter((step) => step.day === 1)).toHaveLength(4);
    expect(entre.perDay[0].distanceKm).toBeNull();

    await second;

    const apres = parcours();
    expect(apres.perDay[0].distanceKm).not.toBeNull();
    attenduCoherent(apres);
    expect(useAdventurePrepStore.getState().remeasuring).toBeNull();
  });

  it('E12-5: sans parcours, la remesure ne part pas et ne pretend rien', async () => {
    const { runners, journal } = fournisseurEnMemoire();
    etat.runners = runners;
    useAdventurePrepStore.setState({ draft: fullDraft(), remeasuring: null });
    await useAdventurePrepStore.getState().remeasure('manuel');
    expect(journal.appels).toHaveLength(0);
    expect(useAdventurePrepStore.getState().draft.itinerary).toBeNull();
    expect(useAdventurePrepStore.getState().remeasuring).toBeNull();
  });

  it('E12-6: une edition refusee ne relance aucun mesurage', async () => {
    const { runners, journal } = fournisseurEnMemoire();
    etat.runners = runners;
    charger(modelDepart());
    // Le couple (0, 0) n est pas une position : le moteur refuse le point, le
    // parcours ne bouge pas, donc il n y a rien a remesurer.
    await useAdventurePrepStore.getState().addWaypoint({ lat: 0, lon: 0 }, 1);
    expect(parcours().steps).toHaveLength(5);
    expect(journal.appels).toHaveLength(0);
    expect(useAdventurePrepStore.getState().remeasuring).toBeNull();
  });
});
