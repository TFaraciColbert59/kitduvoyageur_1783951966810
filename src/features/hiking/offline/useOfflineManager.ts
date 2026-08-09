'use client';

import { useState, useEffect } from 'react';
import { OfflineManager, NetworkStatus } from './OfflineManager';

const globalOfflineManager = new OfflineManager();

export function useOfflineManager(): {
  status: NetworkStatus;
  pendingCount: number;
  isOffline: boolean;
  isSyncing: boolean;
  enqueue: (type: 'hike_session' | 'journal_event', payload: any) => void;
  processQueue: () => Promise<{ synced: number; failed: number }>;
} {
  const [status, setStatus] = useState<NetworkStatus>(() => globalOfflineManager.getStatus());
  const [pendingCount, setPendingCount] = useState<number>(() => globalOfflineManager.getPendingCount());

  useEffect(() => {
    const unsubscribe = globalOfflineManager.subscribe((newStatus, count) => {
      setStatus(newStatus);
      setPendingCount(count);
    });
    return unsubscribe;
  }, []);

  return {
    status,
    pendingCount,
    isOffline: status === 'offline',
    isSyncing: status === 'syncing',
    enqueue: (type, payload) => globalOfflineManager.enqueue(type, payload),
    processQueue: () => globalOfflineManager.processQueue(),
  };
}
