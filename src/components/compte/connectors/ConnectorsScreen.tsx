'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import type { CanonicalRouteForSync, PartnerProviderId } from '@/features/connectors';
import type {
  ConnectorCatalogResponse,
  ConnectorConsentResponse,
  ConnectorSyncQueueResponse,
  OAuthStartResponse,
  RevokeServiceResult,
  RouteSendResponse,
} from '@/lib/connectors/types';
import { buildRouteSendTargets, CONNECTOR_PURPOSE_LABELS } from '@/lib/connectors/viewModels';
import { ConnectorOAuthPanel } from './ConnectorOAuthPanel';
import { ConnectorSyncQueue } from './ConnectorSyncQueue';
import { PartnerConnectorCatalog } from './PartnerConnectorCatalog';
import { RouteSendToGpsPanel } from './RouteSendToGpsPanel';

export interface ConnectorsScreenProps {
  initialCatalog: ConnectorCatalogResponse;
  initialQueue: ConnectorSyncQueueResponse;
  route?: CanonicalRouteForSync | null;
  initialNotice?: string | null;
  initialError?: string | null;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as
    | (Record<string, unknown> & { error?: string })
    | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? `Requête refusée (HTTP ${response.status}).`);
  }
  return payload as T;
}

/**
 * Écran Connecteurs du compte.
 *
 * Toutes les données initiales viennent du serveur (session + registre D01).
 * Les actions ne font que déclencher les routes API dédiées puis recharger
 * l'état réel : aucun succès n'est affiché sans réponse serveur.
 */
export function ConnectorsScreen({
  initialCatalog,
  initialQueue,
  route = null,
  initialNotice = null,
  initialError = null,
}: ConnectorsScreenProps) {
  const router = useRouter();
  const [catalog, setCatalog] = useState(initialCatalog);
  const [queue, setQueue] = useState(initialQueue);
  const [notice, setNotice] = useState<string | null>(initialNotice);
  const [error, setError] = useState<string | null>(initialError);
  const [busyProvider, setBusyProvider] = useState<PartnerProviderId | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [sendResult, setSendResult] = useState<RouteSendResponse | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const refreshQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const next = await requestJson<ConnectorSyncQueueResponse>('/api/connectors/sync-queue');
      setQueue(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’actualiser la file.');
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const handleConnect = useCallback(async (providerId: PartnerProviderId) => {
    setBusyProvider(providerId);
    setError(null);
    setNotice(null);
    try {
      const started = await requestJson<OAuthStartResponse>(
        `/api/connectors/oauth/${providerId}/start`,
        { method: 'POST', body: JSON.stringify({ returnTo: '/compte/connecteurs' }) }
      );
      window.location.assign(started.authorizationUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Connexion impossible.');
      setBusyProvider(null);
    }
  }, []);

  const handleRevoke = useCallback(
    async (providerId: PartnerProviderId) => {
      setBusyProvider(providerId);
      setError(null);
      setNotice(null);
      try {
        const result = await requestJson<RevokeServiceResult>(`/api/connectors/${providerId}/revoke`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        setCatalog(result.catalog);
        setNotice(
          `Connexion révoquée. ${result.cancelledPendingJobs} job(s) annulé(s). Les références de jeton ont été purgées.`
        );
        await refreshQueue();
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Révocation impossible.');
      } finally {
        setBusyProvider(null);
      }
    },
    [refreshQueue, router]
  );

  const handleGrantPurpose = useCallback(
    async (
      providerId: PartnerProviderId,
      purpose: keyof typeof CONNECTOR_PURPOSE_LABELS,
      granted: boolean
    ) => {
      setBusyProvider(providerId);
      setError(null);
      setNotice(null);
      try {
        const result = await requestJson<ConnectorConsentResponse>('/api/connectors/consent', {
          method: 'POST',
          body: JSON.stringify({ purpose, granted }),
        });
        setCatalog(result.catalog);
        setNotice(
          granted
            ? `Consentement « ${CONNECTOR_PURPOSE_LABELS[purpose]} » accordé. La synchronisation reste soumise aux capacités du partenaire.`
            : `Consentement « ${CONNECTOR_PURPOSE_LABELS[purpose]} » retiré. Toute synchronisation est coupée immédiatement.`
        );
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer ce consentement.');
      } finally {
        setBusyProvider(null);
      }
    },
    [router]
  );

  const handleSend = useCallback(
    async (providerId: PartnerProviderId, deviceModelId?: string) => {
      if (!route) return;
      setBusyProvider(providerId);
      setSendError(null);
      setSendResult(null);
      try {
        const response = await requestJson<RouteSendResponse>('/api/connectors/routes/send', {
          method: 'POST',
          body: JSON.stringify({ providerId, deviceModelId, route }),
        });
        setSendResult(response);
        await refreshQueue();
      } catch (cause) {
        setSendError(cause instanceof Error ? cause.message : 'Envoi impossible.');
      } finally {
        setBusyProvider(null);
      }
    },
    [refreshQueue, route]
  );

  const sendTargets = buildRouteSendTargets(catalog.connectors);

  return (
    <main className="cn-screen">
      <header className="cn-hero">
        <Link className="cn-back" href="/compte">
          <ChevronLeft size={16} aria-hidden="true" />
          Compte
        </Link>
        <p className="cn-eyebrow">Connecteurs partenaires</p>
        <h1 className="cn-title">
          Tes GPS, montres et plateformes, <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>au même endroit</em>
        </h1>
        <p className="cn-lede">
          Envoie un itinéraire, importe une activité ou vérifie ce qui est réellement connecté. Un connecteur sans
          credentials serveur reste indisponible : aucun jeton n’est simulé.
        </p>
      </header>

      <div className="cn-summary" aria-label="Résumé des connecteurs">
        <div className="cn-metric">
          <b>{catalog.summary.connected}</b>
          <span>Connectés</span>
        </div>
        <div className="cn-metric">
          <b>{catalog.summary.available}</b>
          <span>Configurés</span>
        </div>
        <div className="cn-metric">
          <b>{catalog.summary.credentialsMissing}</b>
          <span>Credentials absents</span>
        </div>
        <div className="cn-metric">
          <b>{catalog.summary.manualFallbacks}</b>
          <span>Replis manuels</span>
        </div>
      </div>

      <PartnerConnectorCatalog catalog={catalog} />

      <ConnectorOAuthPanel
        connectors={catalog.connectors}
        pendingProvider={busyProvider}
        error={error}
        notice={notice}
        onConnect={handleConnect}
        onRevoke={handleRevoke}
        onGrantPurpose={handleGrantPurpose}
      />

      <RouteSendToGpsPanel
        targets={sendTargets}
        route={route}
        result={sendResult}
        busyProvider={busyProvider}
        error={sendError}
        onSend={handleSend}
      />

      <ConnectorSyncQueue queue={queue} loading={queueLoading} onRefresh={refreshQueue} />
    </main>
  );
}

export default ConnectorsScreen;
