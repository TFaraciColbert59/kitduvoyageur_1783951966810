'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  HeartPulse,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { formatClockS, formatDurationS } from '@/features/workouts/domain/sessionFactory';
import type { RecoveryProgram, SorenessLevel } from '@/features/workouts/domain/types';

export interface RecoveryPanelProps {
  program: RecoveryProgram;
  practiceStatus: 'available' | 'partial' | 'absent';
  soreness?: SorenessLevel;
  onSorenessChange?: (value: SorenessLevel) => void;
}

const SORENESS_OPTIONS: Array<{ id: SorenessLevel; label: string }> = [
  { id: 'none', label: 'Aucune' },
  { id: 'mild', label: 'Courbatures légères' },
  { id: 'high', label: 'Douleur importante' },
];

function formatPracticeDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function exerciseAmount(
  durationS: number | null,
  reps: number | null
): string {
  if (durationS !== null) return formatDurationS(durationS);
  if (reps !== null) return `${reps} répétition${reps > 1 ? 's' : ''}`;
  return 'libre';
}

/**
 * Programme de récupération relié à la dernière pratique réelle.
 * L'état vide et le repos sont affichés explicitement ; aucun exercice n'est
 * inventé quand la donnée manque ou qu'une douleur importante est déclarée.
 */
export function RecoveryPanel({
  program,
  practiceStatus,
  soreness = 'none',
  onSorenessChange,
}: RecoveryPanelProps) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const [remainingS, setRemainingS] = useState<number>(0);
  const [running, setRunning] = useState<boolean>(false);

  useEffect(() => {
    setDone(new Set());
    setActiveTimerId(null);
    setRemainingS(0);
    setRunning(false);
  }, [program.basedOn.lastPracticeAt, program.status]);

  useEffect(() => {
    if (!running || !activeTimerId) return;
    const timer = window.setInterval(() => {
      setRemainingS((prev) => {
        if (prev <= 1) {
          setRunning(false);
          setDone((old) => new Set(old).add(activeTimerId));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, activeTimerId]);

  const toggle = (id: string) => {
    setDone((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startExerciseTimer = (id: string, durationS: number) => {
    if (activeTimerId === id) {
      setRunning((prev) => !prev);
      return;
    }
    setActiveTimerId(id);
    setRemainingS(durationS);
    setRunning(true);
  };

  const resetExerciseTimer = (id: string, durationS: number) => {
    setActiveTimerId(id);
    setRemainingS(durationS);
    setRunning(false);
  };

  const renderSorenessControl = () =>
    onSorenessChange ? (
      <div
        className="lkdv-workout-choice"
        role="group"
        aria-label="Douleur ou fatigue musculaire"
      >
        <span className="lkdv-workout-choice-label">Ressenti / douleur</span>
        <div className="lkdv-workout-chip-row">
          {SORENESS_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`lkdv-workout-chip${soreness === option.id ? ' is-active' : ''}`}
              aria-pressed={soreness === option.id}
              onClick={() => onSorenessChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    ) : null;

  const practiceDate = formatPracticeDate(program.basedOn.lastPracticeAt);

  if (program.status === 'absent') {
    const detail =
      practiceStatus === 'absent'
        ? 'Aucune sortie terminée n’est lisible dans le compte.'
        : practiceStatus === 'partial'
          ? 'Les dates des sorties lues sont illisibles.'
          : 'La dernière pratique est trop ancienne pour une récupération spécifique.';
    return (
      <section className="lkdv-workout-recovery" data-status="absent">
        {renderSorenessControl()}
        <div className="lkdv-workout-state" role="status">
          <span className="lkdv-workout-state-icon" aria-hidden="true">
            <HeartPulse size={20} />
          </span>
          <h3>{program.title}</h3>
          <p>{program.summary}</p>
          <p className="lkdv-workout-state-detail">{detail}</p>
          {practiceDate ? (
            <p className="lkdv-workout-state-detail">
              Dernière pratique : {practiceDate}
            </p>
          ) : null}
        </div>
        <p className="lkdv-workout-disclaimer">{program.disclaimer}</p>
      </section>
    );
  }

  if (program.status === 'rest') {
    return (
      <section className="lkdv-workout-recovery" data-status="rest">
        {renderSorenessControl()}
        <div className="lkdv-workout-alert" role="alert">
          <ShieldAlert size={20} aria-hidden="true" />
          <div>
            <h3>{program.title}</h3>
            <p>{program.summary}</p>
          </div>
        </div>
        <p className="lkdv-workout-disclaimer">{program.disclaimer}</p>
      </section>
    );
  }

  return (
    <section className="lkdv-workout-recovery" data-status="ready">
      {renderSorenessControl()}
      <div className="lkdv-workout-proposal">
        <div className="lkdv-workout-plan-topline">
          <span className="lkdv-workout-badge">Récupération</span>
          {program.basedOn.hoursSincePractice !== null ? (
            <span>il y a {program.basedOn.hoursSincePractice} h</span>
          ) : null}
          <span>
            {done.size}/{program.exercises.length} fait(s)
          </span>
        </div>
        <h3>{program.title}</h3>
        <p>{program.summary}</p>
        {practiceDate ? (
          <p className="lkdv-workout-state-detail">
            Dernière pratique : {practiceDate}
          </p>
        ) : null}
      </div>

      <ol className="lkdv-workout-exercises">
        {program.exercises.map((exercise) => {
          const checked = done.has(exercise.id);
          return (
            <li key={exercise.id} className={checked ? 'is-done' : undefined}>
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(exercise.id)}
                  aria-label={`Marquer ${exercise.title} comme fait`}
                />
                <span className="lkdv-workout-exercise-body">
                  <span className="lkdv-workout-exercise-head">
                    <strong>{exercise.title}</strong>
                    <span>{exerciseAmount(exercise.durationS, exercise.reps)}</span>
                  </span>
                  <span className="lkdv-workout-exercise-area">
                    {exercise.area}
                  </span>
                  <span className="lkdv-workout-exercise-instructions">
                    {exercise.instructions}
                  </span>
                </span>
                {checked ? (
                  <CheckCircle2
                    size={18}
                    aria-hidden="true"
                    className="lkdv-workout-check"
                  />
                ) : null}
              </label>
              {exercise.durationS !== null ? (
                <div className="lkdv-workout-recovery-timer">
                  <button
                    type="button"
                    className="lkdv-workout-secondary"
                    onClick={() => startExerciseTimer(exercise.id, exercise.durationS!)}
                  >
                    {activeTimerId === exercise.id && running ? (
                      <Pause size={14} aria-hidden="true" />
                    ) : (
                      <Play size={14} aria-hidden="true" />
                    )}
                    {activeTimerId === exercise.id
                      ? `${running ? 'Pause' : 'Reprendre'} · ${formatClockS(remainingS)}`
                      : `Chrono ${formatClockS(exercise.durationS)}`}
                  </button>
                  {activeTimerId === exercise.id ? (
                    <button
                      type="button"
                      className="lkdv-workout-ghost"
                      onClick={() => resetExerciseTimer(exercise.id, exercise.durationS!)}
                      aria-label={`Réinitialiser ${exercise.title}`}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {program.nextPracticeHint ? (
        <p className="lkdv-workout-hint">{program.nextPracticeHint}</p>
      ) : null}
      <p className="lkdv-workout-disclaimer">{program.disclaimer}</p>
    </section>
  );
}
