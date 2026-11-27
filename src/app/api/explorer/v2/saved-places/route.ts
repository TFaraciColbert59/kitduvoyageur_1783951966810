import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const dynamic = 'force-dynamic';

const MAX_METADATA_BYTES = 8_192;

const upsertPlaceSchema = z
  .object({
    placeId: z.string().trim().min(1).max(200).optional(),
    place_id: z.string().trim().min(1).max(200).optional(),
    kind: z.string().trim().min(1).max(60).optional().default('poi'),
    name: z.string().trim().min(1).max(200),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
  })
  .refine((data) => Boolean(data.placeId ?? data.place_id), {
    message: 'placeId requis',
  });

function bearerToken(header: string | null): string {
  const match = header ? /^Bearer\s+(\S+)\s*$/i.exec(header) : null;
  return match?.[1] ?? '';
}

function isMissingTableError(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    Boolean(error.message?.includes('user_saved_places') && error.message?.includes('does not exist'))
  );
}

async function resolveAuthenticatedClient(request: Request): Promise<{
  supabase: SupabaseClient | null;
  user: User | null;
}> {
  try {
    const serverClient = await createClient();
    const {
      data: { user },
      error,
    } = await serverClient.auth.getUser();
    if (!error && user) {
      return { supabase: serverClient, user };
    }
  } catch {
    // Fallback vers le jeton Bearer si les cookies serveur sont absents.
  }

  const token = bearerToken(request.headers.get('authorization'));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) {
    return { supabase: null, user: null };
  }

  try {
    const bearerClient = createSupabaseClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error,
    } = await bearerClient.auth.getUser(token);
    if (!error && user) {
      return { supabase: bearerClient, user };
    }
  } catch {
    // Jeton invalide ou Supabase indisponible.
  }

  return { supabase: null, user: null };
}

/**
 * GET /api/explorer/v2/saved-places
 * Retourne les lieux favoris de l'utilisateur authentifié triés par date décroissante.
 */
export async function GET(request: Request) {
  const { supabase, user } = await resolveAuthenticatedClient(request);

  const limited = await enforceRateLimit(
    user?.id ?? clientIpFromHeaders(request.headers),
    {
      scope: 'explorer-v2-saved-places-read',
      limit: 60,
      windowMs: 60_000,
      failMode: 'open',
    },
  );
  if (limited) return limited;

  if (!supabase || !user) {
    return NextResponse.json(
      { places: [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  try {
    const { data, error } = await supabase
      .from('user_saved_places')
      .select('id, place_id, kind, name, lat, lng, metadata, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      if (isMissingTableError(error)) {
        console.warn('[explorer-v2] saved-places GET: table not migrated yet');
        return NextResponse.json(
          { places: [] },
          { headers: { 'Cache-Control': 'private, no-store' } },
        );
      }
      console.error('[explorer-v2] saved-places GET error', error.code);
      return NextResponse.json(
        { error: 'Impossible de charger les lieux sauvegardés' },
        { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    return NextResponse.json(
      { places: data ?? [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('[explorer-v2] saved-places GET exception', error);
    return NextResponse.json(
      { places: [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}

/**
 * POST /api/explorer/v2/saved-places
 * Ajoute ou met à jour un lieu favori sur la contrainte unique `(user_id, place_id)`.
 */
export async function POST(request: Request) {
  const { supabase, user } = await resolveAuthenticatedClient(request);
  if (!supabase || !user) {
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const limited = await enforceRateLimit(user.id, {
    scope: 'explorer-v2-saved-places-write',
    limit: 30,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = upsertPlaceSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Lieu invalide' }, { status: 400 });
  }

  const placeId = (parsed.data.placeId ?? parsed.data.place_id) as string;
  const { kind, name, lat, lng, metadata } = parsed.data;

  try {
    if (JSON.stringify(metadata).length > MAX_METADATA_BYTES) {
      return NextResponse.json({ error: 'Métadonnées trop volumineuses' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Métadonnées invalides' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('user_saved_places')
      .upsert(
        {
          user_id: user.id,
          place_id: placeId,
          kind,
          name,
          lat,
          lng,
          metadata,
        },
        { onConflict: 'user_id,place_id' },
      )
      .select('id, place_id, kind, name, lat, lng, metadata, created_at')
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        console.warn('[explorer-v2] saved-places POST: table not migrated yet');
        return NextResponse.json(
          { error: 'Migration favoris requise' },
          { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
        );
      }
      console.error('[explorer-v2] saved-places POST error', error.code);
      return NextResponse.json(
        { error: 'Sauvegarde refusée' },
        { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    return NextResponse.json(
      { ok: true, place: data },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('[explorer-v2] saved-places POST exception', error);
    return NextResponse.json(
      { error: 'Service indisponible' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}

/**
 * DELETE /api/explorer/v2/saved-places?placeId=<id>
 * Supprime un lieu favori strictement scopé à l'utilisateur authentifié.
 */
export async function DELETE(request: Request) {
  const { supabase, user } = await resolveAuthenticatedClient(request);
  if (!supabase || !user) {
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const limited = await enforceRateLimit(user.id, {
    scope: 'explorer-v2-saved-places-write',
    limit: 30,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const sp = new URL(request.url).searchParams;
  const placeId = (sp.get('placeId') ?? sp.get('place_id') ?? '').trim();
  if (!placeId || placeId.length > 200) {
    return NextResponse.json({ error: 'Identifiant de lieu invalide' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('user_saved_places')
      .delete()
      .eq('user_id', user.id)
      .eq('place_id', placeId);

    if (error) {
      if (isMissingTableError(error)) {
        console.warn('[explorer-v2] saved-places DELETE: table not migrated yet');
        return NextResponse.json(
          { error: 'Migration favoris requise' },
          { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
        );
      }
      console.error('[explorer-v2] saved-places DELETE error', error.code);
      return NextResponse.json(
        { error: 'Suppression refusée' },
        { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    return NextResponse.json(
      { ok: true, deletedPlaceId: placeId },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('[explorer-v2] saved-places DELETE exception', error);
    return NextResponse.json(
      { error: 'Service indisponible' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
