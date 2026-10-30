import { describe, expect, it } from 'vitest';
import { moderateText, validateActivity } from '../moderation';

describe('validateActivity', () => {
  it.each(['Randonnée', 'Trail', 'Ski de randonnée', 'Via ferrata', 'Escalade', 'Vélo-gravel', 'Bivouac'])(
    'accepte « %s »',
    (value) => expect(validateActivity(value)).toBeNull(),
  );

  it('exige une activité', () => {
    expect(validateActivity('')).toMatch(/Indique l’activité/);
    expect(validateActivity(' a ')).toMatch(/Indique l’activité/);
  });

  it('refuse trop long, chiffres et symboles', () => {
    expect(validateActivity('a'.repeat(41))).toMatch(/40 caractères/);
    expect(validateActivity('Trail 2026')).toMatch(/lettres/);
    expect(validateActivity('Ski 💥')).toMatch(/lettres/);
  });

  it('refuse les mots interdits, y compris déguisés', () => {
    expect(validateActivity('Porn')).toMatch(/pas accepté/);
    expect(validateActivity('p0rn')).not.toBeNull();
    expect(moderateText('p0rn')).toMatch(/pas accepté/);
    expect(validateActivity('Club nazi')).toMatch(/pas accepté/);
    expect(validateActivity('Vente de drogue')).toMatch(/pas accepté/);
  });

  it('n’interdit pas des mots légitimes qui contiennent un radical court', () => {
    expect(validateActivity('Canyoning')).toBeNull();
    expect(validateActivity('Marche nordique')).toBeNull();
    expect(validateActivity('Alpinisme')).toBeNull();
  });
});

describe('moderateText', () => {
  it('laisse passer un texte vide ou normal', () => {
    expect(moderateText('')).toBeNull();
    expect(moderateText('La Cordée du Vercors')).toBeNull();
  });

  it('refuse liens, e-mails et téléphones', () => {
    expect(moderateText('rejoins https://exemple.fr')).toMatch(/lien/);
    expect(moderateText('écris à moi@exemple.fr')).toMatch(/lien/);
    expect(moderateText('appelle le 06 12 34 56 78')).toMatch(/téléphone/);
  });
});
