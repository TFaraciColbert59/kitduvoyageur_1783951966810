'use client';

/**
 * Lot S03-UI / S4.09–S4.10 — écran dédié des Live Segments.
 *
 * Parcours : catalogue autour du lecteur → approche → départ → effort en
 * direct (écart fantôme) → arrivée et verdict. Le GPS et l'API sont
 * injectables ; l'écran ne fabrique aucune métrique.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LiveSegmentDefinition, PrivacyContext } from '@/features/live-segments';
import {
  createLiveSegmentsApi,
  LiveSegmentsApiError,
  type LiveSegmentsApi,
} from './api';
import { LiveSegmentAlertBanner } from './LiveSegmentAlertBanner';
import { LiveSegmentHud } from './LiveSegmentHud';
import { LiveSegmentsList } from './LiveSegmentsList';
import {
  LiveSegmentBadge,
  LiveSegmentButton,
  LiveSegmentEmpty,
  LiveSegmentPanel,
  LiveSegmentSpinner,
} from './primitives';
import type { LiveSegmentSummaryView } from './types';
import { useLiveSegmentSession } from './useLiveSegmentSession';
import styles from './live-segments.module.css';

const SPORTS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'all', label: 'Tous' },
  { id: 'cycling', label: 'Vélo' },
  { id: 'running', label: 'Course' },
  { id: 'hiking', label: 'Randonnée' },
  { id: 'trail', label: 'Trail' },
  { id: 'gravel', label: 'Gravel' },
];

export interface LiveSegmentsScreenProps {
  api?: LiveSegmentsApi;
  geolocation?: Geolocation | null;
  now?: () => number;
  initialSegments?: readonly LiveSegmentSummaryView[];
  /** Injecté par les tests pour éviter le chargement réseau. */
  autoLoad?: boolean;
  className?: string;
}

const LOCAL_PRIVACY: PrivacyContext = {
  viewerId: 'local-viewer',
  optedInLiveSegments: true,
  blockedUserIds: new Set<string>(),
  allowedPeerIds: new Set<string>(),
};

export function LiveSegmentsScreen({
  api,
  geolocation,
  now,
  initialSegments,
  autoLoad = true,
  className,
}: LiveSegmentsScreenProps) {
  const client = useMemo(() => api ?? createLiveSegmentsApi(), [api]);
  const [segments, setSegments] = useState<LiveSegmentSummaryView[]>([
    ...(initialSegments ?? []),
  ]);
  const [dataSource, setDataSource] = useState<'demo_catalog' | null>(
    initialSegments && initialSegments.length > 0 ? 'demo_catalog' : null,
  );
  const [loading, setLoading] = useState(autoLoad && !initialSegments);
  const [error, setError] = useState<string | null>(null);
  const [sport, setSport] = useState('all');
  const [locating, setLocating] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null);
  const [serverVerdict, setServerVerdict] = useState<{
    tone: 'info' | 'success' | 'warning';
    text: string;
  } | null>(null);
  const submittedEffortRef = useRef<string | null>(null);

  const load = useCallback(
    async (coords?: { lat: number; lon: number } | null) => {
      setLoading(true);
      setError(null);
      try {
        const response = await client.list({
          ...(coords ? { lat: coords.lat, lon: coords.lon, radius: 200_000 } : {}),
          limit: 20,
        });
        setSegments(response.items);
        setDataSource(response.dataSource);
      } catch (cause) {
        setError(
          cause instanceof LiveSegmentsApiError
            ? cause.message
            : 'Impossible de charger les Live Segments.',
        );
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  useEffect(() => {
    if (!autoLoad || initialSegments) return;
    void load();
  }, [autoLoad, initialSegments, load]);

  const definitions = useMemo<LiveSegmentDefinition[]>(
    () =>
      segments.map((summary) => ({
        id: summary.id,
        version: summary.version,
        name: summary.name,
        sport: summary.sport,
        direction: summary.direction,
        points: summary.points,
        totalDistanceM: summary.totalDistanceM,
        elevationGainM: summary.elevationGainM,
        isPrivate: false,
        ownerId: 'lkdv-demo-catalog',
        isStarred: true,
        ghostProfiles: summary.ghostProfiles,
      })),
    [segments],
  );

  const session = useLiveSegmentSession({
    segments: definitions,
    privacy: LOCAL_PRIVACY,
    geolocation,
    now,
  });

  const activeAlert = session.alerts[0] ?? null;
  const finalResult = session.snapshot.finalResult;

  useEffect(() => {
    if (!finalResult || submittedEffortRef.current === finalResult.effortId) return;
    submittedEffortRef.current = finalResult.effortId;
    setServerVerdict({ tone: 'info', text: 'Vérification serveur en cours…' });

    void client
      .submitEffort(finalResult.segmentId, finalResult)
      .then((response) => {
        setServerVerdict(
          response.effort.isValidForLeaderboard
            ? {
                tone: 'success',
                text: 'Vérifié par le serveur · éligible au classement.',
              }
            : {
                tone: 'warning',
                text: 'Vérifié par le serveur · temps non éligible au classement.',
              },
        );
      })
      .catch((cause) => {
        setServerVerdict({
          tone: 'warning',
          text:
            cause instanceof LiveSegmentsApiError
              ? `Validation serveur indisponible : ${cause.message}`
              : 'Validation serveur indisponible ; le résultat local reste affiché.',
        });
      });
  }, [client, finalResult]);

  const locate = useCallback(() => {
    const geo = geolocation ?? (typeof navigator !== 'undefined' ? navigator.geolocation : null);
    if (!geo) {
      setError('La géolocalisation n’est pas disponible sur cet appareil.');
      return;
    }
    setLocating(true);
    setError(null);
    geo.getCurrentPosition(
      (result) => {
        const coords = { lat: result.coords.latitude, lon: result.coords.longitude };
        setPosition(coords);
        setLocating(false);
        void load(coords);
      },
      (failure) => {
        setLocating(false);
        setError(
          failure.code === 1
            ? 'Accès à la position refusé. Vous pouvez parcourir le catalogue sans GPS.'
            : 'Position indisponible. Réessayez à l’extérieur.',
        );
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
    );
  }, [geolocation, load]);

  const visibleSegments = useMemo(
    () => (sport === 'all' ? segments : segments.filter((item) => item.sport === sport)),
    [segments, sport],
  );

  const handleStart = useCallback(
    (segment: LiveSegmentSummaryView) => {
      submittedEffortRef.current = null;
      setServerVerdict(null);
      session.start(segment.id);
    },
    [session],
  );

  const showLive = session.snapshot.isVisible;

  return (
    <div className={[styles.screen, className].filter(Boolean).join(' ')}>
      <header className={styles.screenHeader}>
        <p className={styles.eyebrow}>Explorer · Live Segments</p>
        <h1 className={styles.screenTitle}>Le direct, segment par segment.</h1>
        <p className={styles.screenLead}>
          Approche, départ et arrivée sont détectés au passage des lignes. Votre écart au
          fantôme se met à jour à chaque point GPS.
        </p>
        <div className={styles.screenBadges}>
          <LiveSegmentBadge tone="info" icon="pulse">
            Temps réel
          </LiveSegmentBadge>
          <LiveSegmentBadge tone="neutral" icon="target">
            Comparaison fantôme
          </LiveSegmentBadge>
          {dataSource === 'demo_catalog' ? (
            <LiveSegmentBadge tone="warning" icon="info">
              Catalogue de démonstration
            </LiveSegmentBadge>
          ) : null}
        </div>
      </header>

      <LiveSegmentAlertBanner
        alert={activeAlert}
        snapshot={session.snapshot}
        onDismiss={activeAlert ? () => session.dismissAlert(activeAlert) : undefined}
        onAction={
          activeAlert?.type === 'finish' || activeAlert?.type === 'aborted'
            ? () => session.dismissAlert(activeAlert)
            : undefined
        }
      />

      {session.permissionError ? (
        <p className={styles.inlineError} role="alert">
          {session.permissionError}
        </p>
      ) : null}

      {session.isTracking && !showLive ? (
        <LiveSegmentPanel
          className={styles.waiting}
          ariaLabel="Recherche de la ligne de départ"
          testId="live-segment-waiting"
        >
          <div className={styles.panelHeader}>
            <div className={styles.headingBlock}>
              <p className={styles.eyebrow}>GPS actif</p>
              <h2 className={styles.title}>En attente de la ligne de départ</h2>
              <p className={styles.subtitle}>
                Le chrono partira automatiquement dès que vous serez à moins de 150 m du
                départ, dans le bon sens.
              </p>
            </div>
            <LiveSegmentButton variant="secondary" onClick={session.stop}>
              Arrêter
            </LiveSegmentButton>
          </div>
        </LiveSegmentPanel>
      ) : null}

      {showLive && serverVerdict ? (
        <p className={styles.serverNote} data-tone={serverVerdict.tone} role="status">
          {serverVerdict.text}
        </p>
      ) : null}

      {showLive ? (
        <LiveSegmentHud
          snapshot={session.snapshot}
          isPaused={session.isPaused}
          onPause={session.pause}
          onResume={session.resume}
          onStop={session.stop}
          onAcknowledge={() => {
            setServerVerdict(null);
            session.acknowledge();
          }}
          onRestart={() => {
            submittedEffortRef.current = null;
            setServerVerdict(null);
            if (session.selectedSegmentId) session.start(session.selectedSegmentId);
          }}
        />
      ) : (
        <section className={styles.catalog} aria-labelledby="live-segments-catalog-title">
          <div className={styles.catalogHeader}>
            <div className={styles.headingBlock}>
              <p className={styles.eyebrow}>Catalogue</p>
              <h2 className={styles.title} id="live-segments-catalog-title">
                {position ? 'Autour de vous' : 'Segments disponibles'}
              </h2>
              <p className={styles.subtitle}>
                {position
                  ? 'Triés par distance au point de départ, dans un rayon de 200 km.'
                  : 'Le catalogue complet. Activez la position pour trier par proximité.'}
              </p>
            </div>
            <LiveSegmentButton
              variant="secondary"
              onClick={locate}
              disabled={locating || loading}
              aria-label="Trier les segments autour de ma position"
            >
              {locating ? 'Localisation…' : 'Autour de moi'}
            </LiveSegmentButton>
          </div>

          <div className={styles.filterRow} role="group" aria-label="Filtrer par sport">
            {SPORTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.filterChip}
                data-active={sport === item.id ? 'true' : undefined}
                aria-pressed={sport === item.id}
                onClick={() => setSport(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {error ? (
            <LiveSegmentEmpty
              icon="alert"
              title="Chargement impossible"
              description={error}
              action={
                <LiveSegmentButton variant="secondary" onClick={() => void load(position)}>
                  Réessayer
                </LiveSegmentButton>
              }
            />
          ) : null}

          {!error && loading ? <LiveSegmentSpinner /> : null}

          {!error && !loading ? (
            <LiveSegmentsList
              segments={visibleSegments}
              selectedId={session.selectedSegmentId}
              busy={session.isTracking}
              onStart={handleStart}
            />
          ) : null}
        </section>
      )}

      <footer className={styles.footer}>
        <LiveSegmentBadge tone="neutral" icon="shield">
          Position utilisée pour la proximité et l’effort, jamais publiée
        </LiveSegmentBadge>
        <p className={styles.footerNote}>
          Aucun segment privé ni fantôme bloqué n’est exposé. Un effort hors tracé ou sans GPS
          fiable est conservé, mais exclu du classement.
        </p>
      </footer>
    </div>
  );
}
