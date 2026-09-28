import { describe, expect, it } from 'vitest';
import { de } from '../engine/frenchText';

// EL-01 : le francais elide l article devant une initiale vocale. Ecrire
// « Retour de Argentiere » est une faute visible par l utilisateur dans le
// titre d une etape : la regle est donc appliquee a la source, pas au rendu.
describe('de() — elision francaise devant un nom propre', () => {
  it('EL-01 : elide devant une voyelle', () => {
    expect(de('Argentière')).toBe("d'Argentière");
    expect(de('Orcières')).toBe("d'Orcières");
    expect(de('Évian')).toBe("d'Évian");
    expect(de('Aiguille')).toBe("d'Aiguille");
  });

  it('EL-02 : elide devant un h muet', () => {
    expect(de('Hôtel')).toBe("d'Hôtel");
    expect(de('Hôpital')).toBe("d'Hôpital");
  });

  it('EL-03 : conserve « de » devant un h aspire et une consonne', () => {
    expect(de('Haute-Savoie')).toBe('de Haute-Savoie');
    expect(de('Hameaux')).toBe('de Hameaux');
    expect(de('Chamonix')).toBe('de Chamonix');
    expect(de('Servoz')).toBe('de Servoz');
  });

  it('EL-04 : ne casse pas un nom deja elide', () => {
    expect(de("L'Argentière")).toBe("de L'Argentière");
  });

  it('EL-05 : un nom vide ne produit pas un article orphelin', () => {
    expect(de('')).toBe('de');
    expect(de('   ')).toBe('de');
  });

  it('EL-06 : conserve la casse et les accents du nom', () => {
    expect(de('Échappée')).toBe("d'Échappée");
  });
});
