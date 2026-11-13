import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { resolveAssistantIdentity } from '@/features/ai-assistant/server/identity';
import { createSupabaseHistoryConsentPort } from '@/features/ai-assistant/history/consent';
import { createSupabaseHistoryActivitiesPort } from '@/features/ai-assistant/history/supabaseHistory';
import { createClaudeProvider, createGeminiProvider } from '@/features/ai-assistant/providers/external';
import { askHistoryAssistant } from '@/features/ai-assistant/history/historyAssistant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({
  question: z.string().trim().min(3).max(500),
  provider: z.enum(['claude', 'gemini']),
});

/**
 * S2.38 — POST /api/ai-assistant/history/ask
 * Réponse Claude/Gemini sur les agrégats autorisés. Le consentement est
 * contrôlé avant la lecture ; la clé absente rend `provider_unconfigured`
 * sans appel réseau, tout en laissant les questions disponibles.
 */
export async function POST(request: NextRequest) {
  const identity = await resolveAssistantIdentity(request);
  if (!identity) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });

  const limited = await enforceRateLimit(identity.user.id, {
    scope: 'ai-assistant-history-ask',
    limit: 10,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'question ou fournisseur invalide' }, { status: 400 });
  }

  const result = await askHistoryAssistant(identity.user.id, parsed.data.question, parsed.data.provider, {
    consent: createSupabaseHistoryConsentPort(identity.supabase),
    activities: createSupabaseHistoryActivitiesPort(identity.supabase, identity.user.id),
    providers: { claude: createClaudeProvider(), gemini: createGeminiProvider() },
  });

  if (result.status === 'consent_required') {
    return NextResponse.json({ result }, { status: 403 });
  }
  return NextResponse.json({ result });
}
