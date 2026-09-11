import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { createClient } from '@/lib/supabase/server';
import {
  confirmTerrainReport,
  createSupabaseTerrainReportsClient,
} from '@/features/adventure-intelligence/server/terrainReports';
import { terrainConfirmationSchema } from '@/features/adventure-intelligence/schemas/live.schema';
import { currentAdventureFeatureFlags } from '@/features/adventure-intelligence/server/featureFlags';

export const dynamic = 'force-dynamic';

const reportIdSchema = z.string().uuid('id doit être un UUID');

const confirmBodySchema = z.object({
  confirmation: terrainConfirmationSchema,
  locationDistanceM: z
    .number()
    .min(0, 'locationDistanceM doit être positif ou nul')
    .optional(),
  gpsQuality: z
    .number()
    .min(0, 'gpsQuality doit être compris entre 0 et 1')
    .max(1, 'gpsQuality doit être compris entre 0 et 1')
    .optional(),
});

function zodDetails(error: z.ZodError): string {
  return error.issues.map((issue) => issue.path.join('.')).join(', ');
}

/**
 * POST /api/terrain/reports/[id]/confirm — confirmation unique par utilisateur
 * (« toujours présent », « disparu », « sais pas »). L'identité vient de la
 * session ; les compteurs sont maintenus par le trigger A1.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsedId = reportIdSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: 'Signalement invalide', details: zodDetails(parsedId.error) },
        { status: 400 }
      );
    }

    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Session requise' },
        { status: 401 }
      );
    }

    const flags = await currentAdventureFeatureFlags();
    if (flags.terrain_live !== true) {
      return NextResponse.json({ error: 'Fonctionnalité non activée' }, { status: 503 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Corps invalide', details: 'JSON attendu' },
        { status: 400 }
      );
    }

    const parsed = confirmBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Corps invalide', details: zodDetails(parsed.error) },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
    }

    const result = await confirmTerrainReport(
      { reportId: parsedId.data, userId: user.id, ...parsed.data },
      createSupabaseTerrainReportsClient(supabase)
    );

    if (result.status === 'not_found') {
      return NextResponse.json({ error: 'Signalement introuvable' }, { status: 404 });
    }
    if (result.status === 'closed') {
      return NextResponse.json({ error: 'Signalement clos' }, { status: 409 });
    }
    if (result.status === 'duplicate') {
      return NextResponse.json({
        duplicate: true,
        message: 'Confirmation déjà enregistrée pour cet utilisateur',
      });
    }
    if (result.status === 'rate_limited') {
      return NextResponse.json(
        { error: 'Trop de confirmations récentes', details: 'confirmation_cooldown' },
        { status: 429 }
      );
    }

    return NextResponse.json({ status: 'confirmed', reportStatus: result.reportStatus });
  } catch (err) {
    console.error(
      '[terrain/reports/confirm] erreur inattendue:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
