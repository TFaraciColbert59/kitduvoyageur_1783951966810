import { NextResponse } from 'next/server';
import { apiError, isApiError, logUnknownError } from '../../../lib/errors';
import { bearerToken, clientIp, methodNotAllowed, readJsonBody, requestRef } from '../../../server/http';
import { rateLimit } from '../../../server/rate-limit';
import { serviceDb } from '../../../server/db';
import { assertAgentActive, loadAgentByAuthUserId } from '../../../server/agents/store';
import { authError, dispatchRpc, MCP_PROTOCOL_VERSION } from '../../../server/mcp/protocol';
import { verifyAgentToken } from '../../../server/agents/token';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MCP_HEADERS = {
  'Cache-Control': 'no-store',
  'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
  'Content-Type': 'application/json'
} as const;

/**
 * POST /api/mcp — transport HTTP streamable, JSON-RPC 2.0.
 *
 * Authentification : `Authorization: Bearer <jeton court d'agent>` signé par
 * `AGENT_TOKEN_SIGNING` (10 min). Aucun accès anonyme, aucun accès humain.
 * Les outils et le budget sont contrôlés en base (`admin.agent_authorize`).
 */
export async function POST(request: Request): Promise<Response> {
  const ref = requestRef();
  try {
    const token = bearerToken(request);
    if (!token) throw apiError('agent_token_missing');
    const claims = await verifyAgentToken(token);

    const db = serviceDb();
    const agent = await loadAgentByAuthUserId(db, claims.sub);
    assertAgentActive(agent);

    // Débit par agent, en plus de `admin.agent_rate` qui fait foi.
    rateLimit(`mcp:agent:${agent.id}`, 120);
    rateLimit(`mcp:ip:${clientIp(request)}`, 300);

    const body = await readJsonBody(request, 256_000);
    const batch = Array.isArray(body);
    const messages = batch ? body : [body];
    if (messages.length === 0) return new Response(null, { status: 202, headers: MCP_HEADERS });

    const responses: Record<string, unknown>[] = [];
    for (const message of messages) {
      const response = await dispatchRpc(message, { db, agent, requestRef: ref });
      if (response) responses.push(response);
    }

    // Un lot composé uniquement de notifications ne reçoit pas de corps.
    if (responses.length === 0) return new Response(null, { status: 202, headers: MCP_HEADERS });

    const payload = batch ? responses : responses[0];
    return NextResponse.json(payload, { status: 200, headers: { ...MCP_HEADERS, 'X-Request-Ref': ref } });
  } catch (error) {
    const apiErr = isApiError(error) ? error : null;
    if (apiErr) {
      const { status, body } = authError(apiErr);
      return NextResponse.json(body, { status, headers: { ...MCP_HEADERS, 'X-Request-Ref': ref } });
    }
    logUnknownError('mcp_unhandled', error, ref);
    return NextResponse.json(authError(apiError('server_error')).body, {
      status: 500,
      headers: { ...MCP_HEADERS, 'X-Request-Ref': ref }
    });
  }
}

/** Pas de flux SSE côté serveur : le transport est requête/réponse uniquement. */
export async function GET(): Promise<Response> {
  return methodNotAllowed('POST');
}

export async function DELETE(): Promise<Response> {
  return methodNotAllowed('POST');
}
