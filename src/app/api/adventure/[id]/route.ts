import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAdventurePlan } from '@/features/adventure-intelligence/server/generateAdventure';

export const dynamic = 'force-dynamic';

const planIdSchema = z.string().uuid('id doit être un UUID');

/**
 * GET /api/adventure/[id] — lecture du plan + version courante + décisions.
 * Le client de session applique les policies A1 (propriétaire ou
 * collaborateur du voyage) : tout plan inaccessible est un 404.
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

    const { id } = await params;
    const parsedId = planIdSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }
    if (!user) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }

    const stored = await getAdventurePlan(session, parsedId.data);
    if (!stored) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }

    return NextResponse.json({
      plan: stored.plan,
      version: stored.version,
      decisions: stored.decisions,
      // A11 #14 — les plans candidats ne sont renvoyés que s'ils existent.
      ...(stored.candidates && stored.candidates.length > 0
        ? { candidates: stored.candidates }
        : {}),
      // A13 (S2) — le tableau comparatif n'est exposé que si la version le porte.
      ...(stored.candidateComparison ? { candidateComparison: stored.candidateComparison } : {}),
    });
  } catch (error) {
    console.error(
      '[adventure/[id]] erreur inattendue:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
