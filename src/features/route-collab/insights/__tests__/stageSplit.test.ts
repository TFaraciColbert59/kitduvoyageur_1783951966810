import { describe, expect, it } from 'vitest';
import { proposeStageSplit } from '../stageSplit';
import { baseWorkspace, basePoints, section } from './fixtures';

const refuge = { id: 'r1', name: 'Col', type: 'refuge' as const, lat: 45.9, lon: 6.13 };
const opts = { maxHoursPerDay: 4, maxAscentPerDay: 1500 };

describe('proposeStageSplit', () => {
  it('coupe au refuge fourni et l’explique en une phrase', () => {
    const p = proposeStageSplit(baseWorkspace(), { ...opts, overnightCandidates: [refuge] });
    expect(p.ok).toBe(true);
    expect(p.stages).toHaveLength(2);
    expect(p.stages[0].overnight?.id).toBe('r1');
    expect(p.stages[0].overnightStatus).toBe('candidate');
    expect(p.stages[1].overnightStatus).toBe('none');
    expect(p.explanation).toBe('2 jours de 4 h, nuit au refuge Col');
    expect(p.rule).toContain('Naismith 4 km/h + 600 m/h');
    expect(p.thresholds.maxHoursPerDay).toBe(4);
  });
  it('sans candidat : « nuit à trouver », aucun lieu inventé', () => {
    const p = proposeStageSplit(baseWorkspace(), { ...opts, overnightCandidates: [] });
    expect(p.stages[0].overnight).toBeNull();
    expect(p.stages[0].overnightStatus).toBe('to_find');
    expect(p.explanation).toContain('nuit à trouver');
  });
  it('un candidat trop loin du tracé est ignoré', () => {
    const far = { ...refuge, lat: 46.2 };
    const p = proposeStageSplit(baseWorkspace(), { ...opts, overnightCandidates: [far] });
    expect(p.stages[0].overnight).toBeNull();
  });
  it('nombre de jours imposé', () => {
    const p = proposeStageSplit(baseWorkspace(), { days: 2, maxHoursPerDay: 8, maxAscentPerDay: 3000, overnightCandidates: [refuge] });
    expect(p.stages).toHaveLength(2);
    expect(p.stages[0].overnight?.name).toBe('Col');
    expect(p.explanation).toMatch(/^2 jours de /);
  });
  it('un seul jour si les seuils le permettent', () => {
    const p = proposeStageSplit(baseWorkspace(), { maxHoursPerDay: 10, maxAscentPerDay: 3000, overnightCandidates: [refuge] });
    expect(p.stages).toHaveLength(1);
    expect(p.explanation).toBe('1 jour de 7 h');
  });
  it('D+ inconnu : durées minimales et avertissement, jamais un D+ à 0', () => {
    const [a, b, c] = basePoints();
    const ws = baseWorkspace({ sections: [section('s1', a, b, { ascentM: null }), section('s2', b, c)] });
    const p = proposeStageSplit(ws, { ...opts, overnightCandidates: [] });
    expect(p.stages[0].ascentM).toBeNull();
    expect(p.stages[0].durationIsLowerBound).toBe(true);
    expect(p.warnings.join(' ')).toContain('D+ inconnu');
  });
  it('sans tracé : échec explicite', () => {
    const p = proposeStageSplit(baseWorkspace({ sections: [] }), { ...opts, overnightCandidates: [] });
    expect(p.ok).toBe(false);
  });
});
