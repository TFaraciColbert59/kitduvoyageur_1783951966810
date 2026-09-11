import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { createClient } from '@/lib/supabase/server';
import { buildCandidateMaterialization } from '@/features/adventure-intelligence/domain/candidatePlans';
import { getAdventurePlan } from '@/features/adventure-intelligence/server/generateAdventure';

export const dynamic = 'force-dynamic';

const planIdSchema = z.string().uuid('id doit être un UUID');

const selectSchema = z.object({
  candidateId: z.string().min(1, 'candidateId est requis'),
});

/**
 * POST /api/adventure/[id]/select — matérialise un candidat comme nouvelle
 * version du plan. Auth requise (401), `{ candidateId }` Zod (400), plan
 * inconnu (404), non-propriétaire (403), service requis (503). La RPC
 * `a13_materialize_candidate` est service_role uniquement et idempotente :
 * rejouer le même candidat renvoie la version déjà matérialisée.
 */
export async function POST(
  request: NextRequest,
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Corps invalide', details: 'JSON attendu' },
        { status: 400 }
      );
    }
    const parsedBody = selectSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: 'Corps invalide',
          details: parsedBody.error.issues.map((issue) => issue.path.join('.')).join(', '),
        },
        { status: 400 }
      );
    }

    const service = getServiceSupabase();
    if (!service) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
    }

    // Lecture service_role : l'ownership est vérifiée explicitement pour
    // distinguer plan inconnu (404) et non-propriétaire (403).
    const stored = await getAdventurePlan(service, parsedId.data);
    if (!stored) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }
    if (stored.plan.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', details: 'Seul le propriétaire peut sélectionner une variante.' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const materialization = buildCandidateMaterialization({
      plan: stored.plan,
      candidatePlans: stored.candidates,
      candidateId: parsedBody.data.candidateId,
      comparison: stored.candidateComparison,
      now,
    });
    if (!materialization) {
      return NextResponse.json(
        { error: 'Candidat inconnu', details: 'Cette variante n’existe pas pour ce plan.' },
        { status: 400 }
      );
    }

    const { data, error } = await service.rpc('a13_materialize_candidate', {
      p_user_id: user.id,
      p_plan_id: parsedId.data,
      p_version: materialization.version,
      p_decision: materialization.decision,
    });
    if (error) {
      if (/introuvable/i.test(error.message)) {
        return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
      }
      if (/non détenu/i.test(error.message)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ version: Number(data) }, { status: 200 });
  } catch (error) {
    console.error(
      '[adventure/[id]/select] erreur inattendue:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
