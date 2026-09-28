import { describe, expect, it } from 'vitest';

import { normalizeStepKind } from '../engine/stepKind';

// Mesure live du 2026-09-28 : le modele a emis « arrivee » et « randonnee ».
// Le schema n'accepte que les cinq types canoniques, la reponse entiere etait
// donc refusee et le parcours retombait sur les regles. On ne peut pas rendre
// un modele infaillible : on peut en revanche.border ce qu on accepte de
// traduire, et refuser le reste plutot que d'inventer une categorie.
describe('vocabulaire des types d etape', () => {
  it('laisse passer les cinq types canoniques, sans y toucher', () => {
    (['trajet', 'arret', 'repos', 'nuit', 'ravitaillement'] as const).forEach((kind) => {
      expect(normalizeStepKind(kind)).toBe(kind);
    });
  });

  it('traduit les synonymes que le modele produit spontanement', () => {
    expect(normalizeStepKind('arrivee')).toBe('arret');
    expect(normalizeStepKind('depart')).toBe('trajet');
    expect(normalizeStepKind('deplacement')).toBe('trajet');
    expect(normalizeStepKind('randonnee')).toBe('arret');
    expect(normalizeStepKind('activite')).toBe('arret');
    expect(normalizeStepKind('visite')).toBe('arret');
    expect(normalizeStepKind('repas')).toBe('ravitaillement');
    expect(normalizeStepKind('restaurant')).toBe('ravitaillement');
    expect(normalizeStepKind('dodo')).toBe('nuit');
    expect(normalizeStepKind('hebergement')).toBe('nuit');
    expect(normalizeStepKind('pause')).toBe('repos');
  });

  it('tolere la casse, les accents et les separateurs', () => {
    expect(normalizeStepKind('Arrivée')).toBe('arret');
    expect(normalizeStepKind('ARRET')).toBe('arret');
    expect(normalizeStepKind('ravitaillement_alimentaire')).toBe('ravitaillement');
    expect(normalizeStepKind(' nuit ')).toBe('nuit');
  });

  // Le refus doit rester franc : un type qu on ne sait pas traduire ne doit
  // surtout pas etre rapproche d un type qui existe, au hasard.
  it('refuse un type inconnu plutot que de le deviner', () => {
    expect(normalizeStepKind('traversee')).toBeNull();
    expect(normalizeStepKind('xyzzy')).toBeNull();
    expect(normalizeStepKind('')).toBeNull();
    expect(normalizeStepKind(null)).toBeNull();
    expect(normalizeStepKind(undefined)).toBeNull();
  });

  it('un bivouac est bien une nuit, pas un type inconnu', () => {
    expect(normalizeStepKind('bivouac')).toBe('nuit');
  });
});
