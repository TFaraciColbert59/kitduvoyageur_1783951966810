import { describe, expect, it } from 'vitest';
import { buildRecoveryProgram } from '../domain/recovery';

const NOW = Date.parse('2026-11-11T12:00:00.000Z');

function hoursAgo(hours: number): string {
  return new Date(NOW - hours * 3_600_000).toISOString();
}

describe('récupération liée à la pratique', () => {
  it('n’invente aucun programme sans pratique', () => {
    const program = buildRecoveryProgram({
      lastPracticeAt: null,
      now: NOW,
    });

    expect(program.status).toBe('absent');
    expect(program.reason).toBe('practice_absent');
    expect(program.exercises).toEqual([]);
    expect(program.basedOn.hoursSincePractice).toBeNull();
  });

  it('refuse une date illisible', () => {
    const program = buildRecoveryProgram({
      lastPracticeAt: 'pas-une-date',
      now: NOW,
    });
    expect(program.status).toBe('absent');
    expect(program.reason).toBe('invalid_practice');
  });

  it('refuse une pratique datée dans le futur', () => {
    const program = buildRecoveryProgram({
      lastPracticeAt: new Date(NOW + 2 * 3_600_000).toISOString(),
      now: NOW,
    });
    expect(program.status).toBe('absent');
    expect(program.reason).toBe('invalid_practice');
  });

  it('arrête les exercices en cas de douleur importante', () => {
    const program = buildRecoveryProgram({
      lastPracticeAt: hoursAgo(3),
      soreness: 'high',
      now: NOW,
    });

    expect(program.status).toBe('rest');
    expect(program.reason).toBe('high_soreness');
    expect(program.exercises).toEqual([]);
    expect(program.summary).toMatch(/professionnel de santé/i);
  });

  it('propose une récupération immédiate après une pratique récente', () => {
    const program = buildRecoveryProgram({
      lastPracticeAt: hoursAgo(2),
      sport: 'course',
      sportStatus: 'known',
      level: 'intermediaire',
      now: NOW,
    });

    expect(program.status).toBe('ready');
    expect(program.reason).toBe('practice_recent');
    expect(program.basedOn.hoursSincePractice).toBe(2);
    expect(program.basedOn.sport).toBe('course');
    expect(program.exercises.length).toBeGreaterThan(0);
    expect(program.exercises.every((exercise) => exercise.durationS! > 0)).toBe(
      true
    );
    expect(program.disclaimer).toMatch(/professionnel de santé/i);
  });

  it('ajoute une marche souple le lendemain', () => {
    const program = buildRecoveryProgram({
      lastPracticeAt: hoursAgo(30),
      now: NOW,
    });

    expect(program.status).toBe('ready');
    expect(program.exercises.some((exercise) => exercise.id === 'marche-souple')).toBe(
      true
    );
  });

  it('ne prescrit rien après 72 heures', () => {
    const program = buildRecoveryProgram({
      lastPracticeAt: hoursAgo(72),
      now: NOW,
    });

    expect(program.status).toBe('absent');
    expect(program.reason).toBe('practice_old');
    expect(program.exercises).toEqual([]);
  });

  it('module la durée selon le niveau, sans changer la nature', () => {
    const beginner = buildRecoveryProgram({
      lastPracticeAt: hoursAgo(2),
      level: 'debutant',
      now: NOW,
    });
    const advanced = buildRecoveryProgram({
      lastPracticeAt: hoursAgo(2),
      level: 'avance',
      now: NOW,
    });

    const beginnerTotal = beginner.exercises.reduce(
      (sum, exercise) => sum + (exercise.durationS ?? 0),
      0
    );
    const advancedTotal = advanced.exercises.reduce(
      (sum, exercise) => sum + (exercise.durationS ?? 0),
      0
    );
    expect(advancedTotal).toBeGreaterThan(beginnerTotal);
    expect(advanced.exercises.map((exercise) => exercise.id)).toEqual(
      beginner.exercises.map((exercise) => exercise.id)
    );
  });

  it('annonce un sport inconnu sans le déduire', () => {
    const program = buildRecoveryProgram({
      lastPracticeAt: hoursAgo(10),
      sport: null,
      sportStatus: 'unknown',
      now: NOW,
    });

    expect(program.basedOn.sport).toBeNull();
    expect(program.basedOn.sportStatus).toBe('unknown');
  });
});
