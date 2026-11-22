import { describe, expect, it } from 'vitest';
import { groupPace, naismithDuration } from '../pace';

describe('naismithDuration', () => {
  it('4 km/h + 600 m/h : 12 km et 600 m = 4 h', () => {
    const r = naismithDuration(12, 600);
    expect(r.minutes).toBe(240);
    expect(r.isLowerBound).toBe(false);
    expect(r.method).toBe('Naismith 4 km/h + 600 m/h');
  });
  it('paramètres réglables', () => {
    const r = naismithDuration(10, 500, { speedKmh: 5, ascentMPerHour: 500 });
    expect(r.minutes).toBe(180);
    expect(r.method).toBe('Naismith 5 km/h + 500 m/h');
  });
  it('D+ inconnu : durée minimale annoncée, pas de D+ supposé nul', () => {
    const r = naismithDuration(8, null);
    expect(r.minutes).toBe(120);
    expect(r.isLowerBound).toBe(true);
    expect(r.method).toContain('D+ inconnu');
  });
  it('distance inconnue : null', () => {
    expect(naismithDuration(null, 100).minutes).toBeNull();
  });
});

describe('groupPace', () => {
  it('prend le plus lent', () => {
    const g = groupPace([
      { id: 'a', speedKmh: 4.5, ascentMPerHour: 600 },
      { id: 'b', speedKmh: 3, ascentMPerHour: 400 },
    ]);
    expect(g.params).toEqual({ speedKmh: 3, ascentMPerHour: 400 });
    expect(g.slowestMemberId).toBe('b');
    expect(g.basis).toBe('slowest_member');
  });
  it('allures inconnues : défaut annoncé, membres listés', () => {
    const g = groupPace([{ id: 'a' }, { id: 'b', speedKmh: null }]);
    expect(g.basis).toBe('default');
    expect(g.unknownMemberIds).toEqual(['a', 'b']);
    expect(g.method).toContain('non renseignées');
  });
  it('un membre inconnu n’abaisse pas l’allure à zéro', () => {
    const g = groupPace([{ id: 'a', speedKmh: 3.5 }, { id: 'b' }]);
    expect(g.params.speedKmh).toBe(3.5);
    expect(g.params.ascentMPerHour).toBe(600);
    expect(g.unknownMemberIds).toEqual(['b']);
  });
});
