import { describe, it, expect } from 'vitest';
import { getDifficultyColor } from '@/components/explorer/types';

/** Palette Liquid Glass autorisée pour la difficulté (docs/Design-tokens.md). */
const DS_PALETTE = ['#5B7F55', '#C89A3B', '#A8443A', '#17402C', '#5A7064'];

/** Couleurs bannies par le design system (héritage Tailwind par défaut). */
const BANNED_COLORS = [
  '#22c55e',
  '#f97316',
  '#ef4444',
  '#7c3aed',
  '#6b7280',
  '#E4501C',
  '#1C2620',
  '#2D5A3D',
  '#0B1F17',
];

describe('getDifficultyColor — palette Liquid Glass (ATLAS-R3)', () => {
  it('mappe chaque difficulté sur le token DS correspondant', () => {
    expect(getDifficultyColor('Facile')).toBe('#5B7F55');
    expect(getDifficultyColor('Modérée')).toBe('#C89A3B');
    expect(getDifficultyColor('Difficile')).toBe('#A8443A');
    expect(getDifficultyColor('Expert')).toBe('#17402C');
    expect(getDifficultyColor(null)).toBe('#5A7064');
    expect(getDifficultyColor(undefined)).toBe('#5A7064');
  });

  it('accepte les variantes anglaises et ne retourne jamais une couleur bannie', () => {
    const values = [
      'Facile',
      'facile',
      'Modérée',
      'moderee',
      'moderate',
      'Difficile',
      'difficult',
      'Expert',
      'très difficile',
      null,
      undefined,
      'inconnu',
    ].map((d) => getDifficultyColor(d));

    for (const value of values) {
      expect(BANNED_COLORS).not.toContain(value);
      expect(DS_PALETTE).toContain(value);
    }
  });
});
