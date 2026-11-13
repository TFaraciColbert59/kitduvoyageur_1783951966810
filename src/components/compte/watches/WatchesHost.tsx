'use client';

/**
 * Lot D03-UI — hôte de la surface « Montres » du Compte.
 *
 * Quatre écrans : diagnostic/appareils, file hors ligne, paquets de cartes et
 * Live Sync. Les données viennent exclusivement des routes `/api/watches` ;
 * aucun état « disponible » n’est fabriqué côté navigateur.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Watch } from 'lucide-react';
import type {
  ReconciledPhoneSession,
  WatchDeviceProfile,
  WatchOfflinePackRecord,
} from '@/features/watches';
import { createWatchesApi, type WatchApi } from './api';
import {
  Button,
  ErrorState,
  LoadingState,
} from './primitives';
import { WatchLiveSyncScreen } from './WatchLiveSyncScreen';
import { WatchPacksScreen } from './WatchPacksScreen';
import { WatchSessionsScreen } from './WatchSessionsScreen';
import { WatchStatusScreen } from './WatchStatusScreen';
import type { WatchDeviceRegistrationResponse, WatchStatusResponse, WatchTab } from './types';
import './watches.css';

const TABS: Array<{ id: WatchTab; label: string }> = [
  { id: 'status', label: 'Montres' },
  { id: 'sessions', label: 'Hors-ligne' },
  { id: 'packs', label: 'Cartes' },
  { id: 'live', label: 'Live Sync' },
];

export interface WatchesHostProps {
  userId?: string;
  api?: WatchApi;
  initialTab?: WatchTab;
  initialStatus?: WatchStatusResponse | null;
  initialSessions?: ReconciledPhoneSession[];
  initialPacks?: WatchOfflinePackRecord[];
  initialStorageBytes?: number;
}

function mergeDevice(
  status: WatchStatusResponse,
  registration: WatchDeviceRegistrationResponse,
): WatchStatusResponse {
  const others = status.devices.filter(
    (device) => device.profile.deviceId !== registration.profile.deviceId,
  );
  return {
    ...status,
    devices: [...others, registration],
  };
}

export function WatchesHost({
  userId: _userId,
  api,
  initialTab = 'status',
  initialStatus = null,
  initialSessions = [],
  initialPacks = [],
  initialStorageBytes = 0,
}: WatchesHostProps) {
  const client = useMemo(() => api ?? createWatchesApi(), [api]);
  const [tab, setTab] = useState<WatchTab>(initialTab);
  const [status, setStatus] = useState<WatchStatusResponse | null>(initialStatus);
  const [sessions, setSessions] = useState<ReconciledPhoneSession[]>(initialSessions);
  const [packs, setPacks] = useState<WatchOfflinePackRecord[]>(initialPacks);
  const [storageBytes, setStorageBytes] = useState(initialStorageBytes);
  const [loading, setLoading] = useState(initialStatus === null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.allSettled([
      client.getStatus(),
      client.listSessions(),
      client.listPacks(),
    ])
      .then(([statusResult, sessionsResult, packsResult]) => {
        if (cancelled) return;
        if (statusResult.status === 'fulfilled') {
          setStatus(statusResult.value);
        } else {
          setError(
            statusResult.reason instanceof Error
              ? statusResult.reason.message
              : 'Diagnostic des montres indisponible.',
          );
        }
        if (sessionsResult.status === 'fulfilled') {
          setSessions(sessionsResult.value.sessions);
        }
        if (packsResult.status === 'fulfilled') {
          setPacks(packsResult.value.packs);
          setStorageBytes(packsResult.value.availableStorageBytes);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, reloadKey]);

  const refresh = useCallback(() => setReloadKey((value) => value + 1), []);

  const registerDevice = useCallback(
    async (profile: WatchDeviceProfile) => {
      const registration = await client.registerDevice(profile);
      setStatus((current) =>
        current ? mergeDevice(current, registration) : current,
      );
      return registration;
    },
    [client],
  );

  const removeDevice = useCallback(
    async (deviceId: string) => {
      await client.removeDevice(deviceId);
      setStatus((current) =>
        current
          ? {
              ...current,
              devices: current.devices.filter(
                (device) => device.profile.deviceId !== deviceId,
              ),
            }
          : current,
      );
    },
    [client],
  );

  const verifyPack = useCallback(
    async (packId: string, checksumSha256: string) => {
      const result = await client.verifyPack(packId, checksumSha256);
      setPacks((current) =>
        current.map((pack) =>
          pack.manifest.packId === packId ? result.pack : pack,
        ),
      );
    },
    [client],
  );

  const removePack = useCallback(
    async (packId: string) => {
      await client.removePack(packId);
      setPacks((current) =>
        current.filter((pack) => pack.manifest.packId !== packId),
      );
    },
    [client],
  );

  const sessionId = sessions[0]?.watchSessionId ?? 'session-locale';
  const routeId = sessions[0]?.routePackId ?? null;

  if (loading && !status) {
    return (
      <main className="lkv-watch" data-testid="watches-host">
        <LoadingState />
      </main>
    );
  }

  if (!status) {
    return (
      <main className="lkv-watch" data-testid="watches-host">
        <ErrorState
          message={error ?? 'Diagnostic des montres indisponible.'}
          onRetry={refresh}
        />
      </main>
    );
  }

  return (
    <main className="lkv-watch" data-testid="watches-host" data-user-id={_userId}>
      <header className="lkv-watch__header">
        <div className="lkv-watch__header-copy">
          <p className="lkv-watch__eyebrow">Compte · Équipement</p>
          <h1 className="lkv-watch__title">
            <Watch size={22} aria-hidden="true" /> Montres & Live Sync
          </h1>
          <p className="lkv-watch__sub">
            Apple Watch, Wear OS et Galaxy Watch : diagnostic natif, file hors ligne,
            paquets de cartes et champs transmis en direct.
          </p>
        </div>
        <a className="lkv-watch__btn" data-variant="ghost" href="/compte">
          <ArrowLeft size={15} aria-hidden="true" /> Compte
        </a>
      </header>

      <nav className="lkv-watch__tabs" role="tablist" aria-label="Sections montres">
        {TABS.map((item) => {
          const count =
            item.id === 'status'
              ? status.devices.length
              : item.id === 'sessions'
                ? sessions.length
                : item.id === 'packs'
                  ? packs.length
                  : 0;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`watch-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`watch-panel-${item.id}`}
              className="lkv-watch__tab"
              onClick={() => setTab(item.id)}
            >
              {item.label}
              {count > 0 ? <span className="lkv-watch__tab-count">{count}</span> : null}
            </button>
          );
        })}
      </nav>

      {error ? (
        <div className="lkv-watch__inline-error">
          <ErrorState message={error} onRetry={refresh} />
        </div>
      ) : null}

      <div
        role="tabpanel"
        id={`watch-panel-${tab}`}
        aria-labelledby={`watch-tab-${tab}`}
        className="lkv-watch__panel"
      >
        {tab === 'status' ? (
          <WatchStatusScreen
            status={status}
            loading={loading}
            error={error}
            onRetry={refresh}
            onRegisterDevice={registerDevice}
            onRemoveDevice={removeDevice}
          />
        ) : null}

        {tab === 'sessions' ? (
          <WatchSessionsScreen
            sessions={sessions}
            loading={loading}
            error={null}
            onRefresh={refresh}
          />
        ) : null}

        {tab === 'packs' ? (
          <WatchPacksScreen
            packs={packs}
            availableStorageBytes={storageBytes}
            loading={loading}
            error={null}
            onRefresh={refresh}
            onVerify={verifyPack}
            onRemove={removePack}
          />
        ) : null}

        {tab === 'live' ? (
          <WatchLiveSyncScreen
            sessionId={sessionId}
            routeId={routeId}
            api={client}
            initialPois={[]}
          />
        ) : null}
      </div>

      <footer className="lkv-watch__footer">
        <p>
          Les cibles natives WatchKit / Wear OS sont diagnostiquées à chaque chargement.
          Une capacité absente reste affichée comme absente.
        </p>
        <Button variant="ghost" onClick={refresh} disabled={loading}>
          Rafraîchir
        </Button>
      </footer>
    </main>
  );
}
