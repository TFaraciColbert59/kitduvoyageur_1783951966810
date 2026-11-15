import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getHighlightsService,
  resolveOptionalViewer,
} from '@/lib/highlights/runtimeHub';
import { requireUser } from '@/lib/api/requireUser';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SportSchema = z.enum(['hike', 'trail', 'mtb', 'road', 'gravel', 'ski', 'other']);
const AudienceSchema = z.enum(['private', 'followers', 'public']);

const PostSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    kind: z.enum(['place', 'segment']),
    targetType: z.enum(['place', 'segment', 'route']),
    targetId: z.string().min(1).max(160),
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1500).default(''),
    sport: SportSchema.default('hike'),
    areaLabel: z.string().trim().max(160).default('Secteur'),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    audience: AudienceSchema.default('public'),
    hideExactLocation: z.boolean().default(false),
    hidePhotos: z.boolean().default(false),
  }),
  z.object({
    action: z.literal('vote'),
    highlightId: z.string().min(1),
    value: z.union([z.literal(1), z.literal(-1)]),
  }),
  z.object({
    action: z.literal('tip'),
    highlightId: z.string().min(1),
    body: z.string().trim().min(2).max(1000),
  }),
  z.object({
    action: z.literal('photo'),
    highlightId: z.string().min(1),
    url: z.string().url(),
    caption: z.string().trim().max(300).optional(),
    exifStripped: z.boolean(),
    consentPublic: z.boolean(),
  }),
]);

/** GET /api/highlights?targetId=... — Highlights projetés selon C-PRIV. */
export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'highlights-list',
    limit: 60,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const targetId = request.nextUrl.searchParams.get('targetId')?.trim() || null;
  const { viewer } = await resolveOptionalViewer();
  const service = getHighlightsService();
  const all = service.list(viewer);
  const items = targetId ? all.filter((h) => h.targetId === targetId) : all;
  return NextResponse.json({ items });
}

/** POST /api/highlights — Création (K5.13) & contributions durables (K5.14). */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const limited = await enforceRateLimit(auth.user.id, {
    scope: 'highlights-write',
    limit: 30,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const parsed = PostSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const { viewer, displayName } = await resolveOptionalViewer();
  if (!viewer.id) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }

  const service = getHighlightsService();
  const body = parsed.data;

  if (body.action === 'create') {
    const res = service.create(
      {
        author: { id: viewer.id, name: displayName },
        kind: body.kind,
        target: { type: body.targetType, id: body.targetId },
        title: body.title,
        description: body.description,
        sport: body.sport,
        areaLabel: body.areaLabel,
        location:
          typeof body.lat === 'number' && typeof body.lng === 'number'
            ? { lat: body.lat, lng: body.lng }
            : null,
        audience: body.audience,
        privacy: {
          hideExactLocation: body.hideExactLocation,
          hidePhotos: body.hidePhotos,
          requireExifStripped: true,
          allowContributions: true,
        },
      },
      viewer,
    );
    if (!res.ok) {
      const status = res.error.code === 'forbidden' ? 403 : 400;
      return NextResponse.json({ error: res.error.message, code: res.error.code }, { status });
    }
    return NextResponse.json({ highlight: res.value }, { status: 201 });
  }

  if (body.action === 'vote') {
    const res = service.vote(body.highlightId, body.value, viewer);
    if (!res.ok) {
      const status =
        res.error.code === 'not-found' ? 404 : res.error.code === 'forbidden' ? 403 : 400;
      return NextResponse.json({ error: res.error.message, code: res.error.code }, { status });
    }
    return NextResponse.json({ highlight: res.value });
  }

  if (body.action === 'tip') {
    const res = service.contributeTip(
      body.highlightId,
      { id: viewer.id, name: displayName },
      body.body,
      viewer,
    );
    if (!res.ok) {
      const status =
        res.error.code === 'not-found' ? 404 : res.error.code === 'forbidden' ? 403 : 400;
      return NextResponse.json({ error: res.error.message, code: res.error.code }, { status });
    }
    return NextResponse.json({ highlight: res.value });
  }

  const res = service.contributePhoto(
    body.highlightId,
    {
      authorId: viewer.id,
      url: body.url,
      caption: body.caption ?? null,
      exifStripped: body.exifStripped,
      consentPublic: body.consentPublic,
    },
    viewer,
  );
  if (!res.ok) {
    const status =
      res.error.code === 'not-found' ? 404 : res.error.code === 'forbidden' ? 403 : 400;
    return NextResponse.json({ error: res.error.message, code: res.error.code }, { status });
  }
  return NextResponse.json({ highlight: res.value });
}
