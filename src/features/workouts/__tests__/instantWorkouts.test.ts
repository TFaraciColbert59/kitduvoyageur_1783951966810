import { describe, expect, it } from 'vitest';
import { proposeWeeklyWorkouts } from '../domain/instantWorkouts';
import type { PracticeHistory } from '../domain/types';

const completeHistory = (
  sessionsLast7d: number,
  sport: 'course' | 'velo' = 'course'
): PracticeHistory => ({
  sessionsLast7d,
  lastPracticeAt: new Date().toISOString(),
  sport,
  sportStatus: 'known',
});

describe('séances instantanées', () => {
  it('propose sans historique, avec un avertissement explicite', () => {
    const proposal = proposeWeeklyWorkouts({
      sport: 'course',
      goal: '10k',
      level: 'intermediaire',
      availableDays: 4,
      history: null,
    });

    expect(proposal.version).toBe(1);
    expect(proposal.provider).toBe('lkdv');
    expect(proposal.historyStatus).toBe('absent');
    expect(proposal.sessions).toHaveLength(4);
    expect(proposal.warnings.join(' ')).toMatch(/Historique indisponible/);
    expect(proposal.sessions.every((session) => session.planId === null)).toBe(
      true
    );
    expect(proposal.sessions.every((session) => session.week === null)).toBe(
      true
    );
  });

  it('allège la semaine après cinq sorties ou plus', () => {
    const proposal = proposeWeeklyWorkouts({
      sport: 'course',
      goal: '10k',
      level: 'avance',
      availableDays: 5,
      history: completeHistory(6),
    });

    expect(proposal.historyStatus).toBe('complete');
    expect(proposal.sessions.length).toBeLessThanOrEqual(2);
    expect(
      proposal.sessions.every(
        (session) =>
          session.intent === 'recovery' || session.intent === 'endurance'
      )
    ).toBe(true);
    expect(proposal.rationale.join(' ')).toMatch(/semaine allégée/i);
  });

  it('ignore un historique d’un autre sport', () => {
    const proposal = proposeWeeklyWorkouts({
      sport: 'velo',
      goal: 'endurance',
      level: 'intermediaire',
      availableDays: 3,
      history: completeHistory(2, 'course'),
    });

    expect(proposal.historyStatus).toBe('absent');
    expect(proposal.warnings.join(' ')).toMatch(/n’est pas utilisé/);
  });

  it('signale un historique partiel quand le sport est inconnu', () => {
    const proposal = proposeWeeklyWorkouts({
      sport: 'course',
      goal: '5k',
      level: 'debutant',
      availableDays: 3,
      history: {
        sessionsLast7d: 2,
        lastPracticeAt: new Date().toISOString(),
        sport: null,
        sportStatus: 'unknown',
      },
    });

    expect(proposal.historyStatus).toBe('partial');
    expect(proposal.warnings.join(' ')).toMatch(/sport de l’historique/i);
    expect(proposal.sessions).toHaveLength(3);
  });


  it('reste partiel quand le sport est déclaré connu mais absent', () => {
    const proposal = proposeWeeklyWorkouts({
      sport: 'course',
      goal: '10k',
      level: 'intermediaire',
      availableDays: 3,
      history: {
        sessionsLast7d: 2,
        lastPracticeAt: new Date().toISOString(),
        sport: null,
        sportStatus: 'known',
      },
    });
    expect(proposal.historyStatus).toBe('partial');
  });

  it('respecte un seul jour disponible', () => {
    const proposal = proposeWeeklyWorkouts({
      sport: 'velo',
      goal: 'puissance',
      level: 'avance',
      availableDays: 1,
      history: null,
    });

    expect(proposal.sessions).toHaveLength(1);
    expect(proposal.warnings.join(' ')).toMatch(/1 jour/);
  });

  it('borne les jours disponibles et garde des identifiants uniques', () => {
    const proposal = proposeWeeklyWorkouts({
      sport: 'course',
      goal: 'semi',
      level: 'avance',
      availableDays: 99,
      history: null,
    });
    const ids = proposal.sessions.map((session) => session.id);

    expect(proposal.sessions).toHaveLength(5);
    expect(new Set(ids).size).toBe(ids.length);
    expect(proposal.sessions.every((session) => session.totalDurationS > 0)).toBe(
      true
    );
  });

  it('refuse un objectif incompatible', () => {
    expect(() =>
      proposeWeeklyWorkouts({
        sport: 'course',
        goal: 'endurance',
        level: 'debutant',
        availableDays: 3,
      })
    ).toThrow(/incompatible/i);
  });
});
