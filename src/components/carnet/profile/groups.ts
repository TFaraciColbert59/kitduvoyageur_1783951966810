/**
 * Densité d'une liste de la feuille : trois lignes au plus par groupe, puis
 * 20 px d'air. Le regroupement ne filtre rien — il ne fait que replier la même
 * suite dans des blocs de trois, dans l'ordre d'origine.
 */
export function groupsOfThree<T>(items: readonly T[]): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += 3) {
    groups.push(items.slice(index, index + 3));
  }
  return groups;
}

export default groupsOfThree;
