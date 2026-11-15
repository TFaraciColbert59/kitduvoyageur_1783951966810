import { describe, expect, it } from 'vitest';
import {
  D03_FICHE_IDS,
  NATIVE_WATCH_PERIMETER_REPORT,
  SimulatedWatchCompanionTransport,
  WatchCompanionBridge,
  WatchLiveSyncEngine,
  WatchOfflinePackManager,
  WatchOfflineSessionQueue,
  WatchSessionReconciler,
  buildLiveSyncCustomFields,
  computeUpcomingPois,
  getSupportedWatchMatrix,
  inspectWatchNativeTargets,
  isWatchOsVersionSupported,
  resolveWatchPlatformCapabilities,
  validateCustomFieldLayout,
  type WatchDeviceProfile,
  type WatchOfflinePackManifest,
} from '../index';

describe('Lot D03 — Montres Apple Watch & Wear OS / Galaxy Watch (K6.09..K6.11, S6.01, S6.02)', () => {
  describe('1. Diagnostic cibles natives & matrice de compatibilité (S6.01, S6.02)', () => {
    it('retourne explicitement native_target_unavailable par défaut tant que les cibles Xcode WatchKit et Gradle :wear sont absentes du dépôt', () => {
      const diag = inspectWatchNativeTargets();
      expect(diag.status).toBe('native_target_unavailable');
      expect(diag.xcodeWatchKitTargetPresent).toBe(false);
      expect(diag.wearOsGradleModulePresent).toBe(false);
      expect(diag.runtimeBridgeInjected).toBe(false);
      expect(diag.missingTargets.length).toBe(3);
      expect(NATIVE_WATCH_PERIMETER_REPORT.map((r) => r.platform)).toEqual([
        'apple_watch',
        'wear_os',
        'galaxy_watch',
      ]);
      expect(D03_FICHE_IDS).toEqual(['K6.09', 'K6.10', 'K6.11', 'S6.01', 'S6.02']);
    });

    it('expose la matrice de compatibilité Apple Watch (watchOS 10+), Wear OS (3.5+) et Galaxy Watch (4.0+)', () => {
      const matrix = getSupportedWatchMatrix();
      expect(matrix).toHaveLength(3);
      expect(isWatchOsVersionSupported('apple_watch', '10.2')).toBe(true);
      expect(isWatchOsVersionSupported('apple_watch', '9.6')).toBe(false);
      expect(isWatchOsVersionSupported('wear_os', '3.5')).toBe(true);
      expect(isWatchOsVersionSupported('wear_os', '3.0')).toBe(false);
      expect(isWatchOsVersionSupported('galaxy_watch', '5.0')).toBe(true);
      expect(isWatchOsVersionSupported('galaxy_watch', '3.5')).toBe(false);
    });

    it('résout les capacités en distinguant native_target_unavailable, consent_required et indeterminate (opacité HealthKit lecture)', () => {
      const appleProfile: WatchDeviceProfile = {
        deviceId: 'aw-ultra-2',
        platform: 'apple_watch',
        modelName: 'Apple Watch Ultra 2',
        osVersion: '11.1',
        hasBuiltInGps: true,
        storageAvailableBytes: 64 * 1024 * 1024,
        batteryPercent: 85,
        pairedPhonePlatform: 'ios',
        permissions: {
          locationWhenInUse: 'granted',
          locationAlwaysOrWorkout: 'granted',
          healthWorkoutWrite: 'granted',
          healthMetricsRead: 'indeterminate',
        },
      };

      // Sans cible native compilée/injectée -> tout est native_target_unavailable
      const unavailCaps = resolveWatchPlatformCapabilities(appleProfile);
      expect(unavailCaps.autonomous_gps_recording).toBe('native_target_unavailable');
      expect(unavailCaps.offline_map_pack).toBe('native_target_unavailable');

      // Avec cible native présente et pont actif -> heart_rate_sensor reflète indeterminate
      const activeDiag = inspectWatchNativeTargets({
        xcodeWatchKitTargetPresent: true,
        runtimeBridgeInjected: true,
      });
      const activeCaps = resolveWatchPlatformCapabilities(appleProfile, activeDiag);
      expect(activeCaps.autonomous_gps_recording).toBe('available');
      expect(activeCaps.offline_map_pack).toBe('available');
      expect(activeCaps.heart_rate_sensor).toBe('indeterminate');
    });
  });

  describe('2. Séance autonome montre, redémarrage, horloge monotone et réconciliation idempotente (K6.09, K6.11, S6.01, S6.02)', () => {
    it('enregistre sans téléphone, gère pause/reprise, survit à un redémarrage de montre (bootId) et produit une seule séance après synchronisation', () => {
      const queue = new WatchOfflineSessionQueue();
      const reconciler = new WatchSessionReconciler();

      const started = queue.startOrResumeSession({
        watchSessionId: '550e8400-e29b-41d4-a716-446655440000',
        deviceId: 'aw-series-9',
        platform: 'apple_watch',
        sport: 'rando',
        routePackId: 'pack-vercors-01',
        startedAtUtcMs: 1_700_000_000_000,
        monotonicMs: 10_000,
        bootId: 'boot-1',
      });
      expect(started.resumedExisting).toBe(false);
      const sessionId = started.session.watchSessionId;

      // Point 1 et 2 sur boot-1
      const p1 = queue.appendPoint(sessionId, {
        recordedAtUtcMs: 1_700_000_005_000,
        monotonicMs: 15_000,
        bootId: 'boot-1',
        lat: 45.1885,
        lng: 5.7245,
        eleM: 1200,
        heartRateBpm: 138,
      });
      expect(p1.seq).toBe(1);
      expect(p1.breakBefore).toBe(true);

      const p2 = queue.appendPoint(sessionId, {
        recordedAtUtcMs: 1_700_000_015_000,
        monotonicMs: 25_000,
        bootId: 'boot-1',
        lat: 45.1895,
        lng: 5.7255,
        eleM: 1212,
        heartRateBpm: 144,
      });
      expect(p2.seq).toBe(2);
      expect(p2.breakBefore).toBe(false);

      // Pause manuelle de 20 secondes puis reprise
      queue.pauseSession(sessionId, 1_700_000_020_000, 30_000, 'boot-1', 'ravitaillement');
      queue.resumeSession(sessionId, 1_700_000_040_000, 50_000, 'boot-1');

      // Redémarrage de la montre en cours de sortie (boot-2) !
      // Le relancement de l'app sur la montre doit reprendre la même séance ouverte
      const resumedAfterReboot = queue.startOrResumeSession({
        deviceId: 'aw-series-9',
        platform: 'apple_watch',
        sport: 'rando',
        startedAtUtcMs: 1_700_000_100_000,
        monotonicMs: 4_000, // compteur monotone remis à zéro sur boot-2
        bootId: 'boot-2',
      });
      expect(resumedAfterReboot.resumedExisting).toBe(true);
      expect(resumedAfterReboot.session.watchSessionId).toBe(sessionId);
      expect(resumedAfterReboot.session.sourceGeneration).toBe(2);

      // Point 3 et 4 après redémarrage
      const p3 = queue.appendPoint(sessionId, {
        recordedAtUtcMs: 1_700_000_105_000,
        monotonicMs: 9_000,
        bootId: 'boot-2',
        lat: 45.1905,
        lng: 5.7265,
        eleM: 1225,
      });
      expect(p3.seq).toBe(3);
      expect(p3.breakBefore).toBe(true); // Rupture explicite après pause/reboot

      const p4 = queue.appendPoint(sessionId, {
        recordedAtUtcMs: 1_700_000_115_000,
        monotonicMs: 19_000,
        bootId: 'boot-2',
        lat: 45.1915,
        lng: 5.7275,
        eleM: 1240,
      });
      expect(p4.seq).toBe(4);
      expect(p4.breakBefore).toBe(false);

      const finished = queue.finishSession(sessionId, 1_700_000_120_000, 24_000, 'boot-2');
      expect(finished.status).toBe('finished');
      expect(finished.events.map((e) => e.type)).toEqual([
        'pause',
        'resume',
        'reboot_detected',
      ]);

      // Synchronisation par petits lots de 2 points avec simulation de perte d'ACK sur le 1er lot
      const firstBatches = queue.buildPendingBatches(sessionId, { maxPointsPerBatch: 2 });
      expect(firstBatches).toHaveLength(2);
      expect(firstBatches[0].fromSeq).toBe(1);
      expect(firstBatches[0].toSeq).toBe(2);

      // Le téléphone reçoit le lot 1, mais l'ACK Bluetooth se perd -> la montre rejoue le lot 1
      reconciler.ingestBatch(firstBatches[0]);
      const retryBatches = queue.buildPendingBatches(sessionId, { maxPointsPerBatch: 2 });
      expect(retryBatches[0].fromSeq).toBe(1);

      const ack1 = reconciler.ingestBatch(retryBatches[0]).ack;
      queue.acknowledge(ack1);

      // Maintenant la montre n'envoie plus que le lot 2 (séquences 3..4 + résumé final)
      const remainingBatches = queue.buildPendingBatches(sessionId, { maxPointsPerBatch: 2 });
      expect(remainingBatches).toHaveLength(1);
      expect(remainingBatches[0].fromSeq).toBe(3);
      expect(remainingBatches[0].toSeq).toBe(4);
      expect(remainingBatches[0].summary).not.toBeNull();

      const { ack: ack2, session: phoneSession } = reconciler.ingestBatch(remainingBatches[0]);
      const finalWatchSession = queue.acknowledge(ack2);

      expect(finalWatchSession?.syncState).toBe('synced');
      expect(queue.listPendingSessions()).toHaveLength(0);

      // Preuve d'unicité et d'intégrité côté téléphone
      expect(reconciler.listReconciledSessions()).toHaveLength(1);
      expect(phoneSession.clientSessionId).toBe(sessionId);
      expect(phoneSession.points).toHaveLength(4);
      expect(phoneSession.duplicatePointsIgnored).toBe(2); // Les 2 points du lot 1 rejoué ont été ignorés
      expect(phoneSession.events.map((e) => e.type)).toEqual([
        'pause',
        'resume',
        'reboot_detected',
      ]);
      expect(phoneSession.status).toBe('finished');
      expect(phoneSession.summarySaved).toBe(true);
    });

    it('protège les durées contre un saut d’horloge civile grâce à l’horloge monotone et préserve les points si une permission est retirée', () => {
      const queue = new WatchOfflineSessionQueue();
      const { session } = queue.startOrResumeSession({
        watchSessionId: '660e8400-e29b-41d4-a716-446655440111',
        deviceId: 'galaxy-watch-6',
        platform: 'galaxy_watch',
        sport: 'trail',
        startedAtUtcMs: 1_700_000_000_000,
        monotonicMs: 1_000,
        bootId: 'gw-boot-1',
      });

      // L'horloge système recule brutalement d'une heure (changement d'heure / NTP),
      // mais l'horloge monotone avance normalement de 10 secondes
      queue.appendPoint(session.watchSessionId, {
        recordedAtUtcMs: 1_700_000_000_000 - 3_600_000,
        monotonicMs: 11_000,
        bootId: 'gw-boot-1',
        lat: 45.2,
        lng: 5.7,
      });

      const afterJump = queue.getSession(session.watchSessionId)!;
      expect(afterJump.movingMs).toBe(10_000);
      expect(afterJump.elapsedMs).toBe(10_000);
      expect(afterJump.clockAnomalies).toHaveLength(1);
      expect(afterJump.events.some((e) => e.type === 'clock_jump_detected')).toBe(true);

      // Révocation de permission en cours de sortie
      const afterRevoke = queue.handlePermissionRevoked(
        session.watchSessionId,
        1_700_000_020_000,
        21_000,
        'gw-boot-1',
      );
      expect(afterRevoke.status).toBe('paused');
      expect(afterRevoke.points).toHaveLength(1);
      expect(afterRevoke.events.some((e) => e.type === 'permission_revoked')).toBe(true);
    });

    it('orchestre le vidage via WatchCompanionBridge avec coupure Bluetooth puis reprise sans perte ni doublon', async () => {
      const watchQueue = new WatchOfflineSessionQueue();
      const phoneReconciler = new WatchSessionReconciler();
      const transport = new SimulatedWatchCompanionTransport({
        platform: 'wear_os',
        nativeAvailable: true,
        reachable: true,
      });
      const bridge = new WatchCompanionBridge({
        adapter: transport,
        watchQueue,
        phoneReconciler,
      });

      const { session } = watchQueue.startOrResumeSession({
        watchSessionId: '770e8400-e29b-41d4-a716-446655440222',
        deviceId: 'pixel-watch-2',
        platform: 'wear_os',
        sport: 'velo',
        startedAtUtcMs: 1_700_000_000_000,
        monotonicMs: 0,
        bootId: 'pw-boot-1',
      });

      for (let i = 1; i <= 5; i += 1) {
        watchQueue.appendPoint(session.watchSessionId, {
          recordedAtUtcMs: 1_700_000_000_000 + i * 5_000,
          monotonicMs: i * 5_000,
          bootId: 'pw-boot-1',
          lat: 45.1 + i * 0.001,
          lng: 5.7 + i * 0.001,
          eleM: 500 + i * 5,
        });
      }
      watchQueue.finishSession(
        session.watchSessionId,
        1_700_000_030_000,
        30_000,
        'pw-boot-1',
      );

      // Le premier ACK se perd sur le lien BLE !
      transport.dropNextAcks(1);
      const firstAttempt = await bridge.flushPendingSessions({ maxPointsPerBatch: 2 });
      expect(firstAttempt.status).toBe('partially_flushed');
      expect(firstAttempt.batchesSent).toBe(1);
      expect(firstAttempt.acksApplied).toBe(0);

      // Reconnexion et reprise complète
      const secondAttempt = await bridge.flushPendingSessions({ maxPointsPerBatch: 2 });
      expect(secondAttempt.status).toBe('flushed');
      expect(secondAttempt.reconciledSessions).toHaveLength(1);
      expect(secondAttempt.reconciledSessions[0].points).toHaveLength(5);
      expect(secondAttempt.reconciledSessions[0].duplicatePointsIgnored).toBe(2);
      expect(secondAttempt.reconciledSessions[0].status).toBe('finished');
    });
  });

  describe('3. Paquets de cartes et d’itinéraires hors ligne sur montre (K6.09, K6.11)', () => {
    const sampleManifest: WatchOfflinePackManifest = {
      packId: 'pack-chartreuse-01',
      routeId: 'route-chamechaude',
      routeRevision: 1,
      ownerUserId: 'user-1',
      provider: 'openfreemap',
      OfflineLicenseAllowed: true,
      styleVersion: 'lkdv-outdoor-v2',
      bounds: { west: 5.75, south: 45.25, east: 5.82, north: 45.32 },
      minZoom: 11,
      maxZoom: 15,
      totalBytes: 4_000_000,
      checksumSha256: 'sha256-rev1-valid',
      createdAtUtcMs: 1_700_000_000_000,
      resources: [
        {
          resourceId: 'res-geom',
          kind: 'route_geometry',
          requiredForFullMap: true,
          sizeBytes: 50_000,
          sha256: 'sha-geom',
        },
        {
          resourceId: 'res-maneuvers',
          kind: 'maneuvers',
          requiredForFullMap: false,
          sizeBytes: 20_000,
          sha256: 'sha-man',
        },
        {
          resourceId: 'res-style',
          kind: 'style_json',
          requiredForFullMap: true,
          sizeBytes: 30_000,
          sha256: 'sha-style',
        },
        {
          resourceId: 'res-tiles',
          kind: 'vector_tiles',
          requiredForFullMap: true,
          sizeBytes: 3_500_000,
          sha256: 'sha-tiles',
        },
        {
          resourceId: 'res-glyphs',
          kind: 'glyphs',
          requiredForFullMap: true,
          sizeBytes: 400_000,
          sha256: 'sha-glyphs',
        },
      ],
    };

    it('transfère un paquet par blocs avec reprise après coupure, vérifie le checksum et conserve la dernière révision valide si un remplacement échoue par manque d’espace', () => {
      const manager = new WatchOfflinePackManager(10_000_000); // 10 Mo disponibles

      const staged = manager.stageManifest(sampleManifest, 2);
      expect(staged.status).toBe('queued');
      expect(staged.capabilities.viewRouteTrace).toBe(false);

      // Bloc 0 reçu
      manager.ingestChunk({
        packId: sampleManifest.packId,
        routeRevision: 1,
        chunkIndex: 0,
        totalChunks: 2,
        byteLength: 2_000_000,
        resourceIdsCovered: ['res-geom', 'res-maneuvers', 'res-style'],
        chunkChecksum: 'chk-0',
      });

      // Interruption Bluetooth avant la fin -> état suspended, jamais available prématuré
      const suspended = manager.suspendTransfer(sampleManifest.packId)!;
      expect(suspended.status).toBe('suspended');
      expect(suspended.ackedChunkIndex).toBe(0);

      // Reprise du bloc 1
      const afterChunk1 = manager.ingestChunk({
        packId: sampleManifest.packId,
        routeRevision: 1,
        chunkIndex: 1,
        totalChunks: 2,
        byteLength: 2_000_000,
        resourceIdsCovered: ['res-tiles', 'res-glyphs'],
        chunkChecksum: 'chk-1',
      });
      expect(afterChunk1.record.status).toBe('verifying');

      // Finalisation avec checksum valide
      const available = manager.verifyAndFinalizePack(
        sampleManifest.packId,
        'sha256-rev1-valid',
      );
      expect(available.status).toBe('available');
      expect(available.capabilities).toEqual({
        viewRouteTrace: true,
        viewBaseMap: true,
        followTurnByTurn: true,
        localPlaceSearch: false,
        localRerouting: false,
        liveWeatherAndClosures: false,
      });

      // Tentative de remplacement par une révision 2 trop volumineuse (20 Mo > 10 Mo)
      const rev2TooLarge: WatchOfflinePackManifest = {
        ...sampleManifest,
        routeRevision: 2,
        totalBytes: 20_000_000,
        checksumSha256: 'sha256-rev2',
      };
      const afterFailedReplace = manager.stageManifest(rev2TooLarge, 4);
      // La révision 1 valide est préservée !
      expect(afterFailedReplace.status).toBe('available');
      expect(afterFailedReplace.manifest.routeRevision).toBe(1);
      expect(afterFailedReplace.errorReason).toBe('insufficient_storage');
    });

    it('passe en état degraded si la trace est présente mais que les polices (glyphs) manquent', () => {
      const manager = new WatchOfflinePackManager(20_000_000);
      manager.stageManifest(sampleManifest, 1);
      manager.ingestChunk({
        packId: sampleManifest.packId,
        routeRevision: 1,
        chunkIndex: 0,
        totalChunks: 1,
        byteLength: 3_600_000,
        // 'res-glyphs' est absent !
        resourceIdsCovered: ['res-geom', 'res-maneuvers', 'res-style', 'res-tiles'],
        chunkChecksum: 'chk-partial',
      });

      const finalized = manager.verifyAndFinalizePack(
        sampleManifest.packId,
        'sha256-rev1-valid',
      );
      expect(finalized.status).toBe('degraded');
      expect(finalized.capabilities.viewRouteTrace).toBe(true);
      expect(finalized.capabilities.viewBaseMap).toBe(false);
      expect(finalized.errorReason).toBe('missing_required_resource');
    });
  });

  describe('4. Protocole Live Sync, champs personnalisés et POI à venir (K6.10, S6.01, S6.02)', () => {
    it('calcule les POI à venir le long du parcours, n’invente aucune métrique capteur absente et rejette les trames obsolètes', () => {
      const engine = new WatchLiveSyncEngine('phone', 1);

      const layoutValidation = validateCustomFieldLayout({
        sport: 'trail',
        maxSlotsPerPage: 3,
        pages: [
          ['distance_total_m', 'elevation_gain_m', 'heart_rate_bpm', 'pace_s_per_km'],
        ],
      });
      expect(layoutValidation.valid).toBe(false);
      expect(layoutValidation.normalizedPages[0]).toHaveLength(3);

      const pois = [
        {
          id: 'poi-passed',
          name: 'Col du Départ',
          category: 'waypoint' as const,
          lat: 45.1,
          lng: 5.7,
          distanceAlongRouteM: 500,
          eleM: 1000,
        },
        {
          id: 'poi-water',
          name: 'Source des Ayes',
          category: 'water' as const,
          lat: 45.12,
          lng: 5.72,
          distanceAlongRouteM: 2_400,
          eleM: 1350,
          maneuverInstruction: 'Prendre à droite vers la fontaine',
        },
        {
          id: 'poi-summit',
          name: 'Dent de Crolles',
          category: 'summit' as const,
          lat: 45.15,
          lng: 5.75,
          distanceAlongRouteM: 5_800,
          eleM: 2062,
        },
      ];

      const upcoming = computeUpcomingPois(pois, 1_200, { currentElevationM: 1150 });
      expect(upcoming.map((p) => p.id)).toEqual(['poi-water', 'poi-summit']);
      expect(upcoming[0].distanceRemainingM).toBe(1_200);
      expect(upcoming[0].elevationDeltaM).toBe(200);
      expect(upcoming[1].distanceRemainingM).toBe(4_600);
      expect(upcoming[1].elevationDeltaM).toBe(912);

      // Champ cardio absent (null) -> available: false, value: null, formatted: '—'
      const fields = buildLiveSyncCustomFields(
        ['distance_total_m', 'heart_rate_bpm', 'next_turn_distance_m'],
        {
          distanceM: 1_200,
          elevGainM: 180,
          movingS: 900,
          elapsedS: 950,
          heartRateBpm: null,
          offRoute: false,
          paused: false,
        },
        {
          instruction: 'Tourner à gauche au sentier GR9',
          direction: 'left',
          distanceToTurnM: 85,
        },
      );
      const hrField = fields.find((f) => f.key === 'heart_rate_bpm')!;
      expect(hrField.available).toBe(false);
      expect(hrField.value).toBeNull();
      expect(hrField.formatted).toBe('—');

      const turnField = fields.find((f) => f.key === 'next_turn_distance_m')!;
      expect(turnField.available).toBe(true);
      expect(turnField.value).toBe(85);

      // Séquence de trames et rejet de trame obsolète
      const frame1 = engine.buildFrame({
        sessionId: 'sess-1',
        routeId: 'route-1',
        metrics: {
          distanceM: 1_200,
          elevGainM: 180,
          movingS: 900,
          elapsedS: 950,
          offRoute: false,
          paused: false,
        },
        pois,
      });
      const frame2 = engine.buildFrame({
        sessionId: 'sess-1',
        routeId: 'route-1',
        metrics: {
          distanceM: 1_350,
          elevGainM: 195,
          movingS: 960,
          elapsedS: 1010,
          offRoute: true,
          offRouteDistanceM: 42,
          paused: false,
        },
        pois,
      });

      expect(engine.applyIncomingFrameOnWatch(frame2).accepted).toBe(true);
      // Trame 1 reçue en retard après trame 2 -> rejetée
      const staleRes = engine.applyIncomingFrameOnWatch(frame1);
      expect(staleRes.accepted).toBe(false);
      expect(staleRes.currentFrame.frameSeq).toBe(frame2.frameSeq);

      // Bascule de source téléphone -> montre
      const handoff = engine.handoffSource('sess-1', 'watch', 48, 1_700_000_050_000);
      expect(handoff.fromSource).toBe('phone');
      expect(handoff.toSource).toBe('watch');
      expect(handoff.lastAcceptedSeq).toBe(48);
      expect(handoff.newSourceGeneration).toBe(2);
    });
  });
});
