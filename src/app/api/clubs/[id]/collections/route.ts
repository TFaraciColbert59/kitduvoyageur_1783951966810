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

const createCollectionSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(800).nullish(),
    discipline: z.string().trim().min(2).max(40).default('trail'),
    difficulty: z.enum(['facile', 'intermediaire', 'difficile', 'expert']).default('intermediaire'),
    isMultiDay: z.boolean().default(false),
    route: z
      .object({
        title: z.string().trim().min(2).max(120),
        distanceKm: z.number().min(0).max(5000).default(0),
        elevationGainM: z.number().int().min(0).max(50000).default(0),
        surfaceBreakdown: z.record(z.string(), z.number()).optional(),
        startLat: z.number().min(-90).max(90).nullish(),
        startLng: z.number().min(-180).max(180).nullish(),
      })
      .optional(),
  })
  .strict();

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

    const [{ data: collections, error: colErr }, { data: routes, error: routeErr }] =
      await Promise.all([
        supabase
          .from('club_collections')
          .select('*')
          .eq('club_id', id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('club_collection_routes')
          .select('*')
          .eq('club_id', id)
          .order('day_number', { ascending: true })
          .limit(200),
      ]);

    if (colErr) return dbFailure('GET club_collections', colErr);
    if (routeErr) return dbFailure('GET club_collection_routes', routeErr);

    return json({
      collections: collections ?? [],
      routes: routes ?? [],
    });
  } catch (err) {
    return dbFailure('GET collections', err);
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
    const parsed = createCollectionSchema.safeParse(body);
    if (!parsed.success) {
      return errorJson('validation_error', 400, parsed.error.flatten());
    }

    const { title, description, discipline, difficulty, isMultiDay, route } = parsed.data;
    const { data: created, error } = await supabase
      .from('club_collections')
      .insert({
        club_id: id,
        title,
        description: description ?? null,
        discipline,
        difficulty,
        is_multi_day: isMultiDay,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) return dbFailure('POST club_collections', error);

    let createdRoute = null;
    if (route && created?.id) {
      const { data: rData, error: rErr } = await supabase
        .from('club_collection_routes')
        .insert({
          collection_id: created.id,
          club_id: id,
          day_number: 1,
          title: route.title,
          distance_km: route.distanceKm,
          elevation_gain_m: route.elevationGainM,
          surface_breakdown: route.surfaceBreakdown ?? { trail: 100 },
          start_lat: route.startLat ?? null,
          start_lng: route.startLng ?? null,
          created_by: user.id,
        })
        .select('*')
        .single();
      if (!rErr) createdRoute = rData;
    }

    return json({ collection: created, route: createdRoute }, 201);
  } catch (err) {
    return dbFailure('POST collections', err);
  }
}
