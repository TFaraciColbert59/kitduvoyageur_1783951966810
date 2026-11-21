import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearOfflineOps,
  enqueueOfflineOp,
  listOfflineOps,
  removeOfflineOp,
  replayOfflineOps,
  type StepExecutionPayload,
} from '@/features/hub/cockpit/offlineQueue';

describe('cockpit offlineQueue', () => {
  beforeEach(async () => {
    await clearOfflineOps();
  });

  it('enqueues operations in FIFO order partitioned by tripId', async () => {
    const payloadA: StepExecutionPayload = {
      tripId: 'trip-1',
      stepId: 'step-a',
      planUpdatedAt: '2026-11-21T08:00:00Z',
      expectedVersion: 0,
      status: 'started',
      note: 'Départ hors-ligne',
    };
    const payloadB: StepExecutionPayload = {
      tripId: 'trip-2',
      stepId: 'step-b',
      planUpdatedAt: '2026-11-21T08:00:00Z',
      expectedVersion: 0,
      status: 'arrived',
      note: '',
    };

    await enqueueOfflineOp({ operationId: 'op-1', tripId: 'trip-1', kind: 'step_execution', payload: payloadA });
    await enqueueOfflineOp({ operationId: 'op-2', tripId: 'trip-2', kind: 'step_execution', payload: payloadB });

    const trip1Ops = await listOfflineOps('trip-1');
    expect(trip1Ops).toHaveLength(1);
    expect(trip1Ops[0].operationId).toBe('op-1');
    expect(trip1Ops[0].status).toBe('pending');
  });

  it('replays synced operations, flags conflicts without losing them, and retains retryable ops', async () => {
    const base: StepExecutionPayload = {
      tripId: 'trip-1',
      stepId: 'step-a',
      planUpdatedAt: '2026-11-21T08:00:00Z',
      expectedVersion: 0,
      status: 'started',
      note: '',
    };

    await enqueueOfflineOp({ operationId: 'op-sync', tripId: 'trip-1', kind: 'step_execution', payload: base });
    await enqueueOfflineOp({ operationId: 'op-conflict', tripId: 'trip-1', kind: 'step_execution', payload: base });
    await enqueueOfflineOp({ operationId: 'op-retry', tripId: 'trip-1', kind: 'step_execution', payload: base });

    const summary = await replayOfflineOps('trip-1', async (op) => {
      if (op.operationId === 'op-sync') return { status: 'synced' };
      if (op.operationId === 'op-conflict') return { status: 'conflict', message: 'Version périmée' };
      return { status: 'retry', message: 'Réseau indisponible' };
    });

    expect(summary).toEqual({ synced: 1, conflicts: 1, remaining: 2 });

    const remaining = await listOfflineOps('trip-1');
    expect(remaining.map((op) => [op.operationId, op.status])).toEqual([
      ['op-conflict', 'conflict'],
      ['op-retry', 'pending'],
    ]);

    await removeOfflineOp('op-conflict');
    expect((await listOfflineOps('trip-1')).map((op) => op.operationId)).toEqual(['op-retry']);
  });
});
