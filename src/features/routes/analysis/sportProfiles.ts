/**
 * Modèles sportifs des analyseurs R02.
 *
 * Chaque coefficient est une hypothèse de calcul **documentée**, pas une
 * mesure. Les seuils de difficulté sont propres au sport pour que les
 * catégories restent comparables entre elles (S3.26), sans comparer un col
 * cycliste à une montée pédestre avec le même barème.
 */
import type { AnalysisSport } from './types';

export type SportFamily = 'foot' | 'bike' | 'snow' | 'water';

export interface SportModel {
  readonly id: AnalysisSport;
  readonly family: SportFamily;
  /** Vitesse de référence sur terrain plat, km/h. */
  readonly flatSpeedKmH: number;
  /** Vitesse d'ascension de référence, m/h. */
  readonly ascentMPerH: number;
  /** Vitesse de descente de référence, m/h. */
  readonly descentMPerH: number;
  /** Part du temps d'ascension ajoutée au temps plat (0 = intégré). */
  readonly ascentWeight: number;
  /** Part du temps de descente ajoutée au temps plat. */
  readonly descentWeight: number;
  /** Seuils de gain équivalent pour les catégories 1→5 d'une montée. */
  readonly climbThresholdsM: readonly [number, number, number, number];
  /** Seuils de distance-effort (km équivalent plat) pour la difficulté 1→5. */
  readonly difficultyThresholdsKm: readonly [number, number, number, number];
  /** Gain (m) qui vaut un kilomètre plat dans le calcul d'effort. */
  readonly gainMForEffortKm: number | null;
}

const FOOT = {
  family: 'foot' as const,
  ascentWeight: 1,
  descentWeight: 0.15,
  climbThresholdsM: [120, 300, 600, 1000] as const,
  difficultyThresholdsKm: [8, 16, 25, 35] as const,
  gainMForEffortKm: 100,
};

const RUN = {
  family: 'foot' as const,
  ascentWeight: 0.85,
  descentWeight: 0.2,
  climbThresholdsM: [100, 250, 500, 900] as const,
  difficultyThresholdsKm: [10, 20, 32, 45] as const,
  gainMForEffortKm: 120,
};

const BIKE = {
  family: 'bike' as const,
  ascentWeight: 0.45,
  descentWeight: 0.1,
  climbThresholdsM: [200, 500, 900, 1400] as const,
  difficultyThresholdsKm: [30, 60, 100, 150] as const,
  gainMForEffortKm: 80,
};

const MTB = {
  family: 'bike' as const,
  ascentWeight: 0.6,
  descentWeight: 0.15,
  climbThresholdsM: [150, 400, 750, 1200] as const,
  difficultyThresholdsKm: [20, 40, 65, 95] as const,
  gainMForEffortKm: 70,
};

const MODELS: Record<AnalysisSport, SportModel> = {
  marche: {
    id: 'marche',
    flatSpeedKmH: 4.5,
    ascentMPerH: 400,
    descentMPerH: 500,
    ...FOOT,
  },
  rando: {
    id: 'rando',
    flatSpeedKmH: 4,
    ascentMPerH: 350,
    descentMPerH: 450,
    ...FOOT,
    climbThresholdsM: [100, 280, 550, 950],
  },
  famille: {
    id: 'famille',
    flatSpeedKmH: 3.5,
    ascentMPerH: 300,
    descentMPerH: 400,
    ...FOOT,
    climbThresholdsM: [80, 200, 400, 700],
    difficultyThresholdsKm: [5, 10, 16, 24],
  },
  bivouac: {
    id: 'bivouac',
    flatSpeedKmH: 3.8,
    ascentMPerH: 350,
    descentMPerH: 450,
    ...FOOT,
  },
  trail: {
    id: 'trail',
    flatSpeedKmH: 7.5,
    ascentMPerH: 700,
    descentMPerH: 900,
    ...RUN,
  },
  course: {
    id: 'course',
    flatSpeedKmH: 9.5,
    ascentMPerH: 800,
    descentMPerH: 1000,
    ...RUN,
  },
  velo: {
    id: 'velo',
    flatSpeedKmH: 20,
    ascentMPerH: 600,
    descentMPerH: 1000,
    ...BIKE,
    climbThresholdsM: [180, 450, 850, 1300],
    difficultyThresholdsKm: [25, 50, 85, 130],
  },
  route: {
    id: 'route',
    flatSpeedKmH: 22,
    ascentMPerH: 700,
    descentMPerH: 1200,
    ...BIKE,
  },
  gravel: {
    id: 'gravel',
    flatSpeedKmH: 17,
    ascentMPerH: 550,
    descentMPerH: 900,
    ...BIKE,
    climbThresholdsM: [180, 450, 850, 1300],
  },
  vtt: {
    id: 'vtt',
    flatSpeedKmH: 13,
    ascentMPerH: 450,
    descentMPerH: 800,
    ...MTB,
  },
  enduro: {
    id: 'enduro',
    flatSpeedKmH: 30,
    ascentMPerH: 1200,
    descentMPerH: 1500,
    ...MTB,
    ascentWeight: 0.25,
    descentWeight: 0.05,
    climbThresholdsM: [300, 700, 1200, 1800],
    difficultyThresholdsKm: [40, 80, 130, 200],
    gainMForEffortKm: 50,
  },
  ski: {
    id: 'ski',
    flatSpeedKmH: 4.5,
    ascentMPerH: 400,
    descentMPerH: 500,
    ...FOOT,
    family: 'snow',
    climbThresholdsM: [100, 250, 500, 900],
    difficultyThresholdsKm: [6, 12, 18, 25],
    gainMForEffortKm: 120,
  },
  kayak: {
    id: 'kayak',
    flatSpeedKmH: 5,
    ascentMPerH: 0,
    descentMPerH: 0,
    ascentWeight: 0,
    descentWeight: 0,
    family: 'water',
    climbThresholdsM: [10_000, 20_000, 30_000, 40_000],
    difficultyThresholdsKm: [10, 20, 35, 50],
    gainMForEffortKm: null,
  },
};

export function sportModel(sport: AnalysisSport): SportModel {
  return MODELS[sport];
}
