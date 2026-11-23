import { copyRouteToDraft } from '@/features/routes/library/routeLibrary';
import type { RouteDraft } from '@/features/adventure-prep/routeRevision';

/**
 * Partie pure de « Préparer avec ce tracé » (10.4) : tracé réel du catalogue → `routeDraft` du Compas.
 * Réutilise `copyRouteToDraft` (≤ 12 points de contrôle, géométrie intacte) ; aucun lieu, prix ni date
 * inventé. `null` si la géométrie n'est pas exploitable.
 */
export function buildExplorerRouteDraft(input: {
  routeId: number;
  name: string | null;
  geojson: unknown;
  distanceKm: number | null;
  nowIso?: string;
}): { name: string; draft: RouteDraft } | null {
  const copied = copyRouteToDraft({
    sourceId: String(input.routeId),
    name: input.name,
    sport: 'marche',
    geojson: input.geojson,
    distanceKm: input.distanceKm,
    nowIso: input.nowIso,
  });
  if (!copied) return null;
  const name = (input.name ?? '').trim().slice(0, 120) || `Itinéraire ${input.routeId}`;
  return { name, draft: { ...copied.draft, provider: 'explorer-catalog' } };
}
