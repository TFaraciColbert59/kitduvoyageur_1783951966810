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
export function pickCarnetTrace(
  sessions: HikeSessionRow[],
  window: { startDate: string | null; endDate: string | null } | null = null
): unknown | null {
  /* Une sortie datée hors du séjour n'est pas le tracé du carnet : c'est une
     autre randonnée, parfois à des mois d'écart (seed de démo, sortie
     rattachée après coup). On ne l'affiche jamais comme le parcours du carnet ;
     sans trace datée dans la fenêtre, la carte montre son état vide honnête. */
  const start = window?.startDate?.trim() || null;
  const end = window?.endDate?.trim() || null;
  const inWindow = (session: HikeSessionRow): boolean => {
    if (!start || !end) return true;
    const at = typeof session?.started_at === 'string' ? session.started_at.slice(0, 10) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) return false;
    return at >= start && at <= end;
  };
  for (const session of sessions) {
    if (!inWindow(session)) continue;
    const positions = session?.positions_geojson;
    if (!positions) continue;
    if (parsePositions(positions).length >= 2) return positions;
  }
  return null;
}
