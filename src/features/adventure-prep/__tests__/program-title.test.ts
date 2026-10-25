import { describe, expect, it } from 'vitest';
import { programTitle } from '../engine/labels';

describe('S13 — le titre du programme nomme une realite', () => {
  it('S13-01: l activite du catalogue reste le titre', () => {
    expect(programTitle('Randonnee en refuge', 'peu importe')).toBe('Randonnee en refuge');
  });

  it('S13-02: sans activite, le programme porte l invite libre', () => {
    // « Partir librement » interdit d inventer une activite. La seule chose
    // reelle qui decrit le parcours est la phrase ecrite par la personne.
    expect(programTitle(null, 'Randonnee autour de Chamonix')).toBe('Randonnee autour de Chamonix');
  });

  it('S13-03: ne dit jamais « Activite inconnue »', () => {
    expect(programTitle(null, null)).not.toContain('inconnue');
    expect(programTitle(null, '   ')).not.toContain('inconnue');
  });

  it('S13-04: raccourcit une invite libre trop longue pour la pastille', () => {
    const long = 'UneQuiteLonguePhraseQuiDebordeLaPastilleEtQuiNEnFinitPlusDeFaireDuTexte';
    const out = programTitle(null, long);
    expect(out.length).toBeLessThanOrEqual(48);
    expect(out.endsWith('…')).toBe(true);
  });
});
