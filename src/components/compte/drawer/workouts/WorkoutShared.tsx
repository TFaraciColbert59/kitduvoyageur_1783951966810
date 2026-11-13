'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import {
  formatClockS,
  formatDurationS,
  primaryTarget,
} from '@/features/workouts/domain/sessionFactory';
import type {
  SessionIntent,
  SessionStep,
  StructuredSession,
} from '@/features/workouts/domain/types';

const INTENT_LABELS: Record<SessionIntent, string> = {
  endurance: 'Endurance',
  interval: 'Fractionné',
  tempo: 'Tempo',
  recovery: 'Récupération',
  test: 'Test',
};

const STEP_LABELS: Record<SessionStep['kind'], string> = {
  warmup: 'Échauffement',
  interval: 'Effort',
  recovery: 'Récupération',
  steady: 'Bloc',
  cooldown: 'Retour au calme',
};

export function intentLabel(intent: SessionIntent): string {
  return INTENT_LABELS[intent] ?? intent;
}

export function stepKindLabel(kind: SessionStep['kind']): string {
  return STEP_LABELS[kind] ?? kind;
}

export interface ChoiceChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  ariaLabel?: string;
}

export function ChoiceChip({
  label,
  active,
  onClick,
  ariaLabel,
}: ChoiceChipProps) {
  return (
    <button
      type="button"
      className={`lkdv-workout-chip${active ? ' is-active' : ''}`}
      aria-pressed={active}
      aria-label={ariaLabel ?? label}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export interface ChoiceRowProps {
  label: string;
  children: React.ReactNode;
}

export function ChoiceRow({ label, children }: ChoiceRowProps) {
  return (
    <div className="lkdv-workout-choice" role="group" aria-label={label}>
      <span className="lkdv-workout-choice-label">{label}</span>
      <div className="lkdv-workout-chip-row">{children}</div>
    </div>
  );
}

export function StepTargets({ step }: { step: SessionStep }) {
  if (step.targets.length === 0) {
    return <span className="lkdv-workout-target-free">Cible libre</span>;
  }
  return (
    <span className="lkdv-workout-target-list">
      {step.targets.map((target) => (
        <span key={`${target.kind}-${target.unit}`} className="lkdv-workout-target">
          {target.label}
        </span>
      ))}
    </span>
  );
}

export interface SessionCardProps {
  session: StructuredSession;
  onStart: (session: StructuredSession) => void;
  activeSessionId: string | null;
  badge?: string;
}

/**
 * Carte de séance réutilisée par les plans et les propositions instantanées.
 * Les étapes et cibles sont visibles sans lancer la séance ; aucun résultat
 * n'est simulé.
 */
export function SessionCard({
  session,
  onStart,
  activeSessionId,
  badge,
}: SessionCardProps) {
  const focusStep =
    session.steps.find(
      (step) => step.kind !== 'warmup' && step.kind !== 'cooldown'
    ) ?? session.steps[0];
  const primary = primaryTarget(focusStep);
  const running = activeSessionId === session.id;
  const anotherRunning = activeSessionId !== null && !running;

  return (
    <article className="lkdv-workout-session" data-intent={session.intent}>
      <div className="lkdv-workout-session-head">
        <div className="lkdv-workout-session-title">
          <span className="lkdv-workout-kicker">
            {badge ?? intentLabel(session.intent)}
          </span>
          <h4>{session.title}</h4>
          <p>
            {formatDurationS(session.totalDurationS)} · {session.steps.length}{' '}
            étapes
            {primary ? ` · ${primary.label}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="lkdv-workout-start"
          onClick={() => onStart(session)}
          disabled={activeSessionId !== null}
          aria-label={
            running
              ? `Séance ${session.title} en cours`
              : anotherRunning
                ? 'Une autre séance est en cours'
                : `Démarrer ${session.title}`
          }
        >
          {running ? 'En cours' : anotherRunning ? 'Séance en cours' : 'Démarrer'}
        </button>
      </div>

      <details className="lkdv-workout-steps">
        <summary>
          <span>Voir les étapes</span>
          <ChevronDown size={15} aria-hidden="true" />
        </summary>
        <ol>
          {session.steps.map((step) => (
            <li key={step.id}>
              <span className="lkdv-workout-step-kind">
                {stepKindLabel(step.kind)}
              </span>
              <span className="lkdv-workout-step-label">{step.label}</span>
              <span className="lkdv-workout-step-duration">
                {formatClockS(step.durationS)}
              </span>
              <StepTargets step={step} />
            </li>
          ))}
        </ol>
      </details>
    </article>
  );
}
