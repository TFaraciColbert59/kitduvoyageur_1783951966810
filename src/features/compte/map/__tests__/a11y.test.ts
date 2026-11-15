import { describe, expect, it } from 'vitest';
import { carnetMapSummary } from '../a11y';

describe('carnetMapSummary — texte accessible de la carte', () => {
  it('décrit le nombre de points quand la trace est visible', () => {
    expect(carnetMapSummary(12, 'Titre', 'Aide')).toBe(
      'Tracé du carnet : 12 points géolocalisés.'
    );
  });

  it('reprend l’état vide réel au lieu d’affirmer une absence de trace', () => {
    expect(
      carnetMapSummary(0, 'Trace non partageable pour les visiteurs.', 'Cette sortie est privée.')
    ).toBe('Trace non partageable pour les visiteurs. Cette sortie est privée.');
    expect(
      carnetMapSummary(0, 'Trace non disponible.', 'La géométrie est refusée.')
    ).toBe('Trace non disponible. La géométrie est refusée.');
  });
});
