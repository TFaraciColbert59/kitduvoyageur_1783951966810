/** Volets du drawer Explorer : l'ordre est celui de la capsule (icônes seules). */
export type SectionTabId = 'recherche' | 'pour-toi' | 'carnets' | 'clubs' | 'sorties';

export interface SectionTab {
  id: SectionTabId;
  label: string;
}

export const SECTION_TABS: ReadonlyArray<SectionTab> = [
  { id: 'recherche', label: 'Recherche' },
  { id: 'pour-toi', label: 'Pour toi' },
  { id: 'carnets', label: 'Carnets' },
  { id: 'clubs', label: 'Clubs' },
  { id: 'sorties', label: 'Sorties' },
];

export function sectionIndex(id: SectionTabId): number {
  return Math.max(0, SECTION_TABS.findIndex((tab) => tab.id === id));
}
