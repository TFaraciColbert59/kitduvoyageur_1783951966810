/**
 * Courbe de puissance vélo, FTP estimée et Power Skills (A04 · S2.13, S2.14).
 *
 * Règles C-MET :
 *   - distingue strictement puissance mesurée (`measured`) et estimée (`estimated`) ;
 *   - l'intégration glissante respecte les trous temporels (`maxGapMs`) : aucune
 *     pause ou coupure de capteur ne gonfle une moyenne de durée ;
 *   - FTP estimée = 95 % de la meilleure puissance moyenne sur 20 min (1 200 s)
 *     si une fenêtre continue d'au moins 20 min est disponible ; jamais fabriquée
 *     sur une sortie de 5 min ;
 *   - Power Skills (Sprint 5-15 s, Attaque 1-2 min, Montée 5-20 min, Endurance 30-60 min)
 *     évaluent le profil relatif du cycliste (Sprinter, Puncheur, Grimpeur,
 *     Rouleur, Polyvalent) sans inventer de poids s'il n'est pas fourni.
 */

export const POWER_CURVE_METHOD = 'mmp-gap-aware-v1' as const;
export const FTP_ESTIMATION_METHOD = '95pct-mmp20-v1' as const;
export const POWER_SKILLS_METHOD = 'cycling-power-skills-v1' as const;

export const POWER_CURVE_DURATIONS_S = [
  5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600,
] as const;

export type PowerDurationS = (typeof POWER_CURVE_DURATIONS_S)[number];

export interface TimedPowerSample {
  readonly atMs: number;
  readonly watts: number | null;
  readonly quality?: 'measured' | 'estimated';
}

export interface PowerCurvePoint {
  readonly durationS: number;
  readonly label: string;
  readonly watts: number;
  readonly wPerKg: number | null;
  readonly startMs: number;
  readonly endMs: number;
  readonly quality: 'measured' | 'estimated';
}

export interface PowerCurveResult {
  readonly status: 'available' | 'unavailable';
  readonly method: typeof POWER_CURVE_METHOD;
  readonly quality: 'measured' | 'estimated' | null;
  readonly reason: string | null;
  readonly totalActiveDurationS: number;
  readonly points: readonly PowerCurvePoint[];
}

export interface EstimatedFtpResult {
  readonly status: 'available' | 'unavailable';
  readonly ftpW: number | null;
  readonly mmp20MinW: number | null;
  readonly wPerKg: number | null;
  readonly quality: 'estimated' | null;
  readonly sourceQuality: 'measured' | 'estimated' | null;
  readonly method: typeof FTP_ESTIMATION_METHOD;
  readonly reason: string | null;
}

export interface PowerCurveComparisonItem {
  readonly durationS: number;
  readonly label: string;
  readonly currentW: number | null;
  readonly baselineW: number | null;
  readonly deltaW: number | null;
  readonly deltaPct: number | null;
}

export type CyclingSkillAxis = 'sprint' | 'attaque' | 'montee' | 'endurance';
export type CyclingProfileKind =
  | 'Sprinter'
  | 'Puncheur'
  | 'Grimpeur'
  | 'Rouleur'
  | 'Polyvalent';

export interface PowerSkillScore {
  readonly axis: CyclingSkillAxis;
  readonly label: string;
  readonly durationHint: string;
  readonly watts: number | null;
  readonly wPerKg: number | null;
  readonly score: number | null;
  readonly levelLabel: string;
}

export interface PowerSkillsResult {
  readonly status: 'available' | 'unavailable';
  readonly method: typeof POWER_SKILLS_METHOD;
  readonly profile: CyclingProfileKind | null;
  readonly summary: string;
  readonly weightUsedKg: number | null;
  readonly weightIsReference: boolean;
  readonly quality: 'measured' | 'estimated' | null;
  readonly skills: readonly PowerSkillScore[];
}

const DURATION_LABELS: Record<number, string> = {
  5: '5 s',
  15: '15 s',
  30: '30 s',
  60: '1 min',
  120: '2 min',
  300: '5 min',
  600: '10 min',
  1200: '20 min',
  1800: '30 min',
  3600: '1 h',
};

export function formatDurationLabel(seconds: number): string {
  if (DURATION_LABELS[seconds]) return DURATION_LABELS[seconds];
  if (seconds < 60) return `${seconds} s`;
  if (seconds % 3600 === 0) return `${seconds / 3600} h`;
  return `${Math.round(seconds / 60)} min`;
}

/**
 * Découpe la série en segments continus (sans trou > `maxGapMs` ni `null`),
 * puis calcule le maximum de moyenne pondérée par durée sur chaque fenêtre
 * glissante de largeur `durationS * 1000`.
 */
export function computePowerCurve(
  samples: readonly TimedPowerSample[],
  options: {
    durationsS?: readonly number[];
    maxGapMs?: number;
    bodyWeightKg?: number | null;
  } = {},
): PowerCurveResult {
  const durations = options.durationsS ?? POWER_CURVE_DURATIONS_S;
  const maxGapMs = options.maxGapMs ?? 10_000;
  const weightKg =
    typeof options.bodyWeightKg === 'number' &&
    Number.isFinite(options.bodyWeightKg) &&
    options.bodyWeightKg > 20
      ? options.bodyWeightKg
      : null;

  const valid = samples
    .filter(
      (s) =>
        Number.isFinite(s.atMs) &&
        typeof s.watts === 'number' &&
        Number.isFinite(s.watts) &&
        s.watts >= 0,
    )
    .slice()
    .sort((a, b) => a.atMs - b.atMs);

  if (valid.length < 2) {
    return {
      status: 'unavailable',
      method: POWER_CURVE_METHOD,
      quality: null,
      reason: 'Aucune série de puissance suffisante pour tracer une courbe.',
      totalActiveDurationS: 0,
      points: [],
    };
  }

  const anyEstimated = valid.some((s) => s.quality === 'estimated');
  const curveQuality: 'measured' | 'estimated' = anyEstimated ? 'estimated' : 'measured';

  // Construire les runs continus d'intervalles [t_i, t_{i+1}] avec watts_i
  interface Interval {
    startMs: number;
    endMs: number;
    watts: number;
  }
  const runs: Interval[][] = [];
  let currentRun: Interval[] = [];
  let totalActiveMs = 0;

  for (let i = 0; i < valid.length - 1; i += 1) {
    const a = valid[i];
    const b = valid[i + 1];
    const dt = b.atMs - a.atMs;
    if (dt <= 0) continue;
    if (dt > maxGapMs) {
      if (currentRun.length > 0) runs.push(currentRun);
      currentRun = [];
      continue;
    }
    const avgW = ((a.watts as number) + (b.watts as number)) / 2;
    currentRun.push({ startMs: a.atMs, endMs: b.atMs, watts: avgW });
    totalActiveMs += dt;
  }
  if (currentRun.length > 0) runs.push(currentRun);

  if (runs.length === 0 || totalActiveMs < 5_000) {
    return {
      status: 'unavailable',
      method: POWER_CURVE_METHOD,
      quality: null,
      reason: 'Durée continue insuffisante (< 5 s) pour calculer la courbe de puissance.',
      totalActiveDurationS: Math.round(totalActiveMs / 1000),
      points: [],
    };
  }

  const points: PowerCurvePoint[] = [];

  for (const durationS of durations) {
    const windowMs = durationS * 1000;
    let bestAvg = -1;
    let bestStart = 0;
    let bestEnd = 0;

    for (const run of runs) {
      const runTotalMs = run[run.length - 1].endMs - run[0].startMs;
      if (runTotalMs < windowMs) continue;

      // Préfixe cumulatif d'énergie (watt-ms) et de temps (ms)
      // Deux pointeurs sur les extrémités des intervalles
      let leftIdx = 0;
      let leftTrimMs = 0;
      let windowEnergy = 0;
      let windowDuration = 0;

      for (let rightIdx = 0; rightIdx < run.length; rightIdx += 1) {
        const seg = run[rightIdx];
        const segDur = seg.endMs - seg.startMs;
        windowEnergy += seg.watts * segDur;
        windowDuration += segDur;

        while (windowDuration >= windowMs && leftIdx <= rightIdx) {
          const excess = windowDuration - windowMs;
          const leftSeg = run[leftIdx];
          const leftAvail = leftSeg.endMs - leftSeg.startMs - leftTrimMs;

          if (excess < leftAvail) {
            const candidateEnergy = windowEnergy - leftSeg.watts * excess;
            const candidateAvg = candidateEnergy / windowMs;
            if (candidateAvg > bestAvg) {
              bestAvg = candidateAvg;
              bestStart = leftSeg.startMs + leftTrimMs + excess;
              bestEnd = seg.endMs;
            }
            windowEnergy -= leftSeg.watts * excess;
            windowDuration -= excess;
            leftTrimMs += excess;
            break;
          } else {
            // Vérifier la fenêtre exacte qui commence à leftTrimMs si excess === leftAvail
            windowEnergy -= leftSeg.watts * leftAvail;
            windowDuration -= leftAvail;
            leftIdx += 1;
            leftTrimMs = 0;
          }
        }
      }
    }

    if (bestAvg >= 0) {
      const roundedW = Math.round(bestAvg);
      points.push({
        durationS,
        label: formatDurationLabel(durationS),
        watts: roundedW,
        wPerKg: weightKg ? Math.round((roundedW / weightKg) * 100) / 100 : null,
        startMs: bestStart,
        endMs: bestEnd,
        quality: curveQuality,
      });
    }
  }

  return {
    status: points.length > 0 ? 'available' : 'unavailable',
    method: POWER_CURVE_METHOD,
    quality: points.length > 0 ? curveQuality : null,
    reason:
      points.length > 0
        ? null
        : 'Aucune fenêtre continue suffisante pour les durées standard.',
    totalActiveDurationS: Math.round(totalActiveMs / 1000),
    points,
  };
}

export function estimateFtpFromPowerCurve(
  curve: PowerCurveResult,
  bodyWeightKg?: number | null,
): EstimatedFtpResult {
  if (curve.status !== 'available' || curve.points.length === 0) {
    return {
      status: 'unavailable',
      ftpW: null,
      mmp20MinW: null,
      wPerKg: null,
      quality: null,
      sourceQuality: null,
      method: FTP_ESTIMATION_METHOD,
      reason: 'Courbe de puissance indisponible.',
    };
  }

  const mmp20 = curve.points.find((p) => p.durationS === 1200);
  if (!mmp20) {
    return {
      status: 'unavailable',
      ftpW: null,
      mmp20MinW: null,
      wPerKg: null,
      quality: null,
      sourceQuality: curve.quality,
      method: FTP_ESTIMATION_METHOD,
      reason: 'Effort continu d’au moins 20 minutes requis pour estimer la FTP.',
    };
  }

  const ftpW = Math.round(mmp20.watts * 0.95);
  const weightKg =
    typeof bodyWeightKg === 'number' &&
    Number.isFinite(bodyWeightKg) &&
    bodyWeightKg > 20
      ? bodyWeightKg
      : null;

  return {
    status: 'available',
    ftpW,
    mmp20MinW: mmp20.watts,
    wPerKg: weightKg ? Math.round((ftpW / weightKg) * 100) / 100 : mmp20.wPerKg ? Math.round(mmp20.wPerKg * 0.95 * 100) / 100 : null,
    quality: 'estimated',
    sourceQuality: mmp20.quality,
    method: FTP_ESTIMATION_METHOD,
    reason: null,
  };
}

export function comparePowerCurves(
  current: PowerCurveResult,
  baseline: PowerCurveResult,
): PowerCurveComparisonItem[] {
  const byDurationCurrent = new Map(current.points.map((p) => [p.durationS, p.watts]));
  const byDurationBaseline = new Map(baseline.points.map((p) => [p.durationS, p.watts]));

  return POWER_CURVE_DURATIONS_S.map((durationS) => {
    const curr = byDurationCurrent.get(durationS) ?? null;
    const base = byDurationBaseline.get(durationS) ?? null;
    const deltaW = curr !== null && base !== null ? curr - base : null;
    const deltaPct =
      deltaW !== null && base !== null && base > 0
        ? Math.round((deltaW / base) * 1000) / 10
        : null;
    return {
      durationS,
      label: formatDurationLabel(durationS),
      currentW: curr,
      baselineW: base,
      deltaW,
      deltaPct,
    };
  }).filter((row) => row.currentW !== null || row.baselineW !== null);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function skillLevelLabel(score: number | null): string {
  if (score === null) return 'Insuffisant';
  if (score >= 85) return 'Élite amateur';
  if (score >= 70) return 'Solide';
  if (score >= 50) return 'Confirmé';
  if (score >= 30) return 'Intermédiaire';
  return 'Base';
}

/**
 * S2.14 — Profil Power Skills vélo (Sprint, Attaque, Montée, Endurance).
 * Évalue les W/kg par filière physiologique par rapport aux repères Coggan
 * (sans inventer de poids : si le poids manque, normalise sur un gabarit de
 * référence 70 kg en le signalant explicitement).
 */
export function computeCyclingPowerSkills(
  curve: PowerCurveResult,
  options: {
    bodyWeightKg?: number | null;
    ftpW?: number | null;
  } = {},
): PowerSkillsResult {
  if (curve.status !== 'available' || curve.points.length === 0) {
    return {
      status: 'unavailable',
      method: POWER_SKILLS_METHOD,
      profile: null,
      summary: 'Aucune donnée de puissance vélo exploitable pour établir le profil.',
      weightUsedKg: null,
      weightIsReference: false,
      quality: null,
      skills: [],
    };
  }

  const hasExplicitWeight =
    typeof options.bodyWeightKg === 'number' &&
    Number.isFinite(options.bodyWeightKg) &&
    options.bodyWeightKg > 20;
  const weightKg = hasExplicitWeight ? (options.bodyWeightKg as number) : 70;

  const pickBest = (durations: readonly number[]): number | null => {
    const candidates = durations
      .map((d) => curve.points.find((p) => p.durationS === d)?.watts ?? null)
      .filter((w): w is number => w !== null);
    if (candidates.length === 0) return null;
    return Math.max(...candidates);
  };

  // Repères de score 100 (W/kg haut niveau amateur / cat 1)
  const sprintW = pickBest([5, 15]);
  const attackW = pickBest([60, 120]);
  const climbW = pickBest([300, 1200]);
  const enduranceW = pickBest([1800, 3600]) ?? (options.ftpW ?? null);

  const buildSkill = (
    axis: CyclingSkillAxis,
    label: string,
    durationHint: string,
    watts: number | null,
    refWPerKg: number,
  ): PowerSkillScore => {
    if (watts === null) {
      return {
        axis,
        label,
        durationHint,
        watts: null,
        wPerKg: null,
        score: null,
        levelLabel: 'Insuffisant',
      };
    }
    const wPerKg = Math.round((watts / weightKg) * 100) / 100;
    const score = clampScore((wPerKg / refWPerKg) * 100);
    return {
      axis,
      label,
      durationHint,
      watts,
      wPerKg: hasExplicitWeight ? wPerKg : null,
      score,
      levelLabel: skillLevelLabel(score),
    };
  };

  const skills: PowerSkillScore[] = [
    buildSkill('sprint', 'Sprint', '5 s – 15 s', sprintW, 18.0),
    buildSkill('attaque', 'Attaque', '1 min – 2 min', attackW, 8.2),
    buildSkill('montee', 'Montée', '5 min – 20 min', climbW, 5.2),
    buildSkill('endurance', 'Endurance', '30 min – 1 h', enduranceW, 4.4),
  ];

  const scored = skills.filter((s): s is PowerSkillScore & { score: number } => s.score !== null);
  let profile: CyclingProfileKind | null = null;
  if (scored.length > 0) {
    const sorted = scored.slice().sort((a, b) => b.score - a.score);
    const top = sorted[0];
    const second = sorted[1];
    if (second && top.score - second.score <= 6) {
      profile = 'Polyvalent';
    } else if (top.axis === 'sprint') {
      profile = 'Sprinter';
    } else if (top.axis === 'attaque') {
      profile = 'Puncheur';
    } else if (top.axis === 'montee') {
      profile = 'Grimpeur';
    } else {
      profile = 'Rouleur';
    }
  }

  return {
    status: scored.length > 0 ? 'available' : 'unavailable',
    method: POWER_SKILLS_METHOD,
    profile,
    summary: profile
      ? `Profil dominant : ${profile}${!hasExplicitWeight ? ' (normalisé sur 70 kg par défaut)' : ''}.`
      : 'Efforts trop courts pour identifier un profil cycliste.',
    weightUsedKg: weightKg,
    weightIsReference: !hasExplicitWeight,
    quality: curve.quality,
    skills,
  };
}
