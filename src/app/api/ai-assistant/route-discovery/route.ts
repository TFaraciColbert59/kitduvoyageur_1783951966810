import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { resolveAssistantIdentity } from '@/features/ai-assistant/server/identity';
import {
  buildChatGptConnectorManifest,
  readChatGptConnectorStatus,
} from '@/features/ai-assistant/connectors/chatgpt';
import { routeDiscoveryRequestSchema } from '@/features/ai-assistant/connectors/routeDiscovery';
import { searchRoutesForAssistant } from '@/features/ai-assistant/server/routeSearch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * K1.14 — POST /api/ai-assistant/route-discovery
 * Recherche de parcours pour l'assistant externe. La route ne s'ouvre que si
 * le connecteur est activé par arbitrage. Les résultats viennent de
 * `compas_search_routes` (catalogue réel) ; les contraintes inconnues sont
 * rendues telles quelles, jamais supposées satisfaites.
 */
export async function POST(request: NextRequest) {
  const connector = readChatGptConnectorStatus();
  if (connector.status !== 'available') {
    return NextResponse.json(
      {
        error: 'Connecteur indisponible',
        connector,
        manifest: buildChatGptConnectorManifest(),
      },
      { status: 503 }
    );
  }

  const identity = await resolveAssistantIdentity(request);
  if (!identity) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });

  const limited = await enforceRateLimit(identity.user.id, {
    scope: 'ai-assistant-route-discovery',
    limit: 20,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const parsed = routeDiscoveryRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'requête invalide', details: parsed.error.issues.map((issue) => issue.message) },
      { status: 400 }
    );
  }

  try {
    const discovery = await searchRoutesForAssistant(identity.supabase, parsed.data);
    return NextResponse.json({ connector, discovery });
  } catch (error) {
    console.error(
      '[ai-assistant/route-discovery]',
      error instanceof Error ? error.message : 'erreur'
    );
    return NextResponse.json({ error: 'Catalogue indisponible' }, { status: 503 });
  }
}
