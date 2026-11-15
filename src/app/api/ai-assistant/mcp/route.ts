import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { resolveAssistantIdentity } from '@/features/ai-assistant/server/identity';
import { searchRoutesForAssistant } from '@/features/ai-assistant/server/routeSearch';
import { readChatGptConnectorStatus } from '@/features/ai-assistant/connectors/chatgpt';
import { handleMcpRequest } from '@/features/ai-assistant/connectors/mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * K1.14 — POST /api/ai-assistant/mcp
 * Transport MCP JSON-RPC en lecture seule. Même arbitrage que le connecteur
 * ChatGPT : désactivé tant que `CHATGPT_CONNECTOR_ENABLED` n'est pas validé.
 */
export async function POST(request: NextRequest) {
  const connector = readChatGptConnectorStatus();
  if (connector.status !== 'available') {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32000, message: connector.message },
      },
      { status: 503 }
    );
  }

  const identity = await resolveAssistantIdentity(request);
  if (!identity) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Authentification requise' } },
      { status: 401 }
    );
  }

  const limited = await enforceRateLimit(identity.user.id, {
    scope: 'ai-assistant-mcp',
    limit: 20,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON invalide' } },
      { status: 400 }
    );
  }

  const response = await handleMcpRequest(body, {
    searchRoutes: (discoveryRequest) => searchRoutesForAssistant(identity.supabase, discoveryRequest),
  });
  if (response.status === 202 || response.body === null) {
    return new NextResponse(null, { status: response.status });
  }
  return NextResponse.json(response.body, { status: response.status });
}
