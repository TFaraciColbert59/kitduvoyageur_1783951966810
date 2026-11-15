import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getCollectionsService,
  resolveOptionalViewer,
} from '@/lib/highlights/runtimeHub';
import { requireUser } from '@/lib/api/requireUser';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PostSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).default(''),
    visibility: z.enum(['private', 'followers', 'public', 'unlisted']).default('private'),
    kind: z.enum(['personal', 'editorial']).default('personal'),
    theme: z.string().trim().max(80).nullable().optional(),
    region: z.string().trim().max(80).nullable().optional(),
  }),
  z.object({
    action: z.literal('add_item'),
    collectionId: z.string().min(1),
    type: z.enum(['highlight', 'route', 'poi']),
    refId: z.string().min(1),
    title: z.string().trim().min(1).max(160),
    sport: z.enum(['hike', 'trail', 'mtb', 'road', 'gravel', 'ski', 'other']).nullable().optional(),
  }),
  z.object({
    action: z.literal('save_highlight_to_places'),
    highlightId: z.string().min(1),
    title: z.string().trim().min(1).max(160).optional(),
  }),
  z.object({
    action: z.literal('move_item'),
    collectionId: z.string().min(1),
    itemId: z.string().min(1),
    direction: z.enum(['up', 'down']),
  }),
  z.object({
    action: z.literal('remove_item'),
    collectionId: z.string().min(1),
    itemId: z.string().min(1),
  }),
  z.object({
    action: z.literal('visibility'),
    collectionId: z.string().min(1),
    visibility: z.enum(['private', 'followers', 'public', 'unlisted']),
  }),
  z.object({
    action: z.literal('share'),
    collectionId: z.string().min(1),
    expiresInHours: z.number().min(1).max(720).optional(),
  }),
  z.object({
    action: z.literal('revoke_share'),
    collectionId: z.string().min(1),
    linkId: z.string().min(1),
  }),
]);

/** GET /api/collections?q=...&token=... — Collections projetées (K5.16, K5.17, K5.18). */
export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'collections-list',
    limit: 60,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const { viewer } = await resolveOptionalViewer();
  const service = getCollectionsService();
  const token = request.nextUrl.searchParams.get('token')?.trim() || null;
  if (token) {
    const resolved = service.resolveShare(token);
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error.message, code: resolved.error.code },
        { status: resolved.error.code === 'not-found' ? 404 : 403 },
      );
    }
    return NextResponse.json({ collection: resolved.value });
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() || '';
  if (q.length > 0) {
    const hits = service.search(q, viewer, 20);
    return NextResponse.json({ items: hits.map((hit) => hit.collection), hits });
  }

  return NextResponse.json({ items: service.list(viewer) });
}

/** POST /api/collections — Gestion collections, Mes lieux (K5.15) et liens révocables (K5.18). */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const limited = await enforceRateLimit(auth.user.id, {
    scope: 'collections-write',
    limit: 40,
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

  const service = getCollectionsService();
  const body = parsed.data;

  const respond = (res: ReturnType<typeof service.get>) => {
    if (!res.ok) {
      const status =
        res.error.code === 'not-found' ? 404 : res.error.code === 'forbidden' ? 403 : 400;
      return NextResponse.json({ error: res.error.message, code: res.error.code }, { status });
    }
    return NextResponse.json({ collection: res.value });
  };

  switch (body.action) {
    case 'create':
      return respond(
        service.create(
          {
            owner: { id: viewer.id, name: displayName },
            title: body.title,
            description: body.description,
            visibility: body.visibility,
            kind: body.kind,
            theme: body.theme ?? null,
            region: body.region ?? null,
          },
          viewer,
        ),
      );
    case 'add_item':
      return respond(
        service.addItem(
          body.collectionId,
          { type: body.type, refId: body.refId, title: body.title, sport: body.sport ?? null },
          viewer,
        ),
      );
    case 'save_highlight_to_places': {
      const saved = service.saveHighlight(
        body.highlightId,
        { id: viewer.id, name: displayName },
        viewer,
      );
      if (!saved.ok) {
        const status =
          saved.error.code === 'not-found' ? 404 : saved.error.code === 'forbidden' ? 403 : 400;
        return NextResponse.json(
          { error: saved.error.message, code: saved.error.code },
          { status },
        );
      }
      return NextResponse.json({ collection: saved.value.collection });
    }
    case 'move_item':
      return respond(service.move(body.collectionId, body.itemId, body.direction, viewer));
    case 'remove_item':
      return respond(service.removeItem(body.collectionId, body.itemId, viewer));
    case 'visibility':
      return respond(service.update(body.collectionId, { visibility: body.visibility }, viewer));
    case 'share': {
      const res = service.share(body.collectionId, viewer, {
        expiresInDays: body.expiresInHours != null ? body.expiresInHours / 24 : undefined,
      });
      if (!res.ok) {
        const status =
          res.error.code === 'not-found' ? 404 : res.error.code === 'forbidden' ? 403 : 400;
        return NextResponse.json({ error: res.error.message, code: res.error.code }, { status });
      }
      return NextResponse.json({
        collection: res.value.collection,
        link: res.value.link,
        path: res.value.path,
      });
    }
    case 'revoke_share':
      return respond(service.revoke(body.collectionId, body.linkId, viewer));
  }
}
