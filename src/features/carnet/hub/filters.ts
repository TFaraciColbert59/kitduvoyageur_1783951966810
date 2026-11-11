/**
 * Carnets de bord — hub `/carnets` : filtres de la capsule.
 *
 * Le chargement est serveur et borné ; le filtrage est **100 % client** après
 * chargement (aucune requête au changement de filtre). Fonctions pures, testées
 * avec l'écran (`src/components/carnets/hub/__tests__/`).
 */

import type { CarnetHubItem, CarnetsHubFilter } from './types';

export interface HubFilterDefinition {
  id: CarnetsHubFilter;
  /** Libellé de la capsule (maquette écran 1). */
  label: string;
}

/** Ordre de la capsule, identique à la maquette. */
export const HUB_FILTERS: ReadonlyArray<HubFilterDefinition> = [
  { id: 'route', label: 'En route' },
  { id: 'followed', label: 'Suivis' },
  { id: 'world', label: 'Monde' },
  { id: 'mine', label: 'Les miens' },
];

/** Un carnet appartient-il au filtre ? Règle unique, partagée par l'écran. */
export function matchesHubFilter(item: CarnetHubItem, filter: CarnetsHubFilter): boolean {
  switch (filter) {
    case 'route':
      return item.phase === 'en_route';
    case 'followed':
      // « Suivis » = carnets des personnes suivies, hors les miens (ils ont leur filtre).
      return item.isFollowed && !item.isMine;
    case 'mine':
      return item.isMine;
    case 'world':
    default:
      // « Monde » = tout ce qui est chargé (public, suivis, miens) : exploration.
      return true;
  }
}

/** Filtre la liste chargée : purement synchrone, aucune requête. */
export function filterHubItems(
  items: ReadonlyArray<CarnetHubItem>,
  filter: CarnetsHubFilter,
): CarnetHubItem[] {
  return items.filter((item) => matchesHubFilter(item, filter));
}

/** Filtre d'ouverture : la maquette met « En route » en avant ; sans carnet en
 *  route, on ouvre sur « Monde » plutôt que sur un état vide (décision notée). */
export function defaultHubFilter(items: ReadonlyArray<CarnetHubItem>): CarnetsHubFilter {
  return items.some((item) => item.phase === 'en_route') ? 'route' : 'world';
}
