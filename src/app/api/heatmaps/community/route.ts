import type { NextResponse } from 'next/server';
import { clientIpFromHeaders } from '@/lib/rate-limit/clientIp';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { createServiceClient } from '@/lib/api/serviceClient';
import { getCommunityHeatmapLayer } from '@/lib/heatmaps/communityService';
import { heatmapErrorResponse, heatmapJson } from '@/lib/heatmaps/http';
import { parseCommunityHeatmapQuery } from '@/lib/heatmaps/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/heatmaps/community?sport=all&window=global
 *
 * Couche communautaire agrégée (K3.07, S3.16, S3.17, S3.18). Route publique :
 * aucune identité d'activité ni coordonnée brute ne sort. Le service_role ne
 * sert qu'à lire les consentements et les séances des utilisateurs qui ont
 * explicitement accepté la heatmap mondiale ; sans table de consentement, la
 * réponse est un 503, jamais un agrégat implicite.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'heatmaps-community',
    limit: 60,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const parsed = parseCommunityHeatmapQuery(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return heatmapJson({ error: parsed.error, code: parsed.code }, 400);
  }

  const service = createServiceClient();
  if (!service) {
    return heatmapJson(
      { error: 'Configuration de contribution absente.', code: 'config_missing' },
      503
    );
  }

  try {
    const layer = await getCommunityHeatmapLayer(service, parsed.value);
    return heatmapJson({ layer });
  } catch (error) {
    return heatmapErrorResponse(error);
  }
}
