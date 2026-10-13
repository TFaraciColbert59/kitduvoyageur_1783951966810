import { describe, expect, it } from 'vitest';
import { unifyStageNames, untangleStages } from '../engine/stageOrder';

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

describe('stagePlaceName', () => {
  it('garde le lieu seul', async () => {
    const { stagePlaceName } = await import('../engine/autofill');
    expect(stagePlaceName('Departure from Glasgow')).toBe('Glasgow');
    expect(stagePlaceName('Départ de Lyon')).toBe('Lyon');
    expect(stagePlaceName("Retour à Reykjavik (aéroport)")).toBe('Reykjavik');
    expect(stagePlaceName('Jour 3 - Arrivée à Oban')).toBe('Oban');
    expect(stagePlaceName('Isle of Skye - Portree')).toBe('Isle of Skye - Portree');
    expect(stagePlaceName('Départementale')).toBe('Départementale');
    expect(stagePlaceName('Départ des Alpes')).toBe('Alpes');
    expect(stagePlaceName('Retour au Havre')).toBe('Havre');
    expect(stagePlaceName('Arrivée aux Deux Alpes')).toBe('Deux Alpes');
    expect(stagePlaceName("Départ d'Annecy")).toBe('Annecy');
    expect(stagePlaceName('Départ du Puy')).toBe('Puy');
  });
});

describe('unifyStageNames', () => {
  it('un même lieu garde un seul nom (Seville / Séville, Malaga / Málaga)', () => {
    const st = (day: number, name: string, lat: number, lon: number) => ({ day, name, lat, lon, move: 'voiture' });
    const out = unifyStageNames([
      st(1, 'Seville', 37.389, -5.984),
      st(2, 'Cordoue', 37.884, -4.779),
      st(5, 'Malaga', 36.721, -4.421),
      st(6, 'Málaga', 36.7213, -4.4214),
      st(8, 'Séville', 37.3891, -5.9845),
    ]);
    expect(out.map((s) => s.name)).toEqual(['Seville', 'Cordoue', 'Malaga', 'Malaga', 'Seville']);
    expect(out[4]).toMatchObject({ lat: 37.389, lon: -5.984, move: 'voiture', day: 8 });
  });
  it('même point, autre nom : le premier nom', () => {
    const out = unifyStageNames([
      { day: 1, name: 'Grenade', lat: 37.1773, lon: -3.5986 },
      { day: 2, name: 'Granada', lat: 37.1775, lon: -3.5985 },
      { day: 3, name: 'Alhambra Palace', lat: 37.176, lon: -3.588 },
    ]);
    expect(out.map((s) => s.name)).toEqual(['Grenade', 'Grenade', 'Alhambra Palace']);
  });
  it('un homonyme lointain reste un autre lieu (deux « Saint-Martin » à 200 km)', () => {
    const out = unifyStageNames([
      { day: 1, name: 'Saint-Martin', lat: 45.0, lon: 6.0 },
      { day: 2, name: 'Saint Martin', lat: 46.8, lon: 6.0 },
    ]);
    expect(out[1]).toMatchObject({ name: 'Saint Martin', lat: 46.8 });
  });
});
