/**
 * Jeu de données de démonstration pour l'écran /planification.
 *
 * Aucune valeur météo n'est inventée : le bulletin initial est explicitement
 * « non configuré ». Les tracés et refuges sont des exemples d'interface, pas
 * des données de production ; `PlanningWorkspace` reçoit ses plans en props et
 * peut être branché sur un stockage réel sans changer l'UI.
 */

import {
  createUnconfiguredWeatherFeed,
  splitRouteIntoDays,
  type ContinuousRoute,
  type GpxTrackPoint,
  type LodgingAnchor,
  type MultiDayPlan,
  type ViewerContextP01,
  type WeatherFeedSnapshot,
} from '@/features/planning';

export const DEMO_NOW_ISO = '2026-07-10T06:00:00Z';

export const DEMO_VIEWER: ViewerContextP01 = {
  viewerId: 'demo-owner',
  friendIds: ['demo-friend'],
  tribuIds: ['tribu-alpes'],
  blockedUserIds: [],
};

function alpinePoints(latBase = 45.8, lonBase = 6.85, count = 13): GpxTrackPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    lat: latBase + index * 0.04,
    lon: lonBase + (index % 2 === 0 ? 0 : 0.012),
    eleM: 1_200 + Math.sin(index / 2) * 350 + index * 40,
  }));
}

export const DEMO_MAIN_ROUTE: ContinuousRoute = {
  id: 'route-demo-alpes',
  title: 'Traversée des Alpes — exemple',
  countryCode: 'FR',
  sport: 'trekking',
  theme: 'alpine',
  timezone: 'Europe/Paris',
  points: alpinePoints(),
  ownerId: 'demo-owner',
  audience: 'public',
  revision: 1,
};

export const DEMO_LODGINGS: LodgingAnchor[] = [
  {
    id: 'demo-refuge-bonhomme',
    name: 'Refuge de la Croix du Bonhomme',
    type: 'refuge',
    lat: 45.96,
    lon: 6.86,
    eleM: 2_443,
    openMonths: [6, 7, 8, 9],
    capacity: 70,
  },
  {
    id: 'demo-refuge-constant',
    name: 'Refuge de Constantine',
    type: 'refuge',
    lat: 45.92,
    lon: 6.87,
    eleM: 2_240,
    openMonths: [6, 7, 8, 9],
    capacity: 45,
  },
];

function buildPlan(
  route: ContinuousRoute,
  planId: string,
  targetDays: number,
  publicShareConsented: boolean,
): MultiDayPlan {
  return splitRouteIntoDays(route, {
    planId,
    targetDays,
    nowIso: '2026-06-01T10:00:00Z',
    publicShareConsented,
  });
}

export interface DemoPlanningData {
  plans: MultiDayPlan[];
  route: ContinuousRoute;
  viewer: ViewerContextP01;
  nowIso: string;
  weatherFeed: WeatherFeedSnapshot;
  lodgings: LodgingAnchor[];
}

export function buildDemoPlanningData(): DemoPlanningData {
  const alpes4 = buildPlan(DEMO_MAIN_ROUTE, 'plan-alpes-4j', 4, true);

  const pyreneesRoute: ContinuousRoute = {
    ...DEMO_MAIN_ROUTE,
    id: 'route-demo-pyrenees',
    title: 'Crêtes des Pyrénées — exemple',
    theme: 'ridge',
    points: alpinePoints(42.7, 0.1),
    audience: 'friends',
  };
  const pyrenees3 = buildPlan(pyreneesRoute, 'plan-pyrenees-3j', 3, false);

  const dolomitesRoute: ContinuousRoute = {
    ...DEMO_MAIN_ROUTE,
    id: 'route-demo-dolomites',
    title: 'Dolomites — exemple',
    countryCode: 'IT',
    theme: 'alpine',
    points: alpinePoints(46.4, 11.8),
    ownerId: 'demo-claire',
    audience: 'public',
  };
  const dolomites5 = buildPlan(dolomitesRoute, 'plan-dolomites-5j', 5, true);

  const privateRoute: ContinuousRoute = {
    ...DEMO_MAIN_ROUTE,
    id: 'route-demo-privee',
    title: 'Reconnaissance privée — exemple',
    theme: 'glacier',
    points: alpinePoints(45.4, 6.6),
    ownerId: 'demo-claire',
    audience: 'private',
  };
  const privatePlan = buildPlan(privateRoute, 'plan-prive-2j', 2, false);

  return {
    plans: [alpes4, pyrenees3, dolomites5, privatePlan],
    route: DEMO_MAIN_ROUTE,
    viewer: DEMO_VIEWER,
    nowIso: DEMO_NOW_ISO,
    weatherFeed: createUnconfiguredWeatherFeed('Europe/Paris'),
    lodgings: DEMO_LODGINGS,
  };
}
