import { describe, expect, it } from 'vitest';
import { tutoyer } from '../engine/voice';

describe('tutoyer — conseils de l’IA', () => {
  it('passe les impératifs courants au tutoiement (Bruges, 8 octobre)', () => {
    expect(tutoyer('Prévoyez des chaussures confortables pour la marche en ville.')).toBe(
      'Prévois des chaussures confortables pour la marche en ville.'
    );
    expect(tutoyer('Pensez à emporter un parapluie, et prenez une veste.')).toBe(
      'Pense à emporter un parapluie, et prends une veste.'
    );
    expect(tutoyer('N’oubliez pas vos bâtons.')).toBe('N’oublie pas tes bâtons.');
    expect(tutoyer('Renseignez-vous sur la météo, équipez-vous en conséquence.')).toBe(
      'Renseigne-toi sur la météo, équipe-toi en conséquence.'
    );
  });

  it('écarte un conseil qui vouvoie encore', () => {
    expect(
      tutoyer('Réservez vos billets d’entrée à l’avance, surtout si vous voyagez en basse saison.')
    ).toBeNull();
    expect(tutoyer('Votre sac doit rester léger.')).toBeNull();
    expect(tutoyer('Explorez les canaux à pied.')).toBeNull();
  });

  it('laisse tel quel un conseil au tutoiement ou à l’infinitif', () => {
    const tu = 'Prévois l’achat d’un baudrier et pense à tes chaussons.';
    expect(tutoyer(tu)).toBe(tu);
    expect(tutoyer('Vérifier la date de péremption de la trousse de secours.')).toBe(
      'Vérifier la date de péremption de la trousse de secours.'
    );
    expect(tutoyer('Chez l’habitant, le petit-déjeuner est souvent compris.')).toBe(
      'Chez l’habitant, le petit-déjeuner est souvent compris.'
    );
  });
});
