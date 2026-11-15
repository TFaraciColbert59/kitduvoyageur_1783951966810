import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getHighlightsService,
  getRouteObservationsMap,
  getRoutePhotosMap,
  getTrailMediaService,
  resolveOptionalViewer,
} from '@/lib/highlights/runtimeHub';
import { requireUser } from '@/lib/api/requireUser';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import type { GeoPoint, RouteObservation, RoutePhoto } from '@/features/highlights';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/highlights/route-media?routeId=...&lat=...&lng=...&heading=...
 * K2.25 (Street View / repli Trail View), K2.26 (Trail View indexé sans coordonnée),
 * S3.05 (Médias communauté sur itinéraire), S3.24 (Tags et description multi-sources).
 */
export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'highlights-route-media',
    limit: 60,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const routeId = sp.get('routeId')?.trim();
  if (!routeId) {
    return NextResponse.json({ error: 'routeId requis' }, { status: 400 });
  }

  const lat = sp.get('lat') ? Number(sp.get('lat')) : null;
  const lng = sp.get('lng') ? Number(sp.get('lng')) : null;
  const heading = sp.get('heading') ? Number(sp.get('heading')) : 0;

  const { viewer } = await resolveOptionalViewer();
  const highlightsSvc = getHighlightsService();
  const mediaSvc = getTrailMediaService();

  // Agrège les photos des highlights rattachés à cet itinéraire + photos de tracé explicites.
  const routeHighlights = highlightsSvc.list(viewer).filter((h) => h.targetId === routeId);
  const storedPhotos = getRoutePhotosMap().get(routeId) ?? [];
  const observations = getRouteObservationsMap().get(routeId) ?? [];

  const photosFromHighlights: RoutePhoto[] = routeHighlights.flatMap((h) =>
    h.photos.map((p) => ({
      id: p.id,
      routeId,
      authorId: h.authorName ?? 'member',
      authorName: h.authorName,
      url: p.url,
      caption: p.caption,
      location: h.location,
      takenAt: h.updatedAt,
      audience: h.audience,
      exifStripped: true,
      masked: false,
      consentPublic: h.audience === 'public',
    })),
  );

  const allPhotos = [...storedPhotos, ...photosFromHighlights];
  const routePoints: GeoPoint[] = routeHighlights
    .map((h) => h.location)
    .filter((pt): pt is GeoPoint => pt !== null);

  const trailMarkers =
    routePoints.length >= 2
      ? mediaSvc.trailPhotos({ id: routeId, points: routePoints }, allPhotos)
      : [];

  const communityMedia = mediaSvc.media(routeId, allPhotos, [], viewer);
  const communitySummary = mediaSvc.summary(routeId, observations);

  // Aucun fournisseur Street View (Google/Mapillary) sans clé approuvée -> 'provider-absent'
  const streetViewPoint: GeoPoint =
    lat !== null && Number.isFinite(lat) && lng !== null && Number.isFinite(lng)
      ? { lat, lng }
      : routePoints[0] ?? { lat: 0, lng: 0 };
  const streetView =
    lat !== null && Number.isFinite(lat) && lng !== null && Number.isFinite(lng)
      ? mediaSvc.streetView(streetViewPoint, Number.isFinite(heading) ? heading : 0, null)
      : mediaSvc.streetView(streetViewPoint, 0, null);

  return NextResponse.json({
    routeId,
    streetView,
    trailMarkers,
    communityMedia,
    communitySummary,
  });
}

const ObservationBody = z.object({
  routeId: z.string().min(1).max(160),
  text: z.string().trim().min(3).max(800),
  tags: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  audience: z.enum(['private', 'followers', 'public']).default('public'),
  consentAggregate: z.boolean().default(true),
});

/** POST /api/highlights/route-media — Ajoute une observation communautaire (S3.24). */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const limited = await enforceRateLimit(auth.user.id, {
    scope: 'highlights-route-obs',
    limit: 20,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const parsed = ObservationBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Observation invalide' }, { status: 400 });
  }

  const obsMap = getRouteObservationsMap();
  const list = obsMap.get(parsed.data.routeId) ?? [];
  const nextObs: RouteObservation = {
    id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    routeId: parsed.data.routeId,
    userId: auth.user.id,
    text: parsed.data.text,
    tags: parsed.data.tags,
    audience: parsed.data.audience,
    consentAggregate: parsed.data.consentAggregate,
    status: 'published',
    createdAt: new Date().toISOString(),
  };
  obsMap.set(parsed.data.routeId, [nextObs, ...list].slice(0, 100));

  const mediaSvc = getTrailMediaService();
  const communitySummary = mediaSvc.summary(parsed.data.routeId, obsMap.get(parsed.data.routeId)!);
  return NextResponse.json({ communitySummary }, { status: 201 });
}
