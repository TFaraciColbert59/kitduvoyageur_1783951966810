import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/api/serviceClient';
import { dbFailure, errorJson, isUuid, json, requireUser } from '../../_lib/http';
import { canReadClub, loadClubBundle } from '../../_lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateClubObservationSchema = z.object({
  commonName: z.string().trim().min(2).max(120),
  latinName: z.string().trim().max(140).optional().default(''),
  kingdom: z.enum(['faune', 'flore', 'geologie']).optional().default('faune'),
  spot: z.string().trim().max(180).optional().default(''),
  note: z.string().trim().max(600).optional().default(''),
  outingId: z.string().uuid().optional().nullable(),
  imageUrl: z.string().trim().max(600).optional().nullable(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const auth = await requireUser(supabase);
    if ('response' in auth) return auth.response;

    const bundle = await loadClubBundle(supabase, id, auth.user.id);
    if (!bundle || !canReadClub(bundle)) return errorJson('not_found', 404);

    const body = await request.json().catch(() => null);
    const parsed = CreateClubObservationSchema.safeParse(body);
    if (!parsed.success) {
      return errorJson('validation_error', 400, { issues: parsed.error.issues });
    }

    const db = createServiceClient() ?? supabase;
    const { data: prof } = await db
      .from('user_profiles')
      .select('full_name, avatar_url')
      .eq('id', auth.user.id)
      .maybeSingle();

    const observerName =
      (prof && typeof prof.full_name === 'string' && prof.full_name.trim()) ||
      auth.user.email?.split('@')[0] ||
      'Membre du club';

    const { commonName, latinName, kingdom, spot, note, outingId, imageUrl } = parsed.data;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const citation = [
      latinName ? `${commonName} (${latinName})` : commonName,
      note || null,
    ]
      .filter(Boolean)
      .join(' — ');

    const momentMeta: Record<string, unknown> = {
      club_id: id,
    };
    if (outingId) {
      momentMeta.event_id = outingId;
      momentMeta.track_progress = 0.45;
    }

    const { data: inserted, error: insertErr } = await db
      .from('carnet_moments')
      .insert({
        jour_numero: 1,
        heure: `${hh}h${mm}`,
        citation,
        auteur_nom: observerName,
        auteur_id: auth.user.id,
        lieu: spot || bundle.club.zoneLabel || bundle.club.name,
        image_url: imageUrl || null,
        source: 'manuel',
        moment_type: 'species',
        identified_species: {
          name: commonName,
          latin: latinName || undefined,
          group: kingdom,
          confidence: 0.98,
        },
        moment_meta: momentMeta,
      })
      .select('id, created_at, lieu, citation, image_url')
      .single();

    if (insertErr) return dbFailure('POST club_pokedex_observation', insertErr);

    return json(
      {
        data: {
          id: `${inserted.id}-0`,
          momentId: inserted.id,
          commonName,
          latinName: latinName || undefined,
          kingdom,
          outingId: outingId ?? '',
          observerId: auth.user.id,
          observerName,
          observerAvatarUrl:
            prof && typeof prof.avatar_url === 'string' ? prof.avatar_url : null,
          observedAt: now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
          spot: inserted.lieu ?? spot,
          citation: inserted.citation ?? citation,
          imageUrl: inserted.image_url ?? imageUrl ?? null,
          confidence: '98%',
        },
      },
      201,
    );
  } catch (err) {
    return dbFailure('POST club_pokedex', err);
  }
}
