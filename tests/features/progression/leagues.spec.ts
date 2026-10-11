/** T36 — ligues : population minimale réelle, ordre gelé déterministe, aucune ligue fantôme. */
import { describe, it, expect } from 'vitest';
import { MIN_LEAGUE_POPULATION, buildLeagueCohorts, eligibleForLeagues } from '@/features/progression/domain/leagues';

function candidate(index: number, overrides: Partial<Parameters<typeof eligibleForLeagues>[0][number]> = {}) {
  return {
    userId: `u-${String(index).padStart(3, '0')}`,
    seasonPoints: index,
    isDemo: false,
    competitionOptIn: true,
    ...overrides,
  };
}

describe('ligues', () => {
  it('population faible ou sans opt-in → aucune cohorte', () => {
    expect(buildLeagueCohorts(Array.from({ length: 19 }, (_, i) => candidate(i)))).toEqual([]);
    const optedOut = Array.from({ length: 25 }, (_, i) => candidate(i, { competitionOptIn: false }));
    expect(buildLeagueCohorts(optedOut)).toEqual([]);
  });

  it('démos exclues de la population réelle', () => {
    const mostlyDemo = Array.from({ length: 30 }, (_, i) => candidate(i, { isDemo: i < 15 }));
    expect(eligibleForLeagues(mostlyDemo).length).toBe(15);
    expect(buildLeagueCohorts(mostlyDemo)).toEqual([]);
  });

  it('formation gelée déterministe : ordre stable, cohortes pleines sauf la dernière', () => {
    const candidates = Array.from({ length: 25 }, (_, i) => candidate(i, { seasonPoints: 100 - i }));
    const first = buildLeagueCohorts(candidates, 10);
    const second = buildLeagueCohorts([...candidates].reverse(), 10);
    expect(first).toEqual(second);
    expect(first.map((cohort) => cohort.length)).toEqual([10, 10, 5]);
    expect(first[0][0]).toBe('u-000');
    expect(MIN_LEAGUE_POPULATION).toBe(20);
  });

  it('égalité de points : départage par user_id, stable sur la période', () => {
    const tied = Array.from({ length: 20 }, (_, i) => candidate(i, { seasonPoints: 50 }));
    const cohorts = buildLeagueCohorts(tied, 20);
    expect(cohorts[0][0]).toBe('u-000');
    expect(cohorts[0][19]).toBe('u-019');
  });
});
