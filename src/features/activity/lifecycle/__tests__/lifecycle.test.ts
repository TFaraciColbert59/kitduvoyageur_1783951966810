import { describe, expect, it } from 'vitest';
import {
  SOFT_DELETE_RETENTION_MS,
  applyQuickEditAfterSync,
  applyVersionedGpsSpikeCorrection,
  canRestoreActivity,
  closeDetailDrawerAndRestoreList,
  closeSubDrawerAndRestoreParent,
  computeActivityStats,
  correctDistanceAndElevation,
  createDrawerNavigationContext,
  cropActivityTrace,
  deriveQuickEditState,
  dismissQuickEditAfterSync,
  isSearchResponseStale,
  manageActivityMedia,
  mergeUnifiedActivityHistory,
  normalizeExplorerActivitySession,
  normalizeLegacyHikeSession,
  openActivityDetailDrawer,
  openActivitySubDrawer,
  parseActivitySearchQuery,
  previewCropActivityTrace,
  purgeExpiredActivities,
  removeSearchCriterion,
  restoreActivity,
  restoreOriginalGeometry,
  revertDistanceAndElevationCorrection,
  searchActivities,
  smoothGpsSpeedSpikes,
  softDeleteActivity,
  splitActivityTrace,
  updateActivityMetadata,
  type LifecyclePoint,
} from '@/features/compte/lifecycle';

/**
 * Construit une trace synthétique réaliste (pas de ~111 m par 0.001° de latitude).
 */
function buildSyntheticTrack(): LifecyclePoint[] {
  // 0.001 deg lat ≈ 111.195 m
  // Sur 30 s par segment -> ~3.7 m/s (~13.3 km/h), valide en course/trail/rando/vélo
  const baseMs = Date.parse('2026-09-12T08:00:00.000Z');
  const points: LifecyclePoint[] = [];
  for (let i = 0; i <= 12; i += 1) {
    // Pause stationnaire entre i=5 et i=6 (même position pendant 60 s)
    const latStep = i <= 5 ? i : i - 1;
    const tOffsetS = i <= 5 ? i * 30 : 5 * 30 + 60 + (i - 6) * 30;
    points.push({
      lat: 45.1 + latStep * 0.001,
      lng: 6.1,
      elevationM: 1200 + latStep * 15,
      timestamp: new Date(baseMs + tOffsetS * 1000).toISOString(),
      heartRateBpm: i === 4 ? 0 : i === 8 ? null : 140 + i,
      cadenceRpm: i === 6 ? 0 : 82,
    });
  }
  return points;
}

describe('Lot A02 — S1.17 & S2.01 : Historique unifié, temps écoulé vs en mouvement et capteurs', () => {
  it('unifie une ancienne randonnée (hike_sessions) et une nouvelle séance (activity_sessions) sans perdre leur ID ni leur provenance', () => {
    const legacy = normalizeLegacyHikeSession({
      id: 'hike-legacy-001',
      user_id: 'user-1',
      route_id: 42,
      route_name: 'Tour du Vercors',
      massif: 'Vercors',
      title: 'Traversée des Hauts Plateaux',
      started_at: '2026-08-10T07:00:00.000Z',
      ended_at: '2026-08-10T11:00:00.000Z',
      distance_km: 14.5,
      duration_seconds: 14400,
      elevation_gain_m: 680,
      max_altitude_m: 1950,
      visibility: 'collective_anonymized',
      kit_id: 'kit-bivouac-1',
      gear_ids: ['gear-1', 'gear-2'],
    });

    const explorer = normalizeExplorerActivitySession({
      id: 'act-exp-002',
      user_id: 'user-1',
      client_session_id: '550e8400-e29b-41d4-a716-446655440000',
      sport: 'trail',
      variant_id: 'trail-10k',
      route_name: 'Crêtes de Chamechaude',
      massif: 'Chartreuse',
      title: 'Sortie matinale Chartreuse',
      started_at: '2026-09-12T08:00:00.000Z',
      ended_at: '2026-09-12T08:06:30.000Z',
      synced_at: '2026-09-12T08:07:00.000Z',
      points: buildSyntheticTrack(),
    });

    const history = mergeUnifiedActivityHistory([legacy], [explorer]);
    expect(history).toHaveLength(2);
    // Plus récente d'abord
    expect(history[0].id).toBe('act-exp-002');
    expect(history[0].provenance.origin).toBe('activity_session');
    expect(history[0].provenance.label).toBe('Séance Explorer');
    expect(history[1].id).toBe('hike-legacy-001');
    expect(history[1].provenance.origin).toBe('hike_session');
    expect(history[1].provenance.label).toBe('Randonnée historique');
    expect(history[1].stats.distanceM).toBe(14500);
    expect(history[1].stats.elevationGainM).toBe(680);
    expect(history[1].kitId).toBe('kit-bivouac-1');
  });

  it('distingue déterministiquement temps écoulé, temps en mouvement, pauses et lacunes capteurs (0 vs null)', () => {
    const points = buildSyntheticTrack();
    const stats = computeActivityStats(points, 'trail');

    // 11 segments en mouvement de 30s = 330s, plus 1 segment immobile de 60s = 390s écoulés
    expect(stats.elapsedTimeS).toBe(390);
    expect(stats.movingTimeS).toBe(330);
    expect(stats.pauseTimeS).toBe(60);
    expect(stats.pauseCount).toBeGreaterThanOrEqual(1);

    // 11 pas de 0.001° (~111.2m) ≈ 1223 m, D+ = 11 * 15 = 165 m
    expect(stats.distanceM).toBeGreaterThan(1200);
    expect(stats.distanceM).toBeLessThan(1250);
    expect(stats.elevationGainM).toBe(165);
    expect(stats.elevationLossM).toBe(0);
    expect(stats.minAltitudeM).toBe(1200);
    expect(stats.maxAltitudeM).toBe(1365);

    // Splits kilométriques : 1 km complet + 1 km en cours
    expect(stats.splitsKm.length).toBe(2);
    expect(stats.splitsKm[0].completed).toBe(true);
    expect(stats.splitsKm[0].distanceM).toBe(1000);

    // Capteurs : le point à 0 bpm et le point à null sont comptés comme lacunes (gapCount = 2), jamais moyennés à 0
    expect(stats.heartRate.status).toBe('partial');
    expect(stats.heartRate.sampleCount).toBe(11);
    expect(stats.heartRate.gapCount).toBe(2);
    expect(stats.heartRate.min).toBeGreaterThanOrEqual(140);

    // Cadence : 0 rpm pendant la pause est une mesure valide (pas une lacune), puissance absente -> unavailable
    expect(stats.cadence.status).toBe('measured');
    expect(stats.cadence.min).toBe(0);
    expect(stats.power.status).toBe('unavailable');
    expect(stats.power.avg).toBeNull();
  });

  it('distingue altitude 0 m (niveau de la mer) et altitude null (manquante)', () => {
    const coastalPoints: LifecyclePoint[] = [
      { lat: 43.29, lng: 5.36, elevationM: 0, timestamp: '2026-09-12T08:00:00Z' },
      { lat: 43.291, lng: 5.36, elevationM: null, timestamp: '2026-09-12T08:01:00Z' },
      { lat: 43.292, lng: 5.36, elevationM: 12, timestamp: '2026-09-12T08:02:00Z' },
    ];
    const stats = computeActivityStats(coastalPoints, 'rando');
    expect(stats.minAltitudeM).toBe(0);
    expect(stats.maxAltitudeM).toBe(12);
    expect(stats.elevationGainM).toBe(12);
  });
});

describe('Lot A02 — K5.10 : Correction et lissage des pics GPS de vitesse', () => {
  it('écarte un pic de téléportation GPS sans modifier originalPoints et recalcule la vitesse max par sport', () => {
    const basePoints = buildSyntheticTrack();
    // Injection d'un pic aberrant au point 3 : saut à 45.25 (~16 km en 30 s = 533 m/s)
    const noisyPoints: LifecyclePoint[] = basePoints.map((pt, idx) =>
      idx === 3
        ? { ...pt, lat: 45.25, speedMs: 180 }
        : pt,
    );

    const smoothing = smoothGpsSpeedSpikes(noisyPoints, 'rando');
    expect(smoothing.spikes.length).toBeGreaterThanOrEqual(1);
    expect(smoothing.spikes[0].pointIndex).toBe(3);
    expect(smoothing.originalPoints).toHaveLength(noisyPoints.length);
    expect(smoothing.originalPoints[3].lat).toBe(45.25);
    expect(smoothing.cleanedPoints.some((p) => p.lat === 45.25)).toBe(false);
    expect(smoothing.rawMaxSpeedKmh).toBeGreaterThan(500);
    // En randonnée, plafond 5 m/s = 18 km/h
    expect(smoothing.correctedMaxSpeedKmh).toBeLessThanOrEqual(18);

    // Application versionnée sur une fiche
    const record = normalizeExplorerActivitySession({
      id: 'act-spike-1',
      user_id: 'user-1',
      sport: 'rando',
      points: noisyPoints,
    });
    const corrected = applyVersionedGpsSpikeCorrection(record, {
      operationId: 'op-spike-1',
      nowIso: '2026-09-12T09:00:00.000Z',
    });
    expect(corrected.revision).toBe(2);
    expect(corrected.originalPoints).toHaveLength(noisyPoints.length);
    expect(corrected.points.length).toBe(smoothing.cleanedPoints.length);
    expect(corrected.recordsEligibility.invalidatedRecords).toBe(true);

    // Idempotence avec le même operationId
    const replay = applyVersionedGpsSpikeCorrection(corrected, {
      operationId: 'op-spike-1',
    });
    expect(replay.revision).toBe(2);
  });
});

describe('Lot A02 — K5.04, S1.18 & S1.20 : Édition nom/sport/variante/tags, médias et édition rapide post-sync', () => {
  it('modifie le nom, reclasse le sport, valide les tags (course, sortie_longue, trajet, cause) et invalide les anciens records', () => {
    const record = normalizeExplorerActivitySession({
      id: 'act-edit-1',
      user_id: 'user-1',
      sport: 'course',
      variant_id: 'course-route',
      title: 'Sortie du matin',
      points: buildSyntheticTrack(),
    });

    const outcome = updateActivityMetadata(
      record,
      {
        title: ' Vélotaf & sortie longue ',
        sport: 'velo',
        variantId: 'velo-gravel',
        tags: ['trajet', 'sortie_longue', 'trajet'],
        visibility: 'collective_anonymized',
      },
      { actorUserId: 'user-1', nowIso: '2026-09-12T10:00:00.000Z' },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.sportChanged).toBe(true);
    expect(outcome.record.title).toBe('Vélotaf & sortie longue');
    expect(outcome.record.sport).toBe('velo');
    expect(outcome.record.variantId).toBe('velo-gravel');
    expect(outcome.record.tags).toEqual(['trajet', 'sortie_longue']);
    expect(outcome.record.visibility).toBe('collective_anonymized');
    expect(outcome.record.recordsEligibility.invalidatedRecords).toBe(true);
    expect(outcome.projectionEvent?.kind).toBe('invalidate_sport_records');
    expect(outcome.projectionEvent?.previousSport).toBe('course');
    expect(outcome.projectionEvent?.currentSport).toBe('velo');

    // Rejette une variante incompatible avec le sport
    const badVariant = updateActivityMetadata(outcome.record, {
      sport: 'rando',
      variantId: 'velo-route',
    });
    expect(badVariant.ok).toBe(false);
    if (!badVariant.ok) {
      expect(badVariant.code).toBe('variant_sport_mismatch');
    }

    // Rejette un tag inconnu
    const badTag = updateActivityMetadata(outcome.record, {
      tags: ['tag_inexistant'],
    });
    expect(badTag.ok).toBe(false);
    if (!badTag.ok) {
      expect(badTag.code).toBe('invalid_tag');
    }
  });

  it('gère de façon homogène les médias (ajout, légende, couverture, réordonnancement, suppression)', () => {
    let record = normalizeLegacyHikeSession({
      id: 'hike-media-1',
      user_id: 'user-42',
      title: 'Lac Blanc',
    });

    // Rejette un chemin appartenant à un autre utilisateur
    const badPath = manageActivityMedia(record, {
      type: 'add',
      id: 'm1',
      storagePath: 'other-user/photo1.jpg',
    });
    expect(badPath.ok).toBe(false);

    const add1 = manageActivityMedia(record, {
      type: 'add',
      id: 'm1',
      storagePath: 'user-42/photo1.jpg',
      caption: 'Départ du sentier',
    });
    expect(add1.ok).toBe(true);
    if (!add1.ok) return;
    record = add1.record;

    const add2 = manageActivityMedia(record, {
      type: 'add',
      id: 'm2',
      storagePath: 'user-42/photo2.jpg',
      caption: 'Sommet',
    });
    expect(add2.ok).toBe(true);
    if (!add2.ok) return;
    record = add2.record;

    expect(record.media).toHaveLength(2);
    expect(record.coverUrl).toBe('user-42/photo1.jpg');

    // Changement de couverture
    const setCover = manageActivityMedia(record, {
      type: 'set_cover',
      id: 'm2',
    });
    expect(setCover.ok).toBe(true);
    if (!setCover.ok) return;
    record = setCover.record;
    expect(record.coverUrl).toBe('user-42/photo2.jpg');
    expect(record.media[0].id).toBe('m2');
    expect(record.media[0].position).toBe(0);
    expect(record.media[1].position).toBe(1);

    // Suppression de la couverture -> la photo restante devient couverture
    const rem = manageActivityMedia(record, {
      type: 'remove',
      id: 'm2',
    });
    expect(rem.ok).toBe(true);
    if (!rem.ok) return;
    expect(rem.record.media).toHaveLength(1);
    expect(rem.record.coverUrl).toBe('user-42/photo1.jpg');
  });

  it('gère l’état temporaire d’édition rapide après synchronisation (S1.18)', () => {
    const syncMs = Date.parse('2026-09-12T08:10:00.000Z');
    const syncedRecord = normalizeExplorerActivitySession(
      {
        id: 'act-sync-1',
        user_id: 'user-1',
        sport: 'course',
        origin: 'device_import',
        device_name: 'Garmin Forerunner',
        synced_at: '2026-09-12T08:10:00.000Z',
        points: buildSyntheticTrack(),
      },
      syncMs + 60_000,
    );

    expect(syncedRecord.quickEditState.status).toBe('pending');
    expect(syncedRecord.quickEditState.visible).toBe(true);
    expect(syncedRecord.provenance.label).toContain('Garmin Forerunner');

    // Résolution par édition rapide
    const applied = applyQuickEditAfterSync(syncedRecord, {
      title: 'Fractionné piste',
      sport: 'course',
      tags: ['course'],
      kitId: 'kit-run',
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.record.quickEditState.status).toBe('resolved');
    expect(applied.record.quickEditState.visible).toBe(false);

    // Fermeture explicite sans modification
    const dismissed = dismissQuickEditAfterSync(syncedRecord);
    expect(dismissed.quickEditState.status).toBe('dismissed');
    expect(dismissed.quickEditState.visible).toBe(false);

    // Expiration automatique après la fenêtre de 24h
    const expiredState = deriveQuickEditState(
      syncedRecord,
      syncMs + 25 * 3_600_000,
    );
    expect(expiredState.status).toBe('expired');
    expect(expiredState.visible).toBe(false);
  });
});

describe('Lot A02 — K5.07 & S1.22 : Recadrage (crop) et fractionnement (split) idempotents et réversibles', () => {
  it('recadre la fin indésirable d’une trace avec aperçu, idempotence et restauration de la géométrie d’origine', () => {
    const initialPoints = buildSyntheticTrack(); // 13 points (0..12)
    const record = normalizeExplorerActivitySession({
      id: 'act-crop-1',
      user_id: 'user-1',
      sport: 'rando',
      points: initialPoints,
    });

    // Aperçu avant écriture : coupe des 3 derniers points (fin indésirable en voiture)
    const previewRes = previewCropActivityTrace(record, {
      startIndex: 0,
      endIndex: 9,
    });
    expect(previewRes.ok).toBe(true);
    if (!previewRes.ok) return;
    expect(previewRes.preview.removedEndPoints).toBe(3);
    expect(previewRes.preview.afterStats.distanceM).toBeLessThan(
      record.stats.distanceM,
    );

    // Application du recadrage
    const cropRes = cropActivityTrace(
      record,
      {
        operationId: 'crop-op-1',
        startIndex: 0,
        endIndex: 9,
      },
      '2026-09-12T12:00:00.000Z',
    );
    expect(cropRes.ok).toBe(true);
    if (!cropRes.ok) return;

    expect(cropRes.idempotentReplay).toBe(false);
    expect(cropRes.record.points).toHaveLength(10);
    // Invariant : originalPoints garde les 13 points d'origine
    expect(cropRes.record.originalPoints).toHaveLength(13);
    expect(cropRes.record.stats.distanceM).toBe(
      previewRes.preview.afterStats.distanceM,
    );
    expect(cropRes.record.recordsEligibility.invalidatedRecords).toBe(true);
    expect(cropRes.projectionEvent.deltaDistanceM).toBeLessThan(0);

    // Rejeu idempotent avec le même operationId
    const replayRes = cropActivityTrace(cropRes.record, {
      operationId: 'crop-op-1',
      startIndex: 0,
      endIndex: 9,
    });
    expect(replayRes.ok).toBe(true);
    if (replayRes.ok) {
      expect(replayRes.idempotentReplay).toBe(true);
      expect(replayRes.record.revision).toBe(cropRes.record.revision);
    }

    // Bornes invalides refusées
    const invalidCrop = cropActivityTrace(record, {
      startIndex: 8,
      endIndex: 8,
    });
    expect(invalidCrop.ok).toBe(false);

    // Réversibilité complète vers originalPoints
    const restored = restoreOriginalGeometry(
      cropRes.record,
      '2026-09-12T12:05:00.000Z',
    );
    expect(restored.points).toHaveLength(13);
    expect(restored.stats.distanceM).toBe(record.stats.distanceM);
    expect(restored.recordsEligibility.invalidatedRecords).toBe(false);
  });

  it('fractionne (split) une activité en deux séances indépendantes avec filiation et recalcul des statistiques', () => {
    const initialPoints = buildSyntheticTrack(); // 13 points (0..12)
    const record = normalizeExplorerActivitySession({
      id: 'act-split-1',
      user_id: 'user-1',
      sport: 'trail',
      title: 'Traversée Belledonne',
      points: initialPoints,
    });

    const splitRes = splitActivityTrace(
      record,
      {
        operationId: 'split-op-1',
        splitIndices: [6],
        partTitles: ['Montée au col', 'Descente vallon'],
      },
      '2026-09-12T14:00:00.000Z',
    );

    expect(splitRes.ok).toBe(true);
    if (!splitRes.ok) return;

    expect(splitRes.parts).toHaveLength(2);
    const [part1, part2] = splitRes.parts;

    expect(part1.id).toBe('act-split-1__part_1');
    expect(part2.id).toBe('act-split-1__part_2');
    expect(part1.title).toBe('Montée au col');
    expect(part2.title).toBe('Descente vallon');
    expect(part1.parentActivityId).toBe('act-split-1');
    expect(part2.parentActivityId).toBe('act-split-1');
    expect(part1.points).toHaveLength(7); // 0..6
    expect(part2.points).toHaveLength(7); // 6..12

    // La somme des distances et D+ des deux tronçons correspond à la trace entière
    expect(
      Math.round(part1.stats.distanceM + part2.stats.distanceM),
    ).toBeCloseTo(record.stats.distanceM, 0);
    expect(part1.stats.elevationGainM + part2.stats.elevationGainM).toBe(
      record.stats.elevationGainM,
    );

    // Idempotence du split
    const replaySplit = splitActivityTrace(splitRes.parentRecord, {
      operationId: 'split-op-1',
      splitIndices: [6],
    });
    expect(replaySplit.ok).toBe(true);
    if (replaySplit.ok) {
      expect(replaySplit.idempotentReplay).toBe(true);
    }
  });
});

describe('Lot A02 — S1.23 : Correction de distance et de dénivelé avec méthode et annulation', () => {
  it('applique une projection DEM et une surcharge manuelle puis annule la correction pour restaurer les mesures d’origine', () => {
    const points = buildSyntheticTrack(); // 13 points
    const record = normalizeExplorerActivitySession({
      id: 'act-corr-1',
      user_id: 'user-1',
      sport: 'rando',
      points,
    });
    const originalGain = record.stats.elevationGainM;
    const originalDistance = record.stats.distanceM;

    // 1. Correction par projection DEM (avec un trou DEM null au point 2 qui ne doit pas inventer 0)
    const demElevations = points.map((_, idx) =>
      idx === 2 ? null : 1000 + idx * 10,
    );
    const demCorrected = correctDistanceAndElevation(
      record,
      {
        operationId: 'corr-dem-1',
        elevationMethod: 'dem_projection',
        demElevationsM: demElevations,
      },
      '2026-09-12T15:00:00.000Z',
    );

    expect(demCorrected.ok).toBe(true);
    if (!demCorrected.ok) return;
    expect(demCorrected.record.correctionState.elevationMethod).toBe(
      'dem_projection',
    );
    expect(demCorrected.record.points[2].elevationM).toBeNull();
    expect(demCorrected.record.stats.elevationGainM).toBe(120);
    // La trace brute d'origine est intacte
    expect(demCorrected.record.originalPoints[2].elevationM).not.toBeNull();

    // 2. Correction manuelle de distance et de D+
    const manualCorrected = correctDistanceAndElevation(
      demCorrected.record,
      {
        operationId: 'corr-man-1',
        distanceMethod: 'manual_override',
        manualDistanceM: 1500,
        elevationMethod: 'manual_override',
        manualElevationGainM: 210,
      },
      '2026-09-12T15:05:00.000Z',
    );
    expect(manualCorrected.ok).toBe(true);
    if (!manualCorrected.ok) return;
    expect(manualCorrected.record.stats.distanceM).toBe(1500);
    expect(manualCorrected.record.stats.elevationGainM).toBe(210);
    // Une surcharge manuelle retire l'éligibilité aux records automatiques
    expect(manualCorrected.record.recordsEligibility.eligible).toBe(false);

    // 3. Annulation de la correction -> retour aux valeurs mesurées d'origine
    const reverted = revertDistanceAndElevationCorrection(
      manualCorrected.record,
      '2026-09-12T15:10:00.000Z',
    );
    expect(reverted.ok).toBe(true);
    if (!reverted.ok) return;
    expect(reverted.record.correctionState.distanceMethod).toBe('raw');
    expect(reverted.record.correctionState.elevationMethod).toBe('raw');
    expect(reverted.record.stats.distanceM).toBe(originalDistance);
    expect(reverted.record.stats.elevationGainM).toBe(originalGain);
    expect(reverted.record.recordsEligibility.eligible).toBe(true);
  });
});

describe('Lot A02 — S1.24 : Suppression logique et restauration pendant 30 jours', () => {
  it('supprime une séance, met à jour les projections une seule fois, restaure sous 30 jours et refuse au-delà', () => {
    const deletedAtIso = '2026-09-12T10:00:00.000Z';
    const deletedAtMs = Date.parse(deletedAtIso);

    const record = normalizeExplorerActivitySession({
      id: 'act-del-1',
      user_id: 'user-1',
      sport: 'course',
      points: buildSyntheticTrack(),
    });

    // Un tiers ne peut pas supprimer
    const forbiddenDel = softDeleteActivity(record, {
      actorUserId: 'other-user',
      deletedAtIso,
    });
    expect(forbiddenDel.ok).toBe(false);

    // Suppression par le propriétaire
    const delOutcome = softDeleteActivity(record, {
      actorUserId: 'user-1',
      deletedAtIso,
    });
    expect(delOutcome.ok).toBe(true);
    if (!delOutcome.ok) return;
    expect(delOutcome.alreadyDeleted).toBe(false);
    expect(delOutcome.record.lifecycleStatus).toBe('deleted');
    expect(delOutcome.projectionEvent?.kind).toBe('exclude_from_projections');
    expect(delOutcome.projectionEvent?.deltaDistanceM).toBe(
      -record.stats.distanceM,
    );

    // Rejeu idempotent de suppression : n'émet pas de second événement de retrait
    const secondDel = softDeleteActivity(delOutcome.record, {
      actorUserId: 'user-1',
      deletedAtIso,
    });
    expect(secondDel.ok).toBe(true);
    if (secondDel.ok) {
      expect(secondDel.alreadyDeleted).toBe(true);
      expect(secondDel.projectionEvent).toBeNull();
    }

    // À J+15 : éligible à la restauration
    const day15Ms = deletedAtMs + 15 * 86_400_000;
    const elig15 = canRestoreActivity(delOutcome.record, {
      actorUserId: 'user-1',
      nowMs: day15Ms,
    });
    expect(elig15.eligible).toBe(true);
    expect(elig15.remainingDays).toBe(15);

    const restored = restoreActivity(delOutcome.record, {
      actorUserId: 'user-1',
      restoredAtIso: new Date(day15Ms).toISOString(),
    });
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.record.lifecycleStatus).toBe('active');
      expect(restored.record.deletedAt).toBeNull();
      expect(restored.projectionEvent.kind).toBe('include_in_projections');
      expect(restored.projectionEvent.deltaDistanceM).toBe(
        record.stats.distanceM,
      );
    }

    // À J+31 : délai de 30 jours dépassé -> restauration refusée et purgeable
    const day31Ms = deletedAtMs + SOFT_DELETE_RETENTION_MS + 86_400_000;
    const expiredRestore = restoreActivity(delOutcome.record, {
      actorUserId: 'user-1',
      restoredAtIso: new Date(day31Ms).toISOString(),
    });
    expect(expiredRestore.ok).toBe(false);
    if (!expiredRestore.ok) {
      expect(expiredRestore.code).toBe('retention_expired');
    }

    const purgeResult = purgeExpiredActivities([delOutcome.record], day31Ms);
    expect(purgeResult.purgedIds).toEqual(['act-del-1']);
    expect(purgeResult.retained).toHaveLength(0);
  });
});

describe('Lot A02 — S2.16 : Recherche par sport, date, lieu et conservation du contexte des drawers', () => {
  const randoVercors = normalizeLegacyHikeSession({
    id: 'hike-vercors-1',
    user_id: 'user-1',
    route_name: 'Grand Veymont',
    massif: 'Vercors',
    title: 'Ascension du Grand Veymont',
    started_at: '2026-08-15T06:30:00.000Z',
    distance_km: 18,
    duration_seconds: 18000,
    elevation_gain_m: 950,
    visibility: 'collective_anonymized',
  });

  const trailChartreuse = normalizeExplorerActivitySession({
    id: 'act-chartreuse-2',
    user_id: 'user-1',
    sport: 'trail',
    massif: 'Chartreuse',
    title: 'Trail Chamechaude',
    tags: ['sortie_longue'],
    started_at: '2026-09-12T08:00:00.000Z',
    visibility: 'private',
    points: buildSyntheticTrack(),
  });

  const veloBelledonne = normalizeExplorerActivitySession({
    id: 'act-velo-3',
    user_id: 'user-2',
    sport: 'velo',
    massif: 'Belledonne',
    title: 'Gravel Balcons de Belledonne',
    tags: ['trajet'],
    started_at: '2026-09-20T09:00:00.000Z',
    visibility: 'private',
    points: buildSyntheticTrack(),
  });

  const allRecords = [randoVercors, trailChartreuse, veloBelledonne];

  it('analyse la requête, retrouve les séances par sport/date/lieu et exclut les séances privées des tiers ou supprimées', () => {
    const res1 = searchActivities(
      allRecords,
      'trail septembre 2026 Chartreuse sortie longue',
      { viewerUserId: 'user-1', requestSeq: 3 },
    );

    expect(res1.criteria.sports).toEqual(['trail']);
    expect(res1.criteria.tags).toEqual(['sortie_longue']);
    expect(res1.criteria.dateRange.label).toBe('septembre 2026');
    expect(res1.criteria.placeTerms).toContain('chartreuse');
    expect(res1.items).toHaveLength(1);
    expect(res1.items[0].id).toBe('act-chartreuse-2');

    // Correction d'un critère compris (retrait du sport 'trail' et du lieu 'chartreuse')
    let corrected = removeSearchCriterion(res1.criteria, {
      kind: 'sport',
      value: 'trail',
    });
    corrected = removeSearchCriterion(corrected, {
      kind: 'tag',
      value: 'sortie_longue',
    });
    corrected = removeSearchCriterion(corrected, {
      kind: 'place',
      value: 'chartreuse',
    });
    corrected = removeSearchCriterion(corrected, {
      kind: 'date',
      value: 'septembre 2026',
    });

    // Recherche globale pour user-1 : voit ses 2 séances mais PAS la séance privée de user-2
    const resAllUser1 = searchActivities(allRecords, corrected, {
      viewerUserId: 'user-1',
      requestSeq: 4,
    });
    expect(resAllUser1.items.map((r) => r.id)).toEqual([
      'act-chartreuse-2',
      'hike-vercors-1',
    ]);
    expect(isSearchResponseStale(res1, resAllUser1.requestSeq)).toBe(true);

    // Un tiers (user-2) voit sa propre séance privée et la randonnée 'collective_anonymized' de user-1, mais pas le trail privé de user-1
    const resUser2 = searchActivities(allRecords, '', {
      viewerUserId: 'user-2',
    });
    expect(resUser2.items.map((r) => r.id)).toEqual([
      'act-velo-3',
      'hike-vercors-1',
    ]);
  });

  it('préserve le contexte de recherche et du drawer parent lors de l’ouverture et de la fermeture d’un sous-drawer', () => {
    let nav = createDrawerNavigationContext('rando Vercors 2026');
    expect(nav.parentSurface).toBe('search_results');
    expect(nav.searchCriteria?.sports).toEqual(['rando']);

    // Ouverture de la fiche détail depuis la recherche à scrollOffset = 340px
    nav = openActivityDetailDrawer(nav, 'hike-vercors-1', 340);
    expect(nav.activeActivityId).toBe('hike-vercors-1');
    expect(nav.scrollOffsetPx).toBe(340);

    // Ouverture du sous-drawer de recadrage K5.07 / S1.22
    nav = openActivitySubDrawer(nav, 'crop_split');
    expect(nav.activeSubDrawer).toBe('crop_split');

    // Retour du sous-drawer -> restaure la fiche détail parente et la recherche
    nav = closeSubDrawerAndRestoreParent(nav);
    expect(nav.activeSubDrawer).toBeNull();
    expect(nav.activeActivityId).toBe('hike-vercors-1');
    expect(nav.searchQuery).toBe('rando Vercors 2026');

    // Fermeture de la fiche détail -> restaure la liste de résultats et le scrollOffset
    nav = closeDetailDrawerAndRestoreList(nav);
    expect(nav.activeActivityId).toBeNull();
    expect(nav.searchQuery).toBe('rando Vercors 2026');
    expect(nav.scrollOffsetPx).toBe(340);
  });
});
