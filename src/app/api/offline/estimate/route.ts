import { NextRequest, NextResponse } from 'next/server';
import {
  estimateOfflinePackSize,
  evaluateMultiZoneSelection,
  getPredefinedRegionById,
  validateAndEstimateCustomZone,
  type OfflinePackSizeEstimate,
} from '@/features/offline';
import { invalidBody, notFound, serverError } from '../_lib/http';
import { estimateInputSchema, type CustomZoneInput } from '../_lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function zoomRangeIsValid(minZoom: number, maxZoom: number): boolean {
  return Number.isFinite(minZoom) && Number.isFinite(maxZoom) && minZoom <= maxZoom;
}

function customZoneToDraft(zone: CustomZoneInput, index = 0) {
  return validateAndEstimateCustomZone({
    zoneId: zone.zoneId ?? `custom-zone-${index + 1}`,
    label: zone.label ?? `Zone libre ${index + 1}`,
    bounds: zone.bounds,
    minZoom: zone.minZoom,
    maxZoom: zone.maxZoom,
    maxTilesLimit: zone.maxTilesLimit,
    maxAreaKm2: zone.maxAreaKm2,
    minAreaKm2: zone.minAreaKm2,
  });
}

function estimateDraft(
  draft: ReturnType<typeof customZoneToDraft>
): OfflinePackSizeEstimate | null {
  if (!draft.valid) return null;
  return estimateOfflinePackSize({
    regionOrZoneId: draft.zoneId,
    bounds: draft.bounds,
    minZoom: draft.minZoom,
    maxZoom: draft.maxZoom,
    mediaPreviewCount: 0,
  });
}

/**
 * POST /api/offline/estimate — estimation d’une région, d’une emprise libre ou
 * de plusieurs zones (K4.14, K4.15, K4.16).
 *
 * Aucun téléchargement : la route rend les mêmes chiffres que le contrat,
 * validation d’emprise comprise (`inverted_bounds`, plafond de tuiles, etc.).
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Corps invalide', details: 'JSON attendu' },
        { status: 400 }
      );
    }

    const parsed = estimateInputSchema.safeParse(body);
    if (!parsed.success) return invalidBody(parsed.error);
    const input = parsed.data;

    if (input.kind === 'predefined_region') {
      const region = getPredefinedRegionById(input.regionId);
      if (!region) return notFound(`Région inconnue: ${input.regionId}`);

      const minZoom = input.minZoom ?? region.recommendedMinZoom;
      const maxZoom = input.maxZoom ?? region.recommendedMaxZoom;
      if (!zoomRangeIsValid(minZoom, maxZoom)) {
        return NextResponse.json(
          { error: 'Plage de zooms invalide', details: 'minZoom doit être ≤ maxZoom' },
          { status: 400 }
        );
      }

      const estimate = estimateOfflinePackSize({
        regionOrZoneId: region.regionId,
        bounds: region.bounds,
        minZoom,
        maxZoom,
        poiCount: region.poiCount,
        routeCount: region.routeCount,
        mediaPreviewCount: input.mediaPreviewCount ?? 8,
        includeRoutingGraph: input.includeRoutingGraph ?? false,
      });

      return NextResponse.json({ kind: input.kind, region, estimate }, { status: 200 });
    }

    if (input.kind === 'custom_zone') {
      const zone = input.zone;
      const minZoom = zone.minZoom ?? 10;
      const maxZoom = zone.maxZoom ?? 15;
      if (!zoomRangeIsValid(minZoom, maxZoom)) {
        return NextResponse.json(
          { error: 'Plage de zooms invalide', details: 'minZoom doit être ≤ maxZoom' },
          { status: 400 }
        );
      }

      const draft = customZoneToDraft(zone);
      return NextResponse.json(
        { kind: input.kind, draft, estimate: estimateDraft(draft) },
        { status: 200 }
      );
    }

    for (const zone of input.zones) {
      if (!zoomRangeIsValid(zone.minZoom ?? 10, zone.maxZoom ?? 15)) {
        return NextResponse.json(
          { error: 'Plage de zooms invalide', details: 'minZoom doit être ≤ maxZoom' },
          { status: 400 }
        );
      }
    }

    const drafts = input.zones.map((zone, index) => customZoneToDraft(zone, index));
    const estimates = drafts.map((draft) => estimateDraft(draft));
    const multi = evaluateMultiZoneSelection(drafts, {
      maxZonesAllowed: input.maxZonesAllowed,
      maxTilesPerZone: input.maxTilesPerZone,
    });

    return NextResponse.json({ kind: input.kind, drafts, estimates, multi }, { status: 200 });
  } catch (error) {
    return serverError('offline/estimate', error);
  }
}
