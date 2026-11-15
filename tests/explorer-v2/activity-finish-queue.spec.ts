import { describe, expect, it } from 'vitest';
import {
  readFinishOutcome,
  shouldKeepFinishInQueue,
} from '@/features/explorer-v2/activity/finishOutcome';
import {
  flushQueue,
  type QueuedOperation,
  type QueueBackend,
} from '@/features/explorer-v2/offline/queue';

const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const SUMMARY_ID = '33333333-3333-4333-8333-333333333333';

function operation(key: string): QueuedOperation {
  return {
    key,
    kind: 'activity.finish',
    payload: { sessionId: SESSION_ID, idempotencyKey: key },
    createdAt: 1,
    attempts: 0,
  };
}

class MemoryQueue implements QueueBackend {
  constructor(public operations: QueuedOperation[]) {}
  readonly removed: string[] = [];

  async list(): Promise<QueuedOperation[]> {
    return [...this.operations];
  }

  async remove(key: string): Promise<void> {
    this.removed.push(key);
    this.operations = this.operations.filter((item) => item.key !== key);
  }
}

describe('explorer-v2 · file hors ligne des fins de séance', () => {
  it('ne retire que les réponses terminales et préserve tout le reste', async () => {
    const responses: Record<string, [number, unknown]> = {
      'finish-400': [400, { error: 'sessionId invalide' }],
      'finish-401': [401, { error: 'authentification requise' }],
      'finish-403': [403, { error: 'refusé' }],
      'finish-404': [404, { error: 'route absente' }],
      'finish-408': [408, { error: 'timeout' }],
      'finish-409': [409, { code: 'idempotency_conflict' }],
      'finish-429': [429, { error: 'trop de requêtes' }],
      'finish-500': [500, { error: 'indisponible' }],
      'finish-200-malformed': [200, { status: 'saved', summaryId: null }],
      'finish-200-ok': [200, { status: 'saved', summaryId: SUMMARY_ID }],
    };
    const backend = new MemoryQueue(Object.keys(responses).map(operation));

    const result = await flushQueue(async (queued) => {
      const [status, payload] = responses[queued.key];
      return !shouldKeepFinishInQueue(readFinishOutcome(status, payload));
    }, backend);

    // Seuls 400, 409 et le succès sont définitifs.
    expect(result).toEqual({ sent: 3, failed: 7 });
    expect(backend.removed.sort()).toEqual(['finish-200-ok', 'finish-400', 'finish-409']);
    expect(backend.operations.map((item) => item.key).sort()).toEqual([
      'finish-200-malformed',
      'finish-401',
      'finish-403',
      'finish-404',
      'finish-408',
      'finish-429',
      'finish-500',
    ]);
  });

  it('conserve une opération quand l’envoi lève ou renvoie false', async () => {
    const backend = new MemoryQueue([operation('throw'), operation('retry'), operation('ok')]);

    const result = await flushQueue(async (queued) => {
      if (queued.key === 'throw') throw new Error('réseau coupé');
      return queued.key === 'ok';
    }, backend);

    expect(result).toEqual({ sent: 1, failed: 2 });
    expect(backend.removed).toEqual(['ok']);
    expect(backend.operations.map((item) => item.key).sort()).toEqual(['retry', 'throw']);
  });
});
