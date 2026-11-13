'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';

import type { ConnectorSyncQueueResponse } from '@/lib/connectors/types';
import { ConnectorAvailabilityBadge } from './ConnectorAvailabilityBadge';

export interface ConnectorSyncQueueProps {
  queue: ConnectorSyncQueueResponse;
  loading?: boolean;
  onRefresh?: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * File de synchronisation réelle : jobs entrants et sortants, statut, tentatives,
 * prochaine reprise et erreur. Les jobs bloqués restent visibles, sans être
 * présentés comme terminés.
 */
export function ConnectorSyncQueue({ queue, loading = false, onRefresh }: ConnectorSyncQueueProps) {
  return (
    <section className="cn-section" aria-labelledby="cn-queue-title" aria-busy={loading}>
      <div className="cn-section-head">
        <h2 id="cn-queue-title">File de synchronisation</h2>
        <p>
          {queue.summary.pending} en attente · {queue.summary.blocked} bloqué
          {queue.summary.blocked > 1 ? 's' : ''} · {queue.summary.completed} terminé
          {queue.summary.completed > 1 ? 's' : ''}
        </p>
      </div>

      <div className="cn-summary">
        <div className="cn-metric">
          <b>{queue.summary.total}</b>
          <span>Jobs</span>
        </div>
        <div className="cn-metric">
          <b>{queue.summary.pending}</b>
          <span>En attente</span>
        </div>
        <div className="cn-metric">
          <b>{queue.summary.failed}</b>
          <span>Échecs</span>
        </div>
        <div className="cn-metric">
          <b>{queue.summary.blocked}</b>
          <span>Bloqués</span>
        </div>
      </div>

      {queue.jobs.length === 0 ? (
        <div className="cn-empty" role="status">
          <b>Aucune synchronisation en cours</b>
          Les imports d’activités et les envois d’itinéraires apparaîtront ici, avec leur statut réel.
        </div>
      ) : (
        <ul className="cn-list" aria-label="Jobs de synchronisation">
          {queue.jobs.map((job) => (
            <li key={job.jobId} className="cn-row">
              <div className="cn-row-main">
                <b>
                  {job.providerLabel} — {job.kindLabel}
                </b>
                <span>
                  Révision {job.revision} · {job.targetEntityId} · tentative {job.attempts}/{job.maxAttempts}
                  {job.nextRetryAt ? ` · reprise ${formatDate(job.nextRetryAt)}` : ''}
                </span>
                {job.lastError ? <span>{job.lastError}</span> : null}
              </div>
              <div className="cn-row-side">
                <ConnectorAvailabilityBadge label={job.statusLabel} tone={job.statusTone} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="cn-actions">
        <button type="button" className="cn-btn" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={15} aria-hidden="true" />
          {loading ? 'Actualisation…' : 'Actualiser la file'}
        </button>
      </div>
    </section>
  );
}

export default ConnectorSyncQueue;
