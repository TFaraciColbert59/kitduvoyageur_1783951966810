import type { AdjustmentId, AdjustmentPreview, ItineraryModel, ItineraryStep } from '../types';
import { createStep } from './itinerary';
import { buildContingencies } from './resilience';

const ADJUSTMENTS: readonly { id: AdjustmentId; impact: string }[] = [
  {
    id: 'moins_cher',
    impact: 'On retire les pauses facultatives. Les trajets et les nuits restent.',
  },
  {
    id: 'moins_de_transport',
    impact: 'On enlève les déplacements parasites pour n’en garder que l’essentiel.',
  },
  {
    id: 'plus_de_nature',
    impact: 'On ajoute du temps dehors, sans heure de départ ni durée à l’heure.',
  },
  {
    id: 'plus_tranquille',
    impact: 'On décompose les journées et on supprime les départs tôt.',
  },
  {
    id: 'plus_de_decouvertes',
    impact: 'On propose des étapes à découvrir, toutes encore à vérifier.',
  },
];

const OPTIONAL: ReadonlySet<ItineraryStep['kind']> = new Set(['repos', 'arret']);

function isKept(step: ItineraryStep): boolean {
  return step.kept;
}

function nextId(steps: readonly ItineraryStep[], day: number, kind: string): string {
  let serial = 1;
  let candidate = `d${day}-${kind}-ajust-${serial}`;
  while (steps.some((step) => step.id === candidate)) {
    serial += 1;
    candidate = `d${day}-${kind}-ajust-${serial}`;
  }
  return candidate;
}

function renumber(steps: readonly ItineraryStep[]): ItineraryStep[] {
  const counters = new Map<number, number>();
  return [...steps]
    .sort((a, b) => a.day - b.day || a.order - b.order)
    .map((step) => {
      const order = counters.get(step.day) ?? 0;
      counters.set(step.day, order + 1);
      return order === step.order ? step : { ...step, order };
    });
}

/** Ce que l'ajustement touche, et ce qu'il laisse tranquille par construction. */
export function previewAdjustment(model: ItineraryModel, id: AdjustmentId): AdjustmentPreview {
  const meta = ADJUSTMENTS.find((entry) => entry.id === id);
  const changed = model.steps.filter((step) => touchedBy(id, step));
  return {
    id,
    impact: meta ? meta.impact : '',
    changedStepIds: changed.map((step) => step.id),
    preservedStepIds: model.steps
      .filter((step) => !touchedBy(id, step))
      .map((step) => step.id),
  };
}

function touchedBy(id: AdjustmentId, step: ItineraryStep): boolean {
  if (isKept(step)) return false;
  switch (id) {
    case 'moins_cher':
    case 'moins_de_transport':
      return OPTIONAL.has(step.kind);
    case 'plus_de_nature':
    case 'plus_de_decouvertes':
    case 'plus_tranquille':
      return false;
    default:
      return false;
  }
}

export function applyAdjustment(model: ItineraryModel, id: AdjustmentId): ItineraryModel {
  const kept = model.steps.filter(isKept);
  let steps = model.steps.filter((step) => !touchedBy(id, step));
  steps = renumber(steps);

  if (id === 'plus_de_nature' || id === 'plus_de_decouvertes') {
    const nature = id === 'plus_de_nature';
    for (let day = 1; day <= model.days; day += 1) {
      const order = steps.filter((step) => step.day === day).length;
      steps = [
        ...steps,
        createStep(nextId(steps, day, nature ? 'arret' : 'decouverte'), day, order, 'arret', {
          title: nature ? 'Temps dehors' : 'Découverte',
          reason: nature
            ? 'Tu as demandé plus de nature'
            : 'Lieu à vérifier : rien n’est inventé ici',
          state: nature ? 'propose' : 'a_reserver',
        }),
      ];
    }
    steps = renumber(steps);
  }

  if (id === 'plus_tranquille') {
    for (let day = 1; day <= model.days; day += 1) {
      const hasPause = steps.some((step) => step.day === day && step.kind === 'repos');
      if (hasPause) continue;
      const order = steps.filter((step) => step.day === day).length;
      steps = [
        ...steps,
        createStep(nextId(steps, day, 'repos'), day, order, 'repos', {
          title: 'Temps à soi',
          reason: 'Rythme tranquille demandé',
        }),
      ];
    }
    steps = renumber(steps);
  }

  const withoutTime = id === 'plus_tranquille';
  const base: ItineraryModel = {
    ...model,
    steps: withoutTime
      ? steps.map((step) => (step.startTime === null ? step : { ...step, startTime: null }))
      : steps,
  };
  const next: ItineraryModel = { ...base, steps: renumber([...kept, ...base.steps]) };
  return { ...next, contingencies: buildContingencies(next) };
}

export function adjustmentIds(): readonly AdjustmentId[] {
  return ADJUSTMENTS.map((entry) => entry.id);
}

