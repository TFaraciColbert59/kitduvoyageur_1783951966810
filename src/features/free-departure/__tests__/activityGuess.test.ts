import { describe, expect, it } from 'vitest';
import { guessActivity, type FreeSessionSignals } from '../engine/activityGuess';

/** Session complete et plausible : le cas nominal de tous les autres tests. */
function signals(overrides: Partial<FreeSessionSignals> = {}): FreeSessionSignals {
  return {
    distanceKm: 8,
    durationSeconds: 2 * 3600,
    averageSpeedKmH: 4,
    elevationGainM: 320,
    ...overrides,
  };
}

describe('guessActivity — reconnaissance d’activite (A11)', () => {
  it('FREE-01: propose la randonnee sur une allure de marche', () => {
    const guess = guessActivity(signals({ averageSpeedKmH: 4.8 }));
    expect(guess?.activityId).toBe('rando-journee');
    expect(guess?.confidence).toBe('proposee');
  });

  it('FREE-02: propose la course sur une allure de course', () => {
    expect(guessActivity(signals({ averageSpeedKmH: 10 }))?.activityId).toBe('course');
  });

  it('FREE-03: propose le velo au-dela de l’allure pedestre', () => {
    expect(guessActivity(signals({ averageSpeedKmH: 22 }))?.activityId).toBe('velo-route');
  });

  it('FREE-04: ne propose RIEN sur une session trop courte', () => {
    // 8 minutes : aucune distinction d'activite n'est defendable.
    expect(guessActivity(signals({ durationSeconds: 8 * 60 }))).toBeNull();
  });

  it('FREE-05: ne propose rien sans distance mesurable', () => {
    // GPS refuse : la distance vaut `null`, pas 0.
    expect(guessActivity(signals({ distanceKm: null }))).toBeNull();
  });

  it('FREE-06: ne propose rien sur une distance trop courte', () => {
    expect(guessActivity(signals({ distanceKm: 0.1 }))).toBeNull();
  });

  it('FREE-07: ne propose rien sans vitesse calculable', () => {
    expect(guessActivity(signals({ averageSpeedKmH: null }))).toBeNull();
  });

  it('FREE-08: ne propose rien sur une vitesse arret / traceur a la derive', () => {
    expect(guessActivity(signals({ averageSpeedKmH: 1.2 }))).toBeNull();
  });

  it('FREE-09: ne propose rien sur une vitesse impossible (traceur casse)', () => {
    // 200 km/h de moyenne n'est pas une idee d'activite : c'est un bug.
    expect(guessActivity(signals({ averageSpeedKmH: 200 }))).toBeNull();
  });

  it('FREE-10: entre deux bandes, la lecture est dite incertaine', () => {
    // 7 km/h : trail ou course lente ? On ne pretend pas savoir.
    const guess = guessActivity(signals({ averageSpeedKmH: 7 }));
    expect(guess?.confidence).toBe('incertaine');
  });

  it('FREE-11: la justification cite la mesure reelle, jamais un pourcentage', () => {
    const guess = guessActivity(signals({ averageSpeedKmH: 5 }));
    expect(guess?.because).toContain('5 km/h');
    expect(guess?.because).not.toMatch(/%/);
  });

  it('FREE-12: le denivele est cite quand il existe, absent sinon', () => {
    expect(guessActivity(signals({ elevationGainM: 320 }))?.because).toContain('+320 m');
    expect(guessActivity(signals({ elevationGainM: null }))?.because).not.toContain('+320');
  });

  it('FREE-13: la proposition renvoie toujours une activite du catalogue', () => {
    for (const speed of [3.5, 5, 7, 10, 13, 20, 40]) {
      const guess = guessActivity(signals({ averageSpeedKmH: speed }));
      expect(guess, `vitesse ${speed}`).not.toBeNull();
      expect(guess?.label.length ?? 0).toBeGreaterThan(0);
    }
  });
});
