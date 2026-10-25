import { hubSectionRegistry } from '../registry/hubSectionRegistry';

/**
 * Moteur de navigation par swipe du hub (mobile) — pur, testable sans DOM.
 * L'ordre suit le registre des sections ; la racine (`overview`, segment vide)
 * n'est jamais une cible : depuis la racine, le premier swipe va à la première
 * section réelle (ex. Itinéraire pour une sortie).
 */

export type SwipeSectionId = string;

export function swipeNavSections(sections: SwipeSectionId[]): SwipeSectionId[] {
  return sections.filter((id) => {
    const def = hubSectionRegistry.find((section) => section.id === id);
    return !!def && def.segment !== '';
  });
}

export function nextSwipeSection(
  sections: SwipeSectionId[],
  active: SwipeSectionId | null
): SwipeSectionId | null {
  if (sections.length === 0) return null;
  if (active === null) return sections[0];
  const index = sections.indexOf(active);
  if (index === -1) return sections[0];
  return sections[index + 1] ?? null;
}
