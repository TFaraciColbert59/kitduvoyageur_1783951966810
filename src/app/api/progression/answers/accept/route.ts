import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { acceptQaAnswer } from '@/features/progression/server/answerProof';
import { awardAnswerAccepted } from '@/features/progression/server/producerHooks';

export const dynamic = 'force-dynamic';

/**
 * T25 — Accepter une réponse (le demandeur uniquement ; l'identité vient de
 * la session serveur). Le gain éventuel est attribué par le serveur après la
 * décision — jamais par le client, jamais sur un simple vote.
 */
const bodySchema = z.object({ answerId: z.string().uuid() });

function statusFor(reason: string): number {
  if (reason === 'reponse_introuvable' || reason === 'question_introuvable') return 404;
  if (reason === 'deja_accepte' || reason === 'collusion_paire') return 409;
  if (reason === 'demandeur_requis' || reason === 'auto_reponse') return 403;
  return 503;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const limited = await enforceRateLimit(user.id, {
      scope: 'progression-answers-accept',
      limit: 30,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
    }

    const result = await acceptQaAnswer(parsed.data.answerId, user.id);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.reason }, { status: statusFor(result.reason) });
    }

    // Attribution serveur, best-effort : un échec du gain ne défait jamais
    // l'acceptation (l'intention/reprise économique suit son propre canal).
    try {
      await awardAnswerAccepted(parsed.data.answerId);
    } catch (error) {
      console.warn('[progression/answers] gain différé (non bloquant):', error);
    }

    return NextResponse.json({ success: true, questionId: result.questionId });
  } catch (err) {
    console.error('[API /api/progression/answers/accept]', err);
    return NextResponse.json({ success: false, error: 'Erreur interne' }, { status: 500 });
  }
}
