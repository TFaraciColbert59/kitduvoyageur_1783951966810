/**
 * Génération d'un récit structuré à partir des étapes réalisées et moments
 * publiables, sans jamais exposer les notes éditeur internes (P07-32, P07-33).
 */

import type { CockpitStep } from './model';
import type { StepExecution } from './stepExecution';

export interface StoryExportDraft {
  title: string;
  completedSteps: number;
  totalSteps: number;
  momentsCount: number;
  markdown: string;
}

export function buildTripStoryDraft(input: {
  title: string;
  steps: CockpitStep[];
  executions?: Record<string, StepExecution> | null;
  moments: { title: string; day: number | null; time?: string | null }[];
}): StoryExportDraft {
  const completedSteps = input.steps.filter((s) => input.executions?.[s.id]?.status === 'completed');
  const lines: string[] = [
    `# ${input.title}`,
    '',
    `Étapes réalisées : ${completedSteps.length}/${input.steps.length} · Moments enregistrés : ${input.moments.length}`,
    '',
  ];

  if (completedSteps.length > 0) {
    lines.push('## Étapes accomplies');
    for (const step of completedSteps) {
      lines.push(`- J${step.day} · ${step.title}${step.distance != null ? ` (${step.distance} km)` : ''}`);
    }
    lines.push('');
  }

  if (input.moments.length > 0) {
    lines.push('## Moments marquants');
    for (const m of input.moments) {
      lines.push(`- ${m.day != null ? `J${m.day}` : 'Hors jour'}${m.time ? ` ${m.time}` : ''} · ${m.title}`);
    }
  }

  return {
    title: input.title,
    completedSteps: completedSteps.length,
    totalSteps: input.steps.length,
    momentsCount: input.moments.length,
    markdown: lines.join('\n'),
  };
}
