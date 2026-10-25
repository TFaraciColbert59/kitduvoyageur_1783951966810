import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  buildOfflinePack,
  createSupabaseOfflinePackClient,
} from '@/features/adventure-intelligence/server/offlinePack';
import { currentAdventureFeatureFlags } from '@/features/adventure-intelligence/server/featureFlags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const planIdSchema = z.string().uuid('id doit être un UUID');

/**
 * GET /api/adventure/[id]/offline-pack — pack aventure hors-ligne réel.
 *
 * Auth de session obligatoire ; l'appartenance du plan est appliquée par la
 * RLS du client injecté (plan inaccessible ⇒ 404, aucune fuite d'existence).
 * Aucune donnée privée d'autres membres : participants projetés en
 * `{ id, role }`, décisions jamais incluses, prédictions propres au compte.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id } = await params;
    const parsedId = planIdSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }

    let featureFlags: Record<string, boolean> = {};
    try {
      featureFlags = (await currentAdventureFeatureFlags(user.id)) as unknown as Record<
        string,
        boolean
      >;
    } catch {
      featureFlags = {};
    }

    const result = await buildOfflinePack(
      {
        adventureId: parsedId.data,
        userId: user.id,
        featureFlags,
      },
      createSupabaseOfflinePackClient(session)
    );

    if (!result.pack) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }

    return NextResponse.json({ pack: result.pack, warnings: result.warnings }, { status: 200 });
  } catch (error) {
    console.error(
      '[adventure/[id]/offline-pack] erreur inattendue:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
