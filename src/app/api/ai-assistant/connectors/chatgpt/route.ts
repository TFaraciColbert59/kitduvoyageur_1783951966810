import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { resolveAssistantIdentity } from '@/features/ai-assistant/server/identity';
import { buildChatGptConnectorManifest } from '@/features/ai-assistant/connectors/chatgpt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * K1.14 — GET /api/ai-assistant/connectors/chatgpt
 * Manifeste du connecteur externe. Aucune entrée de navigation LKDV.
 * Tant que `CHATGPT_CONNECTOR_ENABLED` n'est pas explicitement `true`, le
 * statut est `connector_not_configured` : droits et surface restent à valider.
 */
export async function GET(request: NextRequest) {
  const identity = await resolveAssistantIdentity(request);
  if (!identity) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });

  const limited = await enforceRateLimit(identity.user.id, {
    scope: 'ai-assistant-chatgpt-manifest',
    limit: 60,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  return NextResponse.json({ manifest: buildChatGptConnectorManifest() });
}
