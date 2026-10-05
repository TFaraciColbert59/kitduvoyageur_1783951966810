import { describe, expect, it } from 'vitest';
import { untangleStages } from '../engine/stageOrder';

const P = {
  rennes: { lat: 48.11, lon: -1.68 },
  stMalo: { lat: 48.65, lon: -2.03 },
  perros: { lat: 48.82, lon: -3.46 },
  brest: { lat: 48.39, lon: -4.49 },
  quimper: { lat: 48.0, lon: -4.1 },
  vannes: { lat: 47.66, lon: -2.76 },
};
const st = (day: number, name: keyof typeof P, note: string | null = null) => ({ day, name, ...P[name], note });

describe('untangleStages', () => {
  it('remet un circuit en zigzag dans un ordre direct, séjours et notes intacts', () => {
    const r = untangleStages([
      st(1, 'rennes'),
      st(2, 'brest', 'phare'),
      st(3, 'brest'),
      st(4, 'stMalo', 'remparts'),
      st(5, 'quimper'),
      st(6, 'perros'),
      st(7, 'vannes'),
    ]);
    expect(r.reordered).toBe(true);
    expect(r.savedKm).toBeGreaterThan(100);
    expect(r.stages.map((s) => s.name)).toEqual(['rennes', 'stMalo', 'perros', 'brest', 'brest', 'quimper', 'vannes']);
    expect(r.stages.map((s) => s.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(r.stages.find((s) => s.name === 'stMalo')?.note).toBe('remparts');
    expect(r.stages.filter((s) => s.name === 'brest').map((s) => s.note)).toEqual(['phare', null]);
  });

  it('ne touche pas un itinéraire déjà sensé', () => {
    const input = [st(1, 'rennes'), st(2, 'stMalo'), st(3, 'perros'), st(4, 'brest'), st(5, 'quimper'), st(6, 'vannes')];
    const r = untangleStages(input);
    expect(r.reordered).toBe(false);
    expect(r.stages.map((s) => s.name)).toEqual(input.map((s) => s.name));
  });

  it('garde l’arrivée et le départ, et ne fait rien sous quatre séjours', () => {
    const r = untangleStages([st(1, 'rennes'), st(2, 'brest'), st(3, 'stMalo')]);
    expect(r.reordered).toBe(false);
  });

  it('tient un long circuit (2-opt au-delà de 7 séjours)', () => {
    const names = ['rennes', 'brest', 'stMalo', 'quimper', 'perros', 'vannes', 'brest', 'stMalo', 'quimper', 'rennes'] as const;
    // Séjours distincts consécutifs : on alterne pour éviter les regroupements.
    const r = untangleStages(names.map((n, i) => st(i + 1, n)));
    expect(r.stages).toHaveLength(names.length);
    expect(r.stages[0].name).toBe('rennes');
    expect(r.stages[r.stages.length - 1].name).toBe('rennes');
  });
});
