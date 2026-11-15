/**
 * K2.20 · Détection et classement des montées et descentes.
 *
 * Le profil altimétrique est découpé en pivots (sommet, creux) avec un seuil
 * de retournement, puis les portions plates en tête et en queue sont retirées.
 * Une montée n'est publiée que si son gain, sa pente moyenne et sa longueur
 * dépassent les seuils du sport. Les trous d'altitude coupent l'analyse : ils
 * ne sont jamais comblés.
 */
import {
  isFiniteNumber,
  isAnalysisSport,
  type AnalysisGap,
  type AnalysisSport,
  type AnalysisStatus,
  type AnalysisWarning,
  type ProfileSample,
} from './types';
import { clamp, round } from './geo';
import { sportModel } from './sportProfiles';

export type GradientKind = 'climb' | 'descent';

export interface ClimbAnalysisInput {
  readonly profile?: readonly ProfileSample[] | null;
  readonly sport: AnalysisSport;
  /** Gain minimal publié (m). Défaut : quart du premier seuil du sport. */
  readonly minGainM?: number | null;
  /** Pente moyenne minimale (%). */
  readonly minGradePct?: number | null;
  readonly minLengthM?: number | null;
  /** Au-delà, un trou de distance coupe le profil. */
  readonly maxGapM?: number | null;
  /** Retournement d'altitude qui confirme un pivot (m). */
  readonly reversalM?: number | null;
}

export interface GradientSection {
  readonly id: string;
  readonly kind: GradientKind;
  readonly fromM: number;
  readonly toM: number;
  readonly lengthM: number;
  readonly gainM: number;
  readonly lossM: number;
  /** Pente moyenne signée : positive en montée, négative en descente. */
  readonly avgGradePct: number;
  readonly maxGradePct: number;
  readonly minElevationM: number;
  readonly maxElevationM: number;
  /** 1 (facile) à 5 (très difficile), seuils propres au sport. */
  readonly category: 1 | 2 | 3 | 4 | 5;
  readonly categoryLabel: string;
}

export interface ClimbAnalysis {
  readonly status: AnalysisStatus;
  readonly sport: AnalysisSport;
  readonly climbs: GradientSection[];
  readonly descents: GradientSection[];
  readonly totalGainM: number;
  readonly totalLossM: number;
  /** Part de la distance du profil couverte par des altitudes finies. */
  readonly elevationCoverage: number;
  readonly missing: AnalysisGap[];
  readonly warnings: AnalysisWarning[];
}

interface CleanSample {
  readonly distanceM: number;
  readonly elevationM: number;
}

const CATEGORY_LABELS = ['Facile', 'Modérée', 'Soutenue', 'Difficile', 'Très difficile'] as const;
const MAX_PUBLISHED_GRADE_PCT = 60;

function cleanRuns(
  profile: readonly ProfileSample[],
  maxGapM: number
): { runs: CleanSample[][]; totalSpanM: number; invalidCount: number; gapCount: number } {
  const ordered = profile
    .filter((sample) => isFiniteNumber(sample.distanceM) && sample.distanceM >= 0)
    .slice()
    .sort((a, b) => a.distanceM - b.distanceM);

  const runs: CleanSample[][] = [];
  let current: CleanSample[] = [];
  let invalidCount = 0;
  let gapCount = 0;
  let previousDistance: number | null = null;

  const flush = () => {
    if (current.length >= 2) runs.push(current);
    current = [];
  };

  for (const sample of ordered) {
    if (previousDistance !== null && sample.distanceM - previousDistance > maxGapM) {
      gapCount += 1;
      flush();
    }
    previousDistance = sample.distanceM;
    if (!isFiniteNumber(sample.elevationM)) {
      invalidCount += 1;
      flush();
      continue;
    }
    current.push({ distanceM: sample.distanceM, elevationM: sample.elevationM });
  }
  flush();

  const allDistances = ordered.map((sample) => sample.distanceM);
  const totalSpanM =
    allDistances.length >= 2 ? allDistances[allDistances.length - 1] - allDistances[0] : 0;

  return { runs, totalSpanM, invalidCount, gapCount };
}

function detectPivots(samples: readonly CleanSample[], reversalM: number): number[] {
  if (samples.length < 2) return [];
  const pivots: number[] = [0];
  let direction: 1 | -1 | 0 = 0;
  let extreme = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const elevation = samples[index].elevationM;
    const extremeElevation = samples[extreme].elevationM;

    if (direction === 0) {
      const delta = elevation - extremeElevation;
      if (Math.abs(delta) >= reversalM) {
        direction = delta > 0 ? 1 : -1;
        extreme = index;
      }
      continue;
    }

    if (direction === 1) {
      if (elevation > extremeElevation) {
        extreme = index;
      } else if (extremeElevation - elevation >= reversalM) {
        if (extreme > pivots[pivots.length - 1]) pivots.push(extreme);
        direction = -1;
        extreme = index;
      }
    } else if (elevation < extremeElevation) {
      extreme = index;
    } else if (elevation - extremeElevation >= reversalM) {
      if (extreme > pivots[pivots.length - 1]) pivots.push(extreme);
      direction = 1;
      extreme = index;
    }
  }

  if (extreme > pivots[pivots.length - 1]) pivots.push(extreme);
  const last = samples.length - 1;
  if (last > pivots[pivots.length - 1]) pivots.push(last);
  return pivots;
}

function trimFlatEdges(
  samples: readonly CleanSample[],
  from: number,
  to: number,
  kind: GradientKind
): [number, number] {
  const toleranceM = 2;
  const startElevation = samples[from].elevationM;
  const endElevation = samples[to].elevationM;

  if (kind === 'climb') {
    let start = from;
    for (let index = from + 1; index <= to; index += 1) {
      if (samples[index].elevationM >= startElevation + toleranceM) {
        start = Math.max(from, index - 1);
        break;
      }
    }
    let end = to;
    for (let index = to - 1; index >= start; index -= 1) {
      if (samples[index].elevationM <= endElevation - toleranceM) {
        end = Math.min(to, index + 1);
        break;
      }
    }
    return end > start ? [start, end] : [from, to];
  }

  let start = from;
  for (let index = from + 1; index <= to; index += 1) {
    if (samples[index].elevationM <= startElevation - toleranceM) {
      start = Math.max(from, index - 1);
      break;
    }
  }
  let end = to;
  for (let index = to - 1; index >= start; index -= 1) {
    if (samples[index].elevationM >= endElevation + toleranceM) {
      end = Math.min(to, index + 1);
      break;
    }
  }
  return end > start ? [start, end] : [from, to];
}

function maxWindowGrade(
  samples: readonly CleanSample[],
  from: number,
  to: number
): number {
  let maxGrade = 0;
  for (let start = from; start < to; start += 1) {
    let distanceM = 0;
    let end = start;
    while (end + 1 <= to && distanceM < 50) {
      distanceM += samples[end + 1].distanceM - samples[end].distanceM;
      end += 1;
    }
    if (distanceM <= 0) continue;
    const grade = Math.abs(
      ((samples[end].elevationM - samples[start].elevationM) / distanceM) * 100
    );
    if (Number.isFinite(grade)) maxGrade = Math.max(maxGrade, grade);
  }
  return round(clamp(maxGrade, 0, MAX_PUBLISHED_GRADE_PCT), 1);
}

function categoryFor(
  effortGainM: number,
  thresholds: readonly [number, number, number, number]
): 1 | 2 | 3 | 4 | 5 {
  if (effortGainM < thresholds[0]) return 1;
  if (effortGainM < thresholds[1]) return 2;
  if (effortGainM < thresholds[2]) return 3;
  if (effortGainM < thresholds[3]) return 4;
  return 5;
}

function buildSection(
  samples: readonly CleanSample[],
  from: number,
  to: number,
  kind: GradientKind,
  sport: AnalysisSport,
  index: number
): GradientSection | null {
  let gainM = 0;
  let lossM = 0;
  let minElevationM = samples[from].elevationM;
  let maxElevationM = samples[from].elevationM;

  for (let cursor = from + 1; cursor <= to; cursor += 1) {
    const previous = samples[cursor - 1].elevationM;
    const current = samples[cursor].elevationM;
    const delta = current - previous;
    if (delta > 0) gainM += delta;
    else if (delta < 0) lossM += -delta;
    minElevationM = Math.min(minElevationM, current);
    maxElevationM = Math.max(maxElevationM, current);
  }

  const lengthM = samples[to].distanceM - samples[from].distanceM;
  if (lengthM <= 0) return null;
  const netElevationM = samples[to].elevationM - samples[from].elevationM;
  const avgGradePct = round((netElevationM / lengthM) * 100, 1);
  const absoluteGrade = Math.abs(avgGradePct);
  const effortGainM =
    (kind === 'climb' ? gainM : lossM) * (1 + Math.max(0, absoluteGrade - 6) / 20);
  const thresholds = sportModel(sport).climbThresholdsM;
  const category = categoryFor(effortGainM, thresholds);

  return {
    id: `${kind}-${index}`,
    kind,
    fromM: round(samples[from].distanceM, 1),
    toM: round(samples[to].distanceM, 1),
    lengthM: round(lengthM, 1),
    gainM: round(gainM, 1),
    lossM: round(lossM, 1),
    avgGradePct,
    maxGradePct: maxWindowGrade(samples, from, to),
    minElevationM: round(minElevationM, 1),
    maxElevationM: round(maxElevationM, 1),
    category,
    categoryLabel: CATEGORY_LABELS[category - 1],
  };
}

export function analyzeClimbs(input: ClimbAnalysisInput): ClimbAnalysis {
  const empty = (missing: AnalysisGap[], warnings: AnalysisWarning[] = []): ClimbAnalysis => ({
    status: 'unavailable',
    sport: input.sport,
    climbs: [],
    descents: [],
    totalGainM: 0,
    totalLossM: 0,
    elevationCoverage: 0,
    missing,
    warnings,
  });

  if (!isAnalysisSport(input.sport)) {
    return empty([
      {
        code: 'unsupported_sport',
        message: `Le sport « ${String(input.sport)} » n'a pas de modèle de montée.`,
      },
    ]);
  }

  const profile = input.profile ?? [];
  if (profile.length < 2) {
    return empty([
      {
        code: 'elevation_profile_unavailable',
        message: 'Le profil altimétrique est absent ou trop court pour délimiter une montée.',
      },
    ]);
  }

  const model = sportModel(input.sport);
  const maxGapM = isFiniteNumber(input.maxGapM) ? Math.max(50, input.maxGapM) : 250;
  const reversalM = isFiniteNumber(input.reversalM) ? Math.max(1, input.reversalM) : 8;
  const minGainM = isFiniteNumber(input.minGainM)
    ? Math.max(1, input.minGainM)
    : Math.max(20, model.climbThresholdsM[0] / 4);
  const minGradePct = isFiniteNumber(input.minGradePct) ? Math.max(0, input.minGradePct) : 2;
  const minLengthM = isFiniteNumber(input.minLengthM) ? Math.max(1, input.minLengthM) : 100;

  const { runs, totalSpanM, invalidCount, gapCount } = cleanRuns(profile, maxGapM);
  if (runs.length === 0) {
    return empty([
      {
        code: 'elevation_profile_unavailable',
        message: 'Aucun segment continu avec altitudes : les montées ne peuvent pas être délimitées.',
      },
    ]);
  }

  const warnings: AnalysisWarning[] = [];
  if (invalidCount > 0) {
    warnings.push({
      code: 'elevation_holes',
      message: `${invalidCount} point(s) sans altitude : le profil est coupé à ces endroits.`,
      severity: 'info',
    });
  }
  if (gapCount > 0) {
    warnings.push({
      code: 'elevation_distance_gap',
      message: `${gapCount} trou(s) de distance supérieur(s) à ${maxGapM} m coupent le profil.`,
      severity: 'info',
    });
  }

  const climbs: GradientSection[] = [];
  const descents: GradientSection[] = [];
  let totalGainM = 0;
  let totalLossM = 0;
  let coveredM = 0;
  let climbIndex = 0;
  let descentIndex = 0;

  for (const run of runs) {
    coveredM += run[run.length - 1].distanceM - run[0].distanceM;
    for (let index = 1; index < run.length; index += 1) {
      const delta = run[index].elevationM - run[index - 1].elevationM;
      if (delta > 0) totalGainM += delta;
      else if (delta < 0) totalLossM += -delta;
    }

    const pivots = detectPivots(run, reversalM);
    for (let index = 0; index + 1 < pivots.length; index += 1) {
      const rawFrom = pivots[index];
      const rawTo = pivots[index + 1];
      if (rawTo <= rawFrom) continue;
      const net = run[rawTo].elevationM - run[rawFrom].elevationM;
      if (net === 0) continue;
      const kind: GradientKind = net > 0 ? 'climb' : 'descent';
      const [from, to] = trimFlatEdges(run, rawFrom, rawTo, kind);
      if (to <= from) continue;

      const section = buildSection(run, from, to, kind, input.sport, kind === 'climb' ? climbIndex + 1 : descentIndex + 1);
      if (!section) continue;
      const publishedGainM = kind === 'climb' ? section.gainM : section.lossM;
      if (
        publishedGainM < minGainM ||
        section.lengthM < minLengthM ||
        Math.abs(section.avgGradePct) < minGradePct
      ) {
        continue;
      }
      if (kind === 'climb') {
        climbIndex += 1;
        climbs.push({ ...section, id: `climb-${climbIndex}` });
      } else {
        descentIndex += 1;
        descents.push({ ...section, id: `descent-${descentIndex}` });
      }
    }
  }

  const elevationCoverage = totalSpanM > 0 ? Math.min(1, coveredM / totalSpanM) : 0;
  const missing: AnalysisGap[] = [];
  if (elevationCoverage < 0.999) {
    missing.push({
      code: 'elevation_coverage_incomplete',
      message: `${round(elevationCoverage * 100, 0)} % de la distance du profil porte une altitude.`,
    });
  }

  return {
    status: elevationCoverage < 0.999 ? 'partial' : 'available',
    sport: input.sport,
    climbs,
    descents,
    totalGainM: round(totalGainM, 1),
    totalLossM: round(totalLossM, 1),
    elevationCoverage: round(elevationCoverage, 4),
    missing,
    warnings,
  };
}
