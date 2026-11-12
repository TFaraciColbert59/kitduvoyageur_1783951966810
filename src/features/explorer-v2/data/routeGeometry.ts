/**
 * Géométrie **réelle** d'un itinéraire, pour le hors-trace.
 *
 * `explorer_routes` renvoie volontairement une géométrie simplifiée pour
 * l'affichage (`st_simplifypreservetopology(..., 0.0008)`), dont l'écart peut
 * dépasser le seuil d'alerte de 40 m. Le hors-trace ne doit jamais mesurer sa
 * distance sur cette version : il charge la géométrie complète via
 * `get_route_geojson`, une seule fois par itinéraire armé.
 *
 * Aucune dépendance React : ce module est appelé par l'écran Explorer et peut
 * être remplacé par un double dans les tests, sans réseau.
 */

export interface RouteGeometryResponse {
  geojson: unknown | null;
}

/** Renvoie `null` quand la route n'existe pas ou n'a pas de géométrie. */
export async function fetchRouteGeometry(routeId: string): Promise<unknown | null> {
  const res = await fetch(
    `/api/explorer/v2/routes/${encodeURIComponent(routeId)}/geometry`,
    { headers: { Accept: 'application/json' } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`géométrie ${routeId} indisponible (${res.status})`);
  }
  const body = (await res.json()) as RouteGeometryResponse | null;
  return body?.geojson ?? null;
}
