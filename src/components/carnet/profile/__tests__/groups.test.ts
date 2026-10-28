import { describe, expect, it } from 'vitest';
import { groupsOfThree } from '../groups';

/** Densité de la feuille : trois lignes au plus, puis 20 px d'air (lot C). */
describe('groupsOfThree', () => {
  it('replie la liste en blocs de trois, dans l’ordre d’origine', () => {
    expect(groupsOfThree([1, 2, 3, 4, 5, 6, 7])).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    expect(groupsOfThree([1, 2])).toEqual([[1, 2]]);
    expect(groupsOfThree([])).toEqual([]);
  });

  it('ne perd aucune entrée, même sur une liste de 50', () => {
    const items = Array.from({ length: 50 }, (_, index) => index);
    expect(groupsOfThree(items).flat()).toEqual(items);
    expect(groupsOfThree(items).every((group) => group.length <= 3)).toBe(true);
  });
});
