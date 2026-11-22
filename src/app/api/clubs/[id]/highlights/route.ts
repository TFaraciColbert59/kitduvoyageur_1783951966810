import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
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
import { canReadClub, loadClubBundle } from '../../_lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const postHighlightSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('create'),
      title: z.string().trim().min(2).max(120),
      tip: z.string().trim().max(500).nullish(),
      category: z.enum(['panorama', 'eau', 'refuge', 'danger', 'singletrack']).default('panorama'),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      photoUrl: z.string().url().max(1000).nullish(),
    })
    .strict(),
  z
    .object({
      action: z.literal('vote'),
      highlightId: z.string().uuid(),
    })
    .strict(),
]);

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

    const { data: highlights, error } = await supabase
      .from('club_highlights')
      .select('*')
      .eq('club_id', id)
      .order('upvotes_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return dbFailure('GET club_highlights', error);

    let votedIds: string[] = [];
    if (user && (highlights?.length ?? 0) > 0) {
      const { data: votes } = await supabase
        .from('club_highlight_votes')
        .select('highlight_id')
        .eq('user_id', user.id)
        .in(
          'highlight_id',
          (highlights ?? []).map((h) => h.id),
        );
      votedIds = (votes ?? []).map((v) => String(v.highlight_id));
    }

    return json({ highlights: highlights ?? [], votedIds });
  } catch (err) {
    return dbFailure('GET highlights', err);
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
    if (!user) return errorJson('unauthenticated', 401);

    const body = await readJson(request);
    const parsed = postHighlightSchema.safeParse(body);
    if (!parsed.success) {
      return errorJson('validation_error', 400, parsed.error.flatten());
    }

    if (parsed.data.action === 'create') {
      const { title, tip, category, lat, lng, photoUrl } = parsed.data;
      const { data: created, error } = await supabase
        .from('club_highlights')
        .insert({
          club_id: id,
          author_id: user.id,
          title,
          tip: tip ?? null,
          category,
          lat,
          lng,
          photo_url: photoUrl ?? null,
        })
        .select('*')
        .single();
      if (error) return dbFailure('POST club_highlights', error);
      return json({ highlight: created }, 201);
    }

    const { highlightId } = parsed.data;
    const { data: existing } = await supabase
      .from('club_highlight_votes')
      .select('highlight_id')
      .eq('highlight_id', highlightId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('club_highlight_votes')
        .delete()
        .eq('highlight_id', highlightId)
        .eq('user_id', user.id);
      return json({ voted: false, highlightId });
    }

    const { error: voteErr } = await supabase
      .from('club_highlight_votes')
      .insert({ highlight_id: highlightId, user_id: user.id });
    if (voteErr) return dbFailure('POST club_highlight_votes', voteErr);
    return json({ voted: true, highlightId });
  } catch (err) {
    return dbFailure('POST highlights', err);
  }
}
