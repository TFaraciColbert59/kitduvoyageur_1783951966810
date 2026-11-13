'use client';

import React from 'react';
import {
  bikeGoals,
  goalLabel,
  LEVEL_LABELS,
  runGoals,
  workoutLevels,
} from '@/features/workouts/domain/validation';
import type {
  StructuredSession,
  WeeklyProposal,
  WorkoutGoal,
  WorkoutLevel,
  WorkoutSport,
} from '@/features/workouts/domain/types';
import { ChoiceChip, ChoiceRow, SessionCard } from './WorkoutShared';

const HISTORY_LABELS: Record<WeeklyProposal['historyStatus'], string> = {
  complete: 'Historique complet',
  partial: 'Historique partiel',
  absent: 'Historique absent',
};

export interface InstantWorkoutsPanelProps {
  proposal: WeeklyProposal;
  sport: WorkoutSport;
  goal: WorkoutGoal;
  level: WorkoutLevel;
  availableDays: number;
  onSportChange: (sport: WorkoutSport) => void;
  onGoalChange: (goal: WorkoutGoal) => void;
  onLevelChange: (level: WorkoutLevel) => void;
  onDaysChange: (days: number) => void;
  onStart: (session: StructuredSession) => void;
  activeSessionId: string | null;
}

/**
 * Proposition hebdomadaire : objectif, niveau, jours disponibles et
 * historique réel. Les avertissements restent visibles ; aucune charge
 * physiologique n'est déduite d'une donnée absente.
 */
export function InstantWorkoutsPanel({
  proposal,
  sport,
  goal,
  level,
  availableDays,
  onSportChange,
  onGoalChange,
  onLevelChange,
  onDaysChange,
  onStart,
  activeSessionId,
}: InstantWorkoutsPanelProps) {
  const goals = sport === 'course' ? runGoals() : bikeGoals();

  return (
    <div className="lkdv-workout-instant">
      <ChoiceRow label="Sport">
        <ChoiceChip
          label="Course"
          active={sport === 'course'}
          onClick={() => onSportChange('course')}
        />
        <ChoiceChip
          label="Vélo"
          active={sport === 'velo'}
          onClick={() => onSportChange('velo')}
        />
      </ChoiceRow>

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

      <label className="lkdv-workout-days">
        <span>Jours disponibles cette semaine</span>
        <select
          value={availableDays}
          onChange={(event) => onDaysChange(Number(event.target.value))}
          aria-label="Jours disponibles cette semaine"
        >
          {[1, 2, 3, 4, 5, 6, 7].map((days) => (
            <option key={days} value={days}>
              {days} jour{days > 1 ? 's' : ''}
            </option>
          ))}
        </select>
      </label>

      <section className="lkdv-workout-proposal" aria-label="Proposition de la semaine">
        <div className="lkdv-workout-plan-topline">
          <span className="lkdv-workout-badge">Séances LKDV</span>
          <span data-history={proposal.historyStatus}>
            {HISTORY_LABELS[proposal.historyStatus]}
          </span>
          <span>{proposal.sessions.length} séance(s)</span>
        </div>
        <ul className="lkdv-workout-rationale">
          {proposal.rationale.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {proposal.warnings.length > 0 ? (
          <ul className="lkdv-workout-warnings" role="note">
            {proposal.warnings.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {proposal.sessions.length === 0 ? (
        <p className="lkdv-workout-empty" role="status">
          Aucune séance proposée pour ces paramètres.
        </p>
      ) : (
        <div className="lkdv-workout-session-list">
          {proposal.sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onStart={onStart}
              activeSessionId={activeSessionId}
              badge="Séance proposée"
            />
          ))}
        </div>
      )}
    </div>
  );
}
