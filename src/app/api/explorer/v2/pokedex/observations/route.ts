import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { sanitizeHttpsUrl } from '@/lib/explorer/edgeCache';

export const dynamic = 'force-dynamic';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createObservationSchema = z.object({
  taxonId: z.number().int().positive(),
  commonName: z.string().trim().min(1).max(200),
  scientificName: z.string().trim().max(200).optional().default(''),
  kingdom: z.enum(['faune', 'flore', 'fungi', 'autre']).optional().default('faune'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  placeLabel: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  photoUrl: z.string().trim().max(1000).nullable().optional(),
  observedAt: z.string().datetime().optional(),
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
    Boolean(error.message?.includes('pokedex_observations') && error.message?.includes('does not exist'))
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

function sanitizePhotoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return sanitizeHttpsUrl(trimmed);
}

/**
 * GET /api/explorer/v2/pokedex/observations
 * Retourne les observations naturalistes de l'utilisateur authentifié ainsi que
 * la liste dédupliquée des `observedTaxonIds`.
 */
export async function GET(request: Request) {
  const { supabase, user } = await resolveAuthenticatedClient(request);

  const limited = await enforceRateLimit(
    user?.id ?? clientIpFromHeaders(request.headers),
    {
      scope: 'explorer-v2-pokedex-obs-read',
      limit: 60,
      windowMs: 60_000,
      failMode: 'open',
    },
  );
  if (limited) return limited;

  if (!supabase || !user) {
    return NextResponse.json(
      { observations: [], observedTaxonIds: [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  try {
    const { data, error } = await supabase
      .from('pokedex_observations')
      .select(
        'id, taxon_id, common_name, scientific_name, kingdom, lat, lng, place_label, note, photo_url, observed_at, created_at',
      )
      .eq('user_id', user.id)
      .order('observed_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      if (isMissingTableError(error)) {
        console.warn('[explorer-v2] pokedex/observations GET: table not migrated yet');
        return NextResponse.json(
          { observations: [], observedTaxonIds: [] },
          { headers: { 'Cache-Control': 'private, no-store' } },
        );
      }
      console.error('[explorer-v2] pokedex/observations GET error', error.code);
      return NextResponse.json(
        { error: 'Impossible de charger les observations' },
        { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const observations = data ?? [];
    const taxonSet = new Set<number>();
    for (const row of observations) {
      if (typeof row.taxon_id === 'number' && Number.isFinite(row.taxon_id)) {
        taxonSet.add(row.taxon_id);
      }
    }

    return NextResponse.json(
      {
        observations,
        observedTaxonIds: Array.from(taxonSet),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('[explorer-v2] pokedex/observations GET exception', error);
    return NextResponse.json(
      { observations: [], observedTaxonIds: [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}

/**
 * POST /api/explorer/v2/pokedex/observations
 * Enregistre une observation Pokédex pour l'utilisateur authentifié.
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
    scope: 'explorer-v2-pokedex-obs-write',
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

  const parsed = createObservationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Observation invalide' }, { status: 400 });
  }

  const {
    taxonId,
    commonName,
    scientificName,
    kingdom,
    lat,
    lng,
    placeLabel,
    note,
    photoUrl,
    observedAt,
  } = parsed.data;

  const cleanPhotoUrl = sanitizePhotoUrl(photoUrl);
  if (photoUrl && photoUrl.trim().length > 0 && !cleanPhotoUrl) {
    return NextResponse.json({ error: 'URL photo invalide (HTTPS requis)' }, { status: 400 });
  }

  try {
    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      taxon_id: taxonId,
      common_name: commonName,
      scientific_name: scientificName,
      kingdom,
      lat,
      lng,
      place_label: placeLabel ?? null,
      note: note ?? null,
      photo_url: cleanPhotoUrl,
    };
    if (observedAt) {
      insertPayload.observed_at = observedAt;
    }

    const { data, error } = await supabase
      .from('pokedex_observations')
      .insert(insertPayload)
      .select(
        'id, taxon_id, common_name, scientific_name, kingdom, lat, lng, place_label, note, photo_url, observed_at, created_at',
      )
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        console.warn('[explorer-v2] pokedex/observations POST: table not migrated yet');
        return NextResponse.json(
          { error: 'Migration Pokédex requise' },
          { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
        );
      }
      console.error('[explorer-v2] pokedex/observations POST error', error.code);
      return NextResponse.json(
        { error: 'Enregistrement refusé' },
        { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    return NextResponse.json(
      { ok: true, observation: data },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('[explorer-v2] pokedex/observations POST exception', error);
    return NextResponse.json(
      { error: 'Service indisponible' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}

/**
 * DELETE /api/explorer/v2/pokedex/observations?id=<uuid>
 * Supprime une observation appartenant strictement à l'utilisateur authentifié.
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
    scope: 'explorer-v2-pokedex-obs-write',
    limit: 30,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const id = new URL(request.url).searchParams.get('id');
  if (!id || !UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('pokedex_observations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      if (isMissingTableError(error)) {
        console.warn('[explorer-v2] pokedex/observations DELETE: table not migrated yet');
        return NextResponse.json(
          { error: 'Migration Pokédex requise' },
          { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
        );
      }
      console.error('[explorer-v2] pokedex/observations DELETE error', error.code);
      return NextResponse.json(
        { error: 'Suppression refusée' },
        { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    return NextResponse.json(
      { ok: true, deletedId: id },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('[explorer-v2] pokedex/observations DELETE exception', error);
    return NextResponse.json(
      { error: 'Service indisponible' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
