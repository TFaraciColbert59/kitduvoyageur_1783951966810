import { NextRequest, NextResponse } from 'next/server';
import { completion } from '@rocketnew/llm-sdk';
import { createClient } from '@/lib/supabase/server';
import { askAI } from '@/lib/ai/askAI';
import { askAIStream } from '@/lib/ai/askAIStream';
import { resolveAiMode, derivePromptAndSystem } from '@/lib/ai/requestMode';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Phase 6 (§9.11) — limite anti-rafale de la route IA payante (30/h). */
const CHAT_COMPLETION_LIMIT = 30;
const CHAT_COMPLETION_WINDOW_MS = 60 * 60_000;

/**
 * Point d'entrée IA unique de LKDV.
 * - Mode legacy (rétrocompatibilité) : provider payant demandé explicitement ET
 *   sa clé existe → comportement historique `@rocketnew/llm-sdk` (SSE inclus).
 * - Mode défaut : routeur Nemotron via OpenRouter (`askAI`) — quota et cache
 *   gérés en interne par le routeur (registre + port IA).
 * Toute entrée est validée par Zod (`resolveAiMode`). Aucun throw non géré :
 * en mode Nemotron, la dégradation est gracieuse (flag `degraded`), jamais 500.
 */

const API_KEYS: Record<string, string | undefined> = {
  OPEN_AI: process.env.OPENAI_API_KEY,
  ANTHROPIC: process.env.ANTHROPIC_API_KEY,
  GEMINI: process.env.GEMINI_API_KEY,
  PERPLEXITY: process.env.PERPLEXITY_API_KEY,
};

function formatErrorResponse(error: unknown, provider?: string) {
  const statusCode = (error as any)?.statusCode || (error as any)?.status || 500;
  const providerName = (error as any)?.llmProvider || provider || 'Unknown';

  return {
    error: `${providerName.toUpperCase()} API error: ${statusCode}`,
    details: error instanceof Error ? error.message : String(error),
    statusCode,
  };
}

export async function POST(request: NextRequest) {
  let rawBody: unknown = {};

  try {
    // Route payante : session obligatoire, en production comme en recette —
    // l'ancienne garde `NODE_ENV === 'production'` laissait la route ouverte
    // sur tout déploiement non marqué production.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Authentication required' },
        { status: 401 }
      );
    }
    const userId = user.id;

    // Phase 6 (§9.11) — route IA payante : limite distribuée fail-closed.
    const limitIdentifier = userId;
    const limited = await rateLimit({
      key: `ai-chat-completion:${limitIdentifier}`,
      limit: CHAT_COMPLETION_LIMIT,
      windowMs: CHAT_COMPLETION_WINDOW_MS,
      failMode: 'closed',
    });
    if (limited.outcome === 'limited') {
      return NextResponse.json(
        { error: 'Trop de requêtes', details: 'chat_completion_rate_limited' },
        { status: 429, headers: rateLimitHeaders(limited) }
      );
    }
    if (limited.outcome === 'unavailable') {
      return NextResponse.json(
        { error: 'Service temporairement indisponible', details: 'rate_limit_indisponible' },
        { status: 503, headers: rateLimitHeaders(limited) }
      );
    }

    rawBody = await request.json();
    const resolved = resolveAiMode(rawBody, API_KEYS);
    if (!resolved.ok) {
      return NextResponse.json(
        { error: 'Invalid request body', details: resolved.issues.join('; ') },
        { status: 400 }
      );
    }
    const body = resolved.body;

    // ── Mode legacy : providers payants demandés explicitement (clé présente) ──
    if (resolved.mode === 'legacy') {
      const provider = body.provider as string;
      const apiKey = API_KEYS[provider] as string;

      if (!body.model || !body.messages?.length) {
        return NextResponse.json(
          { error: 'Missing required fields: provider, model, messages', details: 'Request validation failed' },
          { status: 400 }
        );
      }

      if (body.stream) {
        const response = await completion({
          ...body.parameters,
          model: body.model,
          messages: body.messages,
          stream: true,
          api_key: apiKey,
        });

        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          async start(controller) {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start' })}\n\n`));

              for await (const chunk of response as unknown as AsyncIterable<unknown>) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', chunk })}\n\n`));
              }

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
              controller.close();
            } catch (error) {
              const formatted = formatErrorResponse(error, provider);
              console.error('API Route Error:', { error: formatted.error, details: formatted.details });
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: formatted.error, details: formatted.details })}\n\n`));
              controller.close();
            }
          },
        });

        return new NextResponse(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      }

      const response = await completion({
        ...body.parameters,
        model: body.model,
        messages: body.messages,
        stream: false,
        api_key: apiKey,
      });

      return NextResponse.json(response);
    }

    // ── Mode défaut : routeur Nemotron via OpenRouter (port + registre) ───────
    const derived = derivePromptAndSystem(body);
    if (!derived) {
      return NextResponse.json(
        {
          error: 'Missing prompt',
          details: 'Fournir "prompt" ou "messages" contenant au moins un message utilisateur.',
        },
        { status: 400 }
      );
    }

    const aiRequest = {
      feature: 'chat-completion',
      tier: body.task,
      system: derived.system,
      prompt: derived.prompt,
      maxTokens: body.maxTokens ?? 2_048,
      reasoningBudget: body.reasoningBudget,
      cacheTtlSeconds: 0, // chat = personnel : pas de cache
      userId,
    } as const;

    if (body.stream) {
      // Flux réel provider → port IA → HTTP → client. Les précontrôles
      // (auth, quota, plafond du site, feature, modèle autorisé) sont ceux
      // d'askAIStream, pas ceux d'une route provider parallèle.
      const streamed = await askAIStream({ ...aiRequest, signal: request.signal });
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const send = (payload: unknown) => {
            if (request.signal.aborted) return;
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            } catch {
              /* le client a fermé le flux */
            }
          };
          send({ type: 'start' });
          try {
            for await (const delta of streamed.stream) {
              send({ type: 'chunk', chunk: { choices: [{ delta: { content: delta } }] } });
            }
            send({
              type: 'done',
              model: streamed.model,
              provider: streamed.provider,
              degraded: streamed.degraded,
              cached: streamed.cached,
              failureReason: streamed.failureReason,
            });
          } catch (streamError) {
            console.error('API Route stream error:', {
              feature: 'chat-completion',
              details: streamError instanceof Error ? streamError.message : String(streamError),
            });
            send({ type: 'error', error: 'AI stream failed', details: 'flux_interrompu' });
          } finally {
            try {
              controller.close();
            } catch {
              /* déjà fermé */
            }
          }
        },
        cancel() {
          // `request.signal` est déjà liée à la déconnexion ; le générateur
          // provider est annulé par son `finally`.
        },
      });
      return new NextResponse(readable, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const result = await askAI(aiRequest);
    return NextResponse.json({
      text: result.text,
      model: result.model,
      degraded: result.degraded,
      cached: result.cached,
      provider: result.provider,
    });
  } catch (error) {
    const formatted = formatErrorResponse(error, (rawBody as any)?.provider);
    console.error('API Route Error:', { error: formatted.error, details: formatted.details });
    return NextResponse.json(
      { error: formatted.error, details: formatted.details },
      { status: formatted.statusCode }
    );
  }
}
