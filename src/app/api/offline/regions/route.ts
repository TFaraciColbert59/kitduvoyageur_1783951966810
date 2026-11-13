import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  estimateOfflinePackSize,
  getTileProviderPolicy,
  listPredefinedRegions,
} from '@/features/offline';
import { invalidBody, serverError } from '../_lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  country: z
    .string()
    .trim()
    .regex(/^[a-zA-Z]{2}$/, 'Code pays ISO alpha-2 attendu')
    .optional(),
  includeEstimates: z.enum(['0', '1']).optional(),
});

/**
 * GET /api/offline/regions — catalogue des régions prédéfinies durables (K4.14).
 *
 * Route de planification pure : elle ne télécharge, ne stocke et n’écrit rien.
 * Les estimations sont celles du contrat, avec les tuiles déjà en cache
 * déduites lorsque le client fournit ses paquets (route d’estimation dédiée).
 */
export async function GET(request: NextRequest) {
  try {
    const parsed = querySchema.safeParse({
      country: request.nextUrl.searchParams.get('country') ?? undefined,
      includeEstimates: request.nextUrl.searchParams.get('includeEstimates') ?? undefined,
    });
    if (!parsed.success) return invalidBody(parsed.error);

    const { country, includeEstimates } = parsed.data;
    const withEstimates = includeEstimates !== '0';
    const regions = listPredefinedRegions(country?.toUpperCase()).map((region) => {
      const providerPolicy = getTileProviderPolicy(region.providerId);
      if (!withEstimates) {
        return { ...region, providerPolicy, estimate: null };
      }
      return {
        ...region,
        providerPolicy,
        estimate: estimateOfflinePackSize({
          regionOrZoneId: region.regionId,
          bounds: region.bounds,
          minZoom: region.recommendedMinZoom,
          maxZoom: region.recommendedMaxZoom,
          poiCount: region.poiCount,
          routeCount: region.routeCount,
          mediaPreviewCount: 8,
        }),
      };
    });

    return NextResponse.json(
      {
        regions,
        total: regions.length,
        offlineDownloadAllowedProviders: [
          'openfreemap-vector',
          'terrarium-dem',
          'maptiler-licensed',
          'protomaps-pmtiles',
        ],
      },
      { status: 200 }
    );
  } catch (error) {
    return serverError('offline/regions', error);
  }
}
