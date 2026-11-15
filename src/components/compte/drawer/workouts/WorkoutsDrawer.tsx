'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bike, Dumbbell, Footprints, HeartPulse } from 'lucide-react';
import {
  buildCyclingPlan,
  buildRunningPlan,
} from '@/features/workouts/domain/plans';
import { proposeWeeklyWorkouts } from '@/features/workouts/domain/instantWorkouts';
import { buildRecoveryProgram } from '@/features/workouts/domain/recovery';
import {
  advanceExecution,
  createExecution,
  isExecutionResumable,
  pauseExecution,
  resumeExecution,
  skipStep,
} from '@/features/workouts/domain/sessionEngine';
import {
  clearWorkoutSession,
  loadWorkoutSession,
  saveWorkoutSession,
} from '@/features/workouts/client/sessionStore';
import {
  readAccountPractice,
  readPracticeHistory,
} from '@/features/workouts/client/readAccountPractice';
import { getProviderAvailability } from '@/features/workouts/domain/availability';
import type {
  BikeGoal,
  RunGoal,
  SessionExecution,
  StructuredSession,
  WorkoutGoal,
  WorkoutLevel,
  WorkoutSport,
} from '@/features/workouts/domain/types';
import { InstantWorkoutsPanel } from './InstantWorkoutsPanel';
import { PlanBrowser } from './PlanBrowser';
import { RecoveryPanel } from './RecoveryPanel';
import { SessionPlayer } from './SessionPlayer';
import './WorkoutsDrawer.css';

export type WorkoutsSection = 'course' | 'velo' | 'seances' | 'recuperation';

const defaultNow = () => Date.now();

const SECTIONS: Array<{
  id: WorkoutsSection;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'course', label: 'Course', icon: <Footprints size={16} aria-hidden="true" /> },
  { id: 'velo', label: 'Vélo', icon: <Bike size={16} aria-hidden="true" /> },
  { id: 'seances', label: 'Séances', icon: <Dumbbell size={16} aria-hidden="true" /> },
  {
    id: 'recuperation',
    label: 'Récupération',
    icon: <HeartPulse size={16} aria-hidden="true" />,
  },
];

export interface WorkoutsDrawerProps {
  viewer?: 'owner' | 'visitor';
  /** Payload du bootstrap Compte ; seules les sorties réelles sont lues. */
  payload?: unknown;
  now?: () => number;
  storage?: Storage | null;
}

function TrainingLocked() {
  return (
    <section className="lkdv-workout-locked" role="status">
      <span className="lkdv-workout-state-icon" aria-hidden="true">
        <Dumbbell size={20} />
      </span>
      <h3>Entraînement privé</h3>
      <p>
        Les plans, séances guidées et programmes de récupération ne sont
        visibles que par leur propriétaire.
      </p>
    </section>
  );
}

function WorkoutsDrawerOwner({
  payload = null,
  now = defaultNow,
  storage,
}: WorkoutsDrawerProps) {
  const [section, setSection] = useState<WorkoutsSection>('course');
  const [runGoal, setRunGoal] = useState<RunGoal>('10k');
  const [runLevel, setRunLevel] = useState<WorkoutLevel>('intermediaire');
  const [bikeGoal, setBikeGoal] = useState<BikeGoal>('endurance');
  const [bikeLevel, setBikeLevel] = useState<WorkoutLevel>('intermediaire');
  const [instantSport, setInstantSport] = useState<WorkoutSport>('course');
  const [instantGoal, setInstantGoal] = useState<WorkoutGoal>('10k');
  const [instantLevel, setInstantLevel] =
    useState<WorkoutLevel>('intermediaire');
  const [availableDays, setAvailableDays] = useState(3);
  const [execution, setExecution] = useState<SessionExecution | null>(null);
  const [activeSession, setActiveSession] =
    useState<StructuredSession | null>(null);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

  const resolvedStorage = useMemo<Storage | null>(() => {
    if (storage !== undefined) return storage;
    try {
      if (typeof window === 'undefined') return null;
      return window.localStorage ?? null;
    } catch {
      return null;
    }
  }, [storage]);

  const practice = useMemo(
    () => readAccountPractice(payload, now()),
    [payload, now]
  );
  const history = useMemo(
    () => readPracticeHistory(payload, now()),
    [payload, now]
  );
  const runPlan = useMemo(
    () => buildRunningPlan(runGoal, runLevel),
    [runGoal, runLevel]
  );
  const bikePlan = useMemo(
    () => buildCyclingPlan(bikeGoal, bikeLevel),
    [bikeGoal, bikeLevel]
  );
  const proposal = useMemo(
    () =>
      proposeWeeklyWorkouts({
        sport: instantSport,
        goal: instantGoal,
        level: instantLevel,
        availableDays,
        history,
      }),
    [instantSport, instantGoal, instantLevel, availableDays, history]
  );
  const recovery = useMemo(
    () =>
      buildRecoveryProgram({
        lastPracticeAt: practice.lastPracticeAt,
        sport: practice.sport,
        sportStatus: practice.sportStatus,
        level: instantLevel,
        now: now(),
      }),
    [practice, instantLevel, now]
  );

  useEffect(() => {
    const stored = loadWorkoutSession(resolvedStorage);
    if (!stored) return;
    if (
      stored.execution.status === 'completed' ||
      !isExecutionResumable(stored.execution, now())
    ) {
      clearWorkoutSession(resolvedStorage);
      return;
    }
    setActiveSession(stored.session);
    setExecution(stored.execution);
    setRestoreNotice('Séance interrompue restaurée. Tu peux reprendre ou arrêter.');
  }, [resolvedStorage, now]);

  const executionStatus = execution?.status ?? null;

  useEffect(() => {
    if (executionStatus !== 'running' || !activeSession) return;
    const timer = window.setInterval(() => {
      setExecution((previous) => {
        if (!previous || previous.status !== 'running') return previous;
        const next = advanceExecution(previous, activeSession, now());
        saveWorkoutSession(next, activeSession, resolvedStorage);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [executionStatus, activeSession, now, resolvedStorage]);

  const applyExecution = useCallback(
    (next: SessionExecution) => {
      setExecution(next);
      setRestoreNotice(null);
      if (activeSession) {
        saveWorkoutSession(next, activeSession, resolvedStorage);
      }
    },
    [activeSession, resolvedStorage]
  );

  const startSession = useCallback(
    (session: StructuredSession) => {
      const next = createExecution(session, now());
      setActiveSession(session);
      setExecution(next);
      setRestoreNotice(null);
      saveWorkoutSession(next, session, resolvedStorage);
    },
    [now, resolvedStorage]
  );

  const handlePause = useCallback(() => {
    if (!execution || !activeSession) return;
    applyExecution(pauseExecution(execution, activeSession, now()));
  }, [execution, activeSession, applyExecution, now]);

  const handleResume = useCallback(() => {
    if (!execution) return;
    applyExecution(resumeExecution(execution, now()));
  }, [execution, applyExecution, now]);

  const handleSkip = useCallback(() => {
    if (!execution || !activeSession) return;
    applyExecution(skipStep(execution, activeSession, now()));
  }, [execution, activeSession, applyExecution, now]);

  const handleStop = useCallback(() => {
    clearWorkoutSession(resolvedStorage);
    setExecution(null);
    setActiveSession(null);
    setRestoreNotice(null);
  }, [resolvedStorage]);

  const handleInstantSport = (sport: WorkoutSport) => {
    setInstantSport(sport);
    setInstantGoal(sport === 'course' ? '10k' : 'endurance');
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const index = SECTIONS.findIndex((item) => item.id === section);
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % SECTIONS.length;
    else if (event.key === 'ArrowLeft')
      next = (index - 1 + SECTIONS.length) % SECTIONS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = SECTIONS.length - 1;
    if (next < 0) return;
    event.preventDefault();
    const target = SECTIONS[next];
    setSection(target.id);
    document.getElementById(`lkdv-workout-tab-${target.id}`)?.focus();
  };

  const partnerNotice = [
    getProviderAvailability('runna').detail,
    getProviderAvailability('cts').detail,
  ].join(' ');

  return (
    <section className="lkdv-workouts" aria-label="Entraînement">
      <header className="lkdv-workouts-head">
        <span className="lkdv-workout-badge">Plan LKDV</span>
        <h2>Entraînement</h2>
        <p>
          Plans progressifs, séances guidées et récupération reliée à ta
          pratique réelle.
        </p>
        <p className="lkdv-workout-availability">{partnerNotice}</p>
      </header>

      {restoreNotice ? (
        <p className="lkdv-workout-restore" role="status">
          {restoreNotice}
        </p>
      ) : null}

      {execution && activeSession ? (
        <SessionPlayer
          session={activeSession}
          execution={execution}
          onPause={handlePause}
          onResume={handleResume}
          onSkip={handleSkip}
          onStop={handleStop}
        />
      ) : null}

      <nav
        className="lkdv-workout-tabs"
        role="tablist"
        aria-label="Sections d’entraînement"
        onKeyDown={handleTabKeyDown}
      >
        {SECTIONS.map((item) => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`lkdv-workout-tab-${item.id}`}
              aria-selected={active}
              aria-controls={`lkdv-workout-panel-${item.id}`}
              tabIndex={active ? 0 : -1}
              className={active ? 'is-active' : undefined}
              onClick={() => setSection(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div
        className="lkdv-workout-panel"
        role="tabpanel"
        id="lkdv-workout-panel-course"
        aria-labelledby="lkdv-workout-tab-course"
        hidden={section !== 'course'}
      >
        <PlanBrowser
          sport="course"
          plan={runPlan}
          goal={runGoal}
          level={runLevel}
          onGoalChange={(goal) => setRunGoal(goal as RunGoal)}
          onLevelChange={setRunLevel}
          onStart={startSession}
          activeSessionId={execution?.sessionId ?? null}
        />
      </div>

      <div
        className="lkdv-workout-panel"
        role="tabpanel"
        id="lkdv-workout-panel-velo"
        aria-labelledby="lkdv-workout-tab-velo"
        hidden={section !== 'velo'}
      >
        <PlanBrowser
          sport="velo"
          plan={bikePlan}
          goal={bikeGoal}
          level={bikeLevel}
          onGoalChange={(goal) => setBikeGoal(goal as BikeGoal)}
          onLevelChange={setBikeLevel}
          onStart={startSession}
          activeSessionId={execution?.sessionId ?? null}
        />
      </div>

      <div
        className="lkdv-workout-panel"
        role="tabpanel"
        id="lkdv-workout-panel-seances"
        aria-labelledby="lkdv-workout-tab-seances"
        hidden={section !== 'seances'}
      >
        <InstantWorkoutsPanel
          proposal={proposal}
          sport={instantSport}
          goal={instantGoal}
          level={instantLevel}
          availableDays={availableDays}
          onSportChange={handleInstantSport}
          onGoalChange={setInstantGoal}
          onLevelChange={setInstantLevel}
          onDaysChange={setAvailableDays}
          onStart={startSession}
          activeSessionId={execution?.sessionId ?? null}
        />
      </div>

      <div
        className="lkdv-workout-panel"
        role="tabpanel"
        id="lkdv-workout-panel-recuperation"
        aria-labelledby="lkdv-workout-tab-recuperation"
        hidden={section !== 'recuperation'}
      >
        <RecoveryPanel program={recovery} practiceStatus={practice.status} />
      </div>
    </section>
  );
}

/**
 * Entrée « Entraînement » du drawer Profil.
 *
 * Elle est isolée du runtime Explorer : aucun écran dédié, aucune requête
 * réseau, aucune API Runna/CTS/Garmin inventée. Un visiteur ne voit rien.
 */
export function WorkoutsDrawer({ viewer = 'owner', ...props }: WorkoutsDrawerProps) {
  if (viewer === 'visitor') return <TrainingLocked />;
  return <WorkoutsDrawerOwner viewer={viewer} {...props} />;
}

export default WorkoutsDrawer;
