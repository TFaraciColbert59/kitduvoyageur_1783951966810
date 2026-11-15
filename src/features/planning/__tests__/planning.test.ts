import { describe, expect, it } from 'vitest';
import {
  anchorStageToLodging,
  assertValidTimeZone,
  commitStageBoundaryMove,
  createPlanShare,
  createPlanningDrawerState,
  createUnconfiguredWeatherFeed,
  evaluatePlanWeather,
  evaluateShareAccessP01,
  findOptimalWindows,
  getLocalDateAndHour,
  getStageLaunchReadiness,
  listNavigableStages,
  parseMultiDaySearchQuery,
  previewStageBoundaryMove,
  reducePlanningDrawerState,
  revokePlanShare,
  searchMultiDayPlans,
  splitRouteIntoDays,
  type ContinuousRoute,
  type GpxTrackPoint,
  type LodgingAnchor,
  type ViewerContextP01,
  type WeatherFeedSnapshot,
} from '../index';

function buildAlpinePoints(count = 13): GpxTrackPoint[] {
  // ~0.04 deg lat per step ≈ 4.45 km/step -> 12 steps ≈ 53.4 km
  return Array.from({ length: count }, (_, idx) => ({
    lat: 45.8 + idx * 0.04,
    lon: 6.85 + (idx % 2 === 0 ? 0 : 0.01),
    eleM: 1200 + Math.sin(idx / 2) * 350 + idx * 40,
  }));
}

function buildSampleRoute(overrides: Partial<ContinuousRoute> = {}): ContinuousRoute {
  return {
    id: 'route-tmb-1',
    title: 'Tour du Mont-Blanc Alpin',
    countryCode: 'FR',
    sport: 'trekking',
    theme: 'alpine',
    timezone: 'Europe/Paris',
    points: buildAlpinePoints(13),
    ownerId: 'user-owner',
    audience: 'public',
    revision: 1,
    ...overrides,
  };
}

const OWNER_VIEWER: ViewerContextP01 = {
  viewerId: 'user-owner',
  friendIds: [],
  tribuIds: [],
  blockedUserIds: [],
};

const PUBLIC_VIEWER: ViewerContextP01 = {
  viewerId: 'user-other',
  friendIds: [],
  tribuIds: [],
  blockedUserIds: [],
};

describe('R04 Planning — Fuseaux horaires explicites', () => {
  it('valide les fuseaux IANA explicites et rejette les fuseaux absents ou invalides', () => {
    expect(assertValidTimeZone('Europe/Paris')).toBe('Europe/Paris');
    expect(assertValidTimeZone('Asia/Tokyo')).toBe('Asia/Tokyo');
    expect(() => assertValidTimeZone('')).toThrow();
    expect(() => assertValidTimeZone('Mars/Olympus')).toThrow();
  });

  it('résout date et heure locale dans le fuseau explicite sans dépendre de la machine', () => {
    // 2026-07-15T23:30:00Z -> 2026-07-16 01:30 à Paris (UTC+2), 2026-07-16 08:30 à Tokyo (UTC+9), 2026-07-15 20:30 à Buenos Aires (UTC-3)
    const paris = getLocalDateAndHour('2026-07-15T23:30:00Z', 'Europe/Paris');
    const tokyo = getLocalDateAndHour('2026-07-15T23:30:00Z', 'Asia/Tokyo');
    const bsas = getLocalDateAndHour('2026-07-15T23:30:00Z', 'America/Argentina/Buenos_Aires');

    expect(paris).toMatchObject({ date: '2026-07-16', time: '01:30', hour: 1, month: 7 });
    expect(tokyo).toMatchObject({ date: '2026-07-16', time: '08:30', hour: 8, month: 7 });
    expect(bsas).toMatchObject({ date: '2026-07-15', time: '20:30', hour: 20, month: 7 });
  });
});

describe('K2.29 — Découpage automatique dun long tracé GPX', () => {
  it('scinde un GPX continu en N jours avec métriques, capacités hors-ligne et révisions indépendantes', () => {
    const route = buildSampleRoute();
    const plan = splitRouteIntoDays(route, {
      planId: 'plan-tmb-4d',
      targetDays: 4,
      nowIso: '2026-06-01T10:00:00Z',
      publicShareConsented: true,
    });

    expect(plan.daysCount).toBe(4);
    expect(plan.stages).toHaveLength(4);
    expect(plan.timezone).toBe('Europe/Paris');
    expect(plan.stages[0].startPointIndex).toBe(0);
    expect(plan.stages[3].endPointIndex).toBe(route.points.length - 1);

    for (let i = 0; i < plan.stages.length - 1; i += 1) {
      expect(plan.stages[i].endPointIndex).toBe(plan.stages[i + 1].startPointIndex);
      expect(plan.stages[i].standaloneLaunchable).toBe(true);
      expect(plan.stages[i].offline.traceReady).toBe(true);
      expect(plan.stages[i].offline.mapReady).toBe(false);
    }
  });

  it('scinde selon la durée cible journalière (targetHoursPerDay)', () => {
    const route = buildSampleRoute();
    const plan = splitRouteIntoDays(route, {
      planId: 'plan-tmb-hours',
      targetHoursPerDay: 6,
      nowIso: '2026-06-01T10:00:00Z',
    });

    expect(plan.daysCount).toBeGreaterThanOrEqual(2);
    expect(plan.stages[0].points.length).toBeGreaterThanOrEqual(2);
  });
});

describe('K2.30 — Déplacer la fin dune étape et ajuster la suivante', () => {
  it('prévisualise et met à jour atomiquement N et N+1 sans modifier les journées indépendantes', () => {
    const plan = splitRouteIntoDays(buildSampleRoute(), {
      planId: 'plan-k230',
      targetDays: 4,
      nowIso: '2026-06-01T10:00:00Z',
    });

    const originalDay1 = plan.stages[0];
    const originalDay2 = plan.stages[1];
    const originalDay3 = plan.stages[2];
    const originalDay4 = plan.stages[3];

    const newBoundary = originalDay2.endPointIndex + 1;
    const preview = previewStageBoundaryMove(plan, 2, newBoundary, plan.revision);
    expect(preview).not.toBeNull();
    expect(preview?.revisionConflict).toBe(false);
    expect(preview?.dayN.dayNumber).toBe(2);
    expect(preview?.dayNext?.dayNumber).toBe(3);

    const result = commitStageBoundaryMove(
      plan,
      2,
      newBoundary,
      plan.revision,
      '2026-06-01T10:05:00Z',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.revision).toBe(plan.revision + 1);
    expect(result.plan.stages[0]).toBe(originalDay1); // Jour 1 inchangé
    expect(result.plan.stages[3]).toBe(originalDay4); // Jour 4 inchangé
    expect(result.plan.stages[1].endPointIndex).toBe(newBoundary);
    expect(result.plan.stages[2].startPointIndex).toBe(newBoundary);
    expect(result.plan.stages[1].revision).toBe(originalDay2.revision + 1);
    expect(result.plan.stages[2].revision).toBe(originalDay3.revision + 1);
  });

  it('détecte un conflit de révision et conserve lancien découpage intact', () => {
    const plan = splitRouteIntoDays(buildSampleRoute(), {
      planId: 'plan-conflict',
      targetDays: 3,
      nowIso: '2026-06-01T10:00:00Z',
    });

    const staleRevision = plan.revision - 1;
    const res = commitStageBoundaryMove(
      plan,
      1,
      plan.stages[0].endPointIndex + 1,
      staleRevision,
      '2026-06-01T10:10:00Z',
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe('revision_conflict');
    expect(res.preview?.revisionConflict).toBe(true);
  });
});

describe('K2.31 — Refuge et hébergement comme fin détape', () => {
  it('ancre la fin du jour N sur un refuge proche du tracé et ajuste le jour N+1', () => {
    const route = buildSampleRoute();
    const plan = splitRouteIntoDays(route, {
      planId: 'plan-k231',
      targetDays: 3,
      nowIso: '2026-06-01T10:00:00Z',
    });

    const targetPt = route.points[5];
    const refuge: LodgingAnchor = {
      id: 'refuge-bonhomme',
      name: 'Refuge de la Croix du Bonhomme',
      type: 'refuge',
      lat: targetPt.lat + 0.002,
      lon: targetPt.lon,
      eleM: 2443,
      openMonths: [6, 7, 8, 9],
    };

    const res = anchorStageToLodging(plan, 1, refuge, {
      expectedPlanRevision: plan.revision,
      nowIso: '2026-06-01T11:00:00Z',
      stayDateIso: '2026-07-15T18:00:00Z',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.snappedDistanceKm).toBeLessThan(0.5);
    expect(res.plan.stages[0].endPointIndex).toBe(5);
    expect(res.plan.stages[0].endLodging?.id).toBe('refuge-bonhomme');
    expect(res.plan.stages[1].startPointIndex).toBe(5);
  });

  it('rejette un refuge trop éloigné du tracé ou fermé à la date demandée', () => {
    const plan = splitRouteIntoDays(buildSampleRoute(), {
      planId: 'plan-k231-err',
      targetDays: 3,
      nowIso: '2026-06-01T10:00:00Z',
    });

    const farRefuge: LodgingAnchor = {
      id: 'refuge-loin',
      name: 'Refuge Lointain',
      type: 'refuge',
      lat: 47.5,
      lon: 9.0,
      eleM: 2100,
    };
    const farRes = anchorStageToLodging(plan, 1, farRefuge, {
      expectedPlanRevision: plan.revision,
      nowIso: '2026-06-01T11:00:00Z',
      maxSnapDistanceKm: 2.0,
    });
    expect(farRes.ok).toBe(false);
    if (!farRes.ok) expect(farRes.reason).toBe('lodging_too_far');

    const seasonalRefuge: LodgingAnchor = {
      id: 'refuge-ete',
      name: 'Refuge dÉté',
      type: 'refuge',
      lat: plan.stages[0].endCoord.lat,
      lon: plan.stages[0].endCoord.lon,
      eleM: 2400,
      openMonths: [7, 8],
    };
    const closedRes = anchorStageToLodging(plan, 1, seasonalRefuge, {
      expectedPlanRevision: plan.revision,
      nowIso: '2026-06-01T11:00:00Z',
      stayDateIso: '2026-11-15T12:00:00Z',
    });
    expect(closedRes.ok).toBe(false);
    if (!closedRes.ok) expect(closedRes.reason).toBe('lodging_closed_season');
  });
});

describe('K1.13 — Bibliothèque multi-jours & pile de drawers C-UI', () => {
  it('analyse pays/durée/thème, permet la correction de critères et exclut les plans privés/bloqués P01', () => {
    const planFrPublic = splitRouteIntoDays(
      buildSampleRoute({ id: 'r1', title: 'Traversée Alpes 4j', countryCode: 'FR', theme: 'alpine', audience: 'public' }),
      { planId: 'p1', targetDays: 4, nowIso: '2026-06-01T10:00:00Z', publicShareConsented: true },
    );
    const planFrPrivate = splitRouteIntoDays(
      buildSampleRoute({ id: 'r2', title: 'Secret Alpes 4j', countryCode: 'FR', theme: 'alpine', audience: 'private', ownerId: 'user-other-2' }),
      { planId: 'p2', targetDays: 4, nowIso: '2026-06-01T10:00:00Z', publicShareConsented: false },
    );
    const planItCoastal = splitRouteIntoDays(
      buildSampleRoute({ id: 'r3', title: 'Sentier Côtier Italie', countryCode: 'IT', theme: 'coastal', audience: 'public' }),
      { planId: 'p3', targetDays: 3, nowIso: '2026-06-01T10:00:00Z', publicShareConsented: true },
    );

    const parsed = parseMultiDaySearchQuery('France 3-5 jours alpin');
    expect(parsed).toMatchObject({ countryCode: 'FR', minDays: 3, maxDays: 5, theme: 'alpine' });

    const res = searchMultiDayPlans(
      [planFrPublic, planFrPrivate, planItCoastal],
      { rawQuery: 'France 3-5 jours alpin', scrollOffset: 120 },
      PUBLIC_VIEWER,
    );
    expect(res.items.map((p) => p.id)).toEqual(['p1']);
    expect(res.excludedPrivateCount).toBe(1);

    // Correction des critères compris vers l'Italie / côtier
    const corrected = searchMultiDayPlans(
      [planFrPublic, planFrPrivate, planItCoastal],
      {
        rawQuery: 'France 3-5 jours alpin',
        correctedCriteria: { countryCode: 'IT', theme: 'coastal' },
      },
      PUBLIC_VIEWER,
    );
    expect(corrected.items.map((p) => p.id)).toEqual(['p3']);
  });

  it('conserve la requête et la position de liste au retour du drawer détail', () => {
    const initialQuery = { rawQuery: 'France 4 jours alpin', scrollOffset: 240 };
    let state = createPlanningDrawerState({ kind: 'search_results', query: initialQuery });
    state = reducePlanningDrawerState(state, {
      type: 'open',
      view: { kind: 'plan_detail', planId: 'p1' },
    });
    expect(state.active?.kind).toBe('plan_detail');

    state = reducePlanningDrawerState(state, { type: 'back' });
    expect(state.active).toEqual({ kind: 'search_results', query: initialQuery });
  });
});

describe('K2.32 — Navigation par étape (Démarrer cette étape)', () => {
  it('expose chaque étape indépendamment selon donnée, sport et autorisation P01', () => {
    const plan = splitRouteIntoDays(
      buildSampleRoute({ audience: 'friends', ownerId: 'user-owner' }),
      { planId: 'p-nav', targetDays: 3, nowIso: '2026-06-01T10:00:00Z' },
    );

    const friendViewer: ViewerContextP01 = {
      viewerId: 'user-friend',
      friendIds: ['user-owner'],
      tribuIds: [],
      blockedUserIds: [],
    };

    const launch = getStageLaunchReadiness(plan, 2, friendViewer, 'trekking');
    expect(launch.visible).toBe(true);
    if (launch.visible) {
      expect(launch.payload.dayNumber).toBe(2);
      expect(launch.payload.stageRevision).toBe(1);
      expect(launch.payload.timezone).toBe('Europe/Paris');
    }

    // Sport différent -> action masquée
    const wrongSport = getStageLaunchReadiness(plan, 2, friendViewer, 'cycling');
    expect(wrongSport.visible).toBe(false);
    if (!wrongSport.visible) expect(wrongSport.reason).toBe('sport_mismatch');

    // Utilisateur non autorisé -> refus P01
    const unauthorized = getStageLaunchReadiness(plan, 2, PUBLIC_VIEWER, 'trekking');
    expect(unauthorized.visible).toBe(false);
    if (!unauthorized.visible) expect(unauthorized.reason).toBe('forbidden_p01');

    const cards = listNavigableStages(plan, OWNER_VIEWER, 'trekking');
    expect(cards).toHaveLength(3);
    expect(cards.every((c) => c.canStartStage)).toBe(true);
  });
});

describe('Météo, conditions & fenêtres optimales (pas de données inventées)', () => {
  it('signale explicitement labsence de fournisseur météo réel sans inventer de fenêtre', () => {
    const plan = splitRouteIntoDays(buildSampleRoute({ timezone: 'Asia/Tokyo' }), {
      planId: 'p-meteo-none',
      targetDays: 2,
      nowIso: '2026-06-01T10:00:00Z',
    });

    const unconfigured = createUnconfiguredWeatherFeed('Asia/Tokyo');
    const report = evaluatePlanWeather(plan, unconfigured, '2026-06-01T12:00:00Z');
    expect(report.status).toBe('provider_unavailable');
    expect(report.pointsEvaluated).toBe(0);
    expect(report.missingReason).toContain('Aucun fournisseur météo réel');

    const windows = findOptimalWindows(plan, unconfigured, '2026-06-01T12:00:00Z', {
      minDurationHours: 3,
    });
    expect(windows.status).toBe('provider_unavailable');
    expect(windows.windows).toEqual([]);
  });

  it('calcule les fenêtres optimales dans le fuseau explicite et exclut les alertes sévères', () => {
    const plan = splitRouteIntoDays(buildSampleRoute({ timezone: 'Europe/Paris' }), {
      planId: 'p-meteo-ok',
      targetDays: 2,
      nowIso: '2026-07-10T06:00:00Z',
    });

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

    const result = findOptimalWindows(plan, feed, '2026-07-10T06:30:00Z', {
      minDurationHours: 3,
      maxStageElevationM: 2800,
    });

    expect(result.status).toBe('ok');
    expect(result.windows).toHaveLength(1);
    expect(result.windows[0].timezone).toBe('Europe/Paris');
    expect(result.windows[0].localStartTime).toBe('08:00');
    expect(result.windows[0].localEndTime).toBe('10:00');
  });
});

describe('Partage P01 (fail-closed, révocation, expiration, blocage)', () => {
  it('applique le consentement, la révocation et le blocage P01', () => {
    const planNoConsent = splitRouteIntoDays(buildSampleRoute({ audience: 'public' }), {
      planId: 'p-share-1',
      targetDays: 2,
      nowIso: '2026-06-01T10:00:00Z',
      publicShareConsented: false,
    });

    const deniedCreate = createPlanShare(planNoConsent, 'user-owner', {
      shareId: 'sh-1',
      audience: 'public',
      timezone: 'Europe/Paris',
      createdAtIso: '2026-06-01T10:00:00Z',
    });
    expect(deniedCreate).toEqual({ ok: false, reason: 'consent_missing_p01' });

    const planConsented = { ...planNoConsent, publicShareConsented: true };
    const created = createPlanShare(planConsented, 'user-owner', {
      shareId: 'sh-2',
      audience: 'public',
      timezone: 'Europe/Paris',
      createdAtIso: '2026-06-01T10:00:00Z',
      expiresAtIso: '2026-06-10T10:00:00Z',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(
      evaluateShareAccessP01(planConsented, created.record, PUBLIC_VIEWER, '2026-06-02T10:00:00Z'),
    ).toEqual({ allowed: true, audience: 'public', includeExactStartEndCoords: false });

    // Utilisateur ayant bloqué le propriétaire -> refus P01
    const blockingViewer: ViewerContextP01 = {
      ...PUBLIC_VIEWER,
      blockedUserIds: ['user-owner'],
    };
    expect(
      evaluateShareAccessP01(planConsented, created.record, blockingViewer, '2026-06-02T10:00:00Z'),
    ).toEqual({ allowed: false, reason: 'blocked_p01' });

    // Révocation immédiate
    const revoked = revokePlanShare(created.record, 'user-owner', '2026-06-03T10:00:00Z');
    expect(revoked.ok).toBe(true);
    if (!revoked.ok) return;
    expect(
      evaluateShareAccessP01(planConsented, revoked.record, PUBLIC_VIEWER, '2026-06-03T10:01:00Z'),
    ).toEqual({ allowed: false, reason: 'revoked' });
  });
});
