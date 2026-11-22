import type { CollaborativeRoutePoint } from './types';

/** Points actifs dans l'ordre de l'atelier (même tri que `activePoints` du moteur, sans dépendre de lui). */
export function activePointsOf(ws: { points: readonly CollaborativeRoutePoint[] }): CollaborativeRoutePoint[] {
  return ws.points
    .filter((p) => !p.deletedAt)
    .slice()
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : a.id.localeCompare(b.id)));
}
