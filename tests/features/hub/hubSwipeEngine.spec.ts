import { describe, it, expect } from 'vitest';
import {
  nextSwipeSection,
  swipeNavSections,
  type SwipeSectionId,
} from '@/features/hub/mobile/hubSwipeEngine';

const SECTION_IDS: SwipeSectionId[] = [
  'inventaire',
  'itinerary',
  'gear',
  'groupe',
  'budget',
  'overview',
  'docs',
  'checklist',
];

describe('hub swipe engine (navigation par geste)', () => {
  it('exclut la racine (segment vide) et conserve l’ordre du registre', () => {
    expect(swipeNavSections(['overview', 'itinerary', 'gear', 'groupe'])).toEqual([
      'itinerary',
      'gear',
      'groupe',
    ]);
  });

  it('depuis la racine, une section suivante = la première section', () => {
    expect(nextSwipeSection(swipeNavSections(SECTION_IDS), null)).toBe('inventaire');
  });

  it('depuis une section, avance d’un cran dans l’ordre', () => {
    const sections = swipeNavSections(SECTION_IDS);
    expect(nextSwipeSection(sections, 'itinerary')).toBe('gear');
    expect(nextSwipeSection(sections, 'gear')).toBe('groupe');
  });

  it('dernière section → aucune suivante (pas de boucle)', () => {
    const sections = swipeNavSections(SECTION_IDS);
    expect(nextSwipeSection(sections, 'checklist')).toBeNull();
  });

  it('section inconnue → retombe sur la première', () => {
    expect(nextSwipeSection(swipeNavSections(SECTION_IDS), 'nope' as never)).toBe('inventaire');
  });
});
