import { describe, expect, it } from 'vitest';
import {
  availablePlans,
  buildCyclingPlan,
  buildRunningPlan,
  buildTrainingPlan,
  findBuiltInSession,
  resetBuiltInSessionIndex,
  weekLoadFactor,
} from '../domain/plans';
import { sessionDurationS } from '../domain/sessionFactory';

function allSessions(plan: ReturnType<typeof buildRunningPlan>) {
  return plan.weeks.flatMap((week) => week.sessions);
}

describe('plans LKDV — course', () => {
  it('construit un plan 10 km progressif avec semaine allégée', () => {
    const plan = buildRunningPlan('10k', 'intermediaire');

    expect(plan.version).toBe(1);
    expect(plan.provider).toBe('lkdv');
    expect(plan.weeks).toHaveLength(8);
    expect(plan.sessionsPerWeek).toBe(4);

    for (const week of plan.weeks) {
      expect(week.sessions).toHaveLength(4);
      expect(week.totalDurationS).toBe(
        week.sessions.reduce((sum, session) => sum + session.totalDurationS, 0)
      );
    }

    expect(plan.weeks[1].totalDurationS).toBeGreaterThan(
      plan.weeks[0].totalDurationS
    );
    expect(plan.weeks[3].isRecoveryWeek).toBe(true);
    expect(plan.weeks[3].totalDurationS).toBeLessThan(
      plan.weeks[2].totalDurationS
    );
    expect(plan.weeks[7].totalDurationS).toBeLessThan(
      plan.weeks[6].totalDurationS
    );
  });

  it('produit des séances valides, identifiants uniques et cibles cohérentes', () => {
    const plan = buildRunningPlan('semi', 'avance');
    const sessions = allSessions(plan);
    const ids = sessions.map((session) => session.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(sessions).toHaveLength(10 * 5);
    for (const session of sessions) {
      expect(session.steps.length).toBeGreaterThan(0);
      expect(session.totalDurationS).toBe(sessionDurationS(session));
      for (const step of session.steps) {
        expect(step.durationS).toBeGreaterThan(0);
        for (const target of step.targets) {
          expect(target.basis).toBe('lkdv_prescription');
          if (target.min !== null && target.max !== null) {
            expect(target.min).toBeLessThanOrEqual(target.max);
          }
        }
      }
    }

    const intents = new Set(sessions.map((session) => session.intent));
    expect(intents.has('interval')).toBe(true);
    expect(intents.has('tempo')).toBe(true);
    expect(intents.has('endurance')).toBe(true);
  });

  it('garde les allures en secondes par kilomètre positives', () => {
    const plan = buildRunningPlan('marathon', 'debutant');
    const paceTargets = allSessions(plan)
      .flatMap((session) => session.steps)
      .flatMap((step) => step.targets)
      .filter((target) => target.unit === 's_per_km');

    expect(paceTargets.length).toBeGreaterThan(0);
    for (const target of paceTargets) {
      if (target.min !== null) expect(target.min).toBeGreaterThan(120);
      if (target.max !== null) expect(target.max).toBeGreaterThan(120);
    }
  });
});

describe('plans LKDV — vélo', () => {
  it('ne prescrit jamais de puissance sans FTP mesuré', () => {
    const plan = buildCyclingPlan('puissance', 'avance');
    const targets = allSessions(plan)
      .flatMap((session) => session.steps)
      .flatMap((step) => step.targets);

    expect(plan.weeks).toHaveLength(8);
    expect(plan.sessionsPerWeek).toBe(5);
    expect(targets.some((target) => target.unit === 'w')).toBe(false);
    expect(targets.some((target) => target.unit === 'rpe')).toBe(true);
    expect(targets.some((target) => target.unit === 'rpm')).toBe(true);
  });

  it('propose une reprise sans séance intense', () => {
    const plan = buildCyclingPlan('reprise', 'debutant');
    const intents = new Set(
      allSessions(plan).map((session) => session.intent)
    );

    expect(plan.weeks).toHaveLength(6);
    expect(plan.sessionsPerWeek).toBe(3);
    expect(intents.has('interval')).toBe(false);
    expect(intents.has('tempo')).toBe(false);
  });
});

describe('plans LKDV — contrat', () => {
  it('refuse un objectif incompatible avec le sport', () => {
    expect(() =>
      buildTrainingPlan({ sport: 'course', goal: 'puissance', level: 'avance' })
    ).toThrow(/incompatible/i);
    expect(() =>
      buildTrainingPlan({ sport: 'velo', goal: '10k', level: 'avance' })
    ).toThrow(/incompatible/i);
  });

  it('refuse un niveau inconnu', () => {
    expect(() =>
      buildTrainingPlan({
        sport: 'course',
        goal: '10k',
        level: 'expert' as never,
      })
    ).toThrow(/Niveau/i);
  });

  it('indexe toutes les séances intégrées et retourne null pour une inconnue', () => {
    resetBuiltInSessionIndex();
    const plan = buildRunningPlan('5k', 'debutant');
    const first = plan.weeks[0].sessions[0];

    expect(findBuiltInSession(first.id)?.id).toBe(first.id);
    expect(findBuiltInSession('inconnue')).toBeNull();
  });

  it('expose 21 plans valides et tous natifs LKDV', () => {
    const plans = availablePlans();
    expect(plans).toHaveLength(21);
    expect(plans.every((plan) => plan.provider === 'lkdv')).toBe(true);
  });

  it('allège la quatrième semaine et l’affûtage', () => {
    expect(weekLoadFactor(4, 8)).toBeLessThan(weekLoadFactor(3, 8));
    expect(weekLoadFactor(8, 8)).toBeLessThan(weekLoadFactor(7, 8));
    expect(weekLoadFactor(2, 8)).toBeGreaterThan(weekLoadFactor(1, 8));
  });
});
