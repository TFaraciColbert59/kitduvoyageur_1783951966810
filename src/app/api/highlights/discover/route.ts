import { NextRequest, NextResponse } from 'next/server';
import {
  buildGuideViews,
  createInspirationServiceFromSnapshot,
  getCollectionsService,
  loadDiscoverSnapshot,
  resolveOptionalViewer,
} from '@/lib/highlights/runtimeHub';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/highlights/discover?sport=...&region=...&parkQuery=...
 * K1.10 (Inspiration personnalisée), K1.11 (Guides éditoriaux), K1.12 (Parcs & régions), K5.17 (Collections éditoriales).
 */
export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'highlights-discover',
    limit: 60,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const { viewer } = await resolveOptionalViewer();
  const snapshot = await loadDiscoverSnapshot();
  const inspirationSvc = createInspirationServiceFromSnapshot(snapshot);
  const collectionsSvc = getCollectionsService();

  const preferredSport = request.nextUrl.searchParams.get('sport')?.trim() || '';
  const preferredRegion = request.nextUrl.searchParams.get('region')?.trim() || '';
  const parkQuery = request.nextUrl.searchParams.get('parkQuery')?.trim() || '';

  const history = {
    sportCounts: preferredSport ? { [preferredSport]: 3 } : {},
    regionCounts: preferredRegion ? { [preferredRegion]: 3 } : {},
    followedAuthorIds: [],
    savedCollectionIds: [],
    savedHighlightIds: [],
  };

  const nowIso = new Date().toISOString();
  const recommendations = inspirationSvc.feed(history, viewer, nowIso, 8);
  const guides = buildGuideViews(snapshot, viewer);
  const editorialCollections = [
    ...inspirationSvc.editorialCollections(snapshot.editorialCollections, viewer),
    ...collectionsSvc.list(viewer).filter((c) => c.kind === 'editorial'),
  ];
  const park = snapshot.parks[0] ?? null;
  const parkRoutes = park ? inspirationSvc.park(park, parkQuery, 20) : [];

  return NextResponse.json({
    recommendations,
    guides,
    editorialCollections,
    park,
    parkRoutes,
  });
}
