'use client';

/**
 * Lot D03-UI — file hors ligne et séances rapprochées.
 *
 * Une séance montre apparaît ici uniquement après réception d’au moins un lot.
 * La file locale de la montre n’est jamais dupliquée : `clientSessionId` est
 * identique à `watchSessionId`.
 */

import type { ReconciledPhoneSession } from '@/features/watches';
import { RefreshCw } from 'lucide-react';
import {
  formatDateTime,
  formatDistanceMeters,
  formatDuration,
} from './format';
import { Button, Card, EmptyState, Notice, Section, StatusPill } from './primitives';

export interface WatchSessionsScreenProps {
  sessions: ReconciledPhoneSession[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export function WatchSessionsScreen({
  sessions,
  loading = false,
  error = null,
  onRefresh,
}: WatchSessionsScreenProps) {
  const pending = sessions.filter((session) => session.status === 'active');
  const finished = sessions.filter((session) => session.status === 'finished');

  return (
    <div className="lkv-watch__stack" data-testid="watch-sessions-screen">
      <div className="lkv-watch__grid lkv-watch__grid--3">
        <Card>
          <p className="lkv-watch__stat-label">Séances suivies</p>
          <p className="lkv-watch__stat-value">{sessions.length}</p>
        </Card>
        <Card>
          <p className="lkv-watch__stat-label">En attente de fin</p>
          <p className="lkv-watch__stat-value">{pending.length}</p>
        </Card>
        <Card>
          <p className="lkv-watch__stat-label">Terminées</p>
          <p className="lkv-watch__stat-value">{finished.length}</p>
        </Card>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <Section
        title="Séances reçues de la montre"
        hint="Chaque lot est idempotent : un rejeu Bluetooth ne crée ni point ni séance en double."
        action={
          <Button variant="ghost" onClick={onRefresh} disabled={loading || !onRefresh}>
            <RefreshCw size={15} aria-hidden="true" /> Rafraîchir
          </Button>
        }
      >
        {loading && sessions.length === 0 ? (
          <Notice tone="info">Lecture de la file de synchronisation…</Notice>
        ) : sessions.length === 0 ? (
          <EmptyState title="Aucune séance montre reçue">
            Les sorties enregistrées sans téléphone restent dans la file locale de la montre
            jusqu’à la reconnexion Bluetooth. Rien n’est inventé côté Compte.
          </EmptyState>
        ) : (
          <ul className="lkv-watch__list">
            {sessions.map((session) => (
              <li key={session.watchSessionId}>
                <Card as="article" className="lkv-watch__session" data-testid="watch-session-card">
                  <div className="lkv-watch__row">
                    <div>
                      <h3 className="lkv-watch__card-title">{session.sport}</h3>
                      <p className="lkv-watch__hint">
                        {formatDateTime(session.startedAtUtcMs)} ·{' '}
                        {session.platform === 'apple_watch'
                          ? 'Apple Watch'
                          : session.platform === 'wear_os'
                            ? 'Wear OS'
                            : 'Galaxy Watch'}
                      </p>
                    </div>
                    <StatusPill tone={session.status === 'finished' ? 'ok' : 'warning'}>
                      {session.status === 'finished' ? 'Terminée' : 'En cours'}
                    </StatusPill>
                  </div>

                  <dl className="lkv-watch__metrics">
                    <div>
                      <dt>Distance</dt>
                      <dd>{formatDistanceMeters(session.distanceM)}</dd>
                    </div>
                    <div>
                      <dt>D+</dt>
                      <dd>{Math.round(session.elevGainM)} m</dd>
                    </div>
                    <div>
                      <dt>Temps écoulé</dt>
                      <dd>{formatDuration(session.elapsedMs / 1000)}</dd>
                    </div>
                    <div>
                      <dt>Points</dt>
                      <dd>{session.points.length}</dd>
                    </div>
                  </dl>

                  <p className="lkv-watch__hint">
                    Dernier point contigu : {session.lastContiguousPointSeq} · lots reçus :{' '}
                    {session.batchesReceivedCount} · doublons ignorés :{' '}
                    {session.duplicatePointsIgnored} point(s), {session.duplicateEventsIgnored}{' '}
                    événement(s).
                  </p>

                  {session.status === 'finished' ? (
                    <p className="lkv-watch__hint">
                      Identifiant canonique : <code>{session.clientSessionId}</code>{' '}
                      {session.summarySaved ? '· résumé enregistré' : '· résumé manquant'}
                    </p>
                  ) : (
                    <Notice tone="warning">
                      Séance encore ouverte sur la montre : aucun résumé final n’a été reçu.
                    </Notice>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
