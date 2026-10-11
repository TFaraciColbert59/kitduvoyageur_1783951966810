/**
 * T25 — réponses acceptées :
 *   (a) service : décision du demandeur, refus mappés (auto-réponse, déjà
 *       accepté, collusion, demandeur requis) ;
 *   (b) hook : réponse non acceptée → refus ; acceptée → gain avec claim par
 *       QUESTION (une seule récompense par question) ;
 *   (c) route : 401, 400, 403, 409, 200 — l'identité vient de la session.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn() }));
vi.mock('@/features/progression/server/awardProducer', () => ({ awardProducerGain: vi.fn() }));

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { awardProducerGain } from '@/features/progression/server/awardProducer';
import { acceptQaAnswer } from '@/features/progression/server/answerProof';
import { awardAnswerAccepted } from '@/features/progression/server/producerHooks';
import { POST } from '@/app/api/progression/answers/accept/route';

const ORIGINAL_ENV = { ...process.env };
const SESSION_USER = '22222222-2222-4222-8222-222222222222';
const ANSWER_ID = '66666666-6666-4666-8666-666666666666';
const QUESTION_ID = '77777777-7777-4777-8777-777777777777';

const mockedServiceClient = vi.mocked(createServiceClient);
const mockedServerClient = vi.mocked(createServerClient);
const mockedRateLimit = vi.mocked(enforceRateLimit);
const mockedGetService = vi.mocked(getServiceSupabase);
const mockedAward = vi.mocked(awardProducerGain);

function rpcService(options: { result?: unknown; error?: { message: string } | null; calls?: Array<Record<string, unknown>> }) {
  return {
    rpc: (fn: string, args: Record<string, unknown>) => {
      options.calls?.push({ fn, args });
      return Promise.resolve({ data: options.result ?? null, error: options.error ?? null });
    },
  };
}

function answerRow(overrides: Record<string, unknown>) {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.maybeSingle = () => Promise.resolve({ data: { ...overrides }, error: null });
  return { from: () => builder };
}

function request(body?: unknown) {
  return new NextRequest('http://localhost/api/progression/answers/accept', {
    method: 'POST',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  mockedServerClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: SESSION_USER } } }) },
  } as never);
  mockedRateLimit.mockResolvedValue(null as never);
  mockedAward.mockResolvedValue({ success: true, outcome: 'awarded' });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('T25 — réponse acceptée', () => {
  it('(a1) le demandeur accepte une réponse d’un autre auteur → ok', async () => {
    const calls: Array<Record<string, unknown>> = [];
    mockedServiceClient.mockReturnValue(
      rpcService({
        result: { ok: true, questionId: QUESTION_ID, answerAuthor: 'answerer-1' },
        calls,
      }) as never
    );

    const result = await acceptQaAnswer(ANSWER_ID, SESSION_USER);

    expect(result).toEqual({ ok: true, questionId: QUESTION_ID, answerAuthor: 'answerer-1' });
    expect(calls[0]).toMatchObject({
      fn: 'accept_qa_answer',
      args: { p_answer_id: ANSWER_ID, p_actor_id: SESSION_USER },
    });
  });

  it('(a2) refus mappés : auto-réponse, déjà accepté, collusion, demandeur requis', async () => {
    for (const reason of ['auto_reponse', 'deja_accepte', 'collusion_paire', 'demandeur_requis'] as const) {
      mockedServiceClient.mockReturnValue(rpcService({ result: { ok: false, reason } }) as never);
      expect(await acceptQaAnswer(ANSWER_ID, SESSION_USER)).toEqual({ ok: false, reason });
    }
  });

  it('(b1) réponse non acceptée → aucun crédit', async () => {
    mockedGetService.mockReturnValue(
      answerRow({ id: ANSWER_ID, question_id: QUESTION_ID, author_id: 'answerer-1', is_accepted: false }) as never
    );

    const result = await awardAnswerAccepted(ANSWER_ID);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('reponse_non_acceptee');
    expect(mockedAward).not.toHaveBeenCalled();
  });

  it('(b2) réponse acceptée → gain avec claim par QUESTION', async () => {
    mockedGetService.mockReturnValue(
      answerRow({ id: ANSWER_ID, question_id: QUESTION_ID, author_id: 'answerer-1', is_accepted: true }) as never
    );

    await awardAnswerAccepted(ANSWER_ID);

    const input = mockedAward.mock.calls[0][0];
    expect(input.action).toBe('answer_accepted');
    expect(input.userId).toBe('answerer-1');
    expect(input.claims).toEqual([{ group: 'qa_answer', key: `question:${QUESTION_ID}` }]);
  });

  it('(c1) route : 401 sans session, 400 corps invalide', async () => {
    mockedServerClient.mockResolvedValueOnce({
      auth: { getUser: async () => ({ data: { user: null } }) },
    } as never);
    expect((await POST(request({ answerId: ANSWER_ID }))).status).toBe(401);
    expect((await POST(request({ answerId: 'pas-un-uuid' }))).status).toBe(400);
  });

  it('(c2) route : 403 auto-réponse/demandeur, 409 déjà accepté, 404 introuvable', async () => {
    mockedServiceClient.mockReturnValue(rpcService({ result: { ok: false, reason: 'auto_reponse' } }) as never);
    expect((await POST(request({ answerId: ANSWER_ID }))).status).toBe(403);

    mockedServiceClient.mockReturnValue(rpcService({ result: { ok: false, reason: 'deja_accepte' } }) as never);
    expect((await POST(request({ answerId: ANSWER_ID }))).status).toBe(409);

    mockedServiceClient.mockReturnValue(rpcService({ result: { ok: false, reason: 'reponse_introuvable' } }) as never);
    expect((await POST(request({ answerId: ANSWER_ID }))).status).toBe(404);
  });

  it('(c3) route 200 : identité de session, gain serveur déclenché', async () => {
    const calls: Array<Record<string, unknown>> = [];
    mockedServiceClient.mockReturnValue(
      rpcService({ result: { ok: true, questionId: QUESTION_ID, answerAuthor: 'answerer-1' }, calls }) as never
    );
    mockedGetService.mockReturnValue(
      answerRow({ id: ANSWER_ID, question_id: QUESTION_ID, author_id: 'answerer-1', is_accepted: true }) as never
    );

    const response = await POST(request({ answerId: ANSWER_ID }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, questionId: QUESTION_ID });
    // L'acteur SQL vient de la session, jamais du corps.
    expect(calls[0].args).toMatchObject({ p_actor_id: SESSION_USER });
    expect(mockedAward).toHaveBeenCalledTimes(1);
  });
});
