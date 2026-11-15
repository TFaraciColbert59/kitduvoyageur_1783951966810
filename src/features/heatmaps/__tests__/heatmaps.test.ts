import { describe, expect, it } from 'vitest';
import {
  ABSOLUTE_MIN_PUBLIC_CONTRIBUTORS,
  HEATMAP_EXCLUSION_REASONS,
  HeatmapAggregateStore,
  MIN_HEATMAP_CONTRIBUTORS,
  buildCommunityHeatmapLayer,
  buildPersonalHeatmapLayer,
  comparePersonalHeatmaps,
  computeSolarWindow,
  createDefaultContributionPreferences,
  createInitialHeatmapDrawerState,
  evaluateActivityPublicEligibility,
  isNocturnalTimestamp,
  isScopeConsented,
  optOutFromGlobalHeatmap,
  quantizePointToCell,
  reduceHeatmapDrawerState,
   sanitizeTracePointsForPublic,
  updateAggregateContributionPreferences,
  type AggregateContributionPreferences,
  type HeatmapActivityRecord,
  type Sport,
  type UserPrivacyZone,
} from '../index';

const NOW_ISO = '2026-06-15T12:00:00.000Z';

function makeConsentedPrefs(
  userId: string,
  overrides: Partial<AggregateContributionPreferences> = {}
): AggregateContributionPreferences {
  return {
    userId,
    globalHeatmapOptOut: false,
    globalHeatmap: true,
    routeRecommendations: true,
    mobilityAggregates: true,
    updatedAt: NOW_ISO,
    revision: 1,
    ...overrides,
  };
}

function makeActivity(
  activityId: string,
  userId: string,
  overrides: Partial<HeatmapActivityRecord> = {}
): HeatmapActivityRecord {
  return {
    activityId,
    userId,
    sport: 'trail',
    visibility: 'collective_anonymized',
    startedAt: '2026-06-10T09:00:00.000Z',
    endedAt: '2026-06-10T11:00:00.000Z',
    sessionFinished: true,
    points: [
      { lat: 45.832621, lng: 6.865172, timestamp: '2026-06-10T09:15:00.000Z' },
      { lat: 45.832789, lng: 6.865319, timestamp: '2026-06-10T09:20:00.000Z' },
    ],
    ...overrides,
  };
}

describe('Lot C02 — Heatmaps & Agrégats géographiques (K3.07..S6.17)', () => {
  describe('K7.06 & S6.17 — Consentement granulaire et Opt-out strict fail-closed', () => {
    it('crée des préférences par défaut en mode fail-closed (aucune contribution publique)', () => {
      const defaults = createDefaultContributionPreferences('user-1', NOW_ISO);
      expect(defaults.globalHeatmapOptOut).toBe(true);
      expect(defaults.globalHeatmap).toBe(false);
      expect(defaults.routeRecommendations).toBe(false);
      expect(defaults.mobilityAggregates).toBe(false);

      expect(isScopeConsented(defaults, 'global_heatmap')).toBe(false);
      expect(isScopeConsented(defaults, 'route_recommendations')).toBe(false);
      expect(isScopeConsented(defaults, 'mobility_aggregates')).toBe(false);
      expect(isScopeConsented(null, 'global_heatmap')).toBe(false);
      expect(isScopeConsented(undefined, 'global_heatmap')).toBe(false);
    });

    it('distingue le consentement pour heatmaps, parcours et données de mobilité (S6.17)', () => {
      const initial = createDefaultContributionPreferences('user-s617', NOW_ISO);
      const updated = updateAggregateContributionPreferences(initial, {
        globalHeatmapOptOut: false,
        globalHeatmap: true,
        routeRecommendations: true,
        mobilityAggregates: false,
        now: '2026-06-15T12:05:00.000Z',
      });

      expect(isScopeConsented(updated, 'global_heatmap')).toBe(true);
      expect(isScopeConsented(updated, 'route_recommendations')).toBe(true);
      expect(isScopeConsented(updated, 'mobility_aggregates')).toBe(false);
      expect(updated.revision).toBe(2);

      // L'utilisateur fait ensuite opt-out uniquement de la heatmap mondiale (K7.06)
      const afterOptOut = optOutFromGlobalHeatmap(updated, {
        revokeAllAggregates: false,
        now: '2026-06-15T12:10:00.000Z',
      });
      expect(afterOptOut.globalHeatmapOptOut).toBe(true);
      expect(afterOptOut.globalHeatmap).toBe(false);
      expect(isScopeConsented(afterOptOut, 'global_heatmap')).toBe(false);
      // Les recommandations de parcours restent actives comme choisi dans S6.17
      expect(isScopeConsented(afterOptOut, 'route_recommendations')).toBe(true);
      expect(isScopeConsented(afterOptOut, 'mobility_aggregates')).toBe(false);
    });

    it('donne toujours priorité à globalHeatmapOptOut=true en cas de conflit (fail-closed K7.06)', () => {
      const inconsistent: AggregateContributionPreferences = {
        userId: 'user-conflict',
        globalHeatmapOptOut: true,
        globalHeatmap: true, // état incohérent forcé
        routeRecommendations: true,
        mobilityAggregates: true,
        updatedAt: NOW_ISO,
        revision: 1,
      };
      expect(isScopeConsented(inconsistent, 'global_heatmap')).toBe(false);

      const activity = makeActivity('act-1', 'user-conflict');
      const eligibility = evaluateActivityPublicEligibility(activity, inconsistent);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reasons).toContain(HEATMAP_EXCLUSION_REASONS.globalHeatmapOptOut);
    });

    it('rejette toute activité privée, followers_only, supprimée, non terminée ou exclue unitairement', () => {
      const prefs = makeConsentedPrefs('user-1');

      expect(
        evaluateActivityPublicEligibility(
          makeActivity('a-priv', 'user-1', { visibility: 'private' }),
          prefs
        ).reasons
      ).toContain(HEATMAP_EXCLUSION_REASONS.privateVisibility);

      expect(
        evaluateActivityPublicEligibility(
          makeActivity('a-fol', 'user-1', { visibility: 'followers_only' }),
          prefs
        ).reasons
      ).toContain(HEATMAP_EXCLUSION_REASONS.privateVisibility);

      expect(
        evaluateActivityPublicEligibility(
          makeActivity('a-del', 'user-1', { deletedAt: '2026-06-12T00:00:00Z' }),
          prefs
        ).reasons
      ).toContain(HEATMAP_EXCLUSION_REASONS.activityDeleted);

      expect(
        evaluateActivityPublicEligibility(
          makeActivity('a-unfinished', 'user-1', { sessionFinished: false }),
          prefs
        ).reasons
      ).toContain(HEATMAP_EXCLUSION_REASONS.sessionNotFinished);

      expect(
        evaluateActivityPublicEligibility(
          makeActivity('a-optout', 'user-1', { excludeFromHeatmap: true }),
          prefs
        ).reasons
      ).toContain(HEATMAP_EXCLUSION_REASONS.activityOptOut);
    });
  });

  describe('K7.05 & S6.14 — Exclusion géométrique des zones masquées (début, milieu, fin)', () => {
    const tracePoints = [
      { lat: 45.8001, lng: 6.8001, timestamp: '2026-06-10T08:00:00Z' }, // Départ (domicile)
      { lat: 45.815, lng: 6.815, timestamp: '2026-06-10T08:30:00Z' }, // Milieu (zone sensible)
      { lat: 45.83, lng: 6.83, timestamp: '2026-06-10T09:00:00Z' }, // Segment public libre
      { lat: 45.845, lng: 6.845, timestamp: '2026-06-10T09:30:00Z' }, // Arrivée
    ];

    it('masque les points coupés par une zone circulaire, bbox ou polygonale au début, milieu et fin', () => {
      const zones: UserPrivacyZone[] = [
        {
          id: 'zone-start-circle',
          userId: 'u1',
          active: true,
          geometry: {
            kind: 'circle',
            centerLat: 45.8,
            centerLng: 6.8,
            radiusM: 300,
          },
        },
        {
          id: 'zone-mid-bbox',
          userId: 'u1',
          active: true,
          geometry: {
            kind: 'bbox',
            minLat: 45.814,
            minLng: 6.814,
            maxLat: 45.816,
            maxLng: 6.816,
          },
        },
        {
          id: 'zone-end-poly',
          userId: 'u1',
          active: true,
          geometry: {
            kind: 'polygon',
            ring: [
              [45.844, 6.844],
              [45.846, 6.844],
              [45.846, 6.846],
              [45.844, 6.846],
            ],
          },
        },
      ];

      const res = sanitizeTracePointsForPublic(tracePoints, zones);
      expect(res.maskedPointCount).toBe(3);
      expect(res.keptPoints).toHaveLength(1);
      expect(res.keptPoints[0].lat).toBe(45.83);
    });

    it('applique le masquage S6.14 de début/fin en mètres (trimStartM, trimEndM) et hideEntireTrace', () => {
      const trimmed = sanitizeTracePointsForPublic(tracePoints, [], {
        trimStartM: 500,
        trimEndM: 500,
      });
      // Le premier et le dernier point sont à 0m du départ/arrivée -> exclus
      expect(trimmed.keptPoints.map((p) => p.lat)).toEqual([45.815, 45.83]);
      expect(trimmed.maskedPointCount).toBe(2);

      const hiddenAll = sanitizeTracePointsForPublic(tracePoints, [], {
        hideEntireTrace: true,
      });
      expect(hiddenAll.keptPoints).toHaveLength(0);
      expect(hiddenAll.maskedPointCount).toBe(4);
    });
  });

  describe('K3.07 & S3.16 — Heatmap communautaire/globale, k-anonymat et non-reconstructibilité', () => {
    it('supprime toute cellule sous le seuil de k-anonymat (zone peu fréquentée) et ne divulgue aucune coordonnée brute', () => {
      const consents = [1, 2, 3, 4, 5, 6].map((i) => makeConsentedPrefs(`user-${i}`));

      // Cellule dense (Chamonix) : 5 contributeurs distincts en 'trail' -> publiée
      // Cellule rare (Vallorcine) : 4 contributeurs seulement -> supprimée (< 5)
      const activities: HeatmapActivityRecord[] = [
        ...[1, 2, 3, 4, 5].map((i) =>
          makeActivity(`dense-${i}`, `user-${i}`, {
            sport: 'trail',
            points: [
              {
                // Coordonnées brutes légèrement différentes à l'intérieur de la même cellule 0.001°
                lat: 45.92311 + i * 0.00005,
                lng: 6.86911 + i * 0.00004,
                timestamp: '2026-06-10T10:00:00.000Z',
              },
            ],
          })
        ),
        ...[1, 2, 3, 4].map((i) =>
          makeActivity(`sparse-${i}`, `user-${i}`, {
            sport: 'trail',
            points: [
              {
                lat: 46.03421,
                lng: 6.93214,
                timestamp: '2026-06-10T10:00:00.000Z',
              },
            ],
          })
        ),
      ];

      const layer = buildCommunityHeatmapLayer(activities, {
        sport: 'trail',
        timeWindow: 'global',
        consents,
        now: NOW_ISO,
      });

      expect(layer.minContributors).toBe(MIN_HEATMAP_CONTRIBUTORS);
      expect(layer.cells).toHaveLength(1);
      expect(layer.suppressedCellCount).toBe(1);

      const publishedCell = layer.cells[0];
      expect(publishedCell.distinctContributorCount).toBe(5);
      expect(publishedCell.passageCount).toBe(5);

      // Invariant de non-reconstructibilité : le centre de la cellule est le centroïde
      // de la grille (45.9235, 6.8695), jamais l'une des coordonnées brutes individuelles !
      const expectedGrid = quantizePointToCell(45.92316, 6.86915, 0.001)!;
      expect(publishedCell.cellCenterLat).toBe(expectedGrid.cellCenterLat);
      expect(publishedCell.cellCenterLng).toBe(expectedGrid.cellCenterLng);
      expect(JSON.stringify(layer)).not.toContain('user-1');
      expect(JSON.stringify(layer)).not.toContain('dense-1');
      expect(JSON.stringify(layer)).not.toContain('45.92316');
    });

    it('empêche un utilisateur unique passant 10 fois dans une cellule de contourner le k-anonymat', () => {
      const consents = [makeConsentedPrefs('solo-user')];
      const activities = Array.from({ length: 10 }, (_, idx) =>
        makeActivity(`loop-${idx}`, 'solo-user', {
          sport: 'course',
          points: [{ lat: 45.9234, lng: 6.8694, timestamp: '2026-06-10T10:00:00.000Z' }],
        })
      );

      const layer = buildCommunityHeatmapLayer(activities, {
        sport: 'course',
        consents,
        minContributors: 1, // tente de baisser sous le plancher de sécurité
        now: NOW_ISO,
      });

      // Le plancher absolu ABSOLUTE_MIN_PUBLIC_CONTRIBUTORS (3) est appliqué
      expect(layer.minContributors).toBe(ABSOLUTE_MIN_PUBLIC_CONTRIBUTORS);
      expect(layer.cells).toHaveLength(0);
      expect(layer.suppressedCellCount).toBe(1);
    });

    it('filtre strictement les agrégats communautaires par sport (K3.07)', () => {
      const users = [1, 2, 3, 4, 5];
      const consents = users.map((i) => makeConsentedPrefs(`u-${i}`));

      const trailActivities = users.map((i) =>
        makeActivity(`trail-${i}`, `u-${i}`, {
          sport: 'trail',
          points: [{ lat: 45.8505, lng: 6.8505, timestamp: '2026-06-10T10:00:00Z' }],
        })
      );
      const veloActivities = users.map((i) =>
        makeActivity(`velo-${i}`, `u-${i}`, {
          sport: 'velo',
          points: [{ lat: 45.7505, lng: 6.7505, timestamp: '2026-06-10T10:00:00Z' }],
        })
      );

      const allActivities = [...trailActivities, ...veloActivities];

      const trailLayer = buildCommunityHeatmapLayer(allActivities, {
        sport: 'trail',
        consents,
        now: NOW_ISO,
      });
      expect(trailLayer.cells).toHaveLength(1);
      expect(trailLayer.cells[0].cellCenterLat).toBeCloseTo(45.8505, 4);

      const veloLayer = buildCommunityHeatmapLayer(allActivities, {
        sport: 'velo',
        consents,
        now: NOW_ISO,
      });
      expect(veloLayer.cells).toHaveLength(1);
      expect(veloLayer.cells[0].cellCenterLat).toBeCloseTo(45.7505, 4);
    });
  });

  describe('S3.17 — Heatmap des sept derniers jours et révocation avec cache chaud', () => {
    it('inclut une activité de 6 jours, exclut une activité de 8 jours, puis supprime la cellule à la révocation du 5e contributeur', () => {
      const users = [1, 2, 3, 4, 5, 6];
      const consents = users.map((i) => makeConsentedPrefs(`u-${i}`));

      // 5 utilisateurs il y a 6 jours (dans la fenêtre de 7j) dans la cellule A
      const sixDaysAgoIso = '2026-06-09T12:00:00.000Z';
      // 5 utilisateurs il y a 8 jours (hors de la fenêtre de 7j) dans la cellule B
      const eightDaysAgoIso = '2026-06-07T11:59:00.000Z';

      const activities: HeatmapActivityRecord[] = [
        ...[1, 2, 3, 4, 5].map((i) =>
          makeActivity(`act-6d-${i}`, `u-${i}`, {
            sport: 'course',
            startedAt: sixDaysAgoIso,
            points: [{ lat: 45.9005, lng: 6.9005, timestamp: sixDaysAgoIso }],
          })
        ),
        ...[1, 2, 3, 4, 5].map((i) =>
          makeActivity(`act-8d-${i}`, `u-${i}`, {
            sport: 'course',
            startedAt: eightDaysAgoIso,
            points: [{ lat: 45.8005, lng: 6.8005, timestamp: eightDaysAgoIso }],
          })
        ),
      ];

      const store = new HeatmapAggregateStore({ activities, consents });

      // 1. La couche 'last_7_days' ne contient que la cellule de 6 jours (celle de 8 jours est exclue)
      const firstFetch = store.getCommunityLayer({
        sport: 'course',
        timeWindow: 'last_7_days',
        now: NOW_ISO,
      });
      expect(firstFetch.fromCache).toBe(false);
      expect(firstFetch.layer.cells).toHaveLength(1);
      const recentCellId = firstFetch.layer.cells[0].cellId;
      expect(firstFetch.layer.cells[0].cellCenterLat).toBeCloseTo(45.9005, 4);

      // 2. Lecture depuis le cache chaud
      const cachedFetch = store.getCommunityLayer({
        sport: 'course',
        timeWindow: 'last_7_days',
        now: NOW_ISO,
      });
      expect(cachedFetch.fromCache).toBe(true);

      // 3. Révocation de la contribution du 5e utilisateur (K7.06 / S3.17)
      const proof = store.revokeUserHeatmapContribution('u-5', {
        now: '2026-06-15T12:30:00.000Z',
      });
      expect(proof.reason).toBe('user_opt_out');
      expect(proof.invalidatedCacheKeys.length).toBeGreaterThan(0);
      expect(proof.removedCellIds).toContain(recentCellId);

      // 4. Après révocation, la cellule (tombée à 4 contributeurs < 5) a disparu
      const afterRevoke = store.getCommunityLayer({
        sport: 'course',
        timeWindow: 'last_7_days',
        now: '2026-06-15T12:30:00.000Z',
      });
      expect(afterRevoke.fromCache).toBe(false);
      expect(afterRevoke.layer.cells).toHaveLength(0);
    });
  });

  describe('S3.18 — Heatmap nocturne (entre coucher et lever du soleil)', () => {
    it('isole uniquement les passages effectués entre le coucher et le lever du soleil', () => {
      // À Chamonix (45.92°N, 6.87°E) le 15 juin :
      // Lever du soleil ~03:45 UTC (05:45 CEST), coucher ~19:25 UTC (21:25 CEST)
      const solar = computeSolarWindow(45.92, 6.87, new Date('2026-06-15T12:00:00Z'));
      expect(solar.polarDay).toBe(false);
      expect(solar.polarNight).toBe(false);
      expect(solar.sunriseUtcMinutes).not.toBeNull();
      expect(solar.sunsetUtcMinutes).not.toBeNull();

      // 23:00 UTC est en pleine nuit, 12:00 UTC est en plein jour
      expect(isNocturnalTimestamp('2026-06-10T23:00:00.000Z', 45.92, 6.87)).toBe(true);
      expect(isNocturnalTimestamp('2026-06-10T01:30:00.000Z', 45.92, 6.87)).toBe(true);
      expect(isNocturnalTimestamp('2026-06-10T12:00:00.000Z', 45.92, 6.87)).toBe(false);

      const users = [1, 2, 3, 4, 5];
      const consents = users.map((i) => makeConsentedPrefs(`u-${i}`));

      const activities = users.map((i) =>
        makeActivity(`mixed-day-night-${i}`, `u-${i}`, {
          sport: 'trail',
          startedAt: '2026-06-10T12:00:00.000Z',
          points: [
            // Point de jour (12h00 UTC) -> doit être exclu de la heatmap nocturne
            { lat: 45.9105, lng: 6.8605, timestamp: '2026-06-10T12:00:00.000Z' },
            // Point de nuit (23h15 UTC, bivouac/approche nocturne) -> doit être retenu
            { lat: 45.9505, lng: 6.8905, timestamp: '2026-06-10T23:15:00.000Z' },
          ],
        })
      );

      const nocturnalLayer = buildCommunityHeatmapLayer(activities, {
        sport: 'trail',
        timeWindow: 'nocturnal',
        consents,
        now: NOW_ISO,
      });

      expect(nocturnalLayer.cells).toHaveLength(1);
      expect(nocturnalLayer.cells[0].cellCenterLat).toBeCloseTo(45.9505, 4);
      expect(nocturnalLayer.cells[0].cellCenterLng).toBeCloseTo(6.8905, 4);
    });
  });

  describe('K3.08 & S3.19 — Heatmap personnelle privée par sport, période et comparaison', () => {
    const ownerActivities: HeatmapActivityRecord[] = [
      makeActivity('owner-trail-may', 'owner-1', {
        sport: 'trail',
        visibility: 'private', // sortie privée incluse dans la heatmap personnelle du propriétaire
        startedAt: '2026-05-01T08:00:00.000Z',
        points: [
          { lat: 45.8105, lng: 6.8105, timestamp: '2026-05-01T08:10:00.000Z' },
          { lat: 45.8205, lng: 6.8205, timestamp: '2026-05-01T08:30:00.000Z' },
        ],
      }),
      makeActivity('owner-trail-june', 'owner-1', {
        sport: 'trail',
        visibility: 'collective_anonymized',
        startedAt: '2026-06-12T08:00:00.000Z',
        points: [
          { lat: 45.8205, lng: 6.8205, timestamp: '2026-06-12T08:10:00.000Z' }, // récurrente
          { lat: 45.8305, lng: 6.8305, timestamp: '2026-06-12T08:30:00.000Z' }, // nouvelle en juin
        ],
      }),
      makeActivity('owner-velo-june', 'owner-1', {
        sport: 'velo',
        visibility: 'private',
        startedAt: '2026-06-13T08:00:00.000Z',
        points: [{ lat: 45.7005, lng: 6.7005, timestamp: '2026-06-13T08:10:00.000Z' }],
      }),
      makeActivity('other-user-act', 'intruder-2', {
        sport: 'trail',
        visibility: 'public',
        startedAt: '2026-06-12T08:00:00.000Z',
        points: [{ lat: 45.9905, lng: 6.9905, timestamp: '2026-06-12T08:10:00.000Z' }],
      }),
    ];

    it('bloque tout accès tiers (viewerUserId !== ownerUserId) en mode fail-closed', () => {
      const deniedThirdParty = buildPersonalHeatmapLayer(ownerActivities, {
        ownerUserId: 'owner-1',
        viewerUserId: 'intruder-2',
        now: NOW_ISO,
      });
      expect(deniedThirdParty.authorized).toBe(false);
      expect(deniedThirdParty.reason).toBe('viewer_is_not_owner');
      expect(deniedThirdParty.layer).toBeNull();

      const deniedAnonymous = buildPersonalHeatmapLayer(ownerActivities, {
        ownerUserId: 'owner-1',
        viewerUserId: '',
        now: NOW_ISO,
      });
      expect(deniedAnonymous.authorized).toBe(false);
      expect(deniedAnonymous.reason).toBe('missing_user_id');
    });

    it('filtre la heatmap personnelle par sport (K3.08) et compare deux périodes (S3.19)', () => {
      // Filtre sport = 'velo' uniquement
      const veloPersonal = buildPersonalHeatmapLayer(ownerActivities, {
        ownerUserId: 'owner-1',
        viewerUserId: 'owner-1',
        sport: 'velo',
        now: NOW_ISO,
      });
      expect(veloPersonal.authorized).toBe(true);
      expect(veloPersonal.layer!.activityCount).toBe(1);
      expect(veloPersonal.layer!.cells).toHaveLength(1);
      expect(veloPersonal.layer!.cells[0].sports).toEqual(['velo' satisfies Sport]);

      // Comparaison S3.19 en 'trail' : Mai 2026 (baseline) vs 7 derniers jours en Juin 2026 (target)
      const mayLayer = buildPersonalHeatmapLayer(ownerActivities, {
        ownerUserId: 'owner-1',
        viewerUserId: 'owner-1',
        sport: 'trail',
        period: {
          kind: 'custom',
          fromIso: '2026-05-01T00:00:00.000Z',
          toIso: '2026-05-31T23:59:59.000Z',
        },
        now: NOW_ISO,
      }).layer!;

      const juneRecentLayer = buildPersonalHeatmapLayer(ownerActivities, {
        ownerUserId: 'owner-1',
        viewerUserId: 'owner-1',
        sport: 'trail',
        period: { kind: 'last_7_days' },
        now: NOW_ISO,
      }).layer!;

      const comparison = comparePersonalHeatmaps(mayLayer, juneRecentLayer);
      expect(comparison).not.toBeNull();
      expect(comparison!.newlyExploredCells).toHaveLength(1);
      expect(comparison!.newlyExploredCells[0].cellCenterLat).toBeCloseTo(45.8305, 4);
      expect(comparison!.recurringCells).toHaveLength(1);
      expect(comparison!.recurringCells[0].cellCenterLat).toBeCloseTo(45.8205, 4);
      expect(comparison!.unvisitedBaselineCells).toHaveLength(1);
      expect(comparison!.unvisitedBaselineCells[0].cellCenterLat).toBeCloseTo(45.8105, 4);
    });
  });

  describe('Parcours UX Sous-drawer — Ouverture explicite, conservation des choix et restauration du parent', () => {
    it('ouvre le sous-drawer sur action explicite, conserve les filtres et restaure le contexte parent au retour', () => {
      let state = createInitialHeatmapDrawerState();
      expect(state.activeSubDrawer).toBe('closed');

      const parentContext = {
        parentSheet: 'layers',
        parentDetent: 'mid' as const,
        parentTab: 2,
        scrollOffsetPx: 140,
      };

      state = reduceHeatmapDrawerState(state, {
        type: 'OPEN_SUB_DRAWER',
        subDrawer: 'personal_heatmap',
        parentContext,
      });
      expect(state.activeSubDrawer).toBe('personal_heatmap');
      expect(state.savedParentContext).toEqual(parentContext);

      state = reduceHeatmapDrawerState(state, {
        type: 'SET_PERSONAL_FILTER',
        enabled: true,
        sport: 'ski',
        period: { kind: 'last_90_days' },
      });

      state = reduceHeatmapDrawerState(state, {
        type: 'BACK_TO_PARENT_DRAWER',
      });
      expect(state.activeSubDrawer).toBe('closed');
      expect(state.lastRestoredParentContext).toEqual(parentContext);
      // Le choix de sport et de période est conservé après le retour au drawer parent (K3.08, S3.19)
      expect(state.personalSelection.sport).toBe('ski');
      expect(state.personalSelection.period.kind).toBe('last_90_days');
      expect(state.personalSelection.enabled).toBe(true);
    });
  });
});
