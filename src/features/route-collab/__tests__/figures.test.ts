import { describe, expect, it } from 'vitest';
import { formatDuration, routeFigures, unknownKm, unknownNote } from '../components/workspace/ui/figures';
import { pt, section } from '../insights/__tests__/fixtures';

const a = pt('a', 'A', 45, 5);
const b = pt('b', 'M', 45.05, 5.05);
const c = pt('c', 'Z', 45.1, 5.1);

describe('figures · tuiles chiffrées et inconnu jamais à zéro (4.4, 4.5)', () => {
  it('tout connu : distance, D+, D−, durée sommés ; la méthode nomme le fournisseur', () => {
    const f = routeFigures({ points: [a, b, c], sections: [section('s1', a, b), section('s2', b, c)] });
    expect(f.map((x) => x.value.replace(/\u202f/g, ' '))).toEqual(['20 km', '1 200 m', '600 m', '5 h']);
    expect(f.every((x) => x.known && x.note === null)).toBe(true);
    expect(f[0].method).toBe('Somme de 2 tronçons · test');
  });

  it('D+ inconnu sur un tronçon : « Inconnu » et « D+ inconnu sur 10 km », jamais 0 m', () => {
    const f = routeFigures({
      points: [a, b, c],
      sections: [section('s1', a, b), section('s2', b, c, { ascentM: null, distanceKm: 3 })],
    });
    const ascent = f[1];
    expect(ascent.value).toBe('Inconnu');
    expect(ascent.value).not.toMatch(/^0/);
    expect(ascent.note).toBe('D+ inconnu sur 3 km · 600 m connus ailleurs');
    expect(ascent.method).toMatch(/aucun dénivelé n’est supposé/);
    expect(f[2].value).toBe('600 m');
  });

  it('durée inconnue : estimation Naismith écrite « ≈ » avec sa méthode, jamais présentée comme mesurée', () => {
    const f = routeFigures({
      points: [a, b, c],
      sections: [section('s1', a, b, { durationMin: null }), section('s2', b, c)],
    });
    const d = f[3];
    expect(d.known).toBe(false);
    expect(d.value).toMatch(/^≈ /);
    expect(d.note).toBe('estimée');
    expect(d.method).toBe('Naismith 4 km/h + 600 m/h');
  });

  it('D+ et durée inconnus : la durée est un minimum annoncé', () => {
    const f = routeFigures({
      points: [a, b],
      sections: [section('s1', a, b, { durationMin: null, ascentM: null })],
    });
    expect(f[3].note).toBe('estimée, minimum (D+ inconnu)');
    expect(f[3].method).toMatch(/D\+ inconnu/);
  });

  it('aucun tronçon : tout est inconnu, rien n’est affiché à zéro', () => {
    const f = routeFigures({ points: [a], sections: [] });
    expect(f.map((x) => x.value)).toEqual(['Inconnue', 'Inconnu', 'Inconnu', 'Inconnue']);
    expect(f.every((x) => x.note === 'Aucun tronçon tracé')).toBe(true);
  });

  it('formats', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(125)).toBe('2 h 05');
    expect(formatDuration(120)).toBe('2 h');
    expect(unknownKm([section('s', a, b, { ascentM: null, distanceKm: 3.04 })], 'ascentM')).toBe(3);
    expect(unknownNote('Durée', 2)).toBe('Durée inconnue sur 2 km');
  });
});
