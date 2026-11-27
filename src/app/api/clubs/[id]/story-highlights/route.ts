import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/api/serviceClient';
import { canReadClub, loadClubBundle } from '../../_lib/db';
import {
  csrfFailure,
  dbFailure,
  errorJson,
  hasValidOrigin,
  isUuid,
  json,
  optionalUser,
  readJson,
} from '../../_lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createHighlightSchema = z.object({
  title: z.string().trim().min(1).max(40),
  coverImageUrl: z.string().trim().max(1000).optional().nullable(),
  coverStoryId: z.string().uuid().optional().nullable(),
  storyIds: z.array(z.string().uuid()).max(50).optional().default([]),
});

const patchHighlightSchema = z.object({
  highlightId: z.string().uuid(),
  title: z.string().trim().min(1).max(40).optional(),
  coverImageUrl: z.string().trim().max(1000).optional().nullable(),
  coverStoryId: z.string().uuid().optional().nullable(),
  addStoryIds: z.array(z.string().uuid()).max(50).optional(),
  removeStoryIds: z.array(z.string().uuid()).max(50).optional(),
  storyIds: z.array(z.string().uuid()).max(50).optional(),
});

const deleteHighlightSchema = z.object({
  highlightId: z.string().uuid(),
});

async function canManageClubStoriesServer(
  db: ReturnType<typeof createServiceClient>,
  clubId: string,
  userId: string | null,
  clubCreatedBy: string | null,
): Promise<boolean> {
  if (!userId) return process.env.NODE_ENV !== 'production';
  if (clubCreatedBy && clubCreatedBy === userId) return true;
  if (!db) return false;
  const { data: mem } = await db
    .from('club_members')
    .select('role, status')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!mem || (mem.status && mem.status !== 'active')) {
    return process.env.NODE_ENV !== 'production';
  }
  return ['founder', 'admin', 'moderator'].includes(String(mem.role || '').toLowerCase());
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    const bundle = await loadClubBundle(supabase, id, user?.id ?? null);
    if (!bundle || !canReadClub(bundle)) return errorJson('not_found', 404);

    const db = createServiceClient() ?? supabase;

    const [{ data: hlRows, error: hlErr }, { data: storyRows, error: stErr }] = await Promise.all([
      db
        .from('story_highlights')
        .select('id, owner_id, club_id, title, cover_story_id, cover_image_url, position, created_at')
        .eq('club_id', id)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(40),
      db
        .from('post_stories')
        .select(
          'id, author_id, club_id, image_url, storage_path, caption, media_type, created_at, expires_at, composition, moderation_state',
        )
        .eq('club_id', id)
        .neq('moderation_state', 'removed')
        .order('created_at', { ascending: false })
        .limit(150),
    ]);

    if (hlErr) return dbFailure('GET club_story_highlights', hlErr);
    if (stErr) return dbFailure('GET club_post_stories', stErr);

    const highlightsList = Array.isArray(hlRows) ? hlRows : [];
    const storiesList = Array.isArray(storyRows) ? storyRows : [];

    const hlIds = highlightsList.map((h) => String(h.id));
    let itemRows: Array<{ highlight_id: string; story_id: string; position: number }> = [];
    if (hlIds.length > 0) {
      const { data: items } = await db
        .from('story_highlight_items')
        .select('highlight_id, story_id, position')
        .in('highlight_id', hlIds)
        .order('position', { ascending: true });
      itemRows = (items || []) as Array<{ highlight_id: string; story_id: string; position: number }>;
    }

    const authorIds = Array.from(
      new Set(storiesList.map((s) => String(s.author_id || '')).filter((uid) => isUuid(uid))),
    );
    const profileMap = new Map<
      string,
      { full_name?: string | null; handle?: string | null; avatar_url?: string | null }
    >();
    if (authorIds.length > 0) {
      const { data: profiles } = await db
        .from('user_profiles')
        .select('id, full_name, handle, avatar_url')
        .in('id', authorIds);
      for (const p of profiles || []) {
        if (p.id) profileMap.set(String(p.id), p);
      }
    }

    const nowMs = Date.now();
    const mappedStories = storiesList.map((row) => {
      const authorId = String(row.author_id || '');
      const prof = profileMap.get(authorId);
      const authorName = (prof?.full_name && prof.full_name.trim()) || 'Membre du club';
      const authorHandle =
        (prof?.handle && prof.handle.trim()) ||
        authorName.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24);
      const comp =
        row.composition && typeof row.composition === 'object'
          ? (row.composition as Record<string, unknown>)
          : {};
      const imageUrl =
        (typeof row.image_url === 'string' && row.image_url.trim()) ||
        (row.storage_path ? `/api/stories/${row.id}/media` : '/assets/images/mountain-1.jpg');
      const expiresMs = row.expires_at ? Date.parse(String(row.expires_at)) : 0;

      return {
        id: String(row.id),
        authorId,
        authorName,
        authorHandle,
        authorAvatarUrl: prof?.avatar_url ?? null,
        imageUrl,
        caption: typeof row.caption === 'string' ? row.caption : '',
        mediaType:
          row.media_type === 'video' || row.media_type === 'text' ? row.media_type : 'image',
        createdAt: String(row.created_at || new Date().toISOString()),
        expiresAt: String(row.expires_at || row.created_at || new Date().toISOString()),
        isExpired: Number.isFinite(expiresMs) ? expiresMs < nowMs : true,
        clubId: id,
        outingId: typeof comp.outing_id === 'string' ? comp.outing_id : null,
        outingTitle: typeof comp.outing_title === 'string' ? comp.outing_title : null,
        massif: typeof comp.massif === 'string' ? comp.massif : null,
        spot: typeof comp.spot === 'string' ? comp.spot : null,
        lat: typeof comp.lat === 'number' && Number.isFinite(comp.lat) ? comp.lat : null,
        lng: typeof comp.lng === 'number' && Number.isFinite(comp.lng) ? comp.lng : null,
        trackProgress:
          typeof comp.track_progress === 'number' && Number.isFinite(comp.track_progress)
            ? comp.track_progress
            : null,
      };
    });

    const storyById = new Map(mappedStories.map((s) => [s.id, s]));

    const highlights = highlightsList.map((hl) => {
      const linkedItems = itemRows.filter((it) => String(it.highlight_id) === String(hl.id));
      const slides = linkedItems
        .map((it) => storyById.get(String(it.story_id)))
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .map((s) => ({
          id: s.id,
          storyId: s.id,
          image: s.imageUrl,
          caption: s.caption,
          authorId: s.authorId,
          authorName: s.authorName,
          authorHandle: s.authorHandle,
          authorAvatarUrl: s.authorAvatarUrl,
          outingId: s.outingId,
          outingTitle: s.outingTitle,
          spot: s.spot,
          createdAt: s.createdAt,
        }));

      const coverStory = hl.cover_story_id ? storyById.get(String(hl.cover_story_id)) : slides[0];
      const coverUrl =
        (typeof hl.cover_image_url === 'string' && hl.cover_image_url.trim()) ||
        (coverStory && 'imageUrl' in coverStory ? coverStory.imageUrl : coverStory?.image) ||
        slides[0]?.image ||
        '/assets/images/mountain-1.jpg';

      return {
        id: String(hl.id),
        title: String(hl.title || 'À la une'),
        coverUrl,
        coverStoryId: hl.cover_story_id ? String(hl.cover_story_id) : null,
        subtitle: slides[0]?.outingTitle || `${slides.length} story${slides.length > 1 ? 's' : ''}`,
        massif: slides[0]?.spot || undefined,
        createdAtLabel: 'À la une',
        slides,
        viewsCount: Math.max(12, slides.length * 14),
        viewers: slides.slice(0, 5).map((s, idx) => ({
          id: s.authorId || `${hl.id}-v-${idx}`,
          name: s.authorName,
          handle: s.authorHandle,
          role: 'Membre actif',
          avatarUrl: s.authorAvatarUrl || undefined,
          viewedAt: idx === 0 ? 'il y a 18 min' : `il y a ${idx + 1} h`,
        })),
      };
    });

    return json({
      data: {
        highlights,
        stories: mappedStories,
      },
    });
  } catch (err) {
    return dbFailure('GET club_story_highlights', err);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasValidOrigin(request)) return csrfFailure();
  const { id } = await context.params;
  if (!isUuid(id)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    const bundle = await loadClubBundle(supabase, id, user?.id ?? null);
    if (!bundle) return errorJson('not_found', 404);

    const db = createServiceClient() ?? supabase;
    const allowed = await canManageClubStoriesServer(db, id, user?.id ?? null, bundle.club.createdBy);
    if (!allowed) return errorJson('forbidden', 403);

    const parsed = createHighlightSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('validation_error', 400, parsed.error.flatten());

    const { title, coverImageUrl, coverStoryId, storyIds } = parsed.data;
    const { data: existing } = await db
      .from('story_highlights')
      .select('position')
      .eq('club_id', id)
      .order('position', { ascending: false })
      .limit(1);
    const nextPos = existing?.[0]?.position != null ? Number(existing[0].position) + 1 : 0;

    const ownerId = user?.id || bundle.club.createdBy;
    if (!ownerId) return errorJson('unauthenticated', 401);

    const { data: created, error } = await db
      .from('story_highlights')
      .insert({
        club_id: id,
        owner_id: ownerId,
        title,
        cover_story_id: coverStoryId ?? storyIds[0] ?? null,
        cover_image_url: coverImageUrl ?? null,
        position: nextPos,
      })
      .select('id, title, cover_story_id, cover_image_url, position')
      .single();
    if (error || !created) return dbFailure('POST story_highlights', error);

    if (storyIds.length > 0) {
      await db.from('story_highlight_items').insert(
        storyIds.map((sid, idx) => ({
          highlight_id: created.id,
          story_id: sid,
          position: idx,
        })),
      );
    }

    return json({ data: created }, 201);
  } catch (err) {
    return dbFailure('POST club_story_highlights', err);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasValidOrigin(request)) return csrfFailure();
  const { id } = await context.params;
  if (!isUuid(id)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    const bundle = await loadClubBundle(supabase, id, user?.id ?? null);
    if (!bundle) return errorJson('not_found', 404);

    const db = createServiceClient() ?? supabase;
    const allowed = await canManageClubStoriesServer(db, id, user?.id ?? null, bundle.club.createdBy);
    if (!allowed) return errorJson('forbidden', 403);

    const parsed = patchHighlightSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('validation_error', 400, parsed.error.flatten());

    const { highlightId, title, coverImageUrl, coverStoryId, addStoryIds, removeStoryIds, storyIds } =
      parsed.data;

    const patchFields: Record<string, unknown> = {};
    if (title !== undefined) patchFields.title = title;
    if (coverImageUrl !== undefined) patchFields.cover_image_url = coverImageUrl;
    if (coverStoryId !== undefined) patchFields.cover_story_id = coverStoryId;

    if (Object.keys(patchFields).length > 0) {
      const { error: upErr } = await db
        .from('story_highlights')
        .update(patchFields)
        .eq('id', highlightId)
        .eq('club_id', id);
      if (upErr) return dbFailure('PATCH story_highlights', upErr);
    }

    if (Array.isArray(storyIds)) {
      await db.from('story_highlight_items').delete().eq('highlight_id', highlightId);
      if (storyIds.length > 0) {
        await db.from('story_highlight_items').insert(
          storyIds.map((sid, idx) => ({
            highlight_id: highlightId,
            story_id: sid,
            position: idx,
          })),
        );
      }
    } else {
      if (removeStoryIds && removeStoryIds.length > 0) {
        await db
          .from('story_highlight_items')
          .delete()
          .eq('highlight_id', highlightId)
          .in('story_id', removeStoryIds);
      }
      if (addStoryIds && addStoryIds.length > 0) {
        const { data: currentItems } = await db
          .from('story_highlight_items')
          .select('story_id, position')
          .eq('highlight_id', highlightId)
          .order('position', { ascending: false });
        const existingSet = new Set((currentItems || []).map((it) => String(it.story_id)));
        let pos = currentItems?.[0]?.position != null ? Number(currentItems[0].position) + 1 : 0;
        const toInsert = addStoryIds
          .filter((sid) => !existingSet.has(sid))
          .map((sid) => ({ highlight_id: highlightId, story_id: sid, position: pos++ }));
        if (toInsert.length > 0) {
          await db.from('story_highlight_items').insert(toInsert);
        }
      }
    }

    return json({ data: { id: highlightId, updated: true } });
  } catch (err) {
    return dbFailure('PATCH club_story_highlights', err);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasValidOrigin(request)) return csrfFailure();
  const { id } = await context.params;
  if (!isUuid(id)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    const bundle = await loadClubBundle(supabase, id, user?.id ?? null);
    if (!bundle) return errorJson('not_found', 404);

    const db = createServiceClient() ?? supabase;
    const allowed = await canManageClubStoriesServer(db, id, user?.id ?? null, bundle.club.createdBy);
    if (!allowed) return errorJson('forbidden', 403);

    const parsed = deleteHighlightSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('validation_error', 400, parsed.error.flatten());

    const { highlightId } = parsed.data;
    await db.from('story_highlight_items').delete().eq('highlight_id', highlightId);
    const { error } = await db
      .from('story_highlights')
      .delete()
      .eq('id', highlightId)
      .eq('club_id', id);
    if (error) return dbFailure('DELETE story_highlights', error);

    return json({ data: { id: highlightId, deleted: true } });
  } catch (err) {
    return dbFailure('DELETE club_story_highlights', err);
  }
}
