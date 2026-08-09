

export interface PendingSyncItem {
  id: string;
  type: 'hike_session' | 'journal_event';
  payload: any;
  createdAt: string;
  retryCount: number;
}

export type NetworkStatus = 'online' | 'offline' | 'syncing';

export class OfflineManager {
  private syncQueue: PendingSyncItem[] = [];
  private currentStatus: NetworkStatus = 'online';
  private listeners: ((status: NetworkStatus, pendingCount: number) => void)[] = [];
  private static readonly STORAGE_KEY_QUEUE = 'lkdv_offline_sync_queue';

  constructor() {
    if (typeof window !== 'undefined') {
      this.currentStatus = navigator.onLine ? 'online' : 'offline';
      this.loadQueueFromLocalStorage();

      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  public getStatus(): NetworkStatus {
    return this.currentStatus;
  }

  public getPendingCount(): number {
    return this.syncQueue.length;
  }

  public subscribe(listener: (status: NetworkStatus, pendingCount: number) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Enqueue a pending session or event for deferred background upload.
   */
  public enqueue(type: 'hike_session' | 'journal_event', payload: any): void {
    const item: PendingSyncItem = {
      id: `sync-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    this.syncQueue.push(item);
    this.saveQueueToLocalStorage();
    this.notify();

    if (this.currentStatus === 'online') {
      this.processQueue();
    }
  }

  /**
   * Process deferred sync queue when online.
   */
  public async processQueue(): Promise<{ synced: number; failed: number }> {
    if (this.syncQueue.length === 0 || this.currentStatus === 'syncing') {
      return { synced: 0, failed: 0 };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.currentStatus = 'offline';
      this.notify();
      return { synced: 0, failed: 0 };
    }

    this.currentStatus = 'syncing';
    this.notify();

    let synced = 0;
    let failed = 0;
    const remainingQueue: PendingSyncItem[] = [];

    for (const item of this.syncQueue) {
      try {
        let success = false;
        if (item.type === 'hike_session') {
          const res = await fetch('/api/hike-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload),
          });
          success = res.ok;
        } else if (item.type === 'journal_event') {
          const res = await fetch(`/api/carnets/${item.payload.carnetId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload.event),
          });
          success = res.ok;
        }

        if (success) {
          synced++;
        } else {
          item.retryCount++;
          if (item.retryCount < 5) {
            remainingQueue.push(item);
          }
          failed++;
        }
      } catch (err) {
        console.warn(`[OfflineManager] Sync failed for ${item.id}:`, err);
        item.retryCount++;
        if (item.retryCount < 5) {
          remainingQueue.push(item);
        }
        failed++;
      }
    }

    this.syncQueue = remainingQueue;
    this.saveQueueToLocalStorage();
    this.currentStatus = typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline';
    this.notify();

    return { synced, failed };
  }

  private handleNetworkChange(isOnline: boolean): void {
    if (isOnline) {
      this.currentStatus = 'online';
      this.notify();
      this.processQueue();
    } else {
      this.currentStatus = 'offline';
      this.notify();
    }
  }

  private saveQueueToLocalStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(OfflineManager.STORAGE_KEY_QUEUE, JSON.stringify(this.syncQueue));
    } catch (err) {
      console.warn('[OfflineManager] LocalStorage write failed:', err);
    }
  }

  private loadQueueFromLocalStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(OfflineManager.STORAGE_KEY_QUEUE);
      if (raw) {
        this.syncQueue = JSON.parse(raw);
      }
    } catch {
      this.syncQueue = [];
    }
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.currentStatus, this.syncQueue.length));
  }
}
