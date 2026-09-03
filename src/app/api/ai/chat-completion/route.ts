import { NextRequest, NextResponse } from 'next/server';
import { completion } from '@rocketnew/llm-sdk';
import { createClient } from '@/lib/supabase/server';
import { askAI } from '@/lib/ai/nemotronRouter';
import {
  resolveAiMode,
  derivePromptAndSystem,
  buildSsePayload,
  ASKAI_ERROR_STATUS,
} from '@/lib/ai/requestMode';

export const dynamic = 'force-dynamic';

/**
 * Point d'entrée IA unique de LKDV.
 * - Mode legacy (rétrocompatibilité) : provider payant demandé explicitement ET
 *   sa clé existe → comportement historique `@rocketnew/llm-sdk` (SSE inclus).
 * - Mode défaut : routeur Nemotron via OpenRouter (`askAI`), avec quota
 *   quotidien (`check_and_increment_ai_quota`) et cache serveur.
 * Toute entrée est validée par Zod (`resolveAiMode`). Aucun throw non géré :
 * erreurs typées traduites en réponses gracieuses pour l'UI.
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

function sseResponse(payload: string): NextResponse {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
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

export async function POST(request: NextRequest) {
  let rawBody: unknown = {};

  try {
    // Authenticate user in production (inchangé)
    let userId: string | null = null;
    let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
    if (process.env.NODE_ENV === 'production') {
      supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized', details: 'Authentication required' },
          { status: 401 }
        );
      }
      userId = user.id;
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
          model: body.model,
          messages: body.messages,
          stream: true,
          api_key: apiKey,
          ...body.parameters,
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
        model: body.model,
        messages: body.messages,
        stream: false,
        api_key: apiKey,
        ...body.parameters,
      });

      return NextResponse.json(response);
    }

    // ── Mode défaut : routeur Nemotron via OpenRouter ─────────────────────────
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

    // Quota quotidien (20 heavy + 100 fast / jour / user). En dev sans session,
    // le quota est ignoré (pas d'utilisateur) — warn pour le rendre visible.
    if (userId && supabase) {
      const { data: allowed, error: quotaError } = await supabase.rpc(
        'check_and_increment_ai_quota',
        { p_user_id: userId, p_tier: body.task }
      );
      if (quotaError) {
        console.warn('[ai/chat-completion] quota indisponible:', quotaError.message);
      } else if (allowed === false) {
        return NextResponse.json(
          { error: 'Quota IA quotidien atteint pour ce tier.', code: 'QUOTA_EXCEEDED' },
          { status: 429 }
        );
      }
    } else if (process.env.NODE_ENV === 'production') {
      console.warn('[ai/chat-completion] quota ignoré: utilisateur inconnu');
    }

    const result = await askAI({
      task: body.task,
      system: derived.system,
      prompt: derived.prompt,
      maxTokens: body.maxTokens,
      reasoningBudget: body.reasoningBudget,
      feature: 'chat-completion',
    });

    if (!result.ok) {
      console.error('[ai/chat-completion] askAI en échec:', result.error.code);
      return NextResponse.json(
        {
          error: 'Service IA momentanément indisponible',
          code: result.error.code,
          details: result.error.message,
        },
        { status: ASKAI_ERROR_STATUS[result.error.code] }
      );
    }

    if (body.stream) {
      // Contrat SSE conservé pour les clients existants (réponse complète en un chunk).
      return sseResponse(buildSsePayload(result.text, result.degraded));
    }

    return NextResponse.json({
      text: result.text,
      model: result.model,
      degraded: result.degraded,
      cached: result.cached,
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
