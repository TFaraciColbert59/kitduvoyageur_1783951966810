/**
 * K2.21 + S3.26 · Difficulté calculée et durée estimée, par sport.
 *
 * La difficulté est une **distance-effort** : distance plate + gain converti
 * avec le coefficient du sport, puis corrigée par la surface et l'altitude.
 * Les seuils de niveau sont propres au sport pour que les catégories restent
 * comparables. La durée est une estimation : elle n'est marquée personnelle
 * que si un profil sportif réel (vitesse ou débit d'ascension) est fourni.
 */
import {
  isAnalysisSport,
  isFiniteNumber,
  ROUTE_ANALYSIS_VERSION,
  type AnalysisGap,
  type AnalysisSport,
  type AnalysisStatus,
  type AnalysisWarning,
} from './types';
import { clamp, round } from './geo';
import { sportModel } from './sportProfiles';
import type { SurfaceAnalysis, SurfaceCategory } from './surfaces';
import type { ClimbAnalysis } from './climbs';

export interface AthleteProfile {
  /** Vitesse récente sur plat, km/h. */
  readonly flatSpeedKmH?: number | null;
  /** Débit d'ascension récent, m/h. */
  readonly ascentMPerH?: number | null;
  /** Débit de descente récent, m/h. */
  readonly descentMPerH?: number | null;
  readonly label?: string | null;
}

export interface DifficultyInput {
  readonly sport: AnalysisSport;
  readonly distanceM: number;
  /** Gain positif ; `null` interdit une difficulté honnête (sauf sport sans relief). */
  readonly gainM: number | null;
  readonly lossM?: number | null;
  readonly maxAltitudeM?: number | null;
  readonly surface?: Pick<SurfaceAnalysis, 'status' | 'shares' | 'coverage' | 'unknownLengthM'> | null;
  readonly climbs?: Pick<ClimbAnalysis, 'climbs' | 'descents' | 'status'> | null;
  readonly athlete?: AthleteProfile | null;
  readonly breakMinutes?: number | null;
}

export interface DifficultyFactor {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  /** Contribution au temps de déplacement, en minutes (peut être négative). */
  readonly contributionMinutes: number;
}

export interface DurationEstimate {
  readonly status: AnalysisStatus;
  readonly seconds: number | null;
  readonly hours: number | null;
  readonly personalized: boolean;
  readonly basis: 'standard' | 'personal';
  readonly factors: DifficultyFactor[];
  readonly missing: AnalysisGap[];
}

export interface DifficultyAnalysis {
  readonly status: AnalysisStatus;
  readonly sport: AnalysisSport;
  /** Score 0–100, croissant avec la distance-effort. */
  readonly score: number;
  readonly level: 1 | 2 | 3 | 4 | 5;
  readonly levelLabel: string;
  /** Distance-effort en km plat équivalent. */
  readonly effortKm: number;
  readonly duration: DurationEstimate;
  readonly factors: DifficultyFactor[];
  readonly missing: AnalysisGap[];
  readonly warnings: AnalysisWarning[];
  readonly method: {
    readonly id: string;
    readonly version: string;
    readonly formula: string;
    readonly assumptions: string[];
  };
}

const LEVEL_LABELS = ['Facile', 'Modérée', 'Soutenue', 'Difficile', 'Très difficile'] as const;

const SURFACE_MULTIPLIERS: Record<Exclude<SurfaceCategory, 'unknown'>, number> = {
  paved: 1,
  unpaved: 1.08,
  natural: 1.2,
  steps: 1.45,
  ferry: 1,
};

function validSpeed(value: unknown, min: number, max: number): number | null {
  return isFiniteNumber(value) && value >= min && value <= max ? value : null;
}

function levelFor(
  effortKm: number,
  thresholds: readonly [number, number, number, number]
): 1 | 2 | 3 | 4 | 5 {
  if (effortKm < thresholds[0]) return 1;
  if (effortKm < thresholds[1]) return 2;
  if (effortKm < thresholds[2]) return 3;
  if (effortKm < thresholds[3]) return 4;
  return 5;
}

export function analyzeDifficulty(input: DifficultyInput): DifficultyAnalysis {
  const durationUnavailable = (missing: AnalysisGap[]): DurationEstimate => ({
    status: 'unavailable',
    seconds: null,
    hours: null,
    personalized: false,
    basis: 'standard',
    factors: [],
    missing,
  });

  const unavailable = (missing: AnalysisGap[], warnings: AnalysisWarning[] = []): DifficultyAnalysis => ({
    status: 'unavailable',
    sport: input.sport,
    score: 0,
    level: 1,
    levelLabel: LEVEL_LABELS[0],
    effortKm: 0,
    duration: durationUnavailable(missing),
    factors: [],
    missing,
    warnings,
    method: {
      id: 'lkdv-route-difficulty/1',
      version: ROUTE_ANALYSIS_VERSION,
      formula: 'distance-effort = (km + gain / coefficient) × surface × altitude',
      assumptions: ['Aucun résultat publié sans distance et sans gain exploitables.'],
    },
  });

  if (!isAnalysisSport(input.sport)) {
    return unavailable([
      {
        code: 'unsupported_sport',
        message: `Le sport « ${String(input.sport)} » n'a pas de modèle de difficulté.`,
      },
    ]);
  }

  const distanceM = isFiniteNumber(input.distanceM) ? input.distanceM : Number.NaN;
  if (!Number.isFinite(distanceM) || distanceM <= 0) {
    return unavailable([
      {
        code: 'distance_invalid',
        message: 'La distance est absente ou nulle : la difficulté ne peut pas être calculée.',
      },
    ]);
  }

  const model = sportModel(input.sport);
  const gainM = isFiniteNumber(input.gainM) ? Math.max(0, input.gainM) : null;
  const lossM = isFiniteNumber(input.lossM) ? Math.max(0, input.lossM) : null;
  const missing: AnalysisGap[] = [];
  const warnings: AnalysisWarning[] = [];

  if (gainM === null && model.gainMForEffortKm !== null) {
    return unavailable([
      {
        code: 'elevation_missing',
        message: 'Le dénivelé positif est absent : aucune difficulté ne peut être publiée sans lui.',
      },
    ]);
  }
  if (gainM === null) {
    warnings.push({
      code: 'elevation_not_applicable',
      message: 'Ce sport ne prend pas le dénivelé en compte : le gain absent reste sans effet.',
      severity: 'info',
    });
  }
  if (lossM === null && gainM !== null) {
    missing.push({
      code: 'descent_missing',
      message: 'Le dénivelé négatif est absent : le temps de descente est compté à zéro.',
    });
  }

  const breakMinutes = isFiniteNumber(input.breakMinutes)
    ? clamp(input.breakMinutes, 0, 24 * 60)
    : 0;

  const athlete = input.athlete ?? null;
  const athleteFlatSpeed = validSpeed(athlete?.flatSpeedKmH, 1, 80);
  const athleteAscent = validSpeed(athlete?.ascentMPerH, 50, 3000);
  const athleteDescent = validSpeed(athlete?.descentMPerH, 50, 3000);
  if (athlete && athlete.flatSpeedKmH != null && athleteFlatSpeed === null) {
    warnings.push({
      code: 'athlete_speed_invalid',
      message: 'La vitesse personnelle est hors bornes : le modèle standard est utilisé.',
      severity: 'info',
    });
  }
  if (athlete && athlete.ascentMPerH != null && athleteAscent === null) {
    warnings.push({
      code: 'athlete_ascent_invalid',
      message: "Le débit d'ascension personnel est hors bornes : le modèle standard est utilisé.",
      severity: 'info',
    });
  }

  const flatSpeedKmH = athleteFlatSpeed ?? model.flatSpeedKmH;
  const ascentMPerH = athleteAscent ?? model.ascentMPerH;
  const descentMPerH = athleteDescent ?? model.descentMPerH;
  const personalized = Boolean(athleteFlatSpeed || athleteAscent || athleteDescent);
  const distanceKm = distanceM / 1000;
  const ascentM = gainM ?? 0;
  const descentM = lossM ?? 0;

  const flatHours = flatSpeedKmH > 0 ? distanceKm / flatSpeedKmH : Number.POSITIVE_INFINITY;
  const ascentHours = ascentMPerH > 0 ? ascentM / ascentMPerH : 0;
  const descentHours = descentMPerH > 0 ? descentM / descentMPerH : 0;

  let surfaceMultiplier = 1;
  let surfaceCoverage = 0;
  if (input.surface && input.surface.status !== 'unavailable') {
    surfaceCoverage = input.surface.coverage;
    for (const share of input.surface.shares) {
      if (share.category === 'ferry') {
        missing.push({
          code: 'ferry_time_unknown',
          message: 'La traversée en ferry a un temps inconnu : la durée est sous-estimée.',
        });
        continue;
      }
      surfaceMultiplier += share.shareOfRoute * (SURFACE_MULTIPLIERS[share.category] - 1);
    }
    if (input.surface.unknownLengthM > 0) {
      warnings.push({
        code: 'surface_partial',
        message: `${round(input.surface.unknownLengthM, 0)} m sans surface étiquetée ne sont pas pénalisés.`,
        severity: 'info',
      });
    }
  } else {
    warnings.push({
      code: 'surface_not_provided',
      message: 'Aucune surface étiquetée : la durée ne reçoit pas de correction de terrain.',
      severity: 'info',
    });
  }

  const maxAltitudeM = isFiniteNumber(input.maxAltitudeM) ? input.maxAltitudeM : null;
  const altitudeFactor =
    maxAltitudeM !== null && maxAltitudeM > 2000
      ? 1 + Math.min(0.3, ((maxAltitudeM - 2000) / 1000) * 0.08)
      : 1;

  const climbCategories = input.climbs
    ? [...input.climbs.climbs, ...input.climbs.descents].map((section) => section.category)
    : [];
  const maxClimbCategory = climbCategories.length > 0 ? Math.max(...climbCategories) : 0;
  const climbTechnicalFactor = 1 + Math.max(0, maxClimbCategory - 3) * 0.04;

  const movingHours =
    (flatHours + ascentHours * model.ascentWeight + descentHours * model.descentWeight) *
    surfaceMultiplier *
    altitudeFactor *
    climbTechnicalFactor;
  const totalHours = movingHours + breakMinutes / 60;
  const totalSeconds = Number.isFinite(totalHours) ? Math.max(0, Math.round(totalHours * 3600)) : null;

  const gainEffortKm = model.gainMForEffortKm
    ? ascentM / model.gainMForEffortKm
    : 0;
  const effortKm =
    (distanceKm + gainEffortKm) * surfaceMultiplier * altitudeFactor * climbTechnicalFactor;
  const level = levelFor(effortKm, model.difficultyThresholdsKm);
  const score = clamp(Math.round((effortKm / model.difficultyThresholdsKm[3]) * 100), 0, 100);

  const factors: DifficultyFactor[] = [
    {
      id: 'distance',
      label: 'Distance',
      value: round(distanceKm, 2),
      unit: 'km',
      contributionMinutes: round(flatHours * 60, 0),
    },
    {
      id: 'ascent',
      label: 'Montée',
      value: round(ascentM, 0),
      unit: 'm',
      contributionMinutes: round(ascentHours * model.ascentWeight * 60, 0),
    },
    {
      id: 'descent',
      label: 'Descente',
      value: round(descentM, 0),
      unit: 'm',
      contributionMinutes: round(descentHours * model.descentWeight * 60, 0),
    },
    {
      id: 'surface',
      label: 'Terrain',
      value: round(surfaceCoverage * 100, 0),
      unit: '% étiqueté',
      contributionMinutes: round((surfaceMultiplier - 1) * flatHours * 60, 0),
    },
    {
      id: 'climb_technical',
      label: 'Montée technique',
      value: maxClimbCategory,
      unit: 'catégorie',
      contributionMinutes: round((climbTechnicalFactor - 1) * movingHours * 60, 0),
    },
    {
      id: 'altitude',
      label: 'Altitude',
      value: maxAltitudeM === null ? 0 : round(maxAltitudeM, 0),
      unit: 'm',
      contributionMinutes: round((altitudeFactor - 1) * movingHours * 60, 0),
    },
    {
      id: 'breaks',
      label: 'Pauses',
      value: round(breakMinutes, 0),
      unit: 'min',
      contributionMinutes: round(breakMinutes, 0),
    },
  ];

  const durationStatus: AnalysisStatus =
    totalSeconds === null || missing.length > 0 ? 'partial' : 'available';

  return {
    status: missing.length > 0 ? 'partial' : 'available',
    sport: input.sport,
    score,
    level,
    levelLabel: LEVEL_LABELS[level - 1],
    effortKm: round(effortKm, 1),
    duration: {
      status: durationStatus,
      seconds: totalSeconds,
      hours: totalSeconds === null ? null : round(totalSeconds / 3600, 2),
      personalized,
      basis: personalized ? 'personal' : 'standard',
      factors,
      missing: [...missing],
    },
    factors,
    missing,
    warnings,
    method: {
      id: 'lkdv-route-difficulty/1',
      version: ROUTE_ANALYSIS_VERSION,
      formula:
        'temps = distance / vitesse + montée / débit × poids + descente / débit × poids, puis surface et altitude',
      assumptions: [
        `Modèle ${input.sport} : ${flatSpeedKmH} km/h à plat, ${ascentMPerH} m/h en montée, ${descentMPerH} m/h en descente.`,
        'Le dénivelé négatif absent est compté à zéro et la durée est alors partielle.',
        'Une durée standard n’est jamais présentée comme personnelle.',
      ],
    },
  };
}
