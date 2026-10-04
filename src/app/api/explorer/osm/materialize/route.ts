import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { queryRouteDetail, OverpassError } from '@/features/explorer-osm/adapters/overpassAdapter';
import { normalizeOsmRelationDetail } from '@/features/explorer-osm/services/normalizationService';
import { getOrCreateCanonicalRoute } from '@/features/explorer-osm/services/canonicalRouteService';
import { osmRouteDetailCache } from '@/features/explorer-osm/services/cacheService';

export const dynamic = 'force-dynamic';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Configuration Supabase service_role manquante (fail-closed)');
  }
  return createSupabaseClient(url, key);
}

export async function POST(request: NextRequest) {
  // Rate limiting par IP pour éviter les abus de création
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-osm-materialize',
    limit: 20,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide' }, { status: 400 });
  }

  const relationId =
    typeof raw === 'object' && raw !== null
      ? (raw as { osmRelationId?: unknown }).osmRelationId
      : undefined;
  const numericOsmId =
    typeof relationId === 'number'
      ? relationId
      : parseInt(String(relationId ?? ''), 10);

  if (!Number.isInteger(numericOsmId) || numericOsmId <= 0 || numericOsmId > 2 ** 31) {
    return NextResponse.json(
      { error: 'osmRelationId numérique requis' },
      { status: 400 }
    );
  }

  try {
    const supabase = getServiceClient();

    // 1. Récupération sécurisée du tracé côté serveur (cache serveur fiable OU Overpass live)
    // Ne jamais faire confiance à un objet géographique complet envoyé par le navigateur.
    let detail: unknown = null;
    const cached = osmRouteDetailCache.get(`route-detail:${numericOsmId}`);
    if (cached && !cached.isStale) {
      detail = cached.data;
    }

    if (!detail) {
      const rawData = await queryRouteDetail(numericOsmId);
      const elements = rawData.elements || [];
      const relationElem =
        elements.find(
          (e: { type?: unknown; id?: unknown }) => e.type === 'relation' && e.id === numericOsmId
        ) || elements[0];
      if (!relationElem) {
        return NextResponse.json(
          { error: 'Relation introuvable sur OpenStreetMap' },
          { status: 404 }
        );
      }
      detail = normalizeOsmRelationDetail(relationElem);
      if (detail) {
        osmRouteDetailCache.set(`route-detail:${numericOsmId}`, detail);
      }
    }

    if (!detail) {
      return NextResponse.json(
        { error: 'Échec de la normalisation du tracé pour matérialisation' },
        { status: 422 }
      );
    }

    // 2. Matérialisation strictement idempotente
    const result = await getOrCreateCanonicalRoute(
      supabase,
      detail as Parameters<typeof getOrCreateCanonicalRoute>[1]
    );

    return NextResponse.json({
      success: true,
      canonicalId: result.canonicalId,
      isNewlyCreated: result.isNewlyCreated,
      route: result.route,
    });
  } catch (error: unknown) {
    console.error('[materialize] Erreur:', error instanceof Error ? error.message : 'unknown');
    if (error instanceof OverpassError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status || 503 }
      );
    }
    return NextResponse.json(
      { error: 'Erreur lors de la matérialisation de la route' },
      { status: 500 }
    );
  }
}

