'use client';

import Dexie, { type Table } from 'dexie';
import type { StepStatus } from './stepExecution';

export type OfflineOpKind = 'step_execution' | 'moment_draft' | 'expense_create' | 'kit_toggle';

export type OfflineOpStatus = 'pending' | 'syncing' | 'conflict' | 'failed';

export interface StepExecutionPayload {
  tripId: string;
  stepId: string;
  planUpdatedAt: string;
  expectedVersion: number;
  status: StepStatus;
  note: string;
}

export interface MomentDraftPayload {
  tripId: string;
  day: number;
  place: string | null;
  caption: string;
  capturedAt: string;
  timeZone: string;
}

export interface ExpenseCreatePayload {
  tripId: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
}

export interface KitTogglePayload {
  tripId: string;
  itemId: string;
  packed: boolean;
}

export type OfflineOpPayload =
  | { kind: 'step_execution'; data: StepExecutionPayload }
  | { kind: 'moment_draft'; data: MomentDraftPayload }
  | { kind: 'expense_create'; data: ExpenseCreatePayload }
  | { kind: 'kit_toggle'; data: KitTogglePayload };

export interface CockpitOfflineOperation {
  operationId: string;
  tripId: string;
  kind: OfflineOpKind;
  payload: StepExecutionPayload | MomentDraftPayload | ExpenseCreatePayload | KitTogglePayload;
  status: OfflineOpStatus;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

class CockpitOfflineDatabase extends Dexie {
  operations!: Table<CockpitOfflineOperation, string>;

  constructor() {
    super('lkdv-hub-cockpit-offline-v1');
    this.version(1).stores({
      operations: 'operationId, tripId, kind, status, createdAt',
    });
  }
}

let dbInstance: CockpitOfflineDatabase | null = null;
const memoryFallback = new Map<string, CockpitOfflineOperation>();

function getDb(): CockpitOfflineDatabase | null {
  if (typeof indexedDB === 'undefined') return null;
  if (!dbInstance) {
    dbInstance = new CockpitOfflineDatabase();
  }
  return dbInstance;
}

export async function enqueueOfflineOp(
  op: Omit<CockpitOfflineOperation, 'status' | 'createdAt' | 'attempts'>,
): Promise<CockpitOfflineOperation> {
  const record: CockpitOfflineOperation = {
    ...op,
    status: 'pending',
    createdAt: Date.now(),
    attempts: 0,
  };
  const db = getDb();
  if (!db) {
    memoryFallback.set(record.operationId, record);
    return record;
  }
  try {
    await db.operations.put(record);
    return record;
  } catch {
    memoryFallback.set(record.operationId, record);
    return record;
  }
}

export async function listOfflineOps(tripId?: string): Promise<CockpitOfflineOperation[]> {
  const db = getDb();
  if (!db) {
    const items = [...memoryFallback.values()];
    return (tripId ? items.filter((item) => item.tripId === tripId) : items)
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  try {
    const rows = tripId
      ? await db.operations.where('tripId').equals(tripId).sortBy('createdAt')
      : await db.operations.orderBy('createdAt').toArray();
    return rows;
  } catch {
    const items = [...memoryFallback.values()];
    return (tripId ? items.filter((item) => item.tripId === tripId) : items)
      .sort((a, b) => a.createdAt - b.createdAt);
  }
}

export async function updateOfflineOp(
  operationId: string,
  patch: Partial<Pick<CockpitOfflineOperation, 'status' | 'attempts' | 'lastError'>>,
): Promise<void> {
  const db = getDb();
  if (!db) {
    const existing = memoryFallback.get(operationId);
    if (existing) memoryFallback.set(operationId, { ...existing, ...patch });
    return;
  }
  try {
    await db.operations.update(operationId, patch);
  } catch {
    const existing = memoryFallback.get(operationId);
    if (existing) memoryFallback.set(operationId, { ...existing, ...patch });
  }
}

export async function removeOfflineOp(operationId: string): Promise<void> {
  memoryFallback.delete(operationId);
  const db = getDb();
  if (!db) return;
  try {
    await db.operations.delete(operationId);
  } catch {
    // ignore fallback
  }
}

export async function clearOfflineOps(tripId?: string): Promise<void> {
  if (!tripId) {
    memoryFallback.clear();
  } else {
    for (const [key, value] of memoryFallback.entries()) {
      if (value.tripId === tripId) memoryFallback.delete(key);
    }
  }
  const db = getDb();
  if (!db) return;
  try {
    if (tripId) {
      await db.operations.where('tripId').equals(tripId).delete();
    } else {
      await db.operations.clear();
    }
  } catch {
    // ignore fallback
  }
}

export type ReplayOutcome =
  | { status: 'synced' }
  | { status: 'conflict'; message: string }
  | { status: 'retry'; message: string };

export async function replayOfflineOps(
  tripId: string,
  executor: (op: CockpitOfflineOperation) => Promise<ReplayOutcome>,
): Promise<{ synced: number; conflicts: number; remaining: number }> {
  const ops = await listOfflineOps(tripId);
  let synced = 0;
  let conflicts = 0;

  for (const op of ops) {
    if (op.status === 'conflict') {
      conflicts += 1;
      continue;
    }
    await updateOfflineOp(op.operationId, { status: 'syncing', attempts: op.attempts + 1 });
    try {
      const outcome = await executor(op);
      if (outcome.status === 'synced') {
        await removeOfflineOp(op.operationId);
        synced += 1;
      } else if (outcome.status === 'conflict') {
        await updateOfflineOp(op.operationId, { status: 'conflict', lastError: outcome.message });
        conflicts += 1;
      } else {
        await updateOfflineOp(op.operationId, { status: 'pending', lastError: outcome.message });
      }
    } catch {
      await updateOfflineOp(op.operationId, {
        status: 'pending',
        lastError: 'Connexion interrompue pendant la synchronisation.',
      });
    }
  }

  const remaining = (await listOfflineOps(tripId)).length;
  return { synced, conflicts, remaining };
}
