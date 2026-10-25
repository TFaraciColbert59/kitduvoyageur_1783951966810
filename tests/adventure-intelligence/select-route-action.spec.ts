/**
 * Phase 2 — Server action `selectAdventurePlanRoute` : validation Zod, session
 * requise, RPC `select_adventure_plan_route` corrélée et mapping d'erreurs.
 *
 *   • TEST-PHASE2-ACT-01 : non authentifié ⇒ 401 sans appel RPC
 *   • TEST-PHASE2-ACT-02 : entrées invalides ⇒ 400 sans appel RPC
 *   • TEST-PHASE2-ACT-03 : corrélation générée côté serveur puis retenue
 *   • TEST-PHASE2-ACT-04 : corrélation fournie transmise à la RPC
 *   • TEST-PHASE2-ACT-05 : erreurs RPC mappées 401/403/400/500
 *   • TEST-PHASE2-ACT-06 : réponse RPC non conforme ⇒ 500
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockRpc } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  })),
}));

import { selectAdventurePlanRoute } from '@/features/adventure-intelligence/actions/selectAdventurePlanRoute';

const USER_ID = 'f2a70000-0000-4000-8000-000000000001';
const PLAN_ID = 'f2a70000-0000-4000-8000-000000000002';
const TRIP_ID = 'f2a70000-0000-4000-8000-000000000003';
const CORRELATION_ID = 'f2a70000-0000-4000-8000-000000000004';
const ROUTE_ID = 920000001;

function rpcPayload(selectedRouteId = ROUTE_ID, correlationId = CORRELATION_ID) {
  return {
    plan_id: PLAN_ID,
    selected_route_id: selectedRouteId,
    correlation_id: correlationId,
    trip_id: TRIP_ID,
  };
}

describe('Phase 2 — action selectAdventurePlanRoute (TEST-PHASE2-ACT)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('TEST-PHASE2-ACT-01: non authentifié ⇒ 401 sans appel RPC', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await selectAdventurePlanRoute({ planId: PLAN_ID, routeId: ROUTE_ID });

    expect(result).toEqual({ ok: false, status: 401, error: 'Authentification requise.' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('TEST-PHASE2-ACT-02: entrées invalides ⇒ 400 sans appel RPC', async () => {
    const badPlan = await selectAdventurePlanRoute({ planId: 'nope', routeId: ROUTE_ID });
    expect(badPlan.ok).toBe(false);
    if (!badPlan.ok) expect(badPlan.status).toBe(400);

    const badRoute = await selectAdventurePlanRoute({ planId: PLAN_ID, routeId: -1 });
    expect(badRoute.ok).toBe(false);
    if (!badRoute.ok) expect(badRoute.status).toBe(400);

    const badCorrelation = await selectAdventurePlanRoute({
      planId: PLAN_ID,
      routeId: ROUTE_ID,
      correlationId: 'pas-un-uuid',
    });
    expect(badCorrelation.ok).toBe(false);
    if (!badCorrelation.ok) expect(badCorrelation.status).toBe(400);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('TEST-PHASE2-ACT-03: corrélation générée côté serveur puis retenue', async () => {
    mockRpc.mockResolvedValue({ data: rpcPayload(), error: null });

    const result = await selectAdventurePlanRoute({ planId: PLAN_ID, routeId: String(ROUTE_ID) });

    expect(result.ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [fnName, args] = mockRpc.mock.calls[0];
    expect(fnName).toBe('select_adventure_plan_route');
    expect(args.p_plan_id).toBe(PLAN_ID);
    expect(args.p_route_id).toBe(ROUTE_ID);
    expect(args.p_correlation_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    if (result.ok) {
      expect(result.planId).toBe(PLAN_ID);
      expect(result.selectedRouteId).toBe(ROUTE_ID);
      expect(result.correlationId).toBe(CORRELATION_ID);
      expect(result.tripId).toBe(TRIP_ID);
    }
  });

  it('TEST-PHASE2-ACT-04: corrélation fournie transmise telle quelle à la RPC', async () => {
    mockRpc.mockResolvedValue({ data: rpcPayload(ROUTE_ID, CORRELATION_ID), error: null });

    const result = await selectAdventurePlanRoute({
      planId: PLAN_ID,
      routeId: ROUTE_ID,
      correlationId: CORRELATION_ID,
    });

    expect(result.ok).toBe(true);
    expect(mockRpc.mock.calls[0][1].p_correlation_id).toBe(CORRELATION_ID);
  });

  it('TEST-PHASE2-ACT-05: erreurs RPC mappées 403/400/500', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'select_adventure_plan_route: plan x non détenu par l’utilisateur y' },
    });
    const forbidden = await selectAdventurePlanRoute({ planId: PLAN_ID, routeId: ROUTE_ID });
    expect(forbidden).toEqual({ ok: false, status: 403, error: 'Ce plan ne vous appartient pas.' });

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'select_adventure_plan_route: route 42 sans géométrie navigable' },
    });
    const noGeometry = await selectAdventurePlanRoute({ planId: PLAN_ID, routeId: ROUTE_ID });
    expect(noGeometry.ok).toBe(false);
    if (!noGeometry.ok) expect(noGeometry.status).toBe(400);

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'select_adventure_plan_route: plan x introuvable' },
    });
    const notFound = await selectAdventurePlanRoute({ planId: PLAN_ID, routeId: ROUTE_ID });
    expect(notFound.ok).toBe(false);
    if (!notFound.ok) expect(notFound.status).toBe(400);

    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom inconnu' } });
    const server = await selectAdventurePlanRoute({ planId: PLAN_ID, routeId: ROUTE_ID });
    expect(server.ok).toBe(false);
    if (!server.ok) expect(server.status).toBe(500);
  });

  it('TEST-PHASE2-ACT-06: réponse RPC non conforme ⇒ 500', async () => {
    mockRpc.mockResolvedValue({
      data: { plan_id: PLAN_ID, correlation_id: CORRELATION_ID, trip_id: TRIP_ID },
      error: null,
    });

    const result = await selectAdventurePlanRoute({ planId: PLAN_ID, routeId: ROUTE_ID });

    expect(result).toEqual({ ok: false, status: 500, error: 'Réponse de sélection invalide.' });
  });
});
