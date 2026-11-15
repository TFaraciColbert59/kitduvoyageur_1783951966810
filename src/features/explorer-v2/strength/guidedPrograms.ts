import type { MuscleGroupId } from './muscles';

export type MovementAnimationKey = 'squat' | 'pushup' | 'plank' | 'lunge' | 'row' | 'hinge';

export interface GuidedStrengthStep {
  id: string;
  name: string;
  sets: number;
  repsLabel: string;
  defaultReps: number;
  suggestedLoadKg: number | null;
  restS: number;
  muscles: MuscleGroupId[];
  coachingCue: string;
  movementKey: MovementAnimationKey;
}

export interface GuidedStrengthProgram {
  id: string;
  title: string;
  goalLabel: string;
  level: 'débutant' | 'intermédiaire' | 'avancé';
  estimatedMin: number;
  summary: string;
  steps: GuidedStrengthStep[];
}

export const GUIDED_STRENGTH_PROGRAMS: GuidedStrengthProgram[] = [
  {
    id: 'trail-knees-strength',
    title: 'Renfo Trail & Montagne',
    goalLabel: 'Stabilité genoux & puissance côte',
    level: 'intermédiaire',
    estimatedMin: 25,
    summary: 'Renforcement ciblé quadriceps, fessiers, ischios et mollets pour encaisser le dénivelé.',
    steps: [
      {
        id: 'step-squat',
        name: 'Squat goblet',
        sets: 4,
        repsLabel: '10 rép.',
        defaultReps: 10,
        suggestedLoadKg: null,
        restS: 60,
        muscles: ['quadriceps', 'fessiers'],
        coachingCue: 'Genoux dans l’axe des orteils, dos gainé, descente contrôlée sur 2 s.',
        movementKey: 'squat',
      },
      {
        id: 'step-lunge',
        name: 'Fentes alternées',
        sets: 3,
        repsLabel: '12 rép. / jambe',
        defaultReps: 12,
        suggestedLoadKg: null,
        restS: 60,
        muscles: ['quadriceps', 'fessiers', 'ischios'],
        coachingCue: 'Buste droit, poussée franche dans le talon avant.',
        movementKey: 'lunge',
      },
      {
        id: 'step-hinge',
        name: 'Soulevé de terre une jambe',
        sets: 3,
        repsLabel: '8 rép. / côté',
        defaultReps: 8,
        suggestedLoadKg: null,
        restS: 45,
        muscles: ['ischios', 'fessiers', 'abdos'],
        coachingCue: 'Bassin parallèle au sol, dos plat tout le long de la flexion.',
        movementKey: 'hinge',
      },
      {
        id: 'step-calf',
        name: 'Extensions mollets sur marche',
        sets: 3,
        repsLabel: '15 rép.',
        defaultReps: 15,
        suggestedLoadKg: null,
        restS: 45,
        muscles: ['mollets'],
        coachingCue: 'Amplitude complète avec 1 s de pause en haut et descente lente.',
        movementKey: 'squat',
      },
    ],
  },
  {
    id: 'full-body-push-pull',
    title: 'Full Body Polyvalent',
    goalLabel: 'Force générale haut & bas',
    level: 'débutant',
    estimatedMin: 30,
    summary: 'Équilibre poussée, tirage, flexion de jambes et gainage profond.',
    steps: [
      {
        id: 'fb-push',
        name: 'Pompes contrôlées',
        sets: 3,
        repsLabel: '10 rép.',
        defaultReps: 10,
        suggestedLoadKg: null,
        restS: 60,
        muscles: ['pectoraux', 'triceps', 'epaules'],
        coachingCue: 'Coudes à 45° du buste, corps aligné des talons à la nuque.',
        movementKey: 'pushup',
      },
      {
        id: 'fb-row',
        name: 'Rowing haltères ou élastique',
        sets: 3,
        repsLabel: '12 rép.',
        defaultReps: 12,
        suggestedLoadKg: null,
        restS: 60,
        muscles: ['dos', 'biceps'],
        coachingCue: 'Resserre les omoplates en haut sans hausser les épaules.',
        movementKey: 'row',
      },
      {
        id: 'fb-squat',
        name: 'Squat poids du corps',
        sets: 3,
        repsLabel: '12 rép.',
        defaultReps: 12,
        suggestedLoadKg: null,
        restS: 60,
        muscles: ['quadriceps', 'fessiers'],
        coachingCue: 'Appui réparti sur tout le pied, regard loin devant.',
        movementKey: 'squat',
      },
      {
        id: 'fb-plank',
        name: 'Gainage planche',
        sets: 3,
        repsLabel: '40 s',
        defaultReps: 1,
        suggestedLoadKg: null,
        restS: 45,
        muscles: ['abdos', 'epaules'],
        coachingCue: 'Rétroversion légère du bassin, respiration régulière sans creuser.',
        movementKey: 'plank',
      },
    ],
  },
];
