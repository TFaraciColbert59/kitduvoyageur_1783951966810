import { describe, expect, it } from 'vitest';
import {
  analyzeEffortAnomalies,
  buildPersonalEffortHistory,
  buildSegmentLeaderboard,
  closeEffortComparisonDrawer,
  closeEffortFlagDrawer,
  closeHazardReportDrawer,
  closeSegmentCrudDrawer,
  compareSegmentEfforts,
  compareSegmentsForDuplication,
  contestEffortExclusion,
  createSegmentFromActivity,
  deduplicateAndMergeSegments,
  deduplicateSegmentEfforts,
  deleteSegment,
  detectActivitySegmentEfforts,
  evaluateSegmentHazardStatus,
  evaluateSegmentVerification,
  filterCompetitionNotificationsForHazardousSegments,
  flagSegmentEffort,
  hideSegmentForUser,
  matchActivityToSegment,
  openEffortComparisonDrawer,
  openEffortFlagDrawer,
  openHazardReportDrawer,
  openSegmentCrudDrawer,
  openSegmentDetailFromSearch,
  parseSegmentSearchQuery,
  reportSegmentHazard,
  resolveEffortReview,
  resolveSegmentHazard,
  returnToSearchFromSegmentDetail,
  searchSegments,
  setSegmentVisibility,
  toggleSegmentStar,
  unhideSegmentForUser,
  updateSegment,
  type ActivityTraceForSegments,
  type DrawerParentContext,
  type SegmentDefinition,
  type SegmentTrackPoint,
  type UserSegmentPreferences,
} from '../index';

/**
 * Génère une trace GPS linéaire vers le nord à partir de `(45.0, 6.0)`.
 * `1e-3` degré de latitude ≈ `111.19 m`.
 */
function buildLinearNorthTrack(params: {
  steps: number;
  stepLatDeg?: number;
  stepSeconds?: number;
  startIso?: string;
  lngOffsetDeg?: number;
  startEleM?: number;
  eleStepM?: number;
  heartRateStartBpm?: number | null;
  powerW?: number | null;
}): SegmentTrackPoint[] {
  const stepLatDeg = params.stepLatDeg ?? 0.0005; // ~55.6 m par pas
  const stepSeconds = params.stepSeconds ?? 12; // ~4.63 m/s = 16.6 km/h
  const startMs = Date.parse(params.startIso ?? '2026-11-13T08:00:00.000Z');
  const lng = 6.0 + (params.lngOffsetDeg ?? 0);
  const startEle = params.startEleM ?? 500;
  const eleStep = params.eleStepM ?? 3;

  const points: SegmentTrackPoint[] = [];
  for (let i = 0; i <= params.steps; i += 1) {
    points.push({
      lat: 45.0 + i * stepLatDeg,
      lng,
      ele: startEle + i * eleStep,
      timestamp: new Date(startMs + i * stepSeconds * 1000).toISOString(),
      accuracyM: 6,
      heartRateBpm:
        params.heartRateStartBpm !== undefined && params.heartRateStartBpm !== null
          ? params.heartRateStartBpm + i
          : null,
      powerW: params.powerW ?? null,
    });
  }
  return points;
}

function createFixtureSegment(overrides?: Partial<SegmentDefinition>): SegmentDefinition {
  // Segment de 10 intervalles = ~556 m, D+ = 30 m
  const pts = buildLinearNorthTrack({ steps: 10, stepLatDeg: 0.0005, eleStepM: 3 }).map((p) => ({
    lat: p.lat,
    lng: p.lng,
    ele: p.ele,
  }));
  return {
    id: 'seg-col-fixture',
    version: 1,
    name: 'Montée du Belvédère',
    sport: 'running',
    direction: 'forward',
    points: pts,
    startPoint: pts[0],
    endPoint: pts[pts.length - 1],
    lengthM: 556,
    elevationGainM: 30,
    elevationLossM: 0,
    meanGradePct: 5.4,
    maxGradePct: 5.4,
    surface: 'trail',
    visibility: 'public',
    createdByUserId: 'user-creator',
    sourceActivityId: 'act-origin',
    verified: true,
    verifiedReason: 'curated',
    canonicalSegmentId: null,
    mergedDuplicateIds: [],
    hazardous: false,
    hazardCategory: null,
    hazardReportedAt: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

describe('Lot S01 — Segments sportifs et validation des efforts (S4.01..S4.12)', () => {
  describe('S4.01 — Détection automatique des passages & appariement GPS', () => {
    it('retient un passage complet dans le bon sens (course et vélo) et calcule durée, mouvement et capteurs sans en inventer', () => {
      const segment = createFixtureSegment();
      const points = buildLinearNorthTrack({
        steps: 10,
        stepLatDeg: 0.0005,
        stepSeconds: 15,
        heartRateStartBpm: 150,
        powerW: null, // aucun capteur de puissance
      });

      const activity: ActivityTraceForSegments = {
        activityId: 'act-valid-run',
        activityVersion: 1,
        userId: 'user-1',
        sport: 'running',
        points,
        pauses: [
          {
            startAt: points[3].timestamp,
            endAt: points[4].timestamp,
            durationS: 15,
          },
        ],
        visibility: 'public',
      };

      const efforts = matchActivityToSegment(activity, segment);
      expect(efforts).toHaveLength(1);
      const eff = efforts[0];
      expect(eff.status).toBe('valid');
      expect(eff.direction).toBe('forward');
      expect(eff.elapsedDurationS).toBe(150);
      expect(eff.pausedDurationS).toBe(15);
      expect(eff.movingDurationS).toBe(135);
      expect(eff.eligibleForPublicLeaderboard).toBe(true);
      expect(eff.avgHeartRateBpm).toBe(155);
      // Aucun capteur de puissance inventé
      expect(eff.avgPowerW).toBeNull();
      expect(eff.avgCadenceRpm).toBeNull();

      // Extension au vélo (S4.01)
      const bikeSegment = createFixtureSegment({ id: 'seg-bike-1', sport: 'cycling' });
      const bikePoints = buildLinearNorthTrack({
        steps: 10,
        stepLatDeg: 0.0005,
        stepSeconds: 6, // ~33 km/h en vélo
        powerW: 260,
      });
      const bikeActivity: ActivityTraceForSegments = {
        activityId: 'act-valid-bike',
        activityVersion: 1,
        userId: 'user-1',
        sport: 'cycling',
        points: bikePoints,
        visibility: 'public',
      };

      const bikeEfforts = matchActivityToSegment(bikeActivity, bikeSegment);
      expect(bikeEfforts).toHaveLength(1);
      expect(bikeEfforts[0].status).toBe('valid');
      expect(bikeEfforts[0].elapsedDurationS).toBe(60);
      expect(bikeEfforts[0].avgPowerW).toBe(260);
    });

    it('rejette un passage en sens inverse (reversed), un passage incomplet, une route parallèle hors couloir et un demi-tour', () => {
      const segment = createFixtureSegment();

      // 1. Sens inverse (du nord au sud)
      const forwardPts = buildLinearNorthTrack({ steps: 10, stepSeconds: 15 });
      const reversedPts: SegmentTrackPoint[] = [...forwardPts].reverse().map((p, idx) => ({
        ...p,
        timestamp: new Date(Date.parse('2026-11-13T09:00:00.000Z') + idx * 15000).toISOString(),
      }));
      const revEfforts = matchActivityToSegment(
        {
          activityId: 'act-rev',
          activityVersion: 1,
          userId: 'user-1',
          sport: 'running',
          points: reversedPts,
          visibility: 'public',
        },
        segment
      );
      expect(revEfforts).toHaveLength(1);
      expect(revEfforts[0].status).toBe('reversed');
      expect(revEfforts[0].exclusionReasons).toContain('wrong_direction');
      expect(revEfforts[0].eligibleForPublicLeaderboard).toBe(false);

      // 2. Passage incomplet (s'arrête à mi-parcours)
      const halfPts = buildLinearNorthTrack({ steps: 5, stepSeconds: 15 });
      const halfEfforts = matchActivityToSegment(
        {
          activityId: 'act-half',
          activityVersion: 1,
          userId: 'user-1',
          sport: 'running',
          points: halfPts,
          visibility: 'public',
        },
        segment
      );
      expect(halfEfforts).toHaveLength(1);
      expect(halfEfforts[0].status).toBe('incomplete');
      expect(halfEfforts[0].exclusionReasons).toContain('incomplete_coverage');
      expect(halfEfforts[0].eligibleForPublicLeaderboard).toBe(false);

      // 3. Route parallèle à ~65 m à l'est (0.00085 deg lng à lat 45° ≈ 67 m)
      const parallelPts = buildLinearNorthTrack({
        steps: 10,
        stepSeconds: 15,
        lngOffsetDeg: 0.00085,
      });
      const parallelEfforts = matchActivityToSegment(
        {
          activityId: 'act-parallel',
          activityVersion: 1,
          userId: 'user-1',
          sport: 'running',
          points: parallelPts,
          visibility: 'public',
        },
        segment
      );
      expect(parallelEfforts).toHaveLength(0);

      // 4. Demi-tour au milieu avant d'atteindre l'arrivée
      const uturnBase = buildLinearNorthTrack({ steps: 10, stepSeconds: 15 });
      const uturnPts: SegmentTrackPoint[] = [
        ...uturnBase.slice(0, 7),
        { ...uturnBase[3], timestamp: '2026-11-13T08:02:00.000Z' },
        { ...uturnBase[7], timestamp: '2026-11-13T08:02:30.000Z' },
        { ...uturnBase[8], timestamp: '2026-11-13T08:02:45.000Z' },
        { ...uturnBase[9], timestamp: '2026-11-13T08:03:00.000Z' },
        { ...uturnBase[10], timestamp: '2026-11-13T08:03:15.000Z' },
      ];
      const uturnEfforts = matchActivityToSegment(
        {
          activityId: 'act-uturn',
          activityVersion: 1,
          userId: 'user-1',
          sport: 'running',
          points: uturnPts,
          visibility: 'public',
        },
        segment
      );
      expect(uturnEfforts).toHaveLength(1);
      expect(uturnEfforts[0].status).toBe('excluded');
      expect(uturnEfforts[0].exclusionReasons).toContain('uturn_detected');
      expect(uturnEfforts[0].eligibleForPublicLeaderboard).toBe(false);
    });

    it('distingue deux boucles successives dans la même sortie et déduplique de manière idempotente après rejeu', () => {
      const segment = createFixtureSegment();
      const lap1 = buildLinearNorthTrack({
        steps: 10,
        stepSeconds: 15,
        startIso: '2026-11-13T08:00:00.000Z',
      });
      const lap2 = buildLinearNorthTrack({
        steps: 10,
        stepSeconds: 14,
        startIso: '2026-11-13T08:15:00.000Z',
      });
      // Point de transition hors couloir entre les deux tours pour revenir au départ
      const transitionPt: SegmentTrackPoint = {
        lat: 45.0025,
        lng: 6.002,
        ele: 510,
        timestamp: '2026-11-13T08:08:00.000Z',
        accuracyM: 6,
      };

      const activity: ActivityTraceForSegments = {
        activityId: 'act-two-laps',
        activityVersion: 1,
        userId: 'user-1',
        sport: 'running',
        points: [...lap1, transitionPt, ...lap2],
        visibility: 'public',
      };

      const detected = detectActivitySegmentEfforts(activity, [segment]);
      expect(detected.validEfforts).toHaveLength(2);
      expect(detected.validEfforts[0].occurrenceIndex).toBe(1);
      expect(detected.validEfforts[0].elapsedDurationS).toBe(150);
      expect(detected.validEfforts[1].occurrenceIndex).toBe(2);
      expect(detected.validEfforts[1].elapsedDurationS).toBe(140);

      // Rejeu idempotent : ne crée aucun doublon
      const replayed = deduplicateSegmentEfforts([
        ...detected.validEfforts,
        ...detected.validEfforts,
      ]);
      expect(replayed).toHaveLength(2);
    });
  });

  describe('S4.12 — Détection des temps invalides, anti-triche, signalement et contestation', () => {
    it('exclut automatiquement un effort avec saut GPS, vitesse motorisée ou activité assistée/manuelle', () => {
      const segment = createFixtureSegment();

      // 1. Saut GPS au milieu du segment (manque les points 3..8, bond de > 300 m)
      const fullPts = buildLinearNorthTrack({ steps: 10, stepSeconds: 15 });
      const jumpPts = [fullPts[0], fullPts[1], fullPts[2], fullPts[9], fullPts[10]];
      const jumpEfforts = matchActivityToSegment(
        {
          activityId: 'act-jump',
          activityVersion: 1,
          userId: 'user-1',
          sport: 'running',
          points: jumpPts,
          visibility: 'public',
        },
        segment
      );
      expect(jumpEfforts).toHaveLength(1);
      expect(jumpEfforts[0].status).toBe('excluded');
      expect(jumpEfforts[0].exclusionReasons).toContain('gps_jump_or_teleport');
      expect(jumpEfforts[0].eligibleForPublicLeaderboard).toBe(false);

      // 2. Vitesse de véhicule motorisé sur un segment de course à pied (556 m en 25 s ≈ 80 km/h)
      const carPts = buildLinearNorthTrack({ steps: 10, stepSeconds: 2.5 });
      const carEfforts = matchActivityToSegment(
        {
          activityId: 'act-car',
          activityVersion: 1,
          userId: 'user-1',
          sport: 'running',
          points: carPts,
          visibility: 'public',
        },
        segment
      );
      expect(carEfforts).toHaveLength(1);
      expect(carEfforts[0].status).toBe('excluded');
      expect(carEfforts[0].exclusionReasons).toContain('speed_exceeded_for_sport');
      expect(carEfforts[0].exclusionReasons).toContain('motorized_vehicle_suspected');
      expect(carEfforts[0].eligibleForPublicLeaderboard).toBe(false);

      // 3. Activité VAE ou manuelle
      const anomaly = analyzeEffortAnomalies({
        segment,
        activity: { sport: 'running', isManualOrIndoor: true, ebikeOrAssisted: true },
        effortPoints: fullPts,
        elapsedDurationS: 150,
        coveredDistanceM: 556,
      });
      expect(anomaly.valid).toBe(false);
      expect(anomaly.reasons).toContain('manual_or_indoor_activity');
      expect(anomaly.reasons).toContain('ebike_on_non_ebike_segment');
    });

    it('gère le signalement communautaire (avec anti-spam), la contestation propriétaire et la revue', () => {
      const segment = createFixtureSegment();
      const validPts = buildLinearNorthTrack({ steps: 10, stepSeconds: 15 });
      const [effort] = matchActivityToSegment(
        {
          activityId: 'act-flag-test',
          activityVersion: 1,
          userId: 'athlete-owner',
          sport: 'running',
          points: validPts,
          visibility: 'public',
        },
        segment
      );

      // Interdit l'auto-signalement
      const selfFlag = flagSegmentEffort({
        effort,
        existingFlags: [],
        reporterUserId: 'athlete-owner',
        reporterFlagsLastHour: 0,
        category: 'motorized_vehicle',
        comment: 'Test auto-signalement',
      });
      expect(selfFlag.accepted).toBe(false);
      expect(selfFlag.reason).toBe('self_flag_not_allowed');

      // Premier signalement tiers
      const flag1 = flagSegmentEffort({
        effort,
        existingFlags: [],
        reporterUserId: 'reporter-1',
        reporterFlagsLastHour: 0,
        category: 'motorized_vehicle',
        comment: 'Vitesse suspecte dans la montée',
      });
      expect(flag1.accepted).toBe(true);
      expect(flag1.updatedEffort.status).toBe('valid');

      // Deuxième signalement distinct -> passe en `under_review` et sort du classement public
      const flag2 = flagSegmentEffort({
        effort: flag1.updatedEffort,
        existingFlags: [
          {
            flagId: 'f1',
            effortId: effort.effortId,
            segmentId: segment.id,
            reporterUserId: 'reporter-1',
            category: 'motorized_vehicle',
            comment: 'Vitesse suspecte dans la montée',
            createdAt: '2026-11-13T10:00:00.000Z',
          },
        ],
        reporterUserId: 'reporter-2',
        reporterFlagsLastHour: 1,
        category: 'motorized_vehicle',
        comment: 'Confirmé, trace en voiture',
      });
      expect(flag2.accepted).toBe(true);
      expect(flag2.updatedEffort.status).toBe('under_review');
      expect(flag2.updatedEffort.eligibleForPublicLeaderboard).toBe(false);

      // Contestation par le propriétaire
      const contested = contestEffortExclusion({
        effort: flag2.updatedEffort,
        reviewRecord: flag2.reviewRecord,
        requesterUserId: 'athlete-owner',
        justification: 'Record réalisé lors de la course officielle du club avec dossard.',
      });
      expect(contested.allowed).toBe(true);
      expect(contested.reviewRecord.contestMessage).toContain('dossard');

      // Décision de revue favorable -> réhabilité dans le classement public
      const resolved = resolveEffortReview({
        effort: contested.updatedEffort,
        reviewRecord: contested.reviewRecord,
        decision: 'restore_valid',
        reviewerId: 'mod-1',
        note: 'Résultat officiel vérifié',
        isActivityPublicAndUnmasked: true,
        isSegmentPublicAndSafe: true,
      });
      expect(resolved.updatedEffort.status).toBe('valid');
      expect(resolved.updatedEffort.eligibleForPublicLeaderboard).toBe(true);

      // Vérifie la restauration du drawer parent (S4.12)
      const parentCtx: DrawerParentContext = {
        drawerId: 'drawer-seg-1',
        view: 'segment_detail',
        scrollOffsetPx: 240,
        selectedSegmentId: segment.id,
      };
      const opened = openEffortFlagDrawer(effort.effortId, 'flag', parentCtx);
      expect(opened.isOpen).toBe(true);
      const closed = closeEffortFlagDrawer(opened);
      expect(closed.drawerState.isOpen).toBe(false);
      expect(closed.restoredParentContext).toEqual(parentCtx);
    });
  });

  describe('S4.02, S4.03 & P01 — CRUD, visibilité privé/public, zones masquées, recherche, favoris et masquage', () => {
    it('crée un segment depuis une activité, bloque un segment public en zone masquée P01 et retire tout effort public si le segment passe en privé', () => {
      const trackPoints = buildLinearNorthTrack({ steps: 12, stepSeconds: 15 });
      const activityWithZone: ActivityTraceForSegments = {
        activityId: 'act-source-1',
        activityVersion: 1,
        userId: 'user-alice',
        sport: 'running',
        points: trackPoints,
        visibility: 'public',
        hiddenZones: [
          {
            id: 'home-zone',
            center: { lat: trackPoints[0].lat, lng: trackPoints[0].lng },
            radiusM: 200,
          },
        ],
      };

      // Interdit la création d'un segment PUBLIC qui démarre dans la zone masquée P01
      const blockedPublic = createSegmentFromActivity({
        name: 'Départ Maison Public',
        activity: activityWithZone,
        startPointIndex: 0,
        endPointIndex: 10,
        visibility: 'public',
      });
      expect(blockedPublic.ok).toBe(false);
      expect(blockedPublic.error).toBe('privacy_zone_conflict_for_public_segment');

      // Autorise la création si le segment est PRIVÉ
      const allowedPrivate = createSegmentFromActivity({
        name: 'Départ Maison Privé',
        activity: activityWithZone,
        startPointIndex: 0,
        endPointIndex: 10,
        visibility: 'private',
      });
      expect(allowedPrivate.ok).toBe(true);
      expect(allowedPrivate.segment?.visibility).toBe('private');

      // Crée un segment public hors zone masquée
      const cleanActivity: ActivityTraceForSegments = {
        ...activityWithZone,
        hiddenZones: [],
      };
      const createdPublic = createSegmentFromActivity({
        segmentId: 'seg-clean-public',
        name: 'Crête des Aiguilles',
        activity: cleanActivity,
        startPointIndex: 1,
        endPointIndex: 11,
        visibility: 'public',
      });
      expect(createdPublic.ok).toBe(true);
      const publicSeg = createdPublic.segment!;
      expect(publicSeg.lengthM).toBeGreaterThan(500);

      const effortsOnPublic = matchActivityToSegment(cleanActivity, publicSeg);
      expect(effortsOnPublic[0].eligibleForPublicLeaderboard).toBe(true);

      // Un tiers ne peut pas modifier la visibilité du segment d'Alice
      const unauthorized = setSegmentVisibility({
        segment: publicSeg,
        actorUserId: 'user-intruder',
        visibility: 'private',
        existingEfforts: effortsOnPublic,
      });
      expect(unauthorized.ok).toBe(false);
      expect(unauthorized.error).toBe('unauthorized_not_owner');

      // Alice passe son segment en privé -> l'effort quitte immédiatement le classement public
      const privatized = setSegmentVisibility({
        segment: publicSeg,
        actorUserId: 'user-alice',
        visibility: 'private',
        existingEfforts: effortsOnPublic,
      });
      expect(privatized.ok).toBe(true);
      expect(privatized.segment.visibility).toBe('private');
      expect(privatized.updatedEfforts[0].visibility).toBe('private');
      expect(privatized.updatedEfforts[0].eligibleForPublicLeaderboard).toBe(false);

      // Suppression par la propriétaire + vérification du drawer CRUD (S4.02)
      const parentCtx: DrawerParentContext = {
        drawerId: 'drawer-act',
        view: 'activity_trace',
        scrollOffsetPx: 120,
        selectedActivityId: 'act-source-1',
      };
      const crudDrawer = openSegmentCrudDrawer({
        mode: 'create',
        parentContext: parentCtx,
        sourceActivityId: 'act-source-1',
        initialStartPointIndex: 1,
        initialEndPointIndex: 11,
      });
      expect(crudDrawer.isOpen).toBe(true);
      expect(closeSegmentCrudDrawer(crudDrawer).restoredParentContext).toEqual(parentCtx);

      const deleted = deleteSegment({
        segment: privatized.segment,
        actorUserId: 'user-alice',
        existingEfforts: privatized.updatedEfforts,
      });
      expect(deleted.ok).toBe(true);
      expect(deleted.remainingEfforts).toHaveLength(0);
    });

    it('filtre la recherche par sport/contraintes, applique les favoris et le masquage personnel et ne fuite aucun segment privé (S4.03)', () => {
      const segRunPublic = createFixtureSegment({
        id: 'seg-run-pub',
        name: 'Col de la Croix Verte',
        sport: 'running',
        meanGradePct: 7.2,
        visibility: 'public',
        createdByUserId: 'user-alice',
      });
      const segBikePublic = createFixtureSegment({
        id: 'seg-bike-pub',
        name: 'Sprint du Lac',
        sport: 'cycling',
        meanGradePct: 1.2,
        visibility: 'public',
        createdByUserId: 'user-alice',
      });
      const segPrivateAlice = createFixtureSegment({
        id: 'seg-priv-alice',
        name: 'Col Secret Alice',
        sport: 'running',
        meanGradePct: 8.0,
        visibility: 'private',
        createdByUserId: 'user-alice',
      });

      const catalog = [segRunPublic, segBikePublic, segPrivateAlice];

      // Bob cherche "course >5% col" -> trouve uniquement segRunPublic, JAMAIS segPrivateAlice
      const parsed = parseSegmentSearchQuery('course >5% col');
      expect(parsed.sport).toBe('running');
      expect(parsed.minGradePct).toBe(5);

      const bobSearch = searchSegments(catalog, {
        query: 'course >5% col',
        viewerUserId: 'user-bob',
      });
      expect(bobSearch.hits.map((h) => h.segment.id)).toEqual(['seg-run-pub']);

      // Alice (propriétaire) voit aussi son segment privé
      const aliceSearch = searchSegments(catalog, {
        query: 'col',
        viewerUserId: 'user-alice',
      });
      expect(aliceSearch.hits.map((h) => h.segment.id)).toEqual([
        'seg-run-pub',
        'seg-priv-alice',
      ]);

      // Favoris et masquage personnel pour Bob
      let bobPrefs: UserSegmentPreferences = {
        userId: 'user-bob',
        starredSegmentIds: [],
        hiddenSegmentIds: [],
      };
      bobPrefs = toggleSegmentStar(bobPrefs, 'seg-bike-pub');
      expect(bobPrefs.starredSegmentIds).toEqual(['seg-bike-pub']);

      const starredOnly = searchSegments(catalog, {
        query: 'favoris',
        viewerUserId: 'user-bob',
        preferences: bobPrefs,
      });
      expect(starredOnly.hits.map((h) => h.segment.id)).toEqual(['seg-bike-pub']);

      // Masquer seg-run-pub l'exclut de la recherche standard
      bobPrefs = hideSegmentForUser(bobPrefs, 'seg-run-pub');
      const afterHide = searchSegments(catalog, {
        query: '',
        viewerUserId: 'user-bob',
        preferences: bobPrefs,
      });
      expect(afterHide.hits.map((h) => h.segment.id)).toEqual(['seg-bike-pub']);

      // Démasquer restaure la visibilité
      bobPrefs = unhideSegmentForUser(bobPrefs, 'seg-run-pub');
      const afterUnhide = searchSegments(catalog, {
        query: '',
        viewerUserId: 'user-bob',
        preferences: bobPrefs,
      });
      expect(afterUnhide.hits).toHaveLength(2);

      // Conservation de l'état de recherche lors de l'ouverture du détail (S4.03)
      const navState = openSegmentDetailFromSearch(
        { query: 'course >5%', sportFilter: 'running', scrollOffsetPx: 0, activeSegmentDetailId: null },
        'seg-run-pub',
        310
      );
      expect(navState.activeSegmentDetailId).toBe('seg-run-pub');
      const returnedNav = returnToSearchFromSegmentDetail(navState);
      expect(returnedNav.activeSegmentDetailId).toBeNull();
      expect(returnedNav.query).toBe('course >5%');
      expect(returnedNav.scrollOffsetPx).toBe(310);
    });
  });

  describe('S4.04 — Segments vérifiés et dédoublonnage en arrière-plan', () => {
    it('évalue la vérification d’un segment, fusionne deux segments doublons vers le canonique et déduplique les efforts d’une même séance', () => {
      const canonicalSeg = createFixtureSegment({
        id: 'seg-canonical',
        name: 'Montée Officielle',
        verified: true,
        createdAt: '2026-10-01T00:00:00.000Z',
      });
      // Doublon très légèrement décalé (~5 m en longitude) créé plus tard
      const duplicateSeg = createFixtureSegment({
        id: 'seg-duplicate',
        name: 'Montée bis doublon',
        verified: false,
        points: canonicalSeg.points.map((p) => ({
          ...p,
          lng: p.lng + 0.00005,
        })),
        startPoint: {
          ...canonicalSeg.startPoint,
          lng: canonicalSeg.startPoint.lng + 0.00005,
        },
        endPoint: {
          ...canonicalSeg.endPoint,
          lng: canonicalSeg.endPoint.lng + 0.00005,
        },
        createdAt: '2026-11-05T00:00:00.000Z',
      });

      const cmp = compareSegmentsForDuplication(canonicalSeg, duplicateSeg);
      expect(cmp.isDuplicate).toBe(true);

      const activity: ActivityTraceForSegments = {
        activityId: 'act-both-segs',
        activityVersion: 1,
        userId: 'user-runner-1',
        sport: 'running',
        points: buildLinearNorthTrack({ steps: 10, stepSeconds: 14 }),
        visibility: 'public',
      };

      const effOnCanonical = matchActivityToSegment(activity, canonicalSeg);
      const effOnDuplicate = matchActivityToSegment(activity, duplicateSeg);
      expect(effOnCanonical).toHaveLength(1);
      expect(effOnDuplicate).toHaveLength(1);

      const merged = deduplicateAndMergeSegments(
        [canonicalSeg, duplicateSeg],
        [...effOnCanonical, ...effOnDuplicate]
      );

      expect(merged.mergedPairs).toEqual([
        { duplicateId: 'seg-duplicate', canonicalId: 'seg-canonical' },
      ]);

      const updatedDup = merged.segments.find((s) => s.id === 'seg-duplicate')!;
      const updatedCanon = merged.segments.find((s) => s.id === 'seg-canonical')!;
      expect(updatedDup.canonicalSegmentId).toBe('seg-canonical');
      expect(updatedCanon.mergedDuplicateIds).toContain('seg-duplicate');

      // Le passage de `act-both-segs` n'est compté qu'une seule fois sur le segment canonique !
      expect(merged.efforts).toHaveLength(1);
      expect(merged.efforts[0].segmentId).toBe('seg-canonical');

      // Vérification d'éligibilité S4.04
      const verifEval = evaluateSegmentVerification(updatedCanon, merged.efforts, {
        minDistinctAthletes: 1,
        minValidEfforts: 1,
      });
      expect(verifEval.eligibleForVerified).toBe(true);
    });
  });

  describe('S4.11 — Signalement de segment dangereux, exclusion du classement et arrêt des notifications', () => {
    it('bascule un segment en dangereux, désactive son classement public et filtre toute notification de compétition', () => {
      const segment = createFixtureSegment({ id: 'seg-danger-test' });
      const pts = buildLinearNorthTrack({ steps: 10, stepSeconds: 14 });
      const efforts = matchActivityToSegment(
        {
          activityId: 'act-before-hazard',
          activityVersion: 1,
          userId: 'user-1',
          sport: 'running',
          points: pts,
          visibility: 'public',
        },
        segment
      );
      expect(efforts[0].eligibleForPublicLeaderboard).toBe(true);

      // Signalement officiel ou confirmé par 2 utilisateurs
      const rep1 = reportSegmentHazard({
        segment,
        existingReports: [],
        efforts,
        reporterUserId: 'user-r1',
        reporterReportsLastHour: 0,
        category: 'trail_closed_or_collapsed',
        description: 'Éboulement majeur sur la deuxième moitié du sentier',
      });
      expect(rep1.accepted).toBe(true);
      expect(rep1.evaluation.hazardous).toBe(false); // 1 seul signalement non-officiel

      const rep2 = reportSegmentHazard({
        segment: rep1.updatedSegment,
        existingReports: [rep1.report!],
        efforts: rep1.updatedEfforts,
        reporterUserId: 'user-r2',
        reporterReportsLastHour: 0,
        category: 'trail_closed_or_collapsed',
        description: 'Sentier fermé par arrêté municipal suite éboulement',
      });
      expect(rep2.accepted).toBe(true);
      expect(rep2.evaluation.hazardous).toBe(true);
      expect(rep2.evaluation.leaderboardEnabled).toBe(false);
      expect(rep2.evaluation.suppressCompetitionNotifications).toBe(true);
      expect(rep2.updatedEfforts[0].eligibleForPublicLeaderboard).toBe(false);

      // Le classement est désactivé pour ce segment dangereux
      const lb = buildSegmentLeaderboard({
        segment: rep2.updatedSegment,
        efforts: rep2.updatedEfforts,
        viewerUserId: 'user-1',
      });
      expect(lb.leaderboardEnabled).toBe(false);
      expect(lb.disabledReason).toBe('segment_hazardous');
      expect(lb.entries).toHaveLength(0);

      // Les notifications de compétition sont supprimées sur ce segment dangereux
      const segmentsMap = new Map([[rep2.updatedSegment.id, rep2.updatedSegment]]);
      const filteredNotifs = filterCompetitionNotificationsForHazardousSegments(
        [
          {
            notificationId: 'notif-1',
            segmentId: rep2.updatedSegment.id,
            recipientUserId: 'user-1',
            type: 'kom_lost',
          },
        ],
        segmentsMap
      );
      expect(filteredNotifs).toHaveLength(0);

      // Restauration du contexte parent à la fermeture du drawer danger
      const parentCtx: DrawerParentContext = {
        drawerId: 'drawer-seg',
        view: 'segment_detail',
        scrollOffsetPx: 95,
        selectedSegmentId: segment.id,
      };
      const hazDrawer = openHazardReportDrawer(segment.id, parentCtx);
      expect(closeHazardReportDrawer(hazDrawer).restoredParentContext).toEqual(parentCtx);

      // Résolution du danger réactive le classement
      const resolved = resolveSegmentHazard({
        segment: rep2.updatedSegment,
        reports: [rep1.report!, rep2.report!],
        efforts: rep2.updatedEfforts,
      });
      expect(resolved.updatedSegment.hazardous).toBe(false);
      expect(resolved.evaluation.leaderboardEnabled).toBe(true);
      expect(resolved.updatedEfforts[0].eligibleForPublicLeaderboard).toBe(true);
    });
  });

  describe('S4.07 — Historique d’efforts, records personnels (PR), ex æquo, P01 et comparaison point par point', () => {
    it('calcule les PR personnels, recalcule le PR si un record est invalidé, gère les ex æquo et exclut les activités privées du classement public', () => {
      const segment = createFixtureSegment({ id: 'seg-history-1' });

      const makeRun = (
        activityId: string,
        userId: string,
        stepSeconds: number,
        startIso: string,
        visibility: ActivityTraceForSegments['visibility'] = 'public',
        heartRateStartBpm: number | null = 150
      ) => {
        const pts = buildLinearNorthTrack({
          steps: 10,
          stepSeconds,
          startIso,
          heartRateStartBpm,
        });
        const [eff] = matchActivityToSegment(
          {
            activityId,
            activityVersion: 1,
            userId,
            sport: 'running',
            points: pts,
            visibility,
          },
          segment
        );
        return { eff, pts };
      };

      const runSlow = makeRun('act-1', 'user-alice', 16, '2026-11-01T08:00:00.000Z', 'public', 148); // 160s
      const runMedium = makeRun('act-2', 'user-alice', 14, '2026-11-05T08:00:00.000Z', 'private', 155); // 140s (privé !)
      const runFast = makeRun('act-3', 'user-alice', 12, '2026-11-10T08:00:00.000Z', 'public', 165); // 120s (PR #1)
      const bobTied = makeRun('act-bob', 'user-bob', 12, '2026-11-11T08:00:00.000Z', 'public', null); // 120s (ex æquo avec Alice)
      const charlieThird = makeRun('act-charlie', 'user-charlie', 15, '2026-11-12T08:00:00.000Z', 'public', 150); // 150s

      const allEfforts = [
        runSlow.eff,
        runMedium.eff,
        runFast.eff,
        bobTied.eff,
        charlieThird.eff,
      ];

      // 1. Historique personnel d'Alice : inclut ses efforts publics ET privés
      const aliceHistory = buildPersonalEffortHistory(allEfforts, segment.id, 'user-alice');
      expect(aliceHistory.totalValidEfforts).toBe(3);
      expect(aliceHistory.bestEffort?.effortId).toBe(runFast.eff.effortId);
      expect(aliceHistory.bestEffort?.isPersonalRecord).toBe(true);
      expect(aliceHistory.bestEffort?.personalRank).toBe(1);
      expect(aliceHistory.improvementFromFirstS).toBe(40); // 160s -> 120s = +40s d'amélioration

      // 2. Si le PR #1 (120s) est exclu/retiré, le second meilleur effort (140s) devient automatiquement PR #1
      const afterExclusion = buildPersonalEffortHistory(
        allEfforts.map((e) =>
          e.effortId === runFast.eff.effortId
            ? { ...e, status: 'excluded' as const, exclusionReasons: ['gps_jump_or_teleport' as const] }
            : e
        ),
        segment.id,
        'user-alice'
      );
      expect(afterExclusion.bestEffort?.effortId).toBe(runMedium.eff.effortId);
      expect(afterExclusion.bestEffort?.personalRank).toBe(1);
      expect(afterExclusion.bestEffort?.isPersonalRecord).toBe(true);

      // 3. Classement communautaire public :
      // - Alice (120s) et Bob (120s) sont ex æquo au rang 1 (rank = 1, denseRank = 1)
      // - Charlie (150s) est au rang sportif 3 (rank = 3, denseRank = 2)
      // - Si l'effort public de 120s d'Alice n'existait pas, son effort privé de 140s ne fuiterait JAMAIS
      //   et seul son effort public de 160s apparaîtrait !
      const lbWithTies = buildSegmentLeaderboard({
        segment,
        efforts: allEfforts,
        viewerUserId: 'user-bob',
        scope: 'community',
      });
      expect(lbWithTies.entries).toHaveLength(3);
      expect(lbWithTies.entries[0].userId).toBe('user-alice');
      expect(lbWithTies.entries[0].rank).toBe(1);
      expect(lbWithTies.entries[0].denseRank).toBe(1);
      expect(lbWithTies.entries[1].userId).toBe('user-bob');
      expect(lbWithTies.entries[1].rank).toBe(1);
      expect(lbWithTies.entries[1].denseRank).toBe(1);
      expect(lbWithTies.entries[2].userId).toBe('user-charlie');
      expect(lbWithTies.entries[2].rank).toBe(3);
      expect(lbWithTies.entries[2].denseRank).toBe(2);

      // Vérifie que l'activité privée d'Alice (140s) ne fuite jamais au classement public
      const lbWithoutFastPublic = buildSegmentLeaderboard({
        segment,
        efforts: [runSlow.eff, runMedium.eff, bobTied.eff],
        viewerUserId: 'user-bob',
        scope: 'community',
      });
      const alicePublicEntry = lbWithoutFastPublic.entries.find((e) => e.userId === 'user-alice')!;
      expect(alicePublicEntry.elapsedDurationS).toBe(160);

      // 4. Comparaison point par point entre deux passages (S4.07)
      const comparison = compareSegmentEfforts({
        segment,
        candidateEffort: runFast.eff, // 120s
        referenceEffort: runSlow.eff, // 160s
        candidateTrackPoints: runFast.pts,
        referenceTrackPoints: runSlow.pts,
        stepsCount: 11,
      });
      expect(comparison.candidateFaster).toBe(true);
      expect(comparison.totalDeltaTimeS).toBe(-40);
      expect(comparison.maxLeadS).toBe(40);
      expect(comparison.samples).toHaveLength(11);
      // Au départ (0%), l'écart est 0s ; à 50%, le candidat a ~20s d'avance (-20s) ; à 100%, -40s
      expect(comparison.samples[0].deltaTimeS).toBe(0);
      expect(comparison.samples[5].deltaTimeS).toBeCloseTo(-20, 0);
      expect(comparison.samples[10].deltaTimeS).toBe(-40);
      // Capteur cardio présent sur les deux traces, puissance absente (null, jamais inventée)
      expect(comparison.samples[5].candidateHeartRateBpm).not.toBeNull();
      expect(comparison.samples[5].candidatePowerW).toBeNull();

      // Sous-drawer de comparaison avec restauration du contexte parent
      const parentCtx: DrawerParentContext = {
        drawerId: 'drawer-my-efforts',
        view: 'my_efforts',
        scrollOffsetPx: 180,
        selectedSegmentId: segment.id,
      };
      const compDrawer = openEffortComparisonDrawer({
        segmentId: segment.id,
        candidateEffortId: runFast.eff.effortId,
        referenceEffortId: runSlow.eff.effortId,
        parentContext: parentCtx,
      });
      expect(compDrawer.isOpen).toBe(true);
      expect(closeEffortComparisonDrawer(compDrawer).restoredParentContext).toEqual(parentCtx);
    });
  });
});
