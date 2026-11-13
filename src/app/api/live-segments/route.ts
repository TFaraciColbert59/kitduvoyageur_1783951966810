import { NextResponse } from 'next/server';
import {
  LIVE_SEGMENT_CATALOG_DATA_SOURCE,
  listLiveSegments,
} from '@/lib/live-segments/server/catalog';
import {
  LIVE_SEGMENTS_NO_STORE,
  rejected,
} from './_shared';
import { ListQuerySchema } from '@/lib/live-segments/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/live-segments
 *
 * Catalogue des Live Segments accessibles au lecteur, avec leur objectif
 * fantôme déjà assaini (P01/S6.19). Paramètres :
 *   `lat`, `lon` (les deux ensemble), `radius` (100 m..200 km), `sport`,
 *   `limit` (1..50), `optIn=0|1`.
 *
 * `dataSource: 'demo_catalog'` est renvoyé explicitement : l'UI ne présente
 * jamais ce catalogue comme des records réels.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }

  const parsed = ListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return rejected({
      code: 'invalid_query',
      message: parsed.error.issues[0]?.message ?? 'Paramètres de recherche invalides.',
    });
  }

  const { lat, lon, radius, sport, limit, optIn } = parsed.data;
  if ((lat === undefined) !== (lon === undefined)) {
    return rejected({
      code: 'invalid_position',
      message: 'Fournissez `lat` et `lon` ensemble, ou aucun des deux.',
    });
  }

  const result = listLiveSegments({
    lat: lat ?? null,
    lon: lon ?? null,
    radiusM: radius ?? null,
    sport: sport ?? null,
    limit: limit ?? null,
    optedIn: optIn !== '0',
  });

  return NextResponse.json(
    {
      ...result,
      dataSource: LIVE_SEGMENT_CATALOG_DATA_SOURCE,
    },
    { headers: LIVE_SEGMENTS_NO_STORE },
  );
}
