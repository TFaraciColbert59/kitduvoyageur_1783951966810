import { describe, expect, it, vi } from 'vitest';
import {
  AudioGuidanceController,
  LockScreenBridgeController,
  NavigationSessionController,
  RerouteController,
  ScreenWakeLockController,
  WaypointAlertController,
  buildAccessGuidancePlan,
  buildEffortAnnouncementText,
  buildExternalNavigationLinks,
  buildLockScreenNavigationPayload,
  closeOrientationSubDrawer,
  compensateDirectionForScreen,
  computeUpcomingWaypoints,
  createDefaultAudioPreferences,
  createInitialDisplayPreferences,
  createInitialOrientationState,
  createInitialTurnByTurnState,
  detectClimbDescentSegments,
  detectReverseDirection,
  evaluateClimbDescentCard,
  evaluateCustomFieldValues,
  evaluateDepartureState,
  evaluateTurnByTurn,
  extractRouteManeuvers,
  findForwardJunctionPoint,
  formatNavigationDistance,
  formatNavigationElevation,
  formatNavigationPaceFromSpeed,
  formatNavigationSpeed,
  markUserMapPan,
  openOrientationSubDrawer,
  projectPositionOnRoute,
  projectWaypointsOnRoute,
  recenterNavigationCamera,
  resolveNavigationZoom,
  setMapOrientationMode,
  swapRouteDuringRecording,
  updateCustomFields,
  updateOrientationFromMovement,
  type ActiveRecordingSnapshot,
  type ElevationPoint,
  type LngLat,
  type LockScreenNativeBridgeAdapter,
  type LockScreenNavigationPayload,
  type NavigationWaypointInput,
  type RerouteProviderAdapter,
  type RouteLine,
  type SpeechSynthesisAdapter,
  type WakeLockAdapter,
} from '../index';

/**
 * Trace synthétique en L (Chamonix) :
 * - Segment 1 : ~556 m plein Nord de [6.869, 45.920] à [6.869, 45.925]
 * - Virage à 90° à droite (Est) au sommet [6.869, 45.925]
 * - Segment 2 : ~540 m plein Est de [6.869, 45.925] à [6.876, 45.925]
 */
const L_SHAPED_ROUTE: RouteLine = [
  [6.869, 45.92],
  [6.869, 45.9225],
  [6.869, 45.925],
  [6.8725, 45.925],
  [6.876, 45.925],
];

const L_SHAPED_GEOJSON = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: L_SHAPED_ROUTE,
  },
  properties: {},
};

function makeBaseRecording(overrides: Partial<ActiveRecordingSnapshot> = {}): ActiveRecordingSnapshot {
  return {
    sessionId: 'srv-session-101',
    clientSessionId: 'client-uuid-101',
    sport: 'rando',
    startedAt: 1_700_000_000_000,
    paused: false,
    autoPaused: false,
    distanceM: 420,
    elevGainM: 38,
    movingS: 300,
    splits: [{ kind: 'km', index: 1, distanceM: 420, movingS: 300, completed: false }],
    mileSplits: [{ kind: 'mi', index: 1, distanceM: 420, movingS: 300, completed: false }],
    laps: [{ kind: 'lap', index: 1, distanceM: 420, movingS: 300, completed: false }],
    ...overrides,
  };
}

describe('Lot N01 — Guidage, Navigation, Recalcul, Alertes, Champs & Live Activities', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // K4.02 & S3.11 — Guidage vocal virage par virage (y compris hors ligne)
  // ───────────────────────────────────────────────────────────────────────────
  describe('K4.02 & S3.11 · Navigation vocale virage par virage et résilience hors ligne', () => {
    it('extrait les manœuvres (départ, virage à droite, arrivée) et annonce le virage en mode avion', () => {
      const maneuvers = extractRouteManeuvers(L_SHAPED_GEOJSON);
      expect(maneuvers.length).toBe(3);
      expect(maneuvers[0].kind).toBe('depart');
      expect(maneuvers[1].kind).toBe('turn-right');
      expect(maneuvers[1].alongTrackM).toBeGreaterThan(540);
      expect(maneuvers[1].alongTrackM).toBeLessThan(570);
      expect(maneuvers[2].kind).toBe('arrive');

      let state = createInitialTurnByTurnState([L_SHAPED_ROUTE]);
      expect(state.offlineReady).toBe(true);
      expect(state.nextManeuver?.kind).toBe('turn-right');

      // Approche à ~60 m du virage ([6.869, 45.92446]) -> palier 'approaching', annonce vocale déclenchée
      state = evaluateTurnByTurn([6.869, 45.92446], [L_SHAPED_ROUTE], state, {
        units: 'metric',
      });
      expect(state.stage).toBe('approaching');
      expect(state.shouldSpeak).toBe(true);
      expect(state.spokenInstruction).toContain('tourner à droite');

      // Fix suivant au même palier -> pas de répétition vocale (anti-bégaiement)
      state = evaluateTurnByTurn([6.869, 45.92455], [L_SHAPED_ROUTE], state, {
        units: 'metric',
      });
      expect(state.stage).toBe('approaching');
      expect(state.shouldSpeak).toBe(false);

      // Arrivée à 10 m du virage ([6.869, 45.92491]) -> palier 'imminent', nouvelle annonce immédiate
      state = evaluateTurnByTurn([6.869, 45.92491], [L_SHAPED_ROUTE], state, {
        units: 'metric',
      });
      expect(state.stage).toBe('imminent');
      expect(state.shouldSpeak).toBe(true);
      expect(state.spokenInstruction).toBe('Tourner à droite maintenant.');

      // Après le virage ([6.871, 45.925]) -> bascule sur la manœuvre suivante ('arrive')
      state = evaluateTurnByTurn([6.871, 45.925], [L_SHAPED_ROUTE], state, {
        units: 'metric',
      });
      expect(state.nextManeuver?.kind).toBe('arrive');
    });

    it('détecte le déplacement en sens inverse sur le tracé sans faux positif stationnaire', () => {
      expect(
        detectReverseDirection([
          { alongTrackM: 300, crossTrackM: 4 },
          { alongTrackM: 299, crossTrackM: 5 },
          { alongTrackM: 300.5, crossTrackM: 4 },
        ]),
      ).toBe(false);

      expect(
        detectReverseDirection([
          { alongTrackM: 400, crossTrackM: 5 },
          { alongTrackM: 375, crossTrackM: 6 },
          { alongTrackM: 345, crossTrackM: 5 },
        ]),
      ).toBe(true);

      const initial = createInitialTurnByTurnState([L_SHAPED_ROUTE]);
      const reversed = evaluateTurnByTurn([6.869, 45.921], [L_SHAPED_ROUTE], initial, {
        alongHistory: [
          { alongTrackM: 250, crossTrackM: 3 },
          { alongTrackM: 180, crossTrackM: 4 },
        ],
      });
      expect(reversed.reverseDirection).toBe(true);
      expect(reversed.shouldSpeak).toBe(true);
      expect(reversed.spokenInstruction).toContain('sens inverse');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // K4.03 & S3.12 — Démarrer / Rejoindre le départ & Navigation routière externe
  // ───────────────────────────────────────────────────────────────────────────
  describe('K4.03 & S3.12 · Démarrer depuis sa position, rejoindre le départ et navigation téléphone', () => {
    it('distingue au départ, déjà sur la trace plus loin, et éloigné de la trace (K4.03)', () => {
      // 1. Au départ
      const atStart = evaluateDepartureState([6.869, 45.9201], [L_SHAPED_ROUTE]);
      expect(atStart.kind).toBe('at_start');
      expect(atStart.recommendedAction).toBe('start_at_origin');

      // 2. Sur la trace à ~550 m du départ
      const onRouteAhead = evaluateDepartureState([6.869, 45.925], [L_SHAPED_ROUTE]);
      expect(onRouteAhead.kind).toBe('on_route_ahead');
      expect(onRouteAhead.recommendedAction).toBe('start_here_on_route');
      expect(onRouteAhead.availableActions).toContain('guide_to_start');
      expect(onRouteAhead.entryAlongTrackM).toBeGreaterThan(500);

      // 3. Loin de la trace (~1 km à l'ouest)
      const away = evaluateDepartureState([6.855, 45.92], [L_SHAPED_ROUTE]);
      expect(away.kind).toBe('away_from_route');
      expect(away.recommendedAction).toBe('guide_to_start');
      expect(away.availableActions).toEqual([
        'guide_to_start',
        'guide_to_nearest_point',
        'open_external_road_nav',
      ]);
    });

    it('construit un plan de ralliement connecté ou un repli boussole hors ligne sans inventer de trace (K4.03)', async () => {
      const awayPos: LngLat = [6.86, 45.92];
      const evaluation = evaluateDepartureState(awayPos, [L_SHAPED_ROUTE]);

      // Hors ligne : repli boussole pur, aucune géométrie inventée
      const offlinePlan = await buildAccessGuidancePlan(
        evaluation,
        awayPos,
        'guide_to_start',
        { online: false, sport: 'rando' },
      );
      expect(offlinePlan.status).toBe('offline_compass_only');
      expect(offlinePlan.routedGeometry).toBeNull();
      expect(offlinePlan.directDistanceM).toBeGreaterThan(500);
      expect(offlinePlan.directBearingDeg).toBeGreaterThan(70);
      expect(offlinePlan.directBearingDeg).toBeLessThan(110);

      // En ligne avec adaptateur : itinéraire d'accès mesuré
      const mockAdapter: RerouteProviderAdapter = vi.fn<RerouteProviderAdapter>(async () => ({
        leg: {
          distanceM: 820,
          durationS: 600,
          geometry: [
            [6.86, 45.92],
            [6.865, 45.92],
            [6.869, 45.92],
          ],
          provider: 'valhalla',
        },
        reason: null,
      }));
      const onlinePlan = await buildAccessGuidancePlan(
        evaluation,
        awayPos,
        'guide_to_start',
        { online: true, sport: 'rando', providerAdapter: mockAdapter },
      );
      expect(onlinePlan.status).toBe('routed_online');
      expect(onlinePlan.provider).toBe('valhalla');
      expect(onlinePlan.routedDistanceM).toBe(820);
      expect(onlinePlan.routedGeometry).toHaveLength(3);
    });

    it('génère les liens profonds vers les applications de navigation du téléphone (S3.12)', () => {
      const invalid = buildExternalNavigationLinks({ lat: Number.NaN, lng: 6.869 });
      expect(invalid.status).toBe('unavailable');
      expect(invalid.links).toHaveLength(0);

      const bundle = buildExternalNavigationLinks({
        lat: 45.92,
        lng: 6.869,
        label: 'Parking des Planards',
        mode: 'driving',
      });
      expect(bundle.status).toBe('ready');
      expect(bundle.links.map((l) => l.provider)).toEqual([
        'apple-maps',
        'google-maps',
        'waze',
        'geo-uri',
      ]);
      expect(bundle.links[0].url).toContain('45.92,6.869');
      expect(bundle.links[1].url).toContain('travelmode=driving');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // K4.05 — Recalcul automatique en ligne après déviation & retour hors ligne
  // ───────────────────────────────────────────────────────────────────────────
  describe('K4.05 · Recalcul automatique en ligne après déviation et retour hors réseau', () => {
    it('cherche une jonction en avant sur le tracé, recalcule en ligne, sépare l’état hors ligne et respecte le cooldown', async () => {
      // Position déviée à ~90 m à l'ouest du premier segment ([6.8678, 45.922])
      const deviatedPos: LngLat = [6.8678, 45.922];
      const junction = findForwardJunctionPoint(deviatedPos, [L_SHAPED_ROUTE], {
        lookaheadM: 150,
      });
      expect(junction).not.toBeNull();
      expect(junction!.junctionAlongTrackM).toBeGreaterThan(junction!.nearestAlongTrackM + 100);

      const controller = new RerouteController();

      // 1. Hors ligne : indication de retour sans inventer de détour
      const offlineState = await controller.evaluate({
        userPosition: deviatedPos,
        offRoute: true,
        lines: [L_SHAPED_ROUTE],
        sport: 'rando',
        online: false,
        nowMs: 1_000,
        mapBearingDeg: 90,
      });
      expect(offlineState.status).toBe('offline_return_only');
      expect(offlineState.detourGeometry).toBeNull();
      expect(offlineState.failureReason).toBe('offline');
      expect(offlineState.returnBearingDeg).not.toBeNull();
      expect(offlineState.screenBearingDeg).not.toBe(offlineState.returnBearingDeg);

      // 2. Reconnexion en ligne : recalcul vers la jonction en avant et fusion avec la fin du tracé
      const providerSpy = vi.fn<RerouteProviderAdapter>(async (_from, to) => ({
        leg: {
          distanceM: 210,
          durationS: 150,
          geometry: [
            [6.8678, 45.922],
            [6.8685, 45.923],
            [to.lng, to.lat],
          ],
          provider: 'geoapify',
        },
        reason: null,
      }));

      const onlineState = await controller.evaluate({
        userPosition: deviatedPos,
        offRoute: true,
        lines: [L_SHAPED_ROUTE],
        sport: 'rando',
        online: true,
        nowMs: 2_000,
        providerAdapter: providerSpy,
      });
      expect(onlineState.status).toBe('recalculated');
      expect(onlineState.provider).toBe('geoapify');
      expect(onlineState.detourGeometry).toHaveLength(3);
      expect(onlineState.mergedRouteGeometry!.length).toBeGreaterThan(3);
      expect(providerSpy).toHaveBeenCalledTimes(1);

      // 3. Appel 3 secondes plus tard sans déplacement : le cooldown évite un second appel API
      await controller.evaluate({
        userPosition: deviatedPos,
        offRoute: true,
        lines: [L_SHAPED_ROUTE],
        sport: 'rando',
        online: true,
        nowMs: 5_000,
        providerAdapter: providerSpy,
      });
      expect(providerSpy).toHaveBeenCalledTimes(1);

      // 4. Retour sur la trace : nettoyage immédiat de l'état temporaire
      const backOnRoute = await controller.evaluate({
        userPosition: [6.869, 45.9235],
        offRoute: false,
        lines: [L_SHAPED_ROUTE],
        sport: 'rando',
        online: true,
        nowMs: 25_000,
        providerAdapter: providerSpy,
      });
      expect(backOnRoute.status).toBe('on_route');
      expect(backOnRoute.detourGeometry).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // K4.06 — Orientation nord fixe ou sens de déplacement & recentrage
  // ───────────────────────────────────────────────────────────────────────────
  describe('K4.06 · Orientation nord fixe ou sens de déplacement et recentrage', () => {
    it('maintient le cap en mouvement, fige le cap à l’arrêt, compense les flèches écran et restaure le drawer parent', () => {
      let state = createInitialOrientationState(false, 45);
      expect(state.mode).toBe('course-up');
      expect(state.cameraBearingDeg).toBe(45);

      // Déplacement vers l'Est (90°) à 1.5 m/s -> la caméra suit le cap 90°
      state = updateOrientationFromMovement(state, {
        gpsHeadingDeg: 90,
        speedMs: 1.5,
      });
      expect(state.cameraBearingDeg).toBe(90);

      // À l'arrêt (0.05 m/s) avec bruit GPS (270°) -> le dernier cap valide (90°) est conservé
      state = updateOrientationFromMovement(state, {
        gpsHeadingDeg: 270,
        speedMs: 0.05,
      });
      expect(state.cameraBearingDeg).toBe(90);

      // Compensation écran : un cap monde à 90° avec carte orientée à 90° pointe vers le haut de l'écran (0°)
      expect(compensateDirectionForScreen(90, state)).toBe(0);

      // Interaction manuelle (pan/rotation utilisateur à 135°) puis recentrage
      state = markUserMapPan(state, 135);
      expect(state.userPanned).toBe(true);
      expect(state.cameraBearingDeg).toBe(135);

      state = recenterNavigationCamera(state);
      expect(state.userPanned).toBe(false);
      expect(state.cameraBearingDeg).toBe(90);

      // Bascule en Nord fixe via le sous-drawer et restauration du contexte parent
      state = openOrientationSubDrawer(state, { sheet: 'live', detent: 'mid', tab: 1 });
      state = setMapOrientationMode(state, 'north-up');
      expect(state.cameraBearingDeg).toBe(0);
      const closed = closeOrientationSubDrawer(state);
      expect(closed.restoredContext).toEqual({ sheet: 'live', detent: 'mid', tab: 1 });
      expect(closed.state.returnSheetContext).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // K4.07 & K4.08 — À venir : POI / Highlights & Alertes aux waypoints
  // ───────────────────────────────────────────────────────────────────────────
  describe('K4.07 & K4.08 · Waypoints « À venir » et alertes audio/visuelles à l’approche', () => {
    const waypoints: NavigationWaypointInput[] = [
      {
        id: 'wp-water',
        name: 'Source de la Blaitière',
        kind: 'water',
        lng: 6.869,
        lat: 45.9225, // ~278 m du départ
        authorized: true,
      },
      {
        id: 'wp-summit',
        name: 'Belvédère du Plan',
        kind: 'viewpoint',
        lng: 6.8725,
        lat: 45.925, // ~825 m du départ (après le virage)
        authorized: true,
      },
      {
        id: 'wp-private',
        name: 'Cabane privée non autorisée',
        kind: 'refuge',
        lng: 6.869,
        lat: 45.923,
        authorized: false,
      },
      {
        id: 'wp-far',
        name: 'Refuge hors couloir (2 km)',
        kind: 'refuge',
        lng: 6.895,
        lat: 45.94,
        authorized: true,
      },
    ];

    it('projette les POI autorisés sur le tracé et calcule la distance curviligne restante (K4.07)', () => {
      const projected = projectWaypointsOnRoute(waypoints, [L_SHAPED_ROUTE], {
        sport: 'rando',
      });
      expect(projected.map((w) => w.id)).toEqual(['wp-water', 'wp-summit']);

      const upcomingAtStart = computeUpcomingWaypoints(projected, 50, {
        units: 'metric',
        currentSpeedMs: 1.5,
      });
      expect(upcomingAtStart).toHaveLength(2);
      expect(upcomingAtStart[0].waypoint.id).toBe('wp-water');
      expect(upcomingAtStart[0].distanceRemainingM).toBeGreaterThan(210);
      expect(upcomingAtStart[0].distanceRemainingM).toBeLessThan(240);
      expect(upcomingAtStart[0].etaSeconds).toBeGreaterThan(140);
    });

    it('déclenche les alertes d’approche puis d’arrivée sans doublon et les retire après dépassement ou perte de signal (K4.08)', () => {
      const projected = projectWaypointsOnRoute(waypoints, [L_SHAPED_ROUTE]);
      const waterAlongM = projected[0].alongTrackM;
      const alertCtrl = new WaypointAlertController();

      // 1. Approche à 120 m du point d'eau
      const step1 = alertCtrl.evaluate(projected, {
        currentAlongTrackM: waterAlongM - 120,
        nowMs: 1000,
      });
      expect(step1.newlyTriggered).toHaveLength(1);
      expect(step1.newlyTriggered[0].stage).toBe('approach');
      expect(step1.activeAlert?.waypointId).toBe('wp-water');

      // 2. Même zone à 100 m : pas de nouveau déclenchement vocal, mais l'alerte visuelle met à jour la distance
      const step2 = alertCtrl.evaluate(projected, {
        currentAlongTrackM: waterAlongM - 100,
        nowMs: 2000,
      });
      expect(step2.newlyTriggered).toHaveLength(0);
      expect(step2.activeAlert?.distanceRemainingM).toBe(100);

      // 3. Arrivée à 15 m du point d'eau
      const step3 = alertCtrl.evaluate(projected, {
        currentAlongTrackM: waterAlongM - 15,
        nowMs: 3000,
      });
      expect(step3.newlyTriggered).toHaveLength(1);
      expect(step3.newlyTriggered[0].stage).toBe('arrival');
      expect(step3.activeAlert?.title).toContain('atteint');

      // 4. Dépassement de 30 m -> retrait automatique de l'état temporaire
      const step4 = alertCtrl.evaluate(projected, {
        currentAlongTrackM: waterAlongM + 30,
        nowMs: 4000,
      });
      expect(step4.activeAlert).toBeNull();

      // 5. Disparition du signal GPS -> retrait immédiat
      alertCtrl.evaluate(projected, {
        currentAlongTrackM: projected[1].alongTrackM - 100,
        nowMs: 5000,
      });
      expect(alertCtrl.currentAlert).not.toBeNull();
      const lost = alertCtrl.evaluate(projected, {
        currentAlongTrackM: projected[1].alongTrackM - 95,
        signalLost: true,
        nowMs: 6000,
      });
      expect(lost.activeAlert).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // K4.09 — Cartes de montée et descente pendant le suivi
  // ───────────────────────────────────────────────────────────────────────────
  describe('K4.09 · Cartes de montée et descente pendant le suivi', () => {
    const profile: ElevationPoint[] = [
      { d: 0, ele: 1000 },
      { d: 200, ele: 1002 }, // Plat initial
      { d: 400, ele: 1020 }, // Début montée
      { d: 700, ele: 1055 }, // Fin montée (+53 m sur 500 m)
      { d: 900, ele: 1054 }, // Replat sommet
      { d: 1200, ele: 1015 }, // Descente (-39 m sur 300 m)
      { d: 1400, ele: null }, // Trou DEM : ne doit jamais inventer de pente
      { d: 1600, ele: 1010 },
    ];

    it('détecte les montées/descentes sans inventer d’altitude sur un trou DEM et retire la carte hors tronçon', () => {
      const segments = detectClimbDescentSegments(profile);
      expect(segments).toHaveLength(2);
      expect(segments[0].kind).toBe('climb');
      expect(segments[1].kind).toBe('descent');

      // Approche du pied de la montée
      const upcoming = evaluateClimbDescentCard(segments, 100, {
        upcomingLookaheadM: 300,
      });
      expect(upcoming.status).toBe('upcoming_climb');

      // Au milieu de la montée (d = 450 m)
      const activeClimb = evaluateClimbDescentCard(segments, 450);
      expect(activeClimb.status).toBe('active_climb');
      expect(activeClimb.progressRatio).toBeGreaterThan(0.3);
      expect(activeClimb.progressRatio).toBeLessThan(0.8);
      expect(activeClimb.remainingElevationDeltaM).toBeGreaterThan(20);

      // Dans la descente (d = 1050 m)
      const activeDescent = evaluateClimbDescentCard(segments, 1050);
      expect(activeDescent.status).toBe('active_descent');
      expect(activeDescent.remainingElevationDeltaM).toBeGreaterThan(15);

      // Après la descente (d = 1300 m) -> l'état temporaire est résolu et retiré
      const resolved = evaluateClimbDescentCard(segments, 1300);
      expect(resolved.status).toBe('flat_or_none');
      expect(resolved.segment).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // K4.10 — Modifier ou changer le parcours pendant l'enregistrement (zéro fuite)
  // ───────────────────────────────────────────────────────────────────────────
  describe('K4.10 · Changement de parcours en cours d’enregistrement sans fuite d’état', () => {
    it('conserve la séance et ses métriques tout en purgeant intégralement l’état de l’ancien tracé', async () => {
      const recording = makeBaseRecording();
      const ctrl = new NavigationSessionController({
        recording,
        route: {
          id: 'route-initial',
          name: 'Boucle des Houches',
          geojson: L_SHAPED_GEOJSON,
          status: 'ready',
          waypoints: [
            {
              id: 'old-wp',
              name: 'Ancien Refuge',
              kind: 'refuge',
              lng: 6.869,
              lat: 45.9225,
            },
          ],
        },
      });

      // Provoquer un état hors-itinéraire sur l'ancien parcours (> 15 s à > 40 m)
      await ctrl.onAcceptedFix({ t: 1_000, lng: 6.867, lat: 45.922, acc: 5, speed: 1.4 });
      const tickOff = await ctrl.onAcceptedFix({
        t: 20_000,
        lng: 6.867,
        lat: 45.922,
        acc: 5,
        speed: 1.4,
      });
      expect(tickOff.recording.offRoute).toBe(true);
      expect(ctrl.currentNavigationContext.offRouteSamples.length).toBeGreaterThan(0);

      // Nouveau tracé passant exactement par [6.867, 45.922]
      const newGeojson = {
        type: 'LineString',
        coordinates: [
          [6.867, 45.92],
          [6.867, 45.922],
          [6.867, 45.926],
        ],
      };

      const swapped = ctrl.changeRouteDuringRecording({
        id: 'route-new',
        name: 'Variante Col de Voza',
        geojson: newGeojson,
        status: 'ready',
        waypoints: [
          {
            id: 'new-wp',
            name: 'Col de Voza',
            kind: 'summit',
            lng: 6.867,
            lat: 45.925,
          },
        ],
      });

      // Invariant 1 : identité et cumuls de la séance intégralement conservés
      expect(swapped.recording.sessionId).toBe('srv-session-101');
      expect(swapped.recording.clientSessionId).toBe('client-uuid-101');
      expect(swapped.recording.startedAt).toBe(1_700_000_000_000);
      expect(swapped.recording.distanceM).toBe(420);
      expect(swapped.recording.elevGainM).toBe(38);
      expect(swapped.recording.movingS).toBe(300);

      // Invariant 2 : zéro fuite de l'ancien tracé
      expect(swapped.recording.route?.id).toBe('route-new');
      expect(swapped.recording.offRoute).toBe(false);
      expect(swapped.recording.offRouteM).toBeUndefined();
      expect(swapped.navigation.offRouteSamples).toHaveLength(0);
      expect(swapped.navigation.reroute.status).toBe('on_route');
      expect(swapped.navigation.projectedWaypoints.map((w) => w.id)).toEqual(['new-wp']);
      expect(swapped.navigation.turnByTurn.routeRevision).toContain('route-new');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // K4.11 — Champs personnalisables, zoom et écran maintenu
  // ───────────────────────────────────────────────────────────────────────────
  describe('K4.11 · Champs personnalisables, zoom automatique et écran maintenu (Wake Lock)', () => {
    it('formate les champs choisis selon les unités et signale explicitement les capteurs absents sans inventer de valeur', () => {
      let prefs = createInitialDisplayPreferences('course');
      expect(prefs.fields).toEqual(['distance', 'duration', 'pace', 'elevation']);

      prefs = updateCustomFields(prefs, [
        'distance',
        'pace',
        'heartRate',
        'power',
        'remainingDistance',
        'eta',
      ]);

      const valuesMetric = evaluateCustomFieldValues(prefs.fields, {
        distanceM: 5000,
        movingS: 1500,
        elevGainM: 120,
        currentSpeedMs: 3.3333,
        remainingRouteDistanceM: 2000,
        units: 'metric',
      });

      const byKey = Object.fromEntries(valuesMetric.map((v) => [v.key, v]));
      expect(byKey.distance.formattedValue).toBe('5.00');
      expect(byKey.distance.unitLabel).toBe('km');
      expect(byKey.pace.formattedValue).toBe('5:00');
      expect(byKey.pace.unitLabel).toBe('/km');
      expect(byKey.heartRate.available).toBe(false);
      expect(byKey.heartRate.unavailableReason).toBe('sensor_not_connected');
      expect(byKey.heartRate.formattedValue).toBe('—');
      expect(byKey.power.available).toBe(false);
      expect(byKey.remainingDistance.formattedValue).toBe('2.00');
      expect(byKey.eta.available).toBe(true);

      // Même évaluation en unités impériales
      const valuesImperial = evaluateCustomFieldValues(['distance', 'elevation', 'speed'], {
        distanceM: 1609.344,
        movingS: 600,
        elevGainM: 100,
        currentSpeedMs: 4.4704, // 10 mph
        units: 'imperial',
      });
      expect(valuesImperial[0].formattedValue).toBe('1.00');
      expect(valuesImperial[0].unitLabel).toBe('mi');
      expect(valuesImperial[1].formattedValue).toBe('+328');
      expect(valuesImperial[1].unitLabel).toBe('ft');
      expect(valuesImperial[2].formattedValue).toBe('10.0');
      expect(valuesImperial[2].unitLabel).toBe('mph');
    });

    it('gère le zoom automatique par vitesse, le zoom manuel et le maintien d’écran Wake Lock', async () => {
      const prefs = createInitialDisplayPreferences('velo');
      expect(resolveNavigationZoom(prefs, 1.0, 3)).toBe(15);
      expect(resolveNavigationZoom(prefs, 7.0, 3)).toBe(14.8);
      expect(
        resolveNavigationZoom({ autoZoomEnabled: false, manualZoomOverride: 16.5 }, 7.0, 3),
      ).toBe(16.5);

      let released = false;
      const mockWakeLockAdapter: WakeLockAdapter = {
        isSupported: () => true,
        request: async () => ({
          get released() {
            return released;
          },
          release: async () => {
            released = true;
          },
        }),
      };

      const wakeCtrl = new ScreenWakeLockController(mockWakeLockAdapter);
      const acquired = await wakeCtrl.setKeepScreenAwake(true);
      expect(acquired.supported).toBe(true);
      expect(acquired.active).toBe(true);

      const afterRelease = await wakeCtrl.setKeepScreenAwake(false);
      expect(afterRelease.active).toBe(false);
      expect(released).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // S1.07 — Annonces audio pendant l'effort
  // ───────────────────────────────────────────────────────────────────────────
  describe('S1.07 · Annonces audio pendant l’effort par sport et par split/temps', () => {
    it('annonce chaque split kilométrique en course (allure) et par intervalle en vélo (vitesse)', () => {
      const spoken: string[] = [];
      const mockSpeech: SpeechSynthesisAdapter = {
        isSupported: () => true,
        speak: (text) => spoken.push(text),
        cancel: () => undefined,
      };

      const audioCtrl = new AudioGuidanceController(mockSpeech, createDefaultAudioPreferences());

      // Course à pied : split 1 km bouclé en 300 s (5:00 /km)
      const runAnnouncement = audioCtrl.evaluateEffortProgress({
        sport: 'course',
        distanceM: 1005,
        movingS: 300,
        splits: [
          { kind: 'km', index: 1, distanceM: 1000, movingS: 300, completed: true },
          { kind: 'km', index: 2, distanceM: 5, movingS: 1, completed: false },
        ],
        units: 'metric',
        nowMs: 10_000,
      });

      expect(runAnnouncement).not.toBeNull();
      expect(runAnnouncement!.text).toContain('Kilomètre 1');
      expect(runAnnouncement!.text).toContain('Allure 5 minutes par kilomètre');
      expect(spoken).toHaveLength(1);

      // Même split évalué une seconde fois : aucun doublon
      expect(
        audioCtrl.evaluateEffortProgress({
          sport: 'course',
          distanceM: 1020,
          movingS: 305,
          splits: [
            { kind: 'km', index: 1, distanceM: 1000, movingS: 300, completed: true },
            { kind: 'km', index: 2, distanceM: 20, movingS: 5, completed: false },
          ],
          units: 'metric',
          nowMs: 15_000,
        }),
      ).toBeNull();

      // Vélo : annonce temporelle à 600 s (10 minutes) avec vitesse en km/h
      const bikeAnnouncement = audioCtrl.evaluateEffortProgress({
        sport: 'velo',
        distanceM: 5000,
        movingS: 600,
        units: 'metric',
        nowMs: 30_000,
      });
      expect(bikeAnnouncement).not.toBeNull();
      expect(bikeAnnouncement!.text).toContain('Vitesse 30 kilomètres par heure');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // K4.12 & S1.06 — Écran verrouillé iOS (Live Activities / Dynamic Island) & Android
  // ───────────────────────────────────────────────────────────────────────────
  describe('K4.12 & S1.06 · Écran verrouillé, Live Activities iOS, Dynamic Island et parité Android', () => {
    it('construit le payload complet (statistiques + prochaine manœuvre + Dynamic Island + Android) et synchronise sans dupliquer la séance', async () => {
      const maneuvers = extractRouteManeuvers(L_SHAPED_GEOJSON);
      const turnRight = maneuvers[1];

      const startCalls: LockScreenNavigationPayload[] = [];
      const updateCalls: LockScreenNavigationPayload[] = [];
      let pausedSessionId: string | null = null;

      const mockBridge: LockScreenNativeBridgeAdapter = {
        getPlatform: () => 'ios',
        isSupported: async () => ({ supported: true, dynamicIsland: true }),
        start: async (payload) => {
          startCalls.push(payload);
          return { supported: true, id: 'la-1' };
        },
        update: async (payload) => {
          updateCalls.push(payload);
        },
        end: async () => undefined,
      };

      const bridgeCtrl = new LockScreenBridgeController(mockBridge, {
        onPause: (id) => {
          pausedSessionId = id;
        },
      });

      const cap = await bridgeCtrl.checkCapability();
      expect(cap.liveActivityAvailable).toBe(true);
      expect(cap.dynamicIslandAvailable).toBe(true);

      // Premier sync : démarre la Live Activity pour `client-uuid-101`
      const payload1 = await bridgeCtrl.sync({
        clientSessionId: 'client-uuid-101',
        sport: 'rando',
        startedAt: 1_700_000_000_000,
        distanceM: 480,
        elevGainM: 42,
        movingS: 320,
        paused: false,
        offRoute: false,
        units: 'metric',
        nextManeuver: turnRight,
        distanceToNextManeuverM: 75,
      });

      expect(startCalls).toHaveLength(1);
      expect(updateCalls).toHaveLength(0);
      expect(payload1.nextManeuver?.kind).toBe('turn-right');
      expect(payload1.nextManeuver?.formattedDistance).toBe('75 m');
      expect(payload1.dynamicIsland.compactTrailing).toBe('75 m');
      expect(payload1.androidNotification.category).toBe('navigation');
      expect(payload1.androidNotification.title).toContain('Tourner à droite');

      // Second sync sur la même `clientSessionId` : `update` uniquement (pas de 2e séance)
      await bridgeCtrl.sync({
        clientSessionId: 'client-uuid-101',
        sport: 'rando',
        startedAt: 1_700_000_000_000,
        distanceM: 530,
        elevGainM: 45,
        movingS: 350,
        paused: false,
        offRoute: false,
        units: 'metric',
        nextManeuver: turnRight,
        distanceToNextManeuverM: 25,
      });

      expect(startCalls).toHaveLength(1);
      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0].nextManeuver?.formattedDistance).toBe('25 m');

      // Action depuis l'écran verrouillé -> transmise à la séance active
      bridgeCtrl.handleLockScreenAction('pause');
      expect(pausedSessionId).toBe('client-uuid-101');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Utilitaires transversaux d'unités et de projection
  // ───────────────────────────────────────────────────────────────────────────
  describe('Transversal · Unités métriques/impériales et projection géométrique', () => {
    it('formate correctement les distances, altitudes, vitesses et allures sans valeurs inventées', () => {
      expect(formatNavigationDistance(null, 'metric')).toBe('—');
      expect(formatNavigationDistance(850, 'metric')).toBe('850 m');
      expect(formatNavigationDistance(2450, 'metric')).toBe('2.45 km');
      expect(formatNavigationDistance(1609.344, 'imperial')).toBe('1.00 mi');
      expect(formatNavigationElevation(100, 'imperial', true)).toBe('+328 ft');
      expect(formatNavigationSpeed(5, 'metric').full).toBe('18.0 km/h');
      expect(formatNavigationPaceFromSpeed(0.1, 'metric').full).toBe('—');

      const proj = projectPositionOnRoute([6.869, 45.9225], [L_SHAPED_ROUTE]);
      expect(proj).not.toBeNull();
      expect(proj!.crossTrackM).toBeLessThan(1);
      expect(proj!.alongTrackM).toBeGreaterThan(270);

      const effortText = buildEffortAnnouncementText({
        sport: 'trail',
        distanceM: 2000,
        movingS: 600,
        units: 'metric',
        prefs: {
          enabled: true,
          onEachSplit: true,
          timeIntervalS: null,
          announceDistance: true,
          announceDuration: true,
          announceRhythm: true,
          announceSplitDelta: false,
        },
      });
      expect(effortText).toContain('2 kilomètres');
      expect(effortText).toContain('10 minutes');

      const lockPayload = buildLockScreenNavigationPayload({
        clientSessionId: 'c-1',
        sport: 'course',
        startedAt: 1000,
        distanceM: 3200,
        elevGainM: 50,
        movingS: 960,
        paused: false,
        offRoute: true,
        offRouteM: 55,
        units: 'metric',
      });
      expect(lockPayload.offRouteBanner).toBe('Hors itinéraire · 55 m');
    });
  });
});
