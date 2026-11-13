import { NextRequest, NextResponse } from 'next/server';
import {
  buildDownloadedCoverageGeoJson,
  evaluateViewportOfflineCoverage,
} from '@/features/offline';
import { summaryToInstalledRecord } from '../_lib/adapters';
import { invalidBody, serverError } from '../_lib/http';
import { coverageInputSchema } from '../_lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/offline/coverage — GeoJSON de couverture téléchargée et contrôle
 * de limite de zoom sur la vue courante (K4.16).
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

    const parsed = coverageInputSchema.safeParse(body);
    if (!parsed.success) return invalidBody(parsed.error);

    const { packs, viewportBounds, requestedZoom, nowMs } = parsed.data;
    const records = packs.map(summaryToInstalledRecord);
    const coverage = buildDownloadedCoverageGeoJson(records, nowMs);
    const viewport = evaluateViewportOfflineCoverage(viewportBounds, requestedZoom, records);

    return NextResponse.json(
      {
        coverage,
        viewport,
        coveringPackIds: viewport.coveringPackIds,
      },
      { status: 200 }
    );
  } catch (error) {
    return serverError('offline/coverage', error);
  }
}
