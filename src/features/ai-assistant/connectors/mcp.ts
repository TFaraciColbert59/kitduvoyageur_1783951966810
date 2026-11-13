/**
 * K1.14 — adaptateur MCP minimal pour la découverte de parcours.
 *
 * Transport JSON-RPC 2.0 sans état, limité à `initialize`, `tools/list`,
 * `tools/call` (`search_routes`) et `ping`. Le connecteur doit être activé
 * par le même arbitrage que le manifeste ChatGPT ; l'authentification et la
 * recherche restent injectées par la route. Aucun outil d'écriture.
 */

import { z } from 'zod';
import {
  routeDiscoveryRequestSchema,
  type RouteDiscoveryRequest,
  type RouteDiscoveryResult,
} from './routeDiscovery';

export const MCP_PROTOCOL_VERSION = '2025-06-18';
export const MCP_SERVER_NAME = 'lkdv-route-discovery';
export const MCP_SERVER_VERSION = 'a08-v1';
export const MCP_TOOL_NAME = 'search_routes';

export interface McpToolContext {
  searchRoutes(request: RouteDiscoveryRequest): Promise<RouteDiscoveryResult>;
}

export interface McpHttpResponse {
  status: number;
  body: unknown;
}

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function rpcResult(id: JsonRpcId, result: unknown): McpHttpResponse {
  return { status: 200, body: { jsonrpc: '2.0', id, result } };
}

function rpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown
): McpHttpResponse {
  return {
    status: 200,
    body: {
      jsonrpc: '2.0',
      id,
      error: { code, message, ...(data === undefined ? {} : { data }) },
    },
  };
}

export const MCP_TOOL_DEFINITION = {
  name: MCP_TOOL_NAME,
  description:
    'Recherche des itinéraires réels du catalogue LKDV avec les contraintes de terrain comprises. ' +
    'Les contraintes inconnues sont rendues comme telles, jamais supposées satisfaites.',
  inputSchema: z.toJSONSchema(routeDiscoveryRequestSchema, { io: 'input' }),
} as const;

async function callTool(params: unknown, context: McpToolContext): Promise<McpHttpResponse> {
  if (!isRecord(params) || params.name !== MCP_TOOL_NAME) {
    return rpcError(null, -32602, 'Outil inconnu');
  }
  const parsed = routeDiscoveryRequestSchema.safeParse(params.arguments ?? {});
  if (!parsed.success) {
    return rpcError(
      null,
      -32602,
      'Arguments invalides',
      parsed.error.issues.map((issue) => issue.message)
    );
  }

  try {
    const discovery = await context.searchRoutes(parsed.data);
    return rpcResult(null, {
      content: [{ type: 'text', text: JSON.stringify(discovery) }],
      structuredContent: discovery,
      isError: false,
    });
  } catch {
    return rpcError(null, -32603, 'Recherche indisponible');
  }
}

/**
 * Traite une requête MCP. Le `id` de la requête est toujours repris ; les
 * notifications (`notifications/initialized`) répondent 202 sans corps.
 */
export async function handleMcpRequest(
  body: unknown,
  context: McpToolContext
): Promise<McpHttpResponse> {
  if (!isRecord(body) || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return rpcError(null, -32600, 'Requête JSON-RPC invalide');
  }
  const request = body as unknown as JsonRpcRequest;
  const id = request.id ?? null;

  if (request.method === 'notifications/initialized') {
    return { status: 202, body: null };
  }

  if (request.method === 'initialize') {
    return rpcResult(id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
      instructions:
        'Découverte de parcours LKDV en lecture seule. Utiliser search_routes avec les contraintes comprises ; les valeurs absentes ne sont pas des zéros.',
    });
  }

  if (request.method === 'ping') {
    return rpcResult(id, {});
  }

  if (request.method === 'tools/list') {
    return rpcResult(id, { tools: [MCP_TOOL_DEFINITION] });
  }

  if (request.method === 'tools/call') {
    const response = await callTool(request.params, context);
    // Reprend l'id réel de la requête, y compris quand l'outil échoue.
    if (isRecord(response.body) && response.body.id === null) {
      response.body.id = id;
    }
    return response;
  }

  return rpcError(id, -32601, `Méthode inconnue : ${request.method}`);
}
