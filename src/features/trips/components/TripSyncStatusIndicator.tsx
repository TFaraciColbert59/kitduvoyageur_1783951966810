'use client';

import React, { useEffect, useState, useTransition } from 'react';
import {
  getTripOfflineQueue,
  flushTripOfflineQueue,
  TripOfflineAction,
} from '@/features/trips/offline/tripOfflineSyncQueue';
import { RefreshCw, Cloud, CloudOff, Check } from 'lucide-react';

interface TripSyncStatusIndicatorProps {
  tripSlug: string;
  onSyncAction?: (action: TripOfflineAction) => Promise<{ success: boolean; error?: string }>;
  className?: string;
}

export function TripSyncStatusIndicator({
  tripSlug,
  onSyncAction,
  className = '',
}: TripSyncStatusIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [lastSyncSuccess, setLastSyncSuccess] = useState(false);

  // Mettre à jour l'état réseau et la file
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const updateStatus = () => {
      setIsOnline(navigator.onLine);
      const queue = getTripOfflineQueue(tripSlug);
      setQueueCount(queue.length);
    };

    updateStatus();

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    const interval = setInterval(updateStatus, 3000);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      clearInterval(interval);
    };
  }, [tripSlug]);

  const handleManualSync = () => {
    if (!isOnline || queueCount === 0 || isPending || !onSyncAction) return;

    startTransition(async () => {
      const res = await flushTripOfflineQueue(tripSlug, onSyncAction);
      const updatedQueue = getTripOfflineQueue(tripSlug);
      setQueueCount(updatedQueue.length);
      if (res.processed > 0 && res.failed === 0) {
        setLastSyncSuccess(true);
        setTimeout(() => setLastSyncSuccess(false), 3000);
      }
    });
  };

  if (!isOnline) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-stone-100/90 text-stone-700 border border-stone-200/80 shadow-sm backdrop-blur-sm ${className}`}
        role="status"
        aria-live="polite"
        title="Mode hors-ligne actif. Vos modifications sont sauvegardées localement."
      >
        <CloudOff className="w-3.5 h-3.5 text-stone-500" aria-hidden="true" />
        <span>Hors-ligne {queueCount > 0 ? `(${queueCount})` : ''}</span>
      </div>
    );
  }

  if (queueCount > 0) {
    return (
      <button
        onClick={handleManualSync}
        disabled={isPending || !onSyncAction}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80 shadow-sm hover:bg-amber-100/80 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${className}`}
        role="status"
        aria-live="polite"
        title="Actions en attente de synchronisation. Cliquez pour synchroniser."
      >
        {isPending ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-sand-600" aria-hidden="true" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-sand-500 animate-pulse" aria-hidden="true" />
        )}
        <span>{isPending ? 'Synchro en cours...' : `${queueCount} en attente`}</span>
      </button>
    );
  }

  if (lastSyncSuccess) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-sm animate-fade-in ${className}`}
        role="status"
      >
        <Check className="w-3.5 h-3.5 text-forest-600" aria-hidden="true" />
        <span>Synchronisé</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-50/80 text-stone-500 border border-stone-200/60 ${className}`}
      role="status"
      title="Toutes les données sont synchronisées"
    >
      <Cloud className="w-3.5 h-3.5 text-forest-600" aria-hidden="true" />
      <span>À jour</span>
    </div>
  );
}
