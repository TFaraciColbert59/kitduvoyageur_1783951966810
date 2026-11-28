import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveActivityProfile } from '../../specs/resolveActivityProfile';
import {
  createActivityDomainEvent,
  emitActivityEvent,
  resetActivityEventBusForTests,
  subscribeActivityEvent,
  toActivityOutboxRow,
} from '../activityEventBus';
import {
  computeGearLedgerDeltas,
  evaluateGearWearAlerts,
} from '../consumers/gearLedgerConsumer';
import { buildCarnetAndTripProjection } from '../consumers/carnetAndTripConsumer';
import { buildClubPokedexSafetyProjections } from '../consumers/clubPokedexSafetyConsumer';
import {
  buildAiActivityInsightPayload,
  computePhysiologyAndXp,
} from '../consumers/physiologyXpAiConsumer';
import { deduplicateAndMergeActivities } from '../../import/deduplicateAndMerge';

describe('Lot 08 — EventBus Cross-App, Ledger Matériel Réversible, IA Guard & Déduplication', () => {
  beforeEach(() => {
    resetActivityEventBusForTests();
  });

  it('émet les événements de manière strictement idempotente (T03)', async () => {
    const spy = vi.fn();
    subscribeActivityEvent(spy);

    const evt = createActivityDomainEvent('activity.completed.v1', {
      sessionId: 'sess-1',
      userId: 'user-1',
      revision: 1,
      payload: {
        sportSlug: 'trail_running',
        sourceOrigin: 'lkdv_native',
        distanceM: 12_400,
        movingS: 4_500,
        elapsedS: 4_800,
        elevGainM: 640,
        elevLossM: 640,
        rpe: 7,
        gearIds: ['shoe-1'],
        tripId: 'trip-9',
        waypoints: [{ id: 'wp-1', kind: 'danger', label: 'Éboulement', lat: 45.8, lng: 6.1 }],
        photosCount: 2,
        title: 'Boucle du Semnoz',
      },
    });

    const first = await emitActivityEvent(evt);
    const second = await emitActivityEvent(evt);
    expect(first.delivered).toBe(true);
    expect(second.delivered).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);

    const outbox = toActivityOutboxRow(evt);
    expect(outbox.idempotency_key).toBe('activity.completed.v1:sess-1:v1');

    const { tripExecution, carnetBridge } = buildCarnetAndTripProjection(evt);
    expect(tripExecution?.tripId).toBe('trip-9');
    expect(carnetBridge?.carnetUrl).toContain('attachSessionId=sess-1');

    const { safetyReports } = buildClubPokedexSafetyProjections(evt);
    expect(safetyReports).toHaveLength(1);
    expect(safetyReports[0]?.kind).toBe('danger');
  });

  it('calcule des deltas gear_usage_ledger exactement réversibles sur completed -> cropped -> split -> deleted (T09)', () => {
    const completed = createActivityDomainEvent('activity.completed.v1', {
      sessionId: 'sess-gear',
      userId: 'u-1',
      payload: {
        sportSlug: 'running',
        sourceOrigin: 'lkdv_native',
        distanceM: 10_000,
        movingS: 3600,
        elapsedS: 3600,
        elevGainM: 100,
        elevLossM: 100,
        gearIds: ['shoe-a'],
        waypoints: [],
        photosCount: 0,
        title: 'Run 10k',
      },
    });
    const cropped = createActivityDomainEvent('activity.cropped.v1', {
      sessionId: 'sess-gear',
      userId: 'u-1',
      revision: 2,
      payload: {
        sportSlug: 'running',
        gearIds: ['shoe-a'],
        previousDistanceM: 10_000,
        previousMovingS: 3600,
        newDistanceM: 8_000,
        newMovingS: 2880,
        reason: 'auto_crop_vehicle',
      },
    });
    const split = createActivityDomainEvent('activity.split.v1', {
      sessionId: 'sess-gear',
      userId: 'u-1',
      revision: 3,
      payload: {
        sportSlug: 'running',
        gearIds: ['shoe-a'],
        parentDistanceM: 8_000,
        parentMovingS: 2880,
        children: [
          { childSessionId: 'sess-child-1', distanceM: 5_000, movingS: 1800 },
          { childSessionId: 'sess-child-2', distanceM: 3_000, movingS: 1080 },
        ],
      },
    });

    const allDeltas = [
      ...computeGearLedgerDeltas(completed),
      ...computeGearLedgerDeltas(cropped),
      ...computeGearLedgerDeltas(split),
    ];
    const netDistance = allDeltas.reduce((acc, d) => acc + d.deltaDistanceM, 0);
    expect(netDistance).toBe(8_000);

    // Suppression annule complètement
    const delChild1 = createActivityDomainEvent('activity.deleted.v1', {
      sessionId: 'sess-child-1',
      userId: 'u-1',
      payload: { sportSlug: 'running', gearIds: ['shoe-a'], distanceM: 5_000, movingS: 1800 },
    });
    const delChild2 = createActivityDomainEvent('activity.deleted.v1', {
      sessionId: 'sess-child-2',
      userId: 'u-1',
      payload: { sportSlug: 'running', gearIds: ['shoe-a'], distanceM: 3_000, movingS: 1080 },
    });
    const finalNet =
      netDistance +
      computeGearLedgerDeltas(delChild1)[0].deltaDistanceM +
      computeGearLedgerDeltas(delChild2)[0].deltaDistanceM;
    expect(finalNet).toBe(0);

    // Alertes EPI & Usure
    const alerts = evaluateGearWearAlerts([
      {
        productOwnershipId: 'shoe-a',
        label: 'Hoka Speedgoat',
        category: 'trail_shoes',
        totalDistanceM: 820_000,
        totalHours: 90,
        totalCycles: 65,
      },
      {
        productOwnershipId: 'lanyard-1',
        label: 'Longe Via Ferrata EN 958',
        category: 'epi_via_ferrata_en958',
        totalDistanceM: 0,
        totalHours: 30,
        totalCycles: 12,
        severeFallRecorded: true,
      },
      {
        productOwnershipId: 'fox-36',
        label: 'Fourche Fox 36',
        category: 'fork_fox',
        totalDistanceM: 2_500_000,
        totalHours: 130,
        totalCycles: 50,
      },
    ]);
    expect(alerts.map((a) => a.code)).toContain('shoes_wear_replace');
    expect(alerts.map((a) => a.code)).toContain('epi_fall_retire_mandatory');
    expect(alerts.map((a) => a.code)).toContain('suspension_service_due');
  });

  it('bloque strictement Strava API et RGPD Art. 9 avant tout envoi IA et reste < 450 tokens (T15)', () => {
    const trail = resolveActivityProfile('trail_running');
    const basePayload = {
      sportSlug: 'trail_running',
      sourceOrigin: 'lkdv_native' as const,
      distanceM: 18_500,
      movingS: 6_300,
      elapsedS: 6_900,
      elevGainM: 1_120,
      elevLossM: 1_120,
      avgHrBpm: 154,
      maxHrBpm: 186,
      restingHrBpm: 52,
      rpe: 8,
      gearIds: [],
      waypoints: [],
      photosCount: 1,
      title: 'Trail des Aravis',
      notes: 'Super conditions, un peu de névé au col.',
    };

    const allowed = buildAiActivityInsightPayload(trail, basePayload);
    expect(allowed.allowed).toBe(true);
    if (allowed.allowed) {
      expect(allowed.estimatedTokens).toBeLessThan(450);
      expect(JSON.stringify(allowed.payload)).not.toContain('lat');
    }

    const stravaBlocked = buildAiActivityInsightPayload(trail, {
      ...basePayload,
      sourceOrigin: 'strava_api',
    });
    expect(stravaBlocked).toEqual({ allowed: false, reason: 'strava_api_prohibition' });

    const art9Profile = {
      ...trail,
      privacyAndCompliance: {
        ...trail.privacyAndCompliance,
        rgpdArt9SensitiveHealth: true,
        aiInsightAllowedDefault: false,
      },
    };
    const art9Blocked = buildAiActivityInsightPayload(art9Profile, basePayload);
    expect(art9Blocked).toEqual({ allowed: false, reason: 'rgpd_art9_sensitive' });

    const phys = computePhysiologyAndXp(trail, basePayload);
    expect(phys.trainingLoadScore).toBeGreaterThan(0);
    expect(phys.xpEarned).toBeGreaterThan(50);
  });

  it('déduplique une montre Garmin .FIT et un enregistrement iPhone LKDV sans perdre photos/repères/carnet (T14)', () => {
    const t0 = Date.UTC(2026, 10, 27, 8, 0, 0);
    const iphoneSession = {
      id: 'sess-iphone',
      sourceOrigin: 'lkdv_native' as const,
      sportSlug: 'trail_running',
      startedAtMs: t0,
      endedAtMs: t0 + 3_600_000,
      distanceM: 10_200,
      elevGainM: 450,
      startLat: 45.899,
      startLng: 6.129,
      photoUrls: ['r2://photos/sommet.jpg'],
      waypoints: [{ id: 'wp-1', kind: 'water', label: 'Source', lat: 45.91, lng: 6.14 }],
      gearIds: ['shoe-1'],
      carnetId: 'carnet-42',
      notes: 'Belle lumière matinale',
    };
    const garminFit = {
      id: 'sess-garmin',
      sourceOrigin: 'garmin_fit' as const,
      sportSlug: 'trail_running',
      startedAtMs: t0 + 45_000,
      endedAtMs: t0 + 3_620_000,
      distanceM: 10_350,
      elevGainM: 472,
      startLat: 45.8995,
      startLng: 6.1292,
      avgHrBpm: 158,
      avgPowerW: 240,
    };

    const res = deduplicateAndMergeActivities(iphoneSession, garminFit);
    expect(res).not.toBeNull();
    expect(res?.winnerId).toBe('sess-garmin');
    expect(res?.merged.avgHrBpm).toBe(158);
    expect(res?.merged.photoUrls).toEqual(['r2://photos/sommet.jpg']);
    expect(res?.merged.waypoints).toHaveLength(1);
    expect(res?.merged.carnetId).toBe('carnet-42');
    expect(res?.merged.gearIds).toEqual(['shoe-1']);
  });
});
