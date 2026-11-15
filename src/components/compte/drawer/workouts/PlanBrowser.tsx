'use client';

import React, { useEffect, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { getProviderAvailability } from '@/features/workouts/domain/availability';
import {
  formatDurationS,
} from '@/features/workouts/domain/sessionFactory';
import {
  bikeGoals,
  goalLabel,
  LEVEL_LABELS,
  runGoals,
  workoutLevels,
} from '@/features/workouts/domain/validation';
import {
  countPlanCompletion,
  planSessionKey,
  readPlanProgress,
  togglePlanEnrollment,
  togglePlanSessionCompleted,
  type PlanProgressState,
} from '@/features/workouts/client/planProgress';
import type { PrepFocusConfig } from '@/features/compte/progression/prepFocus';
import type {
  StructuredSession,
  TrainingPlan,
  WorkoutGoal,
  WorkoutLevel,
  WorkoutSport,
} from '@/features/workouts/domain/types';
import { ChoiceChip, ChoiceRow, SessionCard } from './WorkoutShared';

export interface PlanBrowserProps {
  sport: WorkoutSport;
  plan: TrainingPlan;
  goal: WorkoutGoal;
  level: WorkoutLevel;
  onGoalChange: (goal: WorkoutGoal) => void;
  onLevelChange: (level: WorkoutLevel) => void;
  onStart: (session: StructuredSession) => void;
  activeSessionId: string | null;
  storage?: Storage | null;
  prepFocus?: PrepFocusConfig | null;
}

export function PlanBrowser({
  sport,
  plan,
  goal,
  level,
  onGoalChange,
  onLevelChange,
  onStart,
  activeSessionId,
  storage,
  prepFocus,
}: PlanBrowserProps) {
  const [openWeek, setOpenWeek] = useState<number>(1);
  const [progress, setProgress] = useState<PlanProgressState>(() =>
    readPlanProgress(storage)
  );

  useEffect(() => {
    setOpenWeek(1);
  }, [plan.id]);

  useEffect(() => {
    setProgress(readPlanProgress(storage));
  }, [storage, plan.id]);

  const goals = sport === 'course' ? runGoals() : bikeGoals();
  const partner = getProviderAvailability(sport === 'course' ? 'runna' : 'cts');
  const enrolled = progress.enrolledPlanIds.includes(plan.id);
  const completion = countPlanCompletion(plan, progress);

  return (
    <div className="lkdv-workout-browser">
      <ChoiceRow label="Objectif">
        {goals.map((item) => (
          <ChoiceChip
            key={item}
            label={goalLabel(item as WorkoutGoal)}
            active={goal === item}
            onClick={() => onGoalChange(item as WorkoutGoal)}
          />
        ))}
      </ChoiceRow>

      <ChoiceRow label="Niveau">
        {workoutLevels().map((item) => (
          <ChoiceChip
            key={item}
            label={LEVEL_LABELS[item]}
            active={level === item}
            onClick={() => onLevelChange(item)}
          />
        ))}
      </ChoiceRow>

      <p className="lkdv-workout-source-note">
        <strong>{partner.label}</strong> indisponible (
        {partner.reason === 'no_license' ? 'licence absente' : 'connecteur absent'}) ·
        plan LKDV natif affiché.
      </p>

      <section className="lkdv-workout-plan-summary" aria-label={plan.title}>
        <div className="lkdv-workout-plan-topline">
          <span className="lkdv-workout-badge">Plan LKDV</span>
          <span>{plan.weeks.length} semaines</span>
          <span>{plan.sessionsPerWeek} séances/sem.</span>
          {completion.total > 0 ? (
            <span data-testid="plan-completion-summary">
              {completion.completed}/{completion.total} faites ({completion.percent} %)
            </span>
          ) : null}
        </div>
        <h3>{plan.title}</h3>
        <p>{plan.summary}</p>
        {prepFocus && (prepFocus.discipline === 'all' || prepFocus.discipline === sport) ? (
          <p className="lkdv-workout-state-detail" data-testid="plan-prep-focus">
            Objectif actif : <strong>{prepFocus.title || 'Préparation'}</strong>
            {prepFocus.targetDate ? ` (${prepFocus.targetDate})` : ''}
          </p>
        ) : null}
        <div className="lkdv-workout-plan-actions">
          <p className="lkdv-workout-plan-total">
            Volume total indicatif : {formatDurationS(plan.totalDurationS)}
          </p>
          <button
            type="button"
            className={enrolled ? 'lkdv-workout-primary' : 'lkdv-workout-secondary'}
            aria-pressed={enrolled}
            onClick={() => setProgress(togglePlanEnrollment(plan.id, storage))}
          >
            {enrolled ? (
              <>
                <Check size={15} aria-hidden="true" />
                Plan suivi
              </>
            ) : (
              'Suivre ce plan'
            )}
          </button>
        </div>
      </section>

      <div className="lkdv-workout-weeks">
        {plan.weeks.map((week) => {
          const open = openWeek === week.index;
          const panelId = `lkdv-workout-week-${plan.id}-${week.index}`;
          return (
            <section
              key={week.index}
              className="lkdv-workout-week"
              data-recovery={week.isRecoveryWeek ? 'true' : 'false'}
            >
              <button
                type="button"
                className="lkdv-workout-week-head"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => setOpenWeek(open ? 0 : week.index)}
              >
                <span className="lkdv-workout-week-index">{week.label}</span>
                <span className="lkdv-workout-week-focus">{week.focus}</span>
                <span className="lkdv-workout-week-total">
                  {formatDurationS(week.totalDurationS)}
                </span>
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className={open ? 'is-open' : undefined}
                />
              </button>
              {open ? (
                <div className="lkdv-workout-week-body" id={panelId}>
                  {week.sessions.map((session) => {
                    const sessionKey = planSessionKey(plan.id, session.id);
                    const done = sessionKey in progress.completedSessionKeys;
                    return (
                      <div key={session.id} className="lkdv-workout-week-session">
                        <SessionCard
                          session={session}
                          onStart={onStart}
                          activeSessionId={activeSessionId}
                          badge={week.label}
                        />
                        <button
                          type="button"
                          className={
                            done ? 'lkdv-workout-chip is-active' : 'lkdv-workout-chip'
                          }
                          aria-pressed={done}
                          onClick={() =>
                            setProgress(
                              togglePlanSessionCompleted(plan.id, session.id, storage)
                            )
                          }
                        >
                          {done ? 'Séance faite ✓' : 'Marquer faite'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <p className="lkdv-workout-disclaimer">{plan.disclaimer}</p>
    </div>
  );
}
