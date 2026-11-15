'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { OwnerLiveTrackingStatus } from '@/features/compte/live-tracking/types';
import LiveTrackingPanel from '@/components/compte/live-tracking/LiveTrackingPanel';
import SafetyContactsPanel from '@/components/compte/live-tracking/SafetyContactsPanel';
import WatchLiveStatus from '@/components/compte/live-tracking/WatchLiveStatus';
import { liveTrackingApi } from '@/components/compte/live-tracking/liveTrackingApi';

type BeaconSubTab = 'share' | 'contacts' | 'watch';

export function emitLiveTrackingChanged(status?: OwnerLiveTrackingStatus): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('lkdv:live-tracking-changed', { detail: status }));
}

/**
 * Raccordement P02 (`K7.01`, `K7.02`, `K7.03`, `S6.11`) dans Explorer `LiveSafetyTab` :
 * remplace le texte statique par le vrai panneau Beacon temps réel (démarrer,
 * générer/copier/révoquer un lien avec échéance, contacts de sécurité, montre).
 */
export function ExplorerLiveTrackingPanel() {
  const [subTab, setSubTab] = useState<BeaconSubTab>('share');
  const [status, setStatus] = useState<OwnerLiveTrackingStatus | null>(null);
  const [watchSyncing, setWatchSyncing] = useState(false);

  const handleStatusChange = useCallback((next: OwnerLiveTrackingStatus) => {
    setStatus(next);
    emitLiveTrackingChanged(next);
  }, []);

  const syncWatch = useCallback(async () => {
    setWatchSyncing(true);
    try {
      const next = await liveTrackingApi.getStatus();
      handleStatusChange(next);
    } finally {
      setWatchSyncing(false);
    }
  }, [handleStatusChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        role="tablist"
        aria-label="Suivi temps réel Beacon"
        style={{
          display: 'flex',
          gap: 4,
          padding: 3,
          borderRadius: 999,
          background: 'rgba(23,43,36,.07)',
        }}
      >
        {(
          [
            { id: 'share', label: 'Lien & Beacon' },
            { id: 'contacts', label: 'Proches' },
            { id: 'watch', label: 'Montre' },
          ] as const
        ).map((item) => {
          const active = subTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSubTab(item.id)}
              style={{
                flex: 1,
                height: 30,
                borderRadius: 999,
                border: 'none',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: active ? '#17402c' : 'transparent',
                color: active ? '#fff' : 'var(--xp-ink, #172b24)',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {subTab === 'share' ? (
        <LiveTrackingPanel onStatusChange={handleStatusChange} />
      ) : subTab === 'contacts' ? (
        <SafetyContactsPanel initialContacts={status?.contacts} />
      ) : (
        <WatchLiveStatus
          snapshot={status?.watch ?? null}
          nowMs={status?.nowMs}
          syncing={watchSyncing}
          onSync={() => void syncWatch()}
        />
      )}
    </div>
  );
}

export interface ExplorerBeaconBarProps {
  center: [number, number]; // [lng, lat]
  online: boolean;
  onOpenSafety: () => void;
}

/**
 * Barre persistante en activité (`K7.02`, `S6.11`) dès qu'une session Beacon est active :
 * - pousse les fixes GPS vers `/api/live-tracking/sessions/[id]/positions` (throttlé >= 10s)
 * - permet l'arrêt et la révocation immédiate en un geste.
 */
export function ExplorerBeaconBar({ center, online, onOpenSafety }: ExplorerBeaconBarProps) {
  const [status, setStatus] = useState<OwnerLiveTrackingStatus | null>(null);
  const [stopping, setStopping] = useState(false);
  const lastSentAtRef = useRef<number>(0);

  const refresh = useCallback(async () => {
    try {
      const next = await liveTrackingApi.getStatus();
      setStatus(next);
    } catch {
      /* ignore unauthenticated / offline */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handler = (event: Event) => {
      const custom = event as CustomEvent<OwnerLiveTrackingStatus | undefined>;
      if (custom.detail) setStatus(custom.detail);
      else void refresh();
    };
    window.addEventListener('lkdv:live-tracking-changed', handler);
    return () => window.removeEventListener('lkdv:live-tracking-changed', handler);
  }, [refresh]);

  const activeSession = status?.sessions.find(
    (s) => s.sessionId === status.activeSessionId || s.status === 'active'
  );

  // Envoi des positions GPS tant que le Beacon est actif et en ligne
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active' || !online) return;
    if (!Number.isFinite(center[1]) || !Number.isFinite(center[0])) return;
    const now = Date.now();
    if (now - lastSentAtRef.current < 10_000) return;
    lastSentAtRef.current = now;

    void fetch(`/api/live-tracking/sessions/${encodeURIComponent(activeSession.sessionId)}/positions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lat: center[1],
        lng: center[0],
        recordedAtMs: now,
      }),
    }).catch(() => {
      /* ignore transient network error */
    });
  }, [activeSession, center[0], center[1], online]);

  if (!activeSession || activeSession.status === 'ended') return null;

  const stopImmediately = async () => {
    if (stopping) return;
    setStopping(true);
    try {
      await liveTrackingApi.updateSession(activeSession.sessionId, 'ended');
      const next = await liveTrackingApi.getStatus();
      setStatus(next);
      emitLiveTrackingChanged(next);
    } finally {
      setStopping(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        right: 16,
        bottom: 'calc(var(--safe-bottom, 0px) + 66px + var(--cookie-banner-h, 0px))',
        zIndex: 11,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 999,
        background: 'rgba(23,64,44,.94)',
        color: '#fff',
        fontSize: 11.5,
        fontWeight: 600,
        boxShadow: '0 6px 20px rgba(0,0,0,.2)',
      }}
    >
      <button
        type="button"
        onClick={onOpenSafety}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#fff',
          fontWeight: 600,
          fontSize: 11.5,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        Beacon {activeSession.status === 'paused' ? 'en pause' : 'actif'}
      </button>
      <button
        type="button"
        disabled={stopping}
        onClick={() => void stopImmediately()}
        aria-label="Arrêter et révoquer le partage Beacon"
        style={{
          background: 'rgba(220,38,38,.9)',
          border: 'none',
          borderRadius: 999,
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          padding: '3px 8px',
          cursor: 'pointer',
        }}
      >
        {stopping ? 'Arrêt…' : 'Stop Beacon'}
      </button>
    </div>
  );
}

export default ExplorerLiveTrackingPanel;
