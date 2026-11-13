import { NextResponse } from 'next/server';
import { rpc } from '@/lib/explorer-v2/pgrest';

/**
 * Géométrie complète d'un itinéraire (jamais simplifiée).
 *
 * `explorer_routes` sert l'affichage et simplifie à 0,0008° (~89 m en
 * latitude) : inutilisable pour un seuil hors-trace de 40 m. Cette route
 * expose `get_route_geojson`, qui lit `hiking_routes.geom` sans simplification.
 * Elle est appelée une seule fois quand l'utilisateur arme un itinéraire.
 *
 * La trace peut être corrigée en base : une géométrie périmée décalerait la
 * mesure hors-trace de plus que le seuil de 40 m. On borne donc le cache à une
 * heure, avec une heure supplémentaire de `stale-while-revalidate` au plus,
 * au lieu des huit jours précédents.
 */
export const revalidate = 3_600;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'identifiant invalide' }, { status: 400 });
  }
  const routeId = Number(id);
  if (!Number.isSafeInteger(routeId) || routeId <= 0) {
    return NextResponse.json({ error: 'identifiant invalide' }, { status: 400 });
  }

  try {
    const geojson = await rpc<unknown>('get_route_geojson', { p_route_id: routeId }, 3_600);
    if (!geojson) {
      return NextResponse.json({ error: 'itinéraire introuvable' }, { status: 404 });
    }
    return NextResponse.json(
      { geojson: typeof geojson === 'string' ? JSON.parse(geojson) : geojson },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=3600' } },
    );
  } catch (error) {
    console.error('[explorer-v2] route geometry', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
