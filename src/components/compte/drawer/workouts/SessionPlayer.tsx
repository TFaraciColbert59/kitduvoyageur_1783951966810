'use client';

import React, { useEffect, useState } from 'react';
import {
  Download,
  Pause,
  Play,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
  Watch,
} from 'lucide-react';
import {
  currentStepPosition,
  nextStep,
  remainingS,
  sessionProgress,
} from '@/features/workouts/domain/sessionEngine';
import {
  formatClockS,
  formatDurationS,
} from '@/features/workouts/domain/sessionFactory';
import {
  buildStructuredWorkoutJson,
  buildStructuredWorkoutTcx,
  planWatchTransfer,
  watchTransferLabel,
} from '@/features/workouts/domain/watchTransfer';
import type {
  DeviceConnector,
  SessionExecution,
  StructuredSession,
} from '@/features/workouts/domain/types';
import { StepTargets, stepKindLabel } from './WorkoutShared';

export interface SessionPlayerProps {
  session: StructuredSession;
  execution: SessionExecution;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onStop: () => void;
  connectors?: DeviceConnector[];
}

/**
 * Lecteur de séance locale : étape et cible courantes, progression, pause,
 * reprise, étape suivante. L'envoi montre est un plan de capacité ; sans
 * connecteur, il est explicitement indisponible et rien n'est simulé.
 */
function playStepCue(stepLabel: string, instruction: string | null) {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }
  } catch {
    /* ignore audio errors */
  }
  try {
    if ('speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined') {
      window.speechSynthesis.cancel();
      const text = instruction ? `${stepLabel}. ${instruction}` : stepLabel;
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'fr-FR';
      window.speechSynthesis.speak(utter);
    }
  } catch {
    /* ignore speech errors */
  }
}

function triggerFileDownload(filename: string, content: string, mimeType: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch {
    /* ignore download errors in headless test envs */
  }
}

export function SessionPlayer({
  session,
  execution,
  onPause,
  onResume,
  onSkip,
  onStop,
  connectors = [],
}: SessionPlayerProps) {
  const [transferNotice, setTransferNotice] = useState<string | null>(null);
  const [audioCues, setAudioCues] = useState<boolean>(false);
  const transfer = planWatchTransfer(session, connectors);

  useEffect(() => {
    setTransferNotice(null);
  }, [session.id]);

  const position =
    execution.status !== 'completed' ? currentStepPosition(execution, session) : null;
  const activeStep = position?.step ?? session.steps[0];

  useEffect(() => {
    if (!audioCues || execution.status !== 'running' || !activeStep) return;
    playStepCue(activeStep.label, activeStep.instruction);
  }, [audioCues, execution.status, activeStep]);

  if (execution.status === 'completed') {
    return (
      <section
        className="lkdv-workout-player"
        data-status="completed"
        aria-label="Séance terminée"
      >
        <div className="lkdv-workout-player-head">
          <span className="lkdv-workout-badge">Terminée</span>
          <span>{formatDurationS(session.totalDurationS)}</span>
        </div>
        <h3>Séance terminée</h3>
        <p>
          {session.title} · {formatDurationS(session.totalDurationS)}. Le
          résultat reste local : aucun envoi serveur ni montre n’a été effectué.
        </p>
        <button type="button" className="lkdv-workout-primary" onClick={onStop}>
          Fermer
        </button>
      </section>
    );
  }

  const step = position?.step ?? session.steps[0];
  const stepRemainingS = step
    ? Math.max(0, step.durationS - (position?.stepElapsedS ?? 0))
    : 0;
  const upcoming = nextStep(execution, session);
  const progress = sessionProgress(execution, session);
  const percent = Math.round(progress * 100);
  const paused = execution.status === 'paused';

  return (
    <section
      className="lkdv-workout-player"
      data-status={execution.status}
      aria-label="Séance guidée en cours"
    >
      <div className="lkdv-workout-player-head">
        <span className="lkdv-workout-badge">
          {paused ? 'En pause' : 'En cours'}
        </span>
        <span>{session.title}</span>
        <span>{formatDurationS(remainingS(execution, session))} restantes</span>
      </div>

      <div className="lkdv-workout-current">
        <div>
          <span className="lkdv-workout-kicker">
            {step ? stepKindLabel(step.kind) : 'Étape'}
          </span>
          <h3 aria-live="polite">{step?.label ?? 'Séance'}</h3>
          {step ? <StepTargets step={step} /> : null}
        </div>
        <span className="lkdv-workout-clock" role="timer" aria-label="Temps restant de l’étape">
          {formatClockS(stepRemainingS)}
        </span>
      </div>

      <div
        className="lkdv-workout-progress"
        role="progressbar"
        aria-label="Progression de la séance"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="lkdv-workout-progress-label">
        {percent} % · {formatClockS(execution.elapsedS)} /{' '}
        {formatClockS(session.totalDurationS)}
      </p>

      {upcoming ? (
        <p className="lkdv-workout-next">
          Ensuite : <strong>{upcoming.label}</strong> ·{' '}
          <StepTargets step={upcoming} />
        </p>
      ) : (
        <p className="lkdv-workout-next">Dernière étape de la séance.</p>
      )}

      <div className="lkdv-workout-controls">
        <button
          type="button"
          className="lkdv-workout-primary"
          onClick={paused ? onResume : onPause}
        >
          {paused ? (
            <Play size={16} aria-hidden="true" />
          ) : (
            <Pause size={16} aria-hidden="true" />
          )}
          {paused ? 'Reprendre' : 'Pause'}
        </button>
        <button type="button" className="lkdv-workout-secondary" onClick={onSkip}>
          <SkipForward size={16} aria-hidden="true" />
          Étape suivante
        </button>
        <button type="button" className="lkdv-workout-ghost" onClick={onStop}>
          <Square size={15} aria-hidden="true" />
          Arrêter
        </button>
        <button
          type="button"
          className="lkdv-workout-secondary"
          aria-pressed={audioCues}
          onClick={() => setAudioCues((prev) => !prev)}
        >
          {audioCues ? (
            <Volume2 size={16} aria-hidden="true" />
          ) : (
            <VolumeX size={16} aria-hidden="true" />
          )}
          {audioCues ? 'Audio actif' : 'Guidage audio'}
        </button>
      </div>

      <div className="lkdv-workout-transfer">
        <button
          type="button"
          className="lkdv-workout-secondary"
          onClick={() => setTransferNotice(transfer.detail)}
          aria-describedby="lkdv-workout-transfer-status"
        >
          <Watch size={16} aria-hidden="true" />
          Envoyer vers montre
        </button>
        <button
          type="button"
          className="lkdv-workout-secondary"
          onClick={() => {
            triggerFileDownload(
              `${session.id}.tcx`,
              buildStructuredWorkoutTcx(session),
              'application/vnd.garmin.tcx+xml'
            );
            setTransferNotice(`Fichier ${session.id}.tcx généré pour montre GPS.`);
          }}
        >
          <Download size={15} aria-hidden="true" />
          Exporter .TCX
        </button>
        <button
          type="button"
          className="lkdv-workout-secondary"
          onClick={() => {
            triggerFileDownload(
              `${session.id}.json`,
              buildStructuredWorkoutJson(session),
              'application/json'
            );
            setTransferNotice(`Fichier ${session.id}.json généré.`);
          }}
        >
          <Download size={15} aria-hidden="true" />
          Exporter .JSON
        </button>
        <span className="lkdv-workout-transfer-state">
          {watchTransferLabel(transfer)}
        </span>
      </div>
      {transferNotice ? (
        <p
          className="lkdv-workout-transfer-notice"
          id="lkdv-workout-transfer-status"
          role="status"
        >
          {transferNotice} L’exécution locale reste disponible.
        </p>
      ) : (
        <p className="lkdv-workout-transfer-hint" id="lkdv-workout-transfer-status">
          Sans connecteur compatible, la séance se poursuit uniquement sur le
          téléphone.
        </p>
      )}
    </section>
  );
}
