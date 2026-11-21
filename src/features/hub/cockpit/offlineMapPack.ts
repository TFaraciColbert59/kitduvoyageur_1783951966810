'use client';

import Dexie, { type Table } from 'dexie';
import type { CockpitStep, Coordinate } from './model';

export interface OfflineMapPack {
  tripId: string;
  title: string;
  route: Coordinate[][];
  steps: CockpitStep[];
  distance: number | null;
  elevation: number | null;
  savedAt: string;
  sizeBytes: number;
}

class HubMapPackDatabase extends Dexie {
  packs!: Table<OfflineMapPack, string>;

  constructor() {
    super('lkdv-hub-map-packs-v1');
    this.version(1).stores({
      packs: 'tripId, savedAt',
    });
  }
}

let dbInstance: HubMapPackDatabase | null = null;
const memoryPacks = new Map<string, OfflineMapPack>();

function getDb(): HubMapPackDatabase | null {
  if (typeof indexedDB === 'undefined') return null;
  if (!dbInstance) dbInstance = new HubMapPackDatabase();
  return dbInstance;
}

export async function saveOfflineMapPack(input: Omit<OfflineMapPack, 'savedAt' | 'sizeBytes'>): Promise<OfflineMapPack> {
  const savedAt = new Date().toISOString();
  const raw = JSON.stringify({ ...input, savedAt });
  const sizeBytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(raw).length : raw.length;
  const pack: OfflineMapPack = { ...input, savedAt, sizeBytes };

  const db = getDb();
  if (!db) {
    memoryPacks.set(pack.tripId, pack);
    return pack;
  }
  try {
    await db.packs.put(pack);
    return pack;
  } catch {
    memoryPacks.set(pack.tripId, pack);
    return pack;
  }
}

export async function readOfflineMapPack(tripId: string): Promise<OfflineMapPack | null> {
  const db = getDb();
  if (!db) return memoryPacks.get(tripId) ?? null;
  try {
    return (await db.packs.get(tripId)) ?? memoryPacks.get(tripId) ?? null;
  } catch {
    return memoryPacks.get(tripId) ?? null;
  }
}

export async function deleteOfflineMapPack(tripId: string): Promise<void> {
  memoryPacks.delete(tripId);
  const db = getDb();
  if (!db) return;
  try {
    await db.packs.delete(tripId);
  } catch {
    // ignore
  }
}

export function formatPackSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1).replace('.', ',')} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}
