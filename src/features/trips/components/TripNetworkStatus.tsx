'use client';

import React, { useEffect, useState, useTransition } from 'react';
import {
  getTripOfflineQueue,
  flushTripOfflineQueue,
  TripOfflineAction,
} from '@/features/trips/offline/tripOfflineSyncQueue';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { RefreshCw, Cloud, CloudOff, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TripNetworkStatusProps {
  tripSlug: string;
  onSyncAction?: (action: TripOfflineAction) => Promise<{ success: boolean; error?: string }>;
  className?: string;
}

/**
 * Y3.2 — Statut réseau UNIQUE du hub voyage (ex-`TripSyncStatusIndicator`).
 *
 * Monté UNE seule fois, dans le shell du layout de segment (règle Y-D80 n°8) :
 * identique sur les onze surfaces. L'état réseau provient de l'abstraction
 * unifiée `useOnlineStatus` → `@capacitor/network` en natif, `navigator.onLine`
 * en web — plus aucun accès direct à `navigator.onLine` ailleurs dans le module.
 *
 * Les seize classes froides héritées (stone/amber/emerald) sont tokenisées
 * (`--lkv-*`) conformément au design system.
 */
export function TripNetworkStatus({
  tripSlug,
  onSyncAction,
  className = '',
}: TripNetworkStatusProps) {
  const { isOnline } = useOnlineStatus();
  const [queueCount, setQueueCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [lastSyncSuccess, setLastSyncSuccess] = useState(false);

  // File de synchronisation (indépendante de l'accès réseau direct)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateQueue = () => {
      const queue = getTripOfflineQueue(tripSlug);
      setQueueCount(queue.length);
    };

    updateQueue();
    const interval = setInterval(updateQueue, 3000);

    return () => clearInterval(interval);
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
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium',
          'bg-[var(--lkv-warning-dark)]/10 text-[var(--lkv-warning-dark)] border border-[var(--lkv-warning-dark)]/30',
          'shadow-sm backdrop-blur-sm',
          className
        )}
        role="status"
        aria-live="polite"
        title="Mode hors-ligne actif. Vos modifications sont sauvegardées localement."
      >
        <CloudOff className="w-3.5 h-3.5 text-[var(--lkv-warning-dark)]" aria-hidden="true" />
        <span>Hors-ligne {queueCount > 0 ? `(${queueCount})` : ''}</span>
      </div>
    );
  }

  if (queueCount > 0) {
    return (
      <button
        onClick={handleManualSync}
        disabled={isPending || !onSyncAction}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium',
          'bg-[var(--lkv-warning-dark)]/10 text-[var(--lkv-warning-dark)] border border-[var(--lkv-warning-dark)]/30',
          'shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--lkv-warning-dark)]/40',
          className
        )}
        role="status"
        aria-live="polite"
        title="Actions en attente de synchronisation. Cliquez pour synchroniser."
      >
        {isPending ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--lkv-warning-dark)]" aria-hidden="true" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-[var(--lkv-warning)] animate-pulse" aria-hidden="true" />
        )}
        <span>{isPending ? 'Synchro en cours...' : `${queueCount} en attente`}</span>
      </button>
    );
  }

  if (lastSyncSuccess) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium',
          'bg-[var(--lkv-accent)]/10 text-[var(--lkv-accent)] border border-[var(--lkv-accent)]/30 shadow-sm',
          'animate-in fade-in',
          className
        )}
        role="status"
      >
        <Check className="w-3.5 h-3.5 text-[var(--lkv-accent)]" aria-hidden="true" />
        <span>Synchronisé</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        'bg-[var(--lkv-accent)]/10 text-[var(--lkv-text-secondary)] border border-[var(--lkv-accent)]/20',
        className
      )}
      role="status"
      title="Toutes les données sont synchronisées"
    >
      <Cloud className="w-3.5 h-3.5 text-[var(--lkv-accent)]" aria-hidden="true" />
      <span>À jour</span>
    </div>
  );
}

export default TripNetworkStatus;
