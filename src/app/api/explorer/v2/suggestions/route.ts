import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rpc } from '@/lib/explorer-v2/pgrest';
import {
  ROUTE_CATALOG_SPORT,
  SUGGESTION_RADIUS_KM,
  SUGGESTION_RESULT_LIMIT,
  SUGGESTION_RPC_LIMIT,
  buildRouteSuggestions,
  isKnownSport,
  suggestionWindow,
  type RouteSuggestionRow,
} from '@/features/explorer-v2/routeSuggestions';
import type { SearchRoute } from '@/features/explorer-v2/state/types';

export const dynamic = 'force-dynamic';

/**
 * La position est une donnée personnelle : aucune réponse « autour de moi »
 * n'est mise en cache partagé, et la lecture SQL n'est pas conservée par le
 * cache de données de Next.
 */
const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' };

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  sport: z.string().min(1).max(24),
  limit: z.coerce.number().int().min(1).max(12).optional(),
});

interface SuggestionPayload {
  sport: string;
  supported: boolean;
  reason?: 'sport-sans-catalogue';
  radiusKm: number;
  position: { lat: number; lng: number };
  routes: SearchRoute[];
  truncated: boolean;
}

/**
 * Suggestions « autour de moi » — contrat séparé de la recherche textuelle.
 *
 * L'emprise visible et « près de moi » sont deux intentions distinctes
 * (recherche 02) : cette route n'utilise donc ni `q`, ni `minLat/maxLng`, ni
 * l'emprise de la carte. Elle interroge uniquement la RPC publique
 * `explorer_routes`, dans une fenêtre bornée autour de la position fournie.
 *
 * Le catalogue `hiking_routes` ne décrit que la randonnée. Les autres sports
 * de l'Explorer reçoivent un état explicite `sport-sans-catalogue` : aucun
 * parcours de randonnée n'est recyclé sous un autre sport, aucune difficulté
 * n'est déduite.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    lat: params.get('lat') ?? undefined,
    lng: params.get('lng') ?? undefined,
    sport: params.get('sport') ?? undefined,
    limit: params.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'requête invalide', reason: 'invalid-query' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const { lat, lng, sport } = parsed.data;
  if (!isKnownSport(sport)) {
    return NextResponse.json(
      { error: 'sport inconnu', reason: 'sport-inconnu' },
      { status: 422, headers: NO_STORE_HEADERS },
    );
  }

  const payload: SuggestionPayload = {
    sport,
    supported: sport === ROUTE_CATALOG_SPORT,
    radiusKm: SUGGESTION_RADIUS_KM,
    position: { lat, lng },
    routes: [],
    truncated: false,
  };
  if (!payload.supported) {
    return NextResponse.json(
      { ...payload, reason: 'sport-sans-catalogue' as const },
      { headers: NO_STORE_HEADERS },
    );
  }

  const window = suggestionWindow(lat, lng, SUGGESTION_RADIUS_KM);
  try {
    const rows = await rpc<RouteSuggestionRow[]>(
      'explorer_routes',
      {
        p_min_lat: window.minLat,
        p_min_lng: window.minLng,
        p_max_lat: window.maxLat,
        p_max_lng: window.maxLng,
        p_limit: SUGGESTION_RPC_LIMIT,
      },
      0,
    );
    const limit = parsed.data.limit ?? SUGGESTION_RESULT_LIMIT;
    const routes = buildRouteSuggestions(rows, lat, lng, {
      radiusKm: SUGGESTION_RADIUS_KM,
      limit,
    });
    return NextResponse.json(
      {
        ...payload,
        routes,
        truncated: rows.length >= SUGGESTION_RPC_LIMIT,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error('[explorer-v2] suggestions', error);
    return NextResponse.json(
      { error: 'suggestions indisponibles', reason: 'routes-unavailable' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
