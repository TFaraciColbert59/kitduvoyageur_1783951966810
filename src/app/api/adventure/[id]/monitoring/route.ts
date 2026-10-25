import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { createClient } from '@/lib/supabase/server';
import { requireEntitlement } from '@/lib/entitlements/server';
import { getAdventurePlan } from '@/features/adventure-intelligence/server/generateAdventure';

export const dynamic = 'force-dynamic';

const planIdSchema = z.string().uuid('id doit être un UUID');

/**
 * GET /api/adventure/[id]/monitoring — règles de suivi réelles du plan,
 * réservées à l'entitlement `monitoring` (402 explicite sinon). Aucune règle
 * n'est inventée : le plan expose exactement `monitoringRules`.
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

    const service = getServiceSupabase();
    if (!service) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
    }

    const entitlement = await requireEntitlement(service, user.id, 'monitoring');
    if (!entitlement.ok) return entitlement.response;

    const stored = await getAdventurePlan(service, parsedId.data);
    if (!stored) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }
    if (stored.plan.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', details: 'Seul le propriétaire peut lire le suivi de ce plan.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { monitoringRules: stored.plan.monitoringRules },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[adventure/[id]/monitoring] erreur inattendue:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
