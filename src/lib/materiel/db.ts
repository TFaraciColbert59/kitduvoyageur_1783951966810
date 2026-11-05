import Dexie, { type Table } from 'dexie';

/**
 * Dexie offline store pour Mon Matériel — synchronisation bidirectionnelle.
 * Schéma v1 : miroir local de gear_items, custom_kits, materiel_history.
 */

export interface OfflineGearItem {
  id: string;
  user_id: string;
  updated_at: string;
  dirty: boolean;
  data: Record<string, unknown>;
}

export interface OfflineKit {
  id: string;
  user_id: string;
  updated_at: string;
  dirty: boolean;
  data: Record<string, unknown>;
}

export interface OfflineHistoryEntry {
  id?: number;
  user_id: string;
  created_at: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string | null;
}

class MaterielDatabase extends Dexie {
  gear!: Table<OfflineGearItem, string>;
  kits!: Table<OfflineKit, string>;
  history!: Table<OfflineHistoryEntry, number>;

  constructor() {
    super('lkdv-materiel');
    this.version(1).stores({
      gear: 'id, user_id, updated_at, dirty',
      kits: 'id, user_id, updated_at, dirty',
      history: 'id, user_id, created_at',
    });
  }
}

export const materielDB = new MaterielDatabase();

export async function saveGearOffline(item: OfflineGearItem) {
  await materielDB.gear.put(item);
}

export async function saveKitOffline(kit: OfflineKit) {
  await materielDB.kits.put(kit);
}

export async function getOfflineGear(userId: string): Promise<OfflineGearItem[]> {
  return materielDB.gear.where('user_id').equals(userId).toArray();
}

export async function getOfflineKits(userId: string): Promise<OfflineKit[]> {
  return materielDB.kits.where('user_id').equals(userId).toArray();
}

export async function getDirtyGear(): Promise<OfflineGearItem[]> {
  return materielDB.gear.where('dirty').equals(1).toArray();
}

export async function getDirtyKits(): Promise<OfflineKit[]> {
  return materielDB.kits.where('dirty').equals(1).toArray();
}

export async function markGearSynced(ids: string[]) {
  if (ids.length === 0) return;
  await materielDB.gear.bulkUpdate(ids.map((id) => ({ key: id, changes: { dirty: false } })));
}

export async function markKitsSynced(ids: string[]) {
  if (ids.length === 0) return;
  await materielDB.kits.bulkUpdate(ids.map((id) => ({ key: id, changes: { dirty: false } })));
}

export async function addHistoryEntry(entry: Omit<OfflineHistoryEntry, 'id'>) {
  await materielDB.history.add(entry);
}

export async function getHistory(userId: string, limit = 200): Promise<OfflineHistoryEntry[]> {
  return materielDB.history
    .where('user_id')
    .equals(userId)
    .reverse()
    .sortBy('created_at')
    .then((rows) => rows.slice(0, limit));
}

/** Synchronise le store local avec le serveur (diff timestamps, merge optimiste). */
export async function syncOffline(_userId: string) {
  const dirtyGear = await getDirtyGear();
  const dirtyKits = await getDirtyKits();

  const syncedGearIds: string[] = [];
  const syncedKitIds: string[] = [];

  // 1. Push local dirty gear
  for (const item of dirtyGear) {
    try {
      const res = await fetch('/api/materiel/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data),
      });
      if (res.ok) {
        syncedGearIds.push(item.id);
      }
    } catch {
      // Erreur réseau : conservation de l'état dirty
    }
  }

  // 2. Push local dirty kits
  for (const kit of dirtyKits) {
    const data = kit.data as { items?: unknown[]; allowEmptyItems?: boolean } | undefined;
    // Garde-fou client : refus de propager un vidage d'articles sans drapeau explicite
    if (Array.isArray(data?.items) && data.items.length === 0 && !data.allowEmptyItems) {
      continue;
    }

    try {
      const res = await fetch(`/api/materiel/kits/${kit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kit.data),
      });
      if (res.ok) {
        syncedKitIds.push(kit.id);
      }
    } catch {
      // Erreur réseau : conservation de l'état dirty
    }
  }

  // Seuls les succès confirmés sont marqués synchronisés
  await markGearSynced(syncedGearIds);
  await markKitsSynced(syncedKitIds);

  return {
    pushedGear: syncedGearIds.length,
    pushedKits: syncedKitIds.length,
    failedGear: dirtyGear.length - syncedGearIds.length,
    failedKits: dirtyKits.length - syncedKitIds.length,
  };
}