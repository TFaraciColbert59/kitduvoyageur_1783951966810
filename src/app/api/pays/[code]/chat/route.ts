import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient as createAnonClient } from '@/lib/supabase/server';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { askAI } from '@/lib/ai/askAI';
import { buildPaysChatRequest } from '@/features/pays/chat/paysChatPrompt';
import {
  formatRagContext,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  type RagChunk,
} from '@/features/pays/chat/paysChatRag';
import { clientIpFromHeaders, rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** POC mini-chat pays — même convention que /api/ai/chat-completion : 30/h. */
const CHAT_LIMIT = 30;
const CHAT_WINDOW_MS = 60 * 60_000;

const chatBodySchema = z.object({
  question: z.string().min(1).max(2000),
});

/**
 * Embedding OpenRouter (API compatible OpenAI). Retourne null à la moindre
 * anomalie (clé absente, HTTP non-ok, dimension inattendue, timeout 10 s) :
 * la route dégrade alors vers une réponse sans RAG, jamais une erreur.
 */
async function embedQuery(text: string, apiKey: string): Promise<number[] | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lekitduvoyageur.fr',
        'X-Title': 'LKDV',
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const emb = data?.data?.[0]?.embedding;
    return Array.isArray(emb) && emb.length === EMBEDDING_DIMENSIONS ? emb : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await params;
  const countryCode = (rawCode ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return NextResponse.json({ error: 'Code pays invalide' }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }
  const parsed = chatBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Question requise (1-2000 caractères)' }, { status: 400 });
  }
  const question = parsed.data.question;

  // Authentification en production (même convention que chat-completion).
  let userId: string | undefined;
  if (process.env.NODE_ENV === 'production') {
    const supabase = await createAnonClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    userId = user.id;
  }

  // Quota distribué fail-closed (même convention que chat-completion).
  const limitIdentifier = userId ?? clientIpFromHeaders(request.headers);
  const limited = await rateLimit({
    key: `pays-chat:${limitIdentifier}`,
    limit: CHAT_LIMIT,
    windowMs: CHAT_WINDOW_MS,
    failMode: 'closed',
  });
  if (limited.outcome === 'limited') {
    return NextResponse.json(
      { error: 'Trop de requêtes', details: 'pays_chat_rate_limited' },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }
  if (limited.outcome === 'unavailable') {
    return NextResponse.json(
      { error: 'Service temporairement indisponible', details: 'rate_limit_indisponible' },
      { status: 503, headers: rateLimitHeaders(limited) }
    );
  }

  // RAG optionnel : toute anomalie → réponse sans RAG (ragUsed: false).
  let ragUsed = false;
  let ragContext = '';
  const orKey = process.env.OPENROUTER_API_KEY;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (orKey && svcKey && sbUrl) {
    const emb = await embedQuery(question, orKey);
    if (emb) {
      try {
        const svc = createSbClient(sbUrl, svcKey);
        const { data, error } = await svc.rpc('match_pays_chat_chunks', {
          p_query_embedding: emb,
          p_country_code: countryCode,
          p_limit: 5,
        });
        if (!error && Array.isArray(data) && data.length > 0) {
          ragContext = formatRagContext(data as RagChunk[]);
          ragUsed = ragContext.length > 0;
        }
      } catch {
        ragUsed = false;
      }
    }
  }

  try {
    const base = buildPaysChatRequest({ countryCode, question });
    const system = ragUsed ? `${base.system}\n\nPassages vérifiés du guide :\n${ragContext}` : base.system;
    const result = await askAI({
      // 'chat-completion' = point d'entrée générique du registre (pas de
      // feature dédiée : askAI throw sur feature inconnue — registry.ts).
      feature: 'chat-completion',
      tier: 'fast',
      system,
      prompt: question,
      maxTokens: 1024,
      userId,
    });
    return NextResponse.json({
      text: result.text,
      model: result.model,
      degraded: result.degraded,
      ragUsed,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Échec de la réponse IA',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
