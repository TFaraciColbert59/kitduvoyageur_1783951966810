/**
 * Phase 6 — Reroutage réel (TEST-PHASE6-REROUTE).
 *
 *   • TEST-PHASE6-REROUTE-01 : choix pur du candidat (distance, exclusion, déterministe) ;
 *   • TEST-PHASE6-REROUTE-02 : non authentifié ⇒ 401 sans appel RPC ;
 *   • TEST-PHASE6-REROUTE-03 : entrées invalides ⇒ 400 sans appel RPC ;
 *   • TEST-PHASE6-REROUTE-04 : aucun candidat navigable ⇒ 404, jamais de sélection ;
 *   • TEST-PHASE6-REROUTE-05 : candidat invalide écarté, le suivant navigable est sélectionné ;
 *   • TEST-PHASE6-REROUTE-06 : sélection canonique appelée et réponse transmise ;
 *   • TEST-PHASE6-REROUTE-07 : erreurs RPC mappées (propriété, géométrie, serveur).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectRerouteCandidate } from '@/features/adventure-intelligence/domain/reroute';
import { parseRerouteCandidates } from '@/features/adventure-intelligence/actions/rerouteAdventurePlanRoute';

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

import { rerouteAdventurePlanRoute } from '@/features/adventure-intelligence/actions/rerouteAdventurePlanRoute';

const USER_ID = 'a6e00001-0000-4000-8000-000000000001';
const PLAN_ID = 'a6e00002-0000-4000-8000-000000000002';
const TRIP_ID = 'a6e00003-0000-4000-8000-000000000003';
const CORRELATION_ID = 'a6e00004-0000-4000-8000-000000000004';

interface SearchRow {
  route_id: number;
  distance_m: number | null;
  match_count: number;
}

function searchRows(): SearchRow[] {
  return [
    { route_id: 501, distance_m: 3200, match_count: 0 },
    { route_id: 502, distance_m: 900, match_count: 2 },
    { route_id: 503, distance_m: null, match_count: 5 },
  ];
}

function mockRpcRouting(options: { navigable?: Set<number>; selectError?: string } = {}) {
  const navigable = options.navigable ?? new Set([502]);
  return vi.fn(async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'phase3_search_navigable_routes') {
      return { data: searchRows(), error: null };
    }
    if (fn === 'phase3_route_navigable') {
      return { data: navigable.has(Number(args.p_route_id)), error: null };
    }
    if (fn === 'select_adventure_plan_route') {
      if (options.selectError) return { data: null, error: { message: options.selectError } };
      return {
        data: {
          plan_id: PLAN_ID,
          selected_route_id: Number(args.p_route_id),
          correlation_id: args.p_correlation_id,
          trip_id: TRIP_ID,
        },
        error: null,
      };
    }
    return { data: null, error: { message: `rpc inattendue: ${fn}` } };
  });
}

describe('Phase 6 — reroutage réel (TEST-PHASE6-REROUTE)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('TEST-PHASE6-REROUTE-01: choix pur du candidat (distance, exclusion, déterministe)', () => {
    const candidates = [
      { routeId: 10, distanceM: 5000, matchCount: 0 },
      { routeId: 20, distanceM: 800, matchCount: 1 },
      { routeId: 30, distanceM: 1200, matchCount: 1 },
      { routeId: -3, distanceM: 10, matchCount: 9 },
      { routeId: 20, distanceM: 800, matchCount: 1 },
    ];

    expect(selectRerouteCandidate(candidates)?.routeId).toBe(20);
    expect(selectRerouteCandidate(candidates, { excludeRouteId: 20 })?.routeId).toBe(30);
    // À distance égale, le meilleur match gagne puis l'id tranche.
    expect(
      selectRerouteCandidate([
        { routeId: 42, distanceM: 100, matchCount: 0 },
        { routeId: 41, distanceM: 100, matchCount: 2 },
      ])?.routeId
    ).toBe(41);
    // Distance inconnue : classée après les distances réelles.
    expect(
      selectRerouteCandidate([
        { routeId: 7, distanceM: null, matchCount: 9 },
        { routeId: 8, distanceM: 4000, matchCount: 0 },
      ])?.routeId
    ).toBe(8);
    expect(selectRerouteCandidate([])).toBeNull();
    expect(selectRerouteCandidate([{ routeId: -1, distanceM: 1, matchCount: 0 }])).toBeNull();

    const parsed = parseRerouteCandidates([
      { route_id: '12', distance_m: '99.5', match_count: 3 },
      { route_id: 'nope' },
      null,
    ]);
    expect(parsed[0]).toEqual({ routeId: 12, distanceM: 99.5, matchCount: 3 });
    expect(parsed[1].routeId).toBe(-1);
  });

  it('TEST-PHASE6-REROUTE-02: non authentifié ⇒ 401 sans appel RPC', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await rerouteAdventurePlanRoute({ planId: PLAN_ID, lat: 45, lng: 6 });

    expect(result).toEqual({ ok: false, status: 401, error: 'Authentification requise.' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('TEST-PHASE6-REROUTE-03: entrées invalides ⇒ 400 sans appel RPC', async () => {
    const badPlan = await rerouteAdventurePlanRoute({ planId: 'nope', lat: 45, lng: 6 });
    expect(badPlan.ok).toBe(false);
    if (!badPlan.ok) expect(badPlan.status).toBe(400);

    const badLat = await rerouteAdventurePlanRoute({ planId: PLAN_ID, lat: 120, lng: 6 });
    expect(badLat.ok).toBe(false);
    if (!badLat.ok) expect(badLat.status).toBe(400);

    const badTerm = await rerouteAdventurePlanRoute({
      planId: PLAN_ID,
      lat: 45,
      lng: 6,
      terms: ['ok'],
    });
    expect(badTerm.ok).toBe(false);
    if (!badTerm.ok) expect(badTerm.status).toBe(400);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('TEST-PHASE6-REROUTE-04: aucun candidat navigable ⇒ 404, jamais de sélection', async () => {
    mockRpc.mockImplementation(
      mockRpcRouting({ navigable: new Set<number>() }) as unknown as typeof mockRpc
    );

    const result = await rerouteAdventurePlanRoute({ planId: PLAN_ID, lat: 45, lng: 6 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error).toContain('navigable');
    }
    const selectCalls = mockRpc.mock.calls.filter(([fn]) => fn === 'select_adventure_plan_route');
    expect(selectCalls).toHaveLength(0);
  });

  it('TEST-PHASE6-REROUTE-05: le meilleur candidat non navigable est écarté au profit du suivant', async () => {
    // Le plus proche (502, 900 m) échoue au prédicat ; 501 (3200 m) passe.
    mockRpc.mockImplementation(
      mockRpcRouting({ navigable: new Set([501]) }) as unknown as typeof mockRpc
    );

    const result = await rerouteAdventurePlanRoute({ planId: PLAN_ID, lat: 45, lng: 6 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.routeId).toBe(501);
      expect(result.distanceM).toBe(3200);
    }
    const verified = mockRpc.mock.calls
      .filter(([fn]) => fn === 'phase3_route_navigable')
      .map(([, args]) => args.p_route_id);
    expect(verified).toEqual([502, 501]);
  });

  it('TEST-PHASE6-REROUTE-06: sélection canonique appelée avec la corrélation, réponse transmise', async () => {
    mockRpc.mockImplementation(mockRpcRouting() as unknown as typeof mockRpc);

    const result = await rerouteAdventurePlanRoute({
      planId: PLAN_ID,
      lat: 45.1,
      lng: 6.2,
      radiusKm: 25,
      terms: ['tour', 'lac'],
      excludeRouteId: 999,
      correlationId: CORRELATION_ID,
    });

    expect(result).toEqual({
      ok: true,
      planId: PLAN_ID,
      routeId: 502,
      distanceM: 900,
      correlationId: CORRELATION_ID,
      tripId: TRIP_ID,
    });

    const searchCall = mockRpc.mock.calls.find(([fn]) => fn === 'phase3_search_navigable_routes');
    expect(searchCall?.[1]).toEqual({
      p_lat: 45.1,
      p_lng: 6.2,
      p_radius_km: 25,
      p_terms: ['tour', 'lac'],
      p_limit: 3,
    });
    const selectCall = mockRpc.mock.calls.find(([fn]) => fn === 'select_adventure_plan_route');
    expect(selectCall?.[1]).toEqual({
      p_plan_id: PLAN_ID,
      p_route_id: 502,
      p_correlation_id: CORRELATION_ID,
    });
  });

  it('TEST-PHASE6-REROUTE-07: erreurs RPC de sélection mappées', async () => {
    mockRpc.mockImplementation(
      mockRpcRouting({
        selectError: 'select_adventure_plan_route: plan x non détenu par l’utilisateur y',
      }) as unknown as typeof mockRpc
    );
    const forbidden = await rerouteAdventurePlanRoute({ planId: PLAN_ID, lat: 45, lng: 6 });
    expect(forbidden).toEqual({ ok: false, status: 403, error: 'Ce plan ne vous appartient pas.' });

    mockRpc.mockImplementation(
      mockRpcRouting({
        selectError: 'select_adventure_plan_route: route 42 sans géométrie navigable',
      }) as unknown as typeof mockRpc
    );
    const geometry = await rerouteAdventurePlanRoute({ planId: PLAN_ID, lat: 45, lng: 6 });
    expect(geometry.ok).toBe(false);
    if (!geometry.ok) expect(geometry.status).toBe(400);

    mockRpc.mockImplementation(
      mockRpcRouting({ selectError: 'boom inconnu' }) as unknown as typeof mockRpc
    );
    const server = await rerouteAdventurePlanRoute({ planId: PLAN_ID, lat: 45, lng: 6 });
    expect(server.ok).toBe(false);
    if (!server.ok) expect(server.status).toBe(500);
  });
});
