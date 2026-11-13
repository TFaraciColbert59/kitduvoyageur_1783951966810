import {
  WORKOUT_CONTRACT_VERSION,
  type RecoveryExercise,
  type RecoveryProgram,
  type Soreness,
  type WorkoutLevel,
  type WorkoutSport,
} from './types';

export interface RecoveryInput {
  lastPracticeAt: string | null;
  sport?: WorkoutSport | null;
  sportStatus?: 'known' | 'unknown' | 'absent';
  soreness?: Soreness | null;
  level?: WorkoutLevel;
  now?: number;
}

const DISCLAIMER =
  'Programme de mobilité générale, sans prescription médicale. Une douleur vive, persistante ou inhabituelle justifie l’avis d’un professionnel de santé.';

const LEVEL_FACTOR: Record<WorkoutLevel, number> = {
  debutant: 0.8,
  intermediaire: 1,
  avance: 1.2,
};

function scaledDuration(baseS: number, level: WorkoutLevel): number {
  const scaled = baseS * LEVEL_FACTOR[level];
  return Math.max(60, Math.round(scaled / 15) * 15);
}

function exercise(
  id: string,
  title: string,
  area: string,
  baseDurationS: number,
  level: WorkoutLevel,
  instructions: string
): RecoveryExercise {
  return {
    id,
    title,
    area,
    durationS: scaledDuration(baseDurationS, level),
    reps: null,
    instructions,
  };
}

function recentExercises(level: WorkoutLevel): RecoveryExercise[] {
  return [
    exercise(
      'respiration',
      'Respiration diaphragmatique',
      'Respiration',
      120,
      level,
      'Assis ou allongé, inspire 4 s par le nez, expire 6 s par la bouche, sans forcer.'
    ),
    exercise(
      'mobilite-hanches',
      'Mobilité des hanches',
      'Hanches',
      240,
      level,
      'Cercles lents et amplitudes confortables, sans rebond ni douleur.'
    ),
    exercise(
      'mollets',
      'Étirement des mollets',
      'Mollets',
      180,
      level,
      'Appui au mur, jambe arrière tendue, talon au sol ; tiens sans rebond.'
    ),
  ];
}

function dayAfterExercises(level: WorkoutLevel): RecoveryExercise[] {
  return [
    ...recentExercises(level),
    exercise(
      'marche-souple',
      'Marche souple',
      'Circulation',
      600,
      level,
      'Marche tranquille, respiration libre ; arrête en cas de douleur.'
    ),
  ];
}

function maintenanceExercises(level: WorkoutLevel): RecoveryExercise[] {
  return [
    exercise(
      'mobilite-thoracique',
      'Mobilité thoracique',
      'Dos',
      180,
      level,
      'Rotations lentes du haut du dos, assis ou à quatre pattes.'
    ),
    exercise(
      'ischio-jambiers',
      'Étirement des ischio-jambiers',
      'Arrière des cuisses',
      240,
      level,
      'Jambe allongée, dos droit, penche-toi sans arrondir le dos.'
    ),
    exercise(
      'respiration',
      'Respiration calme',
      'Respiration',
      120,
      level,
      'Respire lentement, sans retenir l’air.'
    ),
    exercise(
      'marche-souple',
      'Marche souple',
      'Circulation',
      600,
      level,
      'Marche tranquille, respiration libre ; arrête en cas de douleur.'
    ),
  ];
}

function absentProgram(
  reason: 'practice_absent' | 'practice_old' | 'invalid_practice',
  basedOn: RecoveryProgram['basedOn'],
  title: string,
  summary: string
): RecoveryProgram {
  return {
    version: WORKOUT_CONTRACT_VERSION,
    status: 'absent',
    reason,
    title,
    summary,
    basedOn,
    exercises: [],
    disclaimer: DISCLAIMER,
    nextPracticeHint: null,
  };
}

/**
 * Relie un programme de récupération à la pratique réelle.
 *
 * Sans pratique lisible, aucun programme n'est inventé. Une douleur forte
 * arrête les exercices et renvoie vers un professionnel. La charge
 * physiologique n'est pas utilisée : le bootstrap Compte ne fournit ni sport
 * ni intensité fiables pour la séance.
 */
export function buildRecoveryProgram(input: RecoveryInput): RecoveryProgram {
  const now = input.now ?? Date.now();
  const level = input.level ?? 'intermediaire';
  const sport = input.sport ?? null;
  const sportStatus =
    input.sportStatus ?? (sport ? 'known' : 'absent');
  const basedOn: RecoveryProgram['basedOn'] = {
    lastPracticeAt: input.lastPracticeAt,
    hoursSincePractice: null,
    sport,
    sportStatus,
  };

  if (!input.lastPracticeAt) {
    return absentProgram(
      'practice_absent',
      basedOn,
      'Aucune pratique récente lue',
      'Aucune sortie récente n’est disponible : pas de programme de récupération personnalisé.'
    );
  }

  const practiceMs = Date.parse(input.lastPracticeAt);
  if (!Number.isFinite(practiceMs)) {
    return absentProgram(
      'invalid_practice',
      basedOn,
      'Date de pratique illisible',
      'La date de la dernière pratique est invalide : aucun programme n’est proposé.'
    );
  }

  if (practiceMs > now + 60_000) {
    return absentProgram(
      'invalid_practice',
      basedOn,
      'Date de pratique incohérente',
      'La dernière pratique est datée dans le futur : aucun programme n’est proposé.'
    );
  }

  const hoursSincePractice = Math.max(0, (now - practiceMs) / 3_600_000);
  basedOn.hoursSincePractice = Math.round(hoursSincePractice * 10) / 10;

  if (input.soreness === 'high') {
    return {
      version: WORKOUT_CONTRACT_VERSION,
      status: 'rest',
      reason: 'high_soreness',
      title: 'Repos et avis professionnel',
      summary:
        'Une douleur importante est déclarée : aucun exercice n’est prescrit. Repose-toi et consulte un professionnel de santé si la douleur persiste.',
      basedOn,
      exercises: [],
      disclaimer: DISCLAIMER,
      nextPracticeHint:
        'Ne reprends pas tant que la douleur importante est présente.',
    };
  }

  if (hoursSincePractice <= 6) {
    return {
      version: WORKOUT_CONTRACT_VERSION,
      status: 'ready',
      reason: 'practice_recent',
      title: 'Récupération immédiate',
      summary: `Pratique terminée il y a ${basedOn.hoursSincePractice} h : respiration et mobilité douce, sans effort.`,
      basedOn,
      exercises: recentExercises(level),
      disclaimer: DISCLAIMER,
      nextPracticeHint:
        'Attends au moins 24 h avant une séance intense si la forme n’est pas revenue.',
    };
  }

  if (hoursSincePractice <= 24) {
    return {
      version: WORKOUT_CONTRACT_VERSION,
      status: 'ready',
      reason: 'practice_recent',
      title: 'Récupération du jour suivant',
      summary: `Pratique terminée il y a ${basedOn.hoursSincePractice} h : mobilité et marche souple pour relancer la circulation.`,
      basedOn,
      exercises: dayAfterExercises(level),
      disclaimer: DISCLAIMER,
      nextPracticeHint:
        'Une séance facile reste possible si la douleur est absente.',
    };
  }

  if (hoursSincePractice <= 48) {
    return {
      version: WORKOUT_CONTRACT_VERSION,
      status: 'ready',
      reason: 'practice_recent',
      title: 'Entretien post-effort',
      summary: `Pratique terminée il y a ${basedOn.hoursSincePractice} h : entretien souple, la récupération principale est passée.`,
      basedOn,
      exercises: maintenanceExercises(level),
      disclaimer: DISCLAIMER,
      nextPracticeHint:
        'La reprise d’une séance normale est possible si la forme est bonne.',
    };
  }

  return absentProgram(
    'practice_old',
    basedOn,
    'Aucune récupération nécessaire',
    `Dernière pratique il y a ${basedOn.hoursSincePractice} h : aucun programme de récupération spécifique n’est nécessaire.`
  );
}
