import { HikeSessionService } from '../services/HikeSessionService';
import { GPSPosition } from '../types';

export interface PendingHikeSession {
  sessionId: string; // ID unique idempotent (ex: UUIDv4)
  routeId?: string | number | null;
  carnetId?: string | null;
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  durationSeconds: number;
  elevationGainM?: number | null;
  positions: GPSPosition[];
  poiEvents: { poiName: string; reachedAt: string; lat: number; lon: number }[];
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  attempts: number;
  lastError?: string | null;
}

const STORAGE_KEY = 'lkdv_pending_hike_sessions';

export class HikeSyncQueue {
  /**
   * Enregistre une session dans la file locale idempotente avant envoi réseau.
   */
  public static enqueueSession(session: Omit<PendingHikeSession, 'status' | 'attempts'>): PendingHikeSession {
    const queue = this.getQueue();
    const existingIdx = queue.findIndex((s) => s.sessionId === session.sessionId);

    const pendingItem: PendingHikeSession = {
      ...session,
      status: 'pending',
      attempts: existingIdx >= 0 ? queue[existingIdx].attempts : 0,
    };

    if (existingIdx >= 0) {
      queue[existingIdx] = pendingItem;
    } else {
      queue.push(pendingItem);
    }

    this.saveQueue(queue);
    return pendingItem;
  }

  /**
   * Récupère toutes les sessions en file d'attente.
   */
  public static getQueue(): PendingHikeSession[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Tente de synchroniser les sessions en attente avec Supabase.
   */
  public static async processQueue(): Promise<{ synced: number; failed: number }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { synced: 0, failed: 0 };
    }

    const queue = this.getQueue();
    const pendingList = queue.filter((s) => s.status === 'pending' || s.status === 'failed');

    let synced = 0;
    let failed = 0;

    for (const item of pendingList) {
      item.status = 'syncing';
      item.attempts += 1;
      this.saveQueue(queue);

      try {
        await HikeSessionService.saveSession({
          routeId: item.routeId,
          carnetId: item.carnetId,
          startedAt: item.startedAt,
          endedAt: item.endedAt,
          distanceKm: item.distanceKm,
          durationSeconds: item.durationSeconds,
          elevationGainM: item.elevationGainM,
          positions: item.positions,
          poiEvents: item.poiEvents,
        });

        item.status = 'synced';
        item.lastError = null;
        synced += 1;
      } catch (err: any) {
        item.status = 'failed';
        item.lastError = err?.message || 'Échec de synchronisation';
        failed += 1;
      }

      this.saveQueue(queue);
    }

    // Nettoyer les sessions synchronisées pour ne garder que le journal propre
    const remaining = this.getQueue().filter((s) => s.status !== 'synced');
    this.saveQueue(remaining);

    return { synced, failed };
  }

  private static saveQueue(queue: PendingHikeSession[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.warn('[HikeSyncQueue] Erreur de sauvegarde locale:', e);
    }
  }
}
