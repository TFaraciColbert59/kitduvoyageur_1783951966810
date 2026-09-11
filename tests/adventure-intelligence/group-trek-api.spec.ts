/**
 * A13 (S3) — API groupe / trek / monitoring (routes serveur).
 *
 *   • TEST-A13-GROUP-04 : POST /group session requise (401) + gating 402.
 *   • TEST-A13-GROUP-05 : POST /group 404/403/400 crew_required/409 + 200 réel.
 *   • TEST-A13-GROUP-06 : GET /group payload public persisté, absent ⇒ 404.
 *   • TEST-A13-GROUP-07 : body invalide (strategy) ⇒ 400, RPC jamais appelée.
 *   • TEST-A13-TREK-04 : POST /trek 402 puis 200 avec payload trek persisté.
 *   • TEST-A13-TREK-05 : GET /trek payload persisté / absent explicite.
 *   • TEST-A13-TREK-06 : étapes indisponibles ⇒ 409 explicite (jamais inventé).
 *   • TEST-A13-ENT-09 : monitoring = gating réel (402) puis règles du plan.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';
import { simulateMultiDayTrek } from '@/features/adventure-intelligence/domain/multiDayTrek';
import { buildGroupPlan } from '@/features/adventure-intelligence/domain/groupIntelligence';
import { summarizeGroupPlanPublic } from '@/features/adventure-intelligence/domain/planGroupTrek';

const serviceMock = vi.hoisted(() => ({}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: vi.fn(() => serviceMock),
}));
vi.mock('@/features/adventure-intelligence/server/generateAdventure', () => ({
  getAdventurePlan: vi.fn(),
}));
vi.mock('@/lib/entitlements/server', () => ({
  requireEntitlement: vi.fn(),
  entitlementRequiredResponse: vi.fn(),
}));
vi.mock('@/features/adventure-intelligence/server/groupTrek', () => ({
  createSupabaseGroupTrekDataSource: vi.fn(() => ({ source: true })),
  computeAndPersistGroupPlan: vi.fn(),
  readLatestGroupPlan: vi.fn(),
  computeAndPersistTrekPlan: vi.fn(),
  readLatestTrekPlan: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { getAdventurePlan } from '@/features/adventure-intelligence/server/generateAdventure';
import { requireEntitlement } from '@/lib/entitlements/server';
import {
  computeAndPersistGroupPlan,
  computeAndPersistTrekPlan,
  createSupabaseGroupTrekDataSource,
  readLatestGroupPlan,
  readLatestTrekPlan,
} from '@/features/adventure-intelligence/server/groupTrek';
import { POST as groupPOST, GET as groupGET } from '@/app/api/adventure/[id]/group/route';
import { POST as trekPOST, GET as trekGET } from '@/app/api/adventure/[id]/trek/route';
import { GET as monitoringGET } from '@/app/api/adventure/[id]/monitoring/route';
import { NextResponse } from 'next/server';

const PLAN_ID = 'a1330000-0000-4000-8000-0000000000d1';
const OWNER_ID = 'a1330000-0000-4000-8000-0000000000d2';
const OTHER_ID = 'a1330000-0000-4000-8000-0000000000d3';
const CREW_ID = 'a1330000-0000-4000-8000-0000000000d4';
const NOW = '2026-09-11T12:00:00.000Z';

const SUMMARY = summarizeGroupPlanPublic(
  buildGroupPlan(
    [
      {
        memberId: 'm-1',
        displayName: 'Membre 1',
        role: 'owner',
        flatSpeedKmH: 4,
        ascentSpeedMPerHour: 300,
        descentSpeedMPerHour: 500,
        packWeightKg: null,
        maxCarryKg: null,
        experienceLevel: 'intermediate',
      },
      {
        memberId: 'm-2',
        displayName: 'Membre 2',
        role: 'member',
        flatSpeedKmH: 3,
        ascentSpeedMPerHour: 240,
        descentSpeedMPerHour: 400,
        packWeightKg: null,
        maxCarryKg: null,
        experienceLevel: 'beginner',
      },
    ],
    [{ segmentId: 1, distanceM: 12000, gainM: 700, lossM: 700 }]
  )
);

const TREK_RESULT = simulateMultiDayTrek([
  { dayNumber: 1, distanceM: 12000, gainM: 700, lossM: 700, packWeightKg: null },
  { dayNumber: 2, distanceM: 12000, gainM: 700, lossM: 700, packWeightKg: null },
]);

const GROUP_META = {
  stagesSource: 'trip_steps' as const,
  strategy: 'recommended' as const,
  crewId: CREW_ID,
  tripId: null,
  memberCount: 2,
  modelVersion: 'a13-group-v1',
  computedAt: NOW,
};

const TREK_META = {
  stagesSource: 'blueprint_uniform' as const,
  dayCount: 2,
  modelVersion: 'a13-trek-v1',
  computedAt: NOW,
};

function storedFixture(ownerId = OWNER_ID) {
  return {
    plan: {
      id: PLAN_ID,
      ownerId,
      title: 'Plan test',
      status: 'draft',
      currentVersion: 1,
      intent: { rawInput: 'test', activities: [], constraints: [] },
      participants: [],
      dates: { flexible: true },
      destinations: [],
      sections: {},
      confidence: makeConfidence({ score: 0.5, sampleCount: 0, method: 'test' }),
      monitoringRules: [{ id: 'rule-1', label: 'Suivi actif', kind: 'safety', enabled: true }],
      createdAt: NOW,
      updatedAt: NOW,
    },
    version: null,
    decisions: [],
    candidates: [],
    candidateComparison: null,
  } as never;
}

function sessionClient(user: { id: string } | null) {
  return { auth: { getUser: async () => ({ data: { user } }) } } as never;
}

function postRequest(url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  });
}

const groupUrl = `http://localhost/api/adventure/${PLAN_ID}/group`;
const trekUrl = `http://localhost/api/adventure/${PLAN_ID}/trek`;
const monitoringUrl = `http://localhost/api/adventure/${PLAN_ID}/monitoring`;
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const mockedCreateClient = vi.mocked(createClient);
const mockedGetPlan = vi.mocked(getAdventurePlan);
const mockedRequireEntitlement = vi.mocked(requireEntitlement);
const mockedComputeGroup = vi.mocked(computeAndPersistGroupPlan);
const mockedReadGroup = vi.mocked(readLatestGroupPlan);
const mockedComputeTrek = vi.mocked(computeAndPersistTrekPlan);
const mockedReadTrek = vi.mocked(readLatestTrekPlan);

describe('A13 (S3) — API groupe et trek', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateClient.mockResolvedValue(sessionClient({ id: OWNER_ID }));
    mockedGetPlan.mockResolvedValue(storedFixture());
    mockedRequireEntitlement.mockResolvedValue({
      ok: true,
      resolved: {
        plan: 'group',
        activePasses: [],
        entitlements: ['group', 'trek', 'monitoring'],
        source: 'manual',
        configured: false,
      },
    });
    mockedComputeGroup.mockResolvedValue({
      ok: true,
      version: 2,
      summary: SUMMARY,
      meta: GROUP_META,
    });
    mockedReadGroup.mockResolvedValue({ version: 2, summary: SUMMARY, meta: GROUP_META });
    mockedComputeTrek.mockResolvedValue({
      ok: true,
      version: 3,
      result: TREK_RESULT,
      meta: TREK_META,
    });
    mockedReadTrek.mockResolvedValue({ version: 3, result: TREK_RESULT, meta: TREK_META });
  });

  it('TEST-A13-GROUP-04: session requise (401) et gating 402 sans entitlement', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient(null));
    const unauthorized = await groupPOST(postRequest(groupUrl), params(PLAN_ID));
    expect(unauthorized.status).toBe(401);
    expect(mockedComputeGroup).not.toHaveBeenCalled();

    mockedCreateClient.mockResolvedValue(sessionClient({ id: OWNER_ID }));
    mockedRequireEntitlement.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'entitlement_required', requiredPlan: 'group' },
        { status: 402 }
      ),
    });

    const denied = await groupPOST(postRequest(groupUrl), params(PLAN_ID));
    expect(denied.status).toBe(402);
    expect(await denied.json()).toEqual({
      error: 'entitlement_required',
      requiredPlan: 'group',
    });
    expect(mockedComputeGroup).not.toHaveBeenCalled();
    expect(mockedRequireEntitlement).toHaveBeenCalledWith(serviceMock, OWNER_ID, 'group');
  });

  it('TEST-A13-GROUP-05: POST groupe 404/403/400/409 puis 200 avec payload public', async () => {
    mockedGetPlan.mockResolvedValue(null);
    expect((await groupPOST(postRequest(groupUrl), params(PLAN_ID))).status).toBe(404);

    mockedGetPlan.mockResolvedValue(storedFixture(OTHER_ID));
    expect((await groupPOST(postRequest(groupUrl), params(PLAN_ID))).status).toBe(403);

    mockedGetPlan.mockResolvedValue(storedFixture());
    mockedComputeGroup.mockResolvedValueOnce({ ok: false, reason: 'crew_required' });
    const crewRequired = await groupPOST(
      postRequest(groupUrl, { strategy: 'comfort' }),
      params(PLAN_ID)
    );
    expect(crewRequired.status).toBe(400);
    expect((await crewRequired.json()).error).toBe('crew_required');

    mockedComputeGroup.mockResolvedValueOnce({ ok: false, reason: 'stages_unavailable' });
    const noStages = await groupPOST(postRequest(groupUrl), params(PLAN_ID));
    expect(noStages.status).toBe(409);
    expect((await noStages.json()).error).toBe('stages_unavailable');

    const response = await groupPOST(postRequest(groupUrl, { crewId: CREW_ID }), params(PLAN_ID));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ version: 2, memberCount: 2, stagesSource: 'trip_steps' });
    expect(body.groupPlan).toEqual(SUMMARY);

    const lastCall = mockedComputeGroup.mock.calls.at(-1) ?? [];
    const [sourceArg, userArg, planArg, optionsArg] = lastCall;
    expect(sourceArg).toEqual({ source: true });
    expect(userArg).toBe(OWNER_ID);
    expect((planArg as { id: string }).id).toBe(PLAN_ID);
    expect(optionsArg).toMatchObject({ crewId: CREW_ID });
    expect(createSupabaseGroupTrekDataSource).toHaveBeenCalledWith(serviceMock);
  });

  it('TEST-A13-GROUP-06: GET groupe renvoie le dernier payload public / 404 absent', async () => {
    const response = await groupGET(new NextRequest(groupUrl), params(PLAN_ID));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.groupPlan).toEqual(SUMMARY);
    expect(body.version).toBe(2);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('memberId');
    expect(serialized).not.toContain('gearRedistribution":{"from');

    mockedReadGroup.mockResolvedValue(null);
    const absent = await groupGET(new NextRequest(groupUrl), params(PLAN_ID));
    expect(absent.status).toBe(404);
    expect((await absent.json()).error).toBe('group_plan_absent');

    mockedRequireEntitlement.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'entitlement_required', requiredPlan: 'group' },
        { status: 402 }
      ),
    });
    expect((await groupGET(new NextRequest(groupUrl), params(PLAN_ID))).status).toBe(402);
  });

  it('TEST-A13-GROUP-07: body invalide ⇒ 400, aucun calcul; id invalide ⇒ 404', async () => {
    const invalidBody = await groupPOST(
      postRequest(groupUrl, { strategy: 'turbo' }),
      params(PLAN_ID)
    );
    expect(invalidBody.status).toBe(400);
    expect(mockedComputeGroup).not.toHaveBeenCalled();

    const invalidId = await groupPOST(postRequest(groupUrl, {}), params('pas-un-uuid'));
    expect(invalidId.status).toBe(404);
    expect(mockedComputeGroup).not.toHaveBeenCalled();
  });

  it('TEST-A13-TREK-04: POST trek gating 402 puis 200 avec simulation persistée', async () => {
    mockedRequireEntitlement.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { error: 'entitlement_required', requiredPlan: 'expedition' },
        { status: 402 }
      ),
    });
    const denied = await trekPOST(postRequest(trekUrl, {}), params(PLAN_ID));
    expect(denied.status).toBe(402);
    expect(mockedComputeTrek).not.toHaveBeenCalled();

    const response = await trekPOST(postRequest(trekUrl, { packWeightKg: 9 }), params(PLAN_ID));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ version: 3, dayCount: 2, stagesSource: 'blueprint_uniform' });
    expect(body.trekPlan.daily).toHaveLength(2);
    expect(mockedRequireEntitlement).toHaveBeenLastCalledWith(serviceMock, OWNER_ID, 'trek');
    const options = mockedComputeTrek.mock.calls[0][2];
    expect(options).toMatchObject({ packWeightKg: 9 });
  });

  it('TEST-A13-TREK-05: GET trek payload persisté / absent explicite / 401', async () => {
    const response = await trekGET(new NextRequest(trekUrl), params(PLAN_ID));
    expect(response.status).toBe(200);
    expect((await response.json()).trekPlan.daily).toHaveLength(2);

    mockedReadTrek.mockResolvedValue(null);
    const absent = await trekGET(new NextRequest(trekUrl), params(PLAN_ID));
    expect(absent.status).toBe(404);
    expect((await absent.json()).error).toBe('trek_plan_absent');

    mockedCreateClient.mockResolvedValue(sessionClient(null));
    expect((await trekGET(new NextRequest(trekUrl), params(PLAN_ID))).status).toBe(401);
  });

  it('TEST-A13-TREK-06: étapes indisponibles ⇒ 409 explicite, aucune persistance', async () => {
    mockedComputeTrek.mockResolvedValueOnce({ ok: false, reason: 'stages_unavailable' });
    const response = await trekPOST(postRequest(trekUrl, {}), params(PLAN_ID));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe('stages_unavailable');
    expect(String(body.details)).toMatch(/étape/i);
  });

  it('TEST-A13-ENT-09: monitoring = gating réel puis règles réelles du plan', async () => {
    mockedRequireEntitlement.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { error: 'entitlement_required', requiredPlan: 'group' },
        { status: 402 }
      ),
    });
    expect((await monitoringGET(new NextRequest(monitoringUrl), params(PLAN_ID))).status).toBe(402);

    const response = await monitoringGET(new NextRequest(monitoringUrl), params(PLAN_ID));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.monitoringRules).toHaveLength(1);
    expect(mockedRequireEntitlement).toHaveBeenLastCalledWith(serviceMock, OWNER_ID, 'monitoring');
  });
});
