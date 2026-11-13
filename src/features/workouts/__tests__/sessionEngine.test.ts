import { describe, expect, it } from 'vitest';
import { makeStep, finalizeSession } from '../domain/sessionFactory';
import {
  advanceExecution,
  createExecution,
  currentStep,
  isExecutionResumable,
  nextStep,
  parseExecution,
  pauseExecution,
  remainingS,
  resumeExecution,
  sessionProgress,
  skipStep,
  stepElapsedS,
  validateSession,
} from '../domain/sessionEngine';
import type { StructuredSession } from '../domain/types';

function session(): StructuredSession {
  return finalizeSession({
    id: 'test-session',
    planId: null,
    sport: 'course',
    goal: '10k',
    level: 'intermediaire',
    week: null,
    title: 'Test',
    intent: 'interval',
    steps: [
      makeStep({ id: 's1', kind: 'warmup', label: 'Échauffement', durationS: 60 }),
      makeStep({ id: 's2', kind: 'interval', label: 'Effort', durationS: 120 }),
      makeStep({ id: 's3', kind: 'cooldown', label: 'Retour', durationS: 60 }),
    ],
  });
}

describe('moteur de séance', () => {
  it('démarre, avance et expose l’étape et la cible courantes', () => {
    const s = session();
    const execution = createExecution(s, 1_000, 'exec-1');

    expect(execution.status).toBe('running');
    expect(currentStep(execution, s)?.id).toBe('s1');
    expect(nextStep(execution, s)?.id).toBe('s2');

    const at30 = advanceExecution(execution, s, 31_000);
    expect(at30.elapsedS).toBe(30);
    expect(currentStep(at30, s)?.id).toBe('s1');
    expect(stepElapsedS(at30, s)).toBe(30);

    const at70 = advanceExecution(at30, s, 71_000);
    expect(at70.elapsedS).toBe(70);
    expect(currentStep(at70, s)?.id).toBe('s2');
    expect(stepElapsedS(at70, s)).toBe(10);
    expect(sessionProgress(at70, s)).toBeCloseTo(70 / 240, 5);
    expect(remainingS(at70, s)).toBe(170);
  });

  it('exclut la pause du temps actif et reprend au bon endroit', () => {
    const s = session();
    let execution = createExecution(s, 0, 'exec-2');
    execution = advanceExecution(execution, s, 30_000);
    execution = pauseExecution(execution, s, 40_000);

    expect(execution.status).toBe('paused');
    expect(execution.elapsedS).toBe(40);
    expect(execution.pausedAt).toBe(40_000);

    execution = resumeExecution(execution, 200_000);
    expect(execution.status).toBe('running');
    expect(execution.runningSince).toBe(200_000);

    execution = advanceExecution(execution, s, 230_000);
    expect(execution.elapsedS).toBe(70);
    expect(currentStep(execution, s)?.id).toBe('s2');
  });

  it('saute une étape et termine sur la dernière', () => {
    const s = session();
    let execution = createExecution(s, 0, 'exec-3');

    execution = skipStep(execution, s, 10_000);
    expect(execution.elapsedS).toBe(60);
    expect(currentStep(execution, s)?.id).toBe('s2');

    execution = skipStep(execution, s, 20_000);
    expect(execution.elapsedS).toBe(180);
    expect(currentStep(execution, s)?.id).toBe('s3');

    execution = skipStep(execution, s, 30_000);
    expect(execution.status).toBe('completed');
    expect(execution.elapsedS).toBe(240);
    expect(currentStep(execution, s)).toBeNull();
  });

  it('termine exactement à la durée totale', () => {
    const s = session();
    let execution = createExecution(s, 0, 'exec-4');
    execution = advanceExecution(execution, s, 240_000);

    expect(execution.status).toBe('completed');
    expect(execution.elapsedS).toBe(240);
    expect(execution.completedAt).toBe(240_000);
    expect(sessionProgress(execution, s)).toBe(1);
    expect(remainingS(execution, s)).toBe(0);
  });

  it('relit une exécution valide et refuse une version inconnue', () => {
    const s = session();
    const execution = createExecution(s, 0, 'exec-5');

    const parsed = parseExecution(JSON.parse(JSON.stringify(execution)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.execution.executionId).toBe('exec-5');

    expect(parseExecution({ ...execution, version: 99 })).toEqual({
      ok: false,
      reason: 'version',
    });
    expect(parseExecution({ ...execution, status: 'flying' })).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(parseExecution(null)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('limite la reprise dans le temps', () => {
    const s = session();
    const execution = createExecution(s, 0, 'exec-6');

    expect(isExecutionResumable(execution, 1_000)).toBe(true);
    expect(isExecutionResumable(execution, 8 * 24 * 60 * 60 * 1000)).toBe(false);
    expect(
      isExecutionResumable(
        { ...execution, status: 'completed', elapsedS: s.totalDurationS },
        1_000
      )
    ).toBe(false);
  });

  it('refuse une séance incohérente', () => {
    const s = session();
    expect(validateSession(s)).toEqual([]);
    expect(validateSession({ ...s, totalDurationS: 999 })).toContain(
      'Durée totale incohérente avec les étapes.'
    );
    expect(validateSession({ ...s, steps: [] })).toContain('Séance sans étape.');
    expect(
      validateSession({
        ...s,
        steps: [s.steps[0], s.steps[0], s.steps[2]],
      })
    ).toContain('Étape dupliquée : s1.');
    expect(() => createExecution({ ...s, steps: [] }, 0)).toThrow(/invalide/i);
  });
});
