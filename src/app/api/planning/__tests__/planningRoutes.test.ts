import { beforeEach, describe, expect, it } from 'vitest';
import {
  createUnconfiguredWeatherFeed,
  splitRouteIntoDays,
  type ContinuousRoute,
  type GpxTrackPoint,
  type LodgingAnchor,
  type MultiDayPlan,
  type ViewerContextP01,
  type WeatherFeedSnapshot,
} from '@/features/planning';
import { GET as getCapabilities, POST as postDispatcher } from '../route';
import { POST as postSearch } from '../search/route';
import { POST as postSplit } from '../split/route';
import { POST as postBoundaryPreview } from '../boundary/preview/route';
import { POST as postBoundaryCommit } from '../boundary/commit/route';
import { POST as postLodgingAnchor } from '../lodging/anchor/route';
import { POST as postWeatherEvaluate } from '../weather/evaluate/route';
import { POST as postWeatherWindows } from '../weather/windows/route';
import { POST as postShareCreate } from '../shares/create/route';
import { POST as postShareRevoke } from '../shares/revoke/route';
import { POST as postShareAccess } from '../shares/access/route';
import { POST as postStageLaunch } from '../stages/launch/route';

const VISITOR: ViewerContextP01 = {
  viewerId: 'visitor-1',
  friendIds: [],
  tribuIds: [],
  blockedUserIds: [],
};

function points(count = 13): GpxTrackPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    lat: 45.8 + index * 0.04,
    lon: 6.85 + (index % 2 === 0 ? 0 : 0.01),
    eleM: 1_200 + Math.sin(index / 2) * 350 + index * 40,
  }));
}

function route(overrides: Partial<ContinuousRoute> = {}): ContinuousRoute {
  return {
    id: 'route-api-1',
    title: 'Traversée API',
    countryCode: 'FR',
    sport: 'trekking',
    theme: 'alpine',
    timezone: 'Europe/Paris',
    points: points(),
    ownerId: 'owner-1',
    audience: 'public',
    revision: 1,
    ...overrides,
  };
}

function plan(overrides: Partial<ContinuousRoute> = {}, targetDays = 4): MultiDayPlan {
  return splitRouteIntoDays(route(overrides), {
    planId: `plan-${overrides.id ?? 'api-1'}-${targetDays}`,
    targetDays,
    nowIso: '2026-06-01T10:00:00Z',
    publicShareConsented: true,
  });
}

async function call(handler: (request: Request) => Promise<Response>, payload: unknown) {
  const response = await handler(
    new Request('http://localhost/api/planning', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
  return { status: response.status, body: await response.json() };
}

describe('API planning — surface et validation', () => {
  it('expose les capacités et le répartiteur d’actions', async () => {
    const response = await getCapabilities();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.module).toBe('planning');
    expect(body.actions).toContain('search');
    expect(body.actions).toContain('stages.launch');
    expect(body.persistence).toBe('stateless');

    const dispatched = await call(postDispatcher, {
      action: 'weather.evaluate',
      payload: {
        plan: plan(),
        feed: createUnconfiguredWeatherFeed('Europe/Paris'),
        nowIso: '2026-06-01T12:00:00Z',
      },
    });
    expect(dispatched.status).toBe(200);
    expect(dispatched.body.status).toBe('provider_unavailable');

    const unknown = await call(postDispatcher, { action: 'nope', payload: {} });
    expect(unknown.status).toBe(404);
  });

  it('rejette un payload invalide en 400 avec un détail lisible', async () => {
    const result = await call(postSearch, { plans: 'pas-un-tableau' });
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('invalid_request');
    expect(Array.isArray(result.body.details)).toBe(true);
  });
});

describe('API planning — K1.13 recherche', () => {
  it('applique les critères compris et exclut les plans privés P01', async () => {
    const publicPlan = plan({ id: 'route-public', title: 'Alpes publiques' }, 4);
    const privatePlan = plan(
      { id: 'route-private', title: 'Alpes privées', audience: 'private', ownerId: 'owner-2' },
      4,
    );
    const italianPlan = plan(
      { id: 'route-it', title: 'Côte italienne', countryCode: 'IT', theme: 'coastal' },
      3,
    );

    const result = await call(postSearch, {
      plans: [publicPlan, privatePlan, italianPlan],
      query: { rawQuery: 'France 3-5 jours alpin' },
      viewer: VISITOR,
    });

    expect(result.status).toBe(200);
    expect(result.body.items.map((item: MultiDayPlan) => item.id)).toEqual([publicPlan.id]);
    expect(result.body.excludedPrivateCount).toBe(1);
    expect(result.body.understoodCriteria).toMatchObject({
      countryCode: 'FR',
      minDays: 3,
      maxDays: 5,
      theme: 'alpine',
    });

    const corrected = await call(postSearch, {
      plans: [publicPlan, privatePlan, italianPlan],
      query: {
        rawQuery: 'France 3-5 jours alpin',
        correctedCriteria: { countryCode: 'IT', theme: 'coastal' },
      },
      viewer: VISITOR,
    });
    expect(corrected.body.items.map((item: MultiDayPlan) => item.id)).toEqual([italianPlan.id]);
  });
});

describe('API planning — K2.29 à K2.32', () => {
  it('découpe un tracé en jours avec révisions indépendantes', async () => {
    const result = await call(postSplit, {
      route: route(),
      options: {
        planId: 'plan-split-api',
        targetDays: 4,
        nowIso: '2026-06-01T10:00:00Z',
        publicShareConsented: true,
      },
    });

    expect(result.status).toBe(201);
    expect(result.body.plan.daysCount).toBe(4);
    expect(result.body.plan.stages).toHaveLength(4);
    expect(result.body.plan.timezone).toBe('Europe/Paris');
    expect(result.body.plan.stages[0].offline.traceReady).toBe(true);
  });

  it('prévisualise puis commit atomiquement N et N+1', async () => {
    const current = plan({}, 4);
    const originalDay1 = current.stages[0];
    const originalDay4 = current.stages[3];
    const newBoundary = current.stages[1].endPointIndex + 1;

    const preview = await call(postBoundaryPreview, {
      plan: current,
      dayNumber: 2,
      newEndPointIndex: newBoundary,
      expectedPlanRevision: current.revision,
    });
    expect(preview.status).toBe(200);
    expect(preview.body.preview.dayN.dayNumber).toBe(2);
    expect(preview.body.preview.dayNext.dayNumber).toBe(3);
    expect(preview.body.preview.revisionConflict).toBe(false);

    const committed = await call(postBoundaryCommit, {
      plan: current,
      dayNumber: 2,
      newEndPointIndex: newBoundary,
      expectedPlanRevision: current.revision,
      nowIso: '2026-06-01T10:05:00Z',
    });
    expect(committed.status).toBe(200);
    expect(committed.body.ok).toBe(true);
    expect(committed.body.plan.revision).toBe(current.revision + 1);
    expect(committed.body.plan.stages[1].endPointIndex).toBe(newBoundary);
    expect(committed.body.plan.stages[2].startPointIndex).toBe(newBoundary);
    expect(committed.body.plan.stages[0]).toEqual(originalDay1);
    expect(committed.body.plan.stages[3]).toEqual(originalDay4);
  });

  it('renvoie 409 sur un conflit de révision sans écraser le plan', async () => {
    const current = plan({}, 3);
    const result = await call(postBoundaryCommit, {
      plan: current,
      dayNumber: 1,
      newEndPointIndex: current.stages[0].endPointIndex + 1,
      expectedPlanRevision: current.revision - 1,
      nowIso: '2026-06-01T10:10:00Z',
    });
    expect(result.status).toBe(409);
    expect(result.body.reason).toBe('revision_conflict');
    expect(result.body.preview.revisionConflict).toBe(true);
  });

  it('ancre un refuge proche et refuse un refuge trop loin ou fermé', async () => {
    const current = plan({}, 3);
    const target = current.stages[0].points[current.stages[0].points.length - 1];
    const nearRefuge: LodgingAnchor = {
      id: 'refuge-near',
      name: 'Refuge proche',
      type: 'refuge',
      lat: target.lat,
      lon: target.lon,
      eleM: 2_400,
      openMonths: [6, 7, 8, 9],
    };

    const anchored = await call(postLodgingAnchor, {
      plan: current,
      dayNumber: 1,
      lodging: nearRefuge,
      options: {
        expectedPlanRevision: current.revision,
        nowIso: '2026-06-01T11:00:00Z',
        stayDateIso: '2026-07-15T18:00:00Z',
        maxSnapDistanceKm: 2.5,
      },
    });
    expect(anchored.status).toBe(200);
    expect(anchored.body.ok).toBe(true);
    expect(anchored.body.snappedDistanceKm).toBeLessThan(0.5);
    expect(anchored.body.plan.stages[0].endLodging.id).toBe('refuge-near');

    const far = await call(postLodgingAnchor, {
      plan: current,
      dayNumber: 1,
      lodging: { ...nearRefuge, id: 'refuge-far', lat: 47.5, lon: 9 },
      options: {
        expectedPlanRevision: current.revision,
        nowIso: '2026-06-01T11:00:00Z',
        maxSnapDistanceKm: 2,
      },
    });
    expect(far.status).toBe(422);
    expect(far.body.reason).toBe('lodging_too_far');

    const closed = await call(postLodgingAnchor, {
      plan: current,
      dayNumber: 1,
      lodging: { ...nearRefuge, id: 'refuge-closed', openMonths: [7, 8] },
      options: {
        expectedPlanRevision: current.revision,
        nowIso: '2026-06-01T11:00:00Z',
        stayDateIso: '2026-11-15T12:00:00Z',
      },
    });
    expect(closed.status).toBe(422);
    expect(closed.body.reason).toBe('lodging_closed_season');
  });

  it('expose une étape lançable, masque le mauvais sport et refuse P01', async () => {
    const current = plan({ audience: 'friends', ownerId: 'owner-1' }, 3);
    const friend: ViewerContextP01 = {
      viewerId: 'friend-1',
      friendIds: ['owner-1'],
      tribuIds: [],
      blockedUserIds: [],
    };

    const ok = await call(postStageLaunch, {
      plan: current,
      dayNumber: 2,
      viewer: friend,
      activeSport: 'trekking',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.visible).toBe(true);
    expect(ok.body.payload.stageRevision).toBe(1);
    expect(ok.body.payload.planRevision).toBe(current.revision);
    expect(ok.body.payload.timezone).toBe('Europe/Paris');

    const wrongSport = await call(postStageLaunch, {
      plan: current,
      dayNumber: 2,
      viewer: friend,
      activeSport: 'cycling',
    });
    expect(wrongSport.body.visible).toBe(false);
    expect(wrongSport.body.reason).toBe('sport_mismatch');

    const forbidden = await call(postStageLaunch, {
      plan: current,
      dayNumber: 2,
      viewer: VISITOR,
      activeSport: 'trekking',
    });
    expect(forbidden.body.visible).toBe(false);
    expect(forbidden.body.reason).toBe('forbidden_p01');
  });
});

describe('API planning — météo explicite', () => {
  it('signale l’absence de fournisseur sans inventer de fenêtre', async () => {
    const current = plan({ timezone: 'Asia/Tokyo' }, 2);
    const feed = createUnconfiguredWeatherFeed('Asia/Tokyo');

    const report = await call(postWeatherEvaluate, {
      plan: current,
      feed,
      nowIso: '2026-06-01T12:00:00Z',
    });
    expect(report.status).toBe(200);
    expect(report.body.status).toBe('provider_unavailable');
    expect(report.body.pointsEvaluated).toBe(0);
    expect(report.body.missingReason).toContain('Aucun fournisseur météo réel');

    const windows = await call(postWeatherWindows, {
      plan: current,
      feed,
      nowIso: '2026-06-01T12:00:00Z',
      options: { minDurationHours: 3 },
    });
    expect(windows.status).toBe(200);
    expect(windows.body.status).toBe('provider_unavailable');
    expect(windows.body.windows).toEqual([]);
  });

  it('calcule des fenêtres dans le fuseau du plan et exclut les alertes sévères', async () => {
    const current = plan({ timezone: 'Europe/Paris' }, 2);
    const feed: WeatherFeedSnapshot = {
      status: 'available',
      providerName: 'open-meteo',
      timezone: 'Europe/Paris',
      fetchedAtIso: '2026-07-10T06:00:00Z',
      maxAgeMinutes: 120,
      points: [
        { timestampIso: '2026-07-10T06:00:00Z', kind: 'forecast', tempC: 14, precipMm: 0, precipProbabilityPct: 5, windKmh: 10, gustKmh: 18, freezingLevelM: 3600, alertSeverity: 'none' },
        { timestampIso: '2026-07-10T07:00:00Z', kind: 'forecast', tempC: 16, precipMm: 0, precipProbabilityPct: 5, windKmh: 12, gustKmh: 20, freezingLevelM: 3600, alertSeverity: 'none' },
        { timestampIso: '2026-07-10T08:00:00Z', kind: 'forecast', tempC: 18, precipMm: 0, precipProbabilityPct: 10, windKmh: 12, gustKmh: 22, freezingLevelM: 3700, alertSeverity: 'none' },
        { timestampIso: '2026-07-10T09:00:00Z', kind: 'official_alert', tempC: 17, precipMm: 6, precipProbabilityPct: 90, windKmh: 45, gustKmh: 75, freezingLevelM: 3100, alertSeverity: 'severe', alertTitle: 'Orage violent' },
      ],
    };

    const result = await call(postWeatherWindows, {
      plan: current,
      feed,
      nowIso: '2026-07-10T06:30:00Z',
      options: { minDurationHours: 3, maxStageElevationM: 2800 },
    });
    expect(result.status).toBe(200);
    expect(result.body.status).toBe('ok');
    expect(result.body.windows).toHaveLength(1);
    expect(result.body.windows[0].localStartTime).toBe('08:00');
    expect(result.body.windows[0].localEndTime).toBe('10:00');
    expect(result.body.windows[0].timezone).toBe('Europe/Paris');
  });
});

describe('API planning — partage P01', () => {
  let current: MultiDayPlan;

  beforeEach(() => {
    current = plan({}, 2);
  });

  it('refuse un partage public sans consentement, puis l’autorise', async () => {
    const noConsent = { ...current, publicShareConsented: false };
    const denied = await call(postShareCreate, {
      plan: noConsent,
      actorId: 'owner-1',
      request: {
        shareId: 'share-denied',
        audience: 'public',
        timezone: 'Europe/Paris',
        createdAtIso: '2026-06-01T10:00:00Z',
      },
    });
    expect(denied.status).toBe(409);
    expect(denied.body.reason).toBe('consent_missing_p01');

    const created = await call(postShareCreate, {
      plan: current,
      actorId: 'owner-1',
      request: {
        shareId: 'share-ok',
        audience: 'public',
        timezone: 'Europe/Paris',
        createdAtIso: '2026-06-01T10:00:00Z',
        expiresAtIso: '2026-06-10T10:00:00Z',
      },
    });
    expect(created.status).toBe(201);
    expect(created.body.record.shareId).toBe('share-ok');
    expect(created.body.record.includeExactStartEndCoords).toBe(false);

    const access = await call(postShareAccess, {
      plan: current,
      share: created.body.record,
      viewer: VISITOR,
      nowIso: '2026-06-02T10:00:00Z',
    });
    expect(access.status).toBe(200);
    expect(access.body).toEqual({
      allowed: true,
      audience: 'public',
      includeExactStartEndCoords: false,
    });
  });

  it('refuse un acteur non propriétaire et révoque le partage', async () => {
    const denied = await call(postShareCreate, {
      plan: current,
      actorId: 'intrus',
      request: {
        shareId: 'share-intrus',
        audience: 'friends',
        timezone: 'Europe/Paris',
        createdAtIso: '2026-06-01T10:00:00Z',
      },
    });
    expect(denied.status).toBe(403);

    const created = await call(postShareCreate, {
      plan: current,
      actorId: 'owner-1',
      request: {
        shareId: 'share-revoke',
        audience: 'friends',
        timezone: 'Europe/Paris',
        createdAtIso: '2026-06-01T10:00:00Z',
      },
    });
    expect(created.status).toBe(201);

    const revoked = await call(postShareRevoke, {
      record: created.body.record,
      actorId: 'owner-1',
      revokedAtIso: '2026-06-03T10:00:00Z',
    });
    expect(revoked.status).toBe(200);
    expect(revoked.body.record.revokedAtIso).toBe('2026-06-03T10:00:00Z');

    const access = await call(postShareAccess, {
      plan: current,
      share: revoked.body.record,
      viewer: VISITOR,
      nowIso: '2026-06-03T10:01:00Z',
    });
    expect(access.body).toEqual({ allowed: false, reason: 'revoked' });
  });
});
