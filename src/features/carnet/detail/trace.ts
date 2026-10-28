import { parsePositions } from '@/features/compte/map/geometry';
import type { HikeSessionRow } from './types';

/**
 * Trace réelle à exposer sur une fiche carnet.
 *
 * Un carnet peut porter plusieurs sorties : la plus récente donne les
 * statistiques (distance, D+), mais elle n'a pas forcément de trace GPS — le
 * relevé de terrain est optionnel. On choisit donc la trace de la session la
 * plus récente *qui en a une*, au lieu de regarder la seule dernière session
 * (constat de recette : carnet du Vercors, 3 traces en base, carte vide parce
 * que la sortie la plus récente n'avait pas de `positions_geojson`).
 *
 * Aucune coordonnée n'est inventée : sans session porteuse, on rend `null` et
 * la carte affiche un état vide honnête.
 */
export function pickCarnetTrace(sessions: HikeSessionRow[]): unknown | null {
  for (const session of sessions) {
    const positions = session?.positions_geojson;
    if (!positions) continue;
    if (parsePositions(positions).length >= 2) return positions;
  }
  return null;
}
