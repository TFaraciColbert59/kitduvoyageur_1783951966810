import type { StrengthLog } from '../state/types';
import { strengthExerciseTotals } from './model';

export type MuscleGroupId =
  | 'pectoraux'
  | 'dos'
  | 'epaules'
  | 'biceps'
  | 'triceps'
  | 'abdos'
  | 'quadriceps'
  | 'ischios'
  | 'fessiers'
  | 'mollets'
  | 'avant_bras';

export const MUSCLE_LABELS: Record<MuscleGroupId, string> = {
  pectoraux: 'Pectoraux',
  dos: 'Dos & dorsaux',
  epaules: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  abdos: 'Abdominaux & gainage',
  quadriceps: 'Quadriceps',
  ischios: 'Ischio-jambiers',
  fessiers: 'Fessiers',
  mollets: 'Mollets',
  avant_bras: 'Avant-bras',
};

interface MuscleMappingRule {
  keywords: string[];
  primary: MuscleGroupId[];
  secondary: MuscleGroupId[];
}

const MUSCLE_RULES: MuscleMappingRule[] = [
  {
    keywords: ['developpe couche', 'bench press', 'pompe', 'push up', 'push-up', 'ecarte', 'chest press', 'pec'],
    primary: ['pectoraux'],
    secondary: ['triceps', 'epaules'],
  },
  {
    keywords: ['developpe incline', 'incline bench', 'incline press'],
    primary: ['pectoraux', 'epaules'],
    secondary: ['triceps'],
  },
  {
    keywords: ['developpe militaire', 'overhead press', 'shoulder press', 'elevation laterale', 'lateral raise', 'oiseau'],
    primary: ['epaules'],
    secondary: ['triceps', 'abdos'],
  },
  {
    keywords: ['traction', 'pull up', 'pull-up', 'chin up', 'tirage', 'lat pulldown', 'rowing', 'barbell row', 'bucheron'],
    primary: ['dos'],
    secondary: ['biceps', 'avant_bras', 'epaules'],
  },
  {
    keywords: ['souleve de terre', 'deadlift', 'rdl', 'souleve jambes tendues'],
    primary: ['ischios', 'fessiers', 'dos'],
    secondary: ['quadriceps', 'avant_bras', 'abdos'],
  },
  {
    keywords: ['squat', 'goblet', 'front squat', 'presse a cuisse', 'leg press', 'chaise'],
    primary: ['quadriceps', 'fessiers'],
    secondary: ['abdos', 'ischios'],
  },
  {
    keywords: ['fente', 'lunge', 'bulgarian', 'bulgare', 'step up', 'montee sur banc'],
    primary: ['quadriceps', 'fessiers'],
    secondary: ['ischios', 'mollets'],
  },
  {
    keywords: ['hip thrust', 'pont fessier', 'glute bridge'],
    primary: ['fessiers'],
    secondary: ['ischios', 'abdos'],
  },
  {
    keywords: ['leg curl', 'nordic', 'curl ischio'],
    primary: ['ischios'],
    secondary: ['fessiers', 'mollets'],
  },
  {
    keywords: ['mollet', 'calf', 'extension cheville'],
    primary: ['mollets'],
    secondary: [],
  },
  {
    keywords: ['curl', 'biceps', 'marteau', 'hammer'],
    primary: ['biceps'],
    secondary: ['avant_bras'],
  },
  {
    keywords: ['dips', 'triceps', 'barre au front', 'skullcrusher', 'pushdown'],
    primary: ['triceps'],
    secondary: ['pectoraux', 'epaules'],
  },
  {
    keywords: ['gainage', 'planche', 'plank', 'crunch', 'abdo', 'russian twist', 'hollow', 'pallof'],
    primary: ['abdos'],
    secondary: ['epaules'],
  },
];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function resolveExerciseMuscles(exerciseName: string): {
  primary: MuscleGroupId[];
  secondary: MuscleGroupId[];
  matched: boolean;
} {
  const norm = normalizeText(exerciseName);
  for (const rule of MUSCLE_RULES) {
    if (rule.keywords.some((kw) => norm.includes(kw))) {
      return {
        primary: rule.primary,
        secondary: rule.secondary,
        matched: true,
      };
    }
  }
  return { primary: [], secondary: [], matched: false };
}

export interface MuscleScoreItem {
  id: MuscleGroupId;
  label: string;
  role: 'primary' | 'secondary';
  weightedScore: number;
  intensity: number; // 0..1
  sets: number;
  volumeKg: number | null;
}

export interface MuscleHeatmapSummary {
  muscles: MuscleScoreItem[];
  scoreByMuscle: Record<MuscleGroupId, number>;
  unmappedExercises: string[];
  totalSets: number;
}

export function computeMuscleHeatmap(log: StrengthLog | null | undefined): MuscleHeatmapSummary {
  const emptyScores: Record<MuscleGroupId, number> = {
    pectoraux: 0,
    dos: 0,
    epaules: 0,
    biceps: 0,
    triceps: 0,
    abdos: 0,
    quadriceps: 0,
    ischios: 0,
    fessiers: 0,
    mollets: 0,
    avant_bras: 0,
  };

  if (!log || log.exercises.length === 0) {
    return {
      muscles: [],
      scoreByMuscle: emptyScores,
      unmappedExercises: [],
      totalSets: 0,
    };
  }

  const acc = new Map<
    MuscleGroupId,
    { score: number; primaryHits: number; sets: number; volumeKg: number; hasLoad: boolean }
  >();
  const unmappedExercises: string[] = [];
  let totalSets = 0;

  for (const exercise of log.exercises) {
    const totals = strengthExerciseTotals(exercise);
    const setsCount = Math.max(1, totals.sets);
    totalSets += totals.sets;
    const mapping = resolveExerciseMuscles(exercise.name);
    if (!mapping.matched) {
      unmappedExercises.push(exercise.name);
      continue;
    }

    const applyHit = (muscle: MuscleGroupId, weight: number, isPrimary: boolean) => {
      const current = acc.get(muscle) ?? {
        score: 0,
        primaryHits: 0,
        sets: 0,
        volumeKg: 0,
        hasLoad: false,
      };
      current.score += setsCount * weight;
      if (isPrimary) current.primaryHits += 1;
      current.sets += totals.sets;
      if (totals.volumeKg !== null) {
        current.volumeKg += Math.round(totals.volumeKg * weight);
        current.hasLoad = true;
      }
      acc.set(muscle, current);
    };

    for (const m of mapping.primary) applyHit(m, 1, true);
    for (const m of mapping.secondary) applyHit(m, 0.45, false);
  }

  let maxScore = 0;
  for (const item of acc.values()) {
    if (item.score > maxScore) maxScore = item.score;
  }

  const scoreByMuscle: Record<MuscleGroupId, number> = { ...emptyScores };
  const muscles: MuscleScoreItem[] = [];

  for (const [id, item] of acc.entries()) {
    const intensity = maxScore > 0 ? Math.min(1, Math.round((item.score / maxScore) * 100) / 100) : 0;
    scoreByMuscle[id] = intensity;
    muscles.push({
      id,
      label: MUSCLE_LABELS[id],
      role: item.primaryHits > 0 ? 'primary' : 'secondary',
      weightedScore: Math.round(item.score * 10) / 10,
      intensity,
      sets: item.sets,
      volumeKg: item.hasLoad ? item.volumeKg : null,
    });
  }

  muscles.sort((a, b) => b.intensity - a.intensity || b.sets - a.sets);

  return {
    muscles,
    scoreByMuscle,
    unmappedExercises,
    totalSets,
  };
}
