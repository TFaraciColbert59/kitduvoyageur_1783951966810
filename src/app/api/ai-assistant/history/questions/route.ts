import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { resolveAssistantIdentity } from '@/features/ai-assistant/server/identity';
import { createSupabaseHistoryConsentPort } from '@/features/ai-assistant/history/consent';
import { createSupabaseHistoryActivitiesPort } from '@/features/ai-assistant/history/supabaseHistory';
import { createClaudeProvider, createGeminiProvider } from '@/features/ai-assistant/providers/external';
import { getHistoryQuestions } from '@/features/ai-assistant/history/historyAssistant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * S2.38 — GET /api/ai-assistant/history/questions
 * Questions déterministes sur l'historique. Consentement vérifié avant
 * toute lecture ; aucune IA n'est appelée pour les proposer.
 */
export async function GET(request: NextRequest) {
  const identity = await resolveAssistantIdentity(request);
  if (!identity) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });

  const limited = await enforceRateLimit(identity.user.id, {
    scope: 'ai-assistant-history-questions',
    limit: 30,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const result = await getHistoryQuestions(identity.user.id, {
    consent: createSupabaseHistoryConsentPort(identity.supabase),
    activities: createSupabaseHistoryActivitiesPort(identity.supabase, identity.user.id),
    providers: { claude: createClaudeProvider(), gemini: createGeminiProvider() },
  });

  if (result.status === 'consent_required') {
    return NextResponse.json({ result }, { status: 403 });
  }
  return NextResponse.json({ result });
}
