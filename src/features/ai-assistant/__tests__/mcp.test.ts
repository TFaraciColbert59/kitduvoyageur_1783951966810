import { describe, expect, it } from 'vitest';
import { handleMcpRequest, MCP_PROTOCOL_VERSION, MCP_TOOL_NAME } from '../connectors/mcp';
import { discoverRoutes, type CompasRouteRow } from '../connectors/routeDiscovery';

const row: CompasRouteRow = {
  route_id: 1,
  name: 'Mont A',
  ref: null,
  region: 'Alpes',
  distance_km: 10,
  elevation_gain_m: 500,
  elevation_loss_m: 500,
  duration_hours: 3,
  difficulty: 'moderee',
  distance_from_m: 0,
  start_lat: 45.9,
  start_lng: 6.8,
  community_sessions: 0,
};

const context = {
  searchRoutes: async (request: Parameters<typeof discoverRoutes>[0]) => discoverRoutes(request, [row]),
};

function bodyOf(response: { body: unknown }): Record<string, unknown> {
  return response.body as Record<string, unknown>;
}

describe('K1.14 — transport MCP', () => {
  it('répond à initialize avec le protocole et le serveur', async () => {
    const response = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' }, context);
    expect(response.status).toBe(200);
    const result = bodyOf(response).result as Record<string, unknown>;
    expect(result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    expect((result.serverInfo as Record<string, unknown>).name).toBe('lkdv-route-discovery');
  });

  it('liste uniquement search_routes', async () => {
    const response = await handleMcpRequest({ jsonrpc: '2.0', id: 'a', method: 'tools/list' }, context);
    const result = bodyOf(response).result as { tools: Array<{ name: string }> };
    expect(result.tools.map((tool) => tool.name)).toEqual([MCP_TOOL_NAME]);
  });

  it('appelle search_routes et rend le résultat structuré', async () => {
    const response = await handleMcpRequest(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: MCP_TOOL_NAME, arguments: { query: 'Mont' } },
      },
      context
    );
    expect(response.status).toBe(200);
    const body = bodyOf(response);
    expect(body.id).toBe(2);
    const result = body.result as {
      isError: boolean;
      structuredContent: { count: number; results: Array<{ name: string }> };
    };
    expect(result.isError).toBe(false);
    expect(result.structuredContent.count).toBe(1);
    expect(result.structuredContent.results[0]?.name).toBe('Mont A');
  });

  it('refuse des arguments invalides sans appeler la recherche', async () => {
    let called = false;
    const response = await handleMcpRequest(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: MCP_TOOL_NAME, arguments: {} },
      },
      {
        searchRoutes: async () => {
          called = true;
          throw new Error('ne doit pas être appelé');
        },
      }
    );
    const body = bodyOf(response);
    expect((body.error as { code: number }).code).toBe(-32602);
    expect(called).toBe(false);
  });

  it('refuse une méthode inconnue en JSON-RPC', async () => {
    const response = await handleMcpRequest({ jsonrpc: '2.0', id: 4, method: 'tools/write' }, context);
    expect((bodyOf(response).error as { code: number }).code).toBe(-32601);
  });

  it('accepte la notification initialisée sans corps', async () => {
    const response = await handleMcpRequest(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      context
    );
    expect(response).toEqual({ status: 202, body: null });
  });
});
