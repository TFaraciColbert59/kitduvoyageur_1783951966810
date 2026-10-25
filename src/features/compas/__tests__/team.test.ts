import { describe, expect, it } from 'vitest';
import { teamCount, teamCountLabel } from '../engine/team';

describe('teamCount', () => {
  it('répartit présents, en attente et places libres sur la taille prévue', () => {
    expect(teamCount(5, 2, 1)).toEqual({ present: 2, pending: 1, free: 2, total: 5 });
    expect(teamCountLabel(teamCount(5, 2, 1))).toBe(
      '2 présents · 1 en attente · 2 places libres · 5 au total'
    );
  });

  it('le total suit l’équipe quand elle dépasse la taille prévue', () => {
    expect(teamCount(2, 2, 2)).toEqual({ present: 2, pending: 2, free: 0, total: 4 });
    expect(teamCountLabel(teamCount(2, 2, 2))).toBe('2 présents · 2 en attente · 4 au total');
  });

  it('jamais de nombre négatif ni de total nul', () => {
    expect(teamCount(0, 1, 0)).toEqual({ present: 1, pending: 0, free: 0, total: 1 });
    expect(teamCountLabel(teamCount(1, 1, 0))).toBe('1 présent · 1 au total');
    expect(teamCount(Number.NaN, -3, -1)).toEqual({ present: 0, pending: 0, free: 1, total: 1 });
  });
});
