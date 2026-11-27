import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/api/serviceClient';
import { canReadClub, loadClubBundle } from '@/app/api/clubs/_lib/db';
import { dbFailure, errorJson, isUuid, json, optionalUser } from '@/app/api/clubs/_lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ArchivedStoryItem {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl: string | null;
  imageUrl: string;
  caption: string;
  mediaType: 'image' | 'video' | 'text';
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
  clubId: string | null;
  outingId: string | null;
  outingTitle: string | null;
  massif: string | null;
  spot: string | null;
  lat: number | null;
  lng: number | null;
  trackProgress: number | null;
}

/**
 * Route universelle d'archives de stories (callable depuis n'importe quelle page :
 * Club, Compte utilisateur ou Carnet).
 *
 * - `scope=club&scopeId=<clubUuid>` : toutes les stories postées dans le club depuis le début,
 *   chacune restant strictement attribuée à son auteur d'origine.
 * - `scope=user` : toutes les stories postées par l'utilisateur connecté (ou `scopeId`).
 * - `scope=carnet&scopeId=<carnetUuid>` : toutes les stories liées à un carnet.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scope = (searchParams.get('scope') || 'club').trim().toLowerCase();
  const scopeId = (searchParams.get('scopeId') || '').trim();
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 120));

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    const db = createServiceClient() ?? supabase;

    let query = db
      .from('post_stories')
      .select(
        'id, author_id, club_id, image_url, storage_path, caption, media_type, created_at, expires_at, composition, moderation_state',
      )
      .neq('moderation_state', 'removed')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (scope === 'club') {
      if (!isUuid(scopeId)) return errorJson('invalid_scope_id', 400);
      const bundle = await loadClubBundle(supabase, scopeId, user?.id ?? null);
      if (!bundle || !canReadClub(bundle)) return errorJson('not_found', 404);
      query = query.eq('club_id', scopeId);
    } else if (scope === 'carnet') {
      if (!isUuid(scopeId)) return errorJson('invalid_scope_id', 400);
      query = query.eq('linked_carnet_id', scopeId);
    } else if (scope === 'user') {
      const targetUid = isUuid(scopeId) ? scopeId : user?.id;
      if (!targetUid) return errorJson('unauthenticated', 401);
      query = query.eq('author_id', targetUid);
    } else {
      return errorJson('invalid_scope', 400);
    }

    const { data: rows, error } = await query;
    if (error) return dbFailure('GET /api/stories/archive', error);

    const list = Array.isArray(rows) ? rows : [];
    const authorIds = Array.from(
      new Set(list.map((r) => String(r.author_id || '')).filter((id) => isUuid(id))),
    );

    const profileById = new Map<
      string,
      { full_name?: string | null; handle?: string | null; avatar_url?: string | null }
    >();
    if (authorIds.length > 0) {
      const { data: profiles } = await db
        .from('user_profiles')
        .select('id, full_name, handle, avatar_url')
        .in('id', authorIds);
      for (const p of profiles || []) {
        if (p.id) profileById.set(String(p.id), p);
      }
    }

    const nowMs = Date.now();
    const stories: ArchivedStoryItem[] = list.map((row) => {
      const authorId = String(row.author_id || '');
      const prof = profileById.get(authorId);
      const authorName =
        (prof?.full_name && prof.full_name.trim()) || 'Membre du club';
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
        clubId: row.club_id ? String(row.club_id) : null,
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

    return json({ data: { scope, scopeId, total: stories.length, stories } });
  } catch (err) {
    return dbFailure('GET /api/stories/archive', err);
  }
}
