import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * T25 — Réponses acceptées : la décision appartient au demandeur (fonction SQL
 * verrouillée), jamais au votant ni au répondant. Un gain par QUESTION.
 */

export type AnswerAcceptanceRefusal =
  | 'reponse_introuvable'
  | 'question_introuvable'
  | 'deja_accepte'
  | 'demandeur_requis'
  | 'auto_reponse'
  | 'collusion_paire'
  | 'unavailable';

export type AnswerAcceptanceResult =
  | { ok: true; questionId: string; answerAuthor: string }
  | { ok: false; reason: AnswerAcceptanceRefusal };

const KNOWN_REASONS: readonly AnswerAcceptanceRefusal[] = [
  'reponse_introuvable',
  'question_introuvable',
  'deja_accepte',
  'demandeur_requis',
  'auto_reponse',
  'collusion_paire',
];

function createAnswerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      '[progression] NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour les réponses.'
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function acceptQaAnswer(
  answerId: string,
  actorId: string
): Promise<AnswerAcceptanceResult> {
  const supabase = createAnswerClient();
  const { data, error } = await supabase.rpc('accept_qa_answer', {
    p_answer_id: answerId,
    p_actor_id: actorId,
  });
  if (error) throw new Error(error.message);

  const payload =
    data !== null && typeof data === 'object'
      ? (data as { ok?: unknown; reason?: unknown; questionId?: unknown; answerAuthor?: unknown })
      : null;
  if (
    payload?.ok === true &&
    typeof payload.questionId === 'string' &&
    typeof payload.answerAuthor === 'string'
  ) {
    return { ok: true, questionId: payload.questionId, answerAuthor: payload.answerAuthor };
  }
  const reason =
    typeof payload?.reason === 'string' &&
    (KNOWN_REASONS as readonly string[]).includes(payload.reason)
      ? (payload.reason as AnswerAcceptanceRefusal)
      : 'unavailable';
  return { ok: false, reason };
}
