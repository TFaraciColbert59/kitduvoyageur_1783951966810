/**
 * Phase 6 — Fusion champ par champ (TEST-PHASE6-MERGE).
 *
 *   • TEST-PHASE6-MERGE-01 : positions/POI en union dédupliquée et ordonnée ;
 *   • TEST-PHASE6-MERGE-02 : métriques monotones, aucune régression ;
 *   • TEST-PHASE6-MERGE-03 : identités jamais écrasées, `ended_at` maximum ;
 *   • TEST-PHASE6-MERGE-04 : décision plus récente gagne, plus ancienne ignorée ;
 *   • TEST-PHASE6-MERGE-05 : pas de résurrection d'un statut terminal ;
 *   • TEST-PHASE6-MERGE-06 : intégration `syncOfflineBatch` — deux rejeux de
 *     session fusionnent sans perte de positions ni de POI.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  MAX_SESSION_MERGE_POI_EVENTS,
  mergeDecisionFields,
  mergeSessionFields,
} from '@/features/adventure-intelligence/domain/syncMerge';
import {
  syncOfflineBatch,
  type OfflineSyncAppliedRecord,
  type OfflineSyncClient,
} from '@/features/adventure-intelligence/server/offlineSync';
import { createOfflineOperation } from '@/features/adventure-intelligence/offline/operations';

function position(lat: number, timestamp: string) {
  return { lat, lng: 6 + lat, timestamp };
}

describe('Phase 6 — fusion champ par champ (TEST-PHASE6-MERGE)', () => {
  it('TEST-PHASE6-MERGE-01: positions et POI en union dédupliquée et chronologique', () => {
    const existing = {
      startedAt: '2026-09-12T08:00:00.000Z',
      endedAt: null,
      distanceKm: 5,
      durationSeconds: 3600,
      elevationGainM: 200,
      positions: [position(45.1, '2026-09-12T08:00:00.000Z'), position(45.2, '2026-09-12T08:30:00.000Z')],
      poiEvents: [{ poiName: 'Refuge', reachedAt: '2026-09-12T08:20:00.000Z' }],
      routeId: 42,
      kitId: null,
      carnetId: null,
    };
    const incoming = {
      createdAt: '2026-09-12T10:00:00.000Z',
      endedAt: null,
      distanceKm: 5,
      durationSeconds: 3600,
      elevationGainM: 200,
      // Le rejeu contient le doublon 08:30 et un nouveau fix plus récent ;
      // l'ordre d'arrivée est inversé pour prouver le tri chronologique.
      positions: [
        position(45.3, '2026-09-12T09:30:00.000Z'),
        position(45.2, '2026-09-12T08:30:00.000Z'),
      ],
      poiEvents: [
        { poiName: 'Refuge', reachedAt: '2026-09-12T08:20:00.000Z' },
        { poiName: 'Lac', reachedAt: '2026-09-12T09:10:00.000Z' },
      ],
      routeId: null,
      kitId: 'kit-1',
      carnetId: null,
    };

    const merge = mergeSessionFields(existing, incoming);
    expect(merge.fields.positions_timed).toEqual([
      position(45.1, '2026-09-12T08:00:00.000Z'),
      position(45.2, '2026-09-12T08:30:00.000Z'),
      position(45.3, '2026-09-12T09:30:00.000Z'),
    ]);
    expect(merge.fields.poi_events).toHaveLength(2);
    expect(merge.changedFields).toContain('positions_timed');
    expect(merge.changedFields).toContain('poi_events');
    expect(merge.detail).toContain('session_fusion_champ_par_champ');
  });

  it('TEST-PHASE6-MERGE-02: métriques monotones — un rejeu obsolète ne régresse pas', () => {
    const existing = {
      startedAt: '2026-09-12T08:00:00.000Z',
      endedAt: '2026-09-12T12:00:00.000Z',
      distanceKm: 12.5,
      durationSeconds: 14400,
      elevationGainM: 800,
      positions: [position(45.1, '2026-09-12T08:00:00.000Z'), position(45.2, '2026-09-12T08:30:00.000Z')],
      poiEvents: [],
      routeId: 42,
      kitId: 'kit-1',
      carnetId: 'carnet-1',
    };
    const stale = {
      createdAt: '2026-09-12T09:00:00.000Z',
      endedAt: '2026-09-12T10:00:00.000Z',
      distanceKm: 4,
      durationSeconds: 3600,
      elevationGainM: 100,
      positions: [],
      poiEvents: [],
      routeId: null,
      kitId: null,
      carnetId: null,
    };

    const merge = mergeSessionFields(existing, stale);
    expect(merge.fields.distance_km).toBe(12.5);
    expect(merge.fields.duration_seconds).toBe(14400);
    expect(merge.fields.elevation_gain_m).toBe(800);
    expect(merge.fields.ended_at).toBe('2026-09-12T12:00:00.000Z');
    expect(merge.changedFields).toEqual([]);
    expect(merge.detail).toBe('session_conservee_plus_recente');
  });

  it('TEST-PHASE6-MERGE-03: identités conservées et `ended_at` maximum', () => {
    const existing = {
      startedAt: '2026-09-12T08:00:00.000Z',
      endedAt: null,
      distanceKm: null,
      durationSeconds: null,
      elevationGainM: null,
      positions: [],
      poiEvents: [],
      routeId: null,
      kitId: null,
      carnetId: 'carnet-existant',
    };
    const incoming = {
      createdAt: '2026-09-12T13:00:00.000Z',
      endedAt: '2026-09-12T13:00:00.000Z',
      distanceKm: 2,
      durationSeconds: 1800,
      elevationGainM: 50,
      positions: [],
      poiEvents: Array.from({ length: 300 }, (_, index) => ({
        poiName: `POI-${index}`,
        reachedAt: `2026-09-12T10:${String(index % 60).padStart(2, '0')}:00.000Z`,
      })),
      routeId: 7,
      kitId: 'kit-2',
      carnetId: 'carnet-entrant',
    };

    const merge = mergeSessionFields(existing, incoming);
    expect(merge.fields.route_id).toBe(7);
    expect(merge.fields.kit_id).toBe('kit-2');
    expect(merge.fields.carnet_id).toBe('carnet-existant');
    expect(merge.fields.ended_at).toBe('2026-09-12T13:00:00.000Z');
    expect(merge.fields.poi_events).toHaveLength(MAX_SESSION_MERGE_POI_EVENTS);
  });

  it('TEST-PHASE6-MERGE-04: décision plus récente gagne, plus ancienne ignorée', () => {
    const existing = {
      status: 'proposed' as const,
      decidedAt: null,
      createdAt: '2026-09-12T08:00:00.000Z',
    };

    const ignored = mergeDecisionFields(existing, {
      status: 'confirmed',
      decidedAt: '2026-09-12T07:00:00.000Z',
      createdAt: '2026-09-12T07:00:00.000Z',
    });
    expect(ignored.status).toBe('proposed');
    expect(ignored.changed).toBe(false);
    expect(ignored.detail).toBe('decision_conservee_plus_recente');

    const applied = mergeDecisionFields(existing, {
      status: 'confirmed',
      decidedAt: '2026-09-12T09:00:00.000Z',
      createdAt: '2026-09-12T09:00:00.000Z',
    });
    expect(applied.status).toBe('confirmed');
    expect(applied.changed).toBe(true);
    expect(applied.decidedAt).toBe('2026-09-12T09:00:00.000Z');
  });

  it('TEST-PHASE6-MERGE-05: pas de résurrection d’un statut terminal', () => {
    const rejected = {
      status: 'rejected' as const,
      decidedAt: '2026-09-12T09:00:00.000Z',
      createdAt: '2026-09-12T08:00:00.000Z',
    };

    const resurrection = mergeDecisionFields(rejected, {
      status: 'confirmed',
      decidedAt: '2026-09-12T10:00:00.000Z',
      createdAt: '2026-09-12T10:00:00.000Z',
    });
    expect(resurrection.status).toBe('rejected');
    expect(resurrection.detail).toBe('decision_terminale_conservee');
    expect(resurrection.changed).toBe(false);

    const expiration = mergeDecisionFields(
      { status: 'proposed', decidedAt: null, createdAt: '2026-09-12T08:00:00.000Z' },
      {
        status: 'expired',
        decidedAt: '2026-09-12T11:00:00.000Z',
        createdAt: '2026-09-12T11:00:00.000Z',
      }
    );
    expect(expiration.status).toBe('expired');
    expect(expiration.changed).toBe(true);
  });

  it('TEST-PHASE6-MERGE-06: syncOfflineBatch — deux rejeux de session fusionnent sans perte', async () => {
    const sessions = new Map<
      string,
      {
        startedAt: string;
        endedAt: string | null;
        distanceKm: number | null;
        durationSeconds: number | null;
        elevationGainM: number | null;
        positions: unknown[];
        poiEvents: unknown[];
        routeId: number | null;
        kitId: string | null;
        carnetId: string | null;
      }
    >();
    const applied = new Map<string, OfflineSyncAppliedRecord>();

    const client: OfflineSyncClient = {
      findApplied: vi.fn(async (_userId, key) => applied.get(key) ?? null),
      markApplied: vi.fn(async (_userId, record) => {
        applied.set(record.idempotencyKey, record);
      }),
      applySession: vi.fn(async (_userId, operation) => {
        const payload = operation.payload as Record<string, unknown>;
        const startedAt = String(payload.startedAt);
        const incoming = {
          createdAt: operation.createdAt,
          endedAt: (payload.endedAt as string | null) ?? startedAt,
          distanceKm: Number(payload.distanceKm),
          durationSeconds: Number(payload.durationSeconds),
          elevationGainM: null,
          positions: Array.isArray(payload.positionsTimed) ? payload.positionsTimed : [],
          poiEvents: Array.isArray(payload.poiEvents) ? payload.poiEvents : [],
          routeId: null,
          kitId: null,
          carnetId: null,
        };
        const existing = sessions.get(startedAt);
        if (!existing) {
          sessions.set(startedAt, {
            startedAt,
            endedAt: incoming.endedAt,
            distanceKm: incoming.distanceKm,
            durationSeconds: incoming.durationSeconds,
            elevationGainM: null,
            positions: [...incoming.positions],
            poiEvents: [...incoming.poiEvents],
            routeId: null,
            kitId: null,
            carnetId: null,
          });
          return { outcome: 'applied' as const, detail: 'session_creee' };
        }
        const merge = mergeSessionFields(existing, incoming);
        sessions.set(startedAt, {
          startedAt,
          endedAt: merge.fields.ended_at,
          distanceKm: merge.fields.distance_km,
          durationSeconds: merge.fields.duration_seconds,
          elevationGainM: merge.fields.elevation_gain_m,
          positions: merge.fields.positions_timed ?? [],
          poiEvents: merge.fields.poi_events,
          routeId: merge.fields.route_id,
          kitId: merge.fields.kit_id,
          carnetId: merge.fields.carnet_id,
        });
        return { outcome: 'applied' as const, detail: merge.detail };
      }),
      applyReport: vi.fn(async () => ({ outcome: 'applied' as const, detail: 'report' })),
      applyDecision: vi.fn(async () => ({ outcome: 'applied' as const, detail: 'decision' })),
    };

    const first = await createOfflineOperation({
      store: 'offline_sessions_queue',
      kind: 'hike_session',
      entityId: 'session-resilience',
      payload: {
        startedAt: '2026-09-12T08:00:00.000Z',
        endedAt: '2026-09-12T09:00:00.000Z',
        distanceKm: 4,
        durationSeconds: 3600,
        positionsTimed: [position(45.1, '2026-09-12T08:00:00.000Z')],
        poiEvents: [{ poiName: 'Refuge', reachedAt: '2026-09-12T08:20:00.000Z' }],
      },
      createdAt: '2026-09-12T09:00:00.000Z',
      userId: 'a6f00009-0000-4000-8000-000000000009',
    });
    // Rejeu plus récent : mêmes données + un fix et un POI supplémentaires.
    const second = await createOfflineOperation({
      store: 'offline_sessions_queue',
      kind: 'hike_session',
      entityId: 'session-resilience',
      payload: {
        startedAt: '2026-09-12T08:00:00.000Z',
        endedAt: '2026-09-12T11:00:00.000Z',
        distanceKm: 9,
        durationSeconds: 7200,
        positionsTimed: [
          position(45.1, '2026-09-12T08:00:00.000Z'),
          position(45.2, '2026-09-12T10:00:00.000Z'),
        ],
        poiEvents: [{ poiName: 'Lac', reachedAt: '2026-09-12T10:30:00.000Z' }],
      },
      createdAt: '2026-09-12T11:00:00.000Z',
      userId: 'a6f00009-0000-4000-8000-000000000009',
    });

    const report = await syncOfflineBatch(
      { userId: 'a6f00009-0000-4000-8000-000000000009', operations: [first, second] },
      client
    );
    expect(report.applied).toBe(2);
    expect(report.failed).toBe(0);

    const merged = sessions.get('2026-09-12T08:00:00.000Z')!;
    expect(merged.distanceKm).toBe(9);
    expect(merged.durationSeconds).toBe(7200);
    expect(merged.endedAt).toBe('2026-09-12T11:00:00.000Z');
    expect(merged.positions).toHaveLength(2);
    expect(merged.poiEvents).toHaveLength(2);

    // Rejeu strictement identique : idempotence, aucune seconde application.
    const replay = await syncOfflineBatch(
      { userId: 'a6f00009-0000-4000-8000-000000000009', operations: [first, second] },
      client
    );
    expect(replay.applied).toBe(0);
    expect(replay.duplicates).toBe(2);
  });
});
