/* eslint-disable @next/next/no-img-element -- médias utilisateur servis par un CDN externe, hôtes non déclarables à l'avance. */
'use client';

import React, { useId, useMemo, useState } from 'react';
import type {
  FlybyCrossing,
  FlybyDetectionResult,
  GeoPoint,
} from '@/features/media-sharing';
import styles from './media-sharing.module.css';
import {
  DIRECTION_LABELS,
  formatDateTimeMs,
  formatDistanceApart,
  formatDurationSec,
} from './format';
import { Badge, EmptyState, LockedState, SectionHeading, Stat } from './StateCards';
import { TrackMiniMap } from './TrackMiniMap';
import { ArrowIcon, UsersIcon } from './icons';

function directionGlyph(direction: FlybyCrossing['relativeDirection']): string {
  if (direction === 'same_direction') return '→';
  if (direction === 'opposite') return '←';
  return '×';
}

export interface FlybyScreenProps {
  result: FlybyDetectionResult;
  primaryName: string;
  primaryPoints: readonly GeoPoint[];
}

/**
 * S3.22 — Flyby croisés.
 * Le refus est visible : le consentement manquant ou une trace privée ne sont
 * jamais remplacés par une liste vide silencieuse.
 */
export function FlybyScreen({
  result,
  primaryName,
  primaryPoints,
}: FlybyScreenProps) {
  const headingId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => result.crossings.find((crossing) => crossing.crossingId === selectedId) ?? null,
    [result.crossings, selectedId],
  );

  if (!result.enabled) {
    return (
      <section className={styles.screen} aria-labelledby={headingId}>
        <SectionHeading
          eyebrow="Flyby"
          title={primaryName}
          description="Les croisements avec d'autres sportifs restent désactivés."
        />
        <LockedState
          title={
            result.reason === 'primary_private'
              ? 'Sortie privée'
              : 'Consentement requis'
          }
          message={
            result.reason === 'primary_private'
              ? "Une sortie privée ne peut pas être croisée. Aucun autre sportif n'est exposé."
              : "Active le Flyby dans les réglages de la sortie pour voir les croisements. Rien n'est détecté sans ton accord explicite."
          }
        />
      </section>
    );
  }

  return (
    <section className={styles.screen} aria-labelledby={headingId}>
      <SectionHeading
        eyebrow="Flyby"
        title={primaryName}
        description="Les sportifs croisés à moins de 100 m et 5 minutes, uniquement avec leur consentement."
        action={
          <div className={styles.badgeRow}>
            <Badge tone="success">{result.crossings.length} croisement(s)</Badge>
            <Badge tone="neutral">{result.excludedCount} exclu(s)</Badge>
          </div>
        }
      />

      <div className={styles.statsRow}>
        <Stat label="Croisements" value={result.crossings.length} />
        <Stat label="Exclus" value={result.excludedCount} hint="privé, bloqué ou sans accord" />
        <Stat label="Fenêtre" value="5 min" hint="100 m maximum" />
      </div>

      {result.crossings.length === 0 ? (
        <EmptyState
          title="Aucun croisement autorisé"
          message="Personne ne correspond aux critères de distance, de temps et de consentement sur cette sortie."
        />
      ) : (
        <div className={styles.flybyLayout}>
          <div className={styles.flybyMapWrap}>
            <TrackMiniMap
              points={primaryPoints}
              pins={result.crossings.map((crossing) => ({
                id: crossing.crossingId,
                label: `${crossing.otherDisplayName}, ${formatDistanceApart(
                  crossing.distanceApartM,
                )}`,
                lat: crossing.meetingPoint.lat,
                lng: crossing.meetingPoint.lng,
                tone: 'meeting',
              }))}
              selectedPinId={selectedId}
              onSelectPin={setSelectedId}
              ariaLabel={`Croisements Flyby de ${primaryName}`}
              height={250}
            />
            <p className={styles.mapLegend}>
              <span className={styles.legendDot} data-tone="meeting" aria-hidden="true" />
              Point de rencontre autorisé
            </p>
          </div>

          <div className={styles.flybyList} role="list" aria-label="Sportifs croisés">
            {result.crossings.map((crossing) => (
              <div role="listitem" key={crossing.crossingId}>
                <button
                  type="button"
                  className={styles.crossingCard}
                  data-active={selectedId === crossing.crossingId ? 'true' : 'false'}
                  aria-pressed={selectedId === crossing.crossingId}
                  onClick={() => setSelectedId(crossing.crossingId)}
                >
                  <span className={styles.avatar} aria-hidden="true">
                    {crossing.otherAvatarUrl ? (
                      <img src={crossing.otherAvatarUrl} alt="" loading="lazy" />
                    ) : (
                      crossing.otherDisplayName.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className={styles.crossingBody}>
                    <span className={styles.crossingTop}>
                      <strong>{crossing.otherDisplayName}</strong>
                      <span className={styles.crossingHandle}>{crossing.otherHandle}</span>
                    </span>
                    <span className={styles.crossingMeta}>
                      <span data-direction={crossing.relativeDirection}>
                        {directionGlyph(crossing.relativeDirection)}{' '}
                        {DIRECTION_LABELS[crossing.relativeDirection]}
                      </span>
                      <span>{formatDistanceApart(crossing.distanceApartM)}</span>
                      <span>{formatDurationSec(crossing.timeDeltaSec)} d’écart</span>
                    </span>
                    <span className={styles.crossingTime}>
                      {formatDateTimeMs(crossing.meetingTimeMs)}
                    </span>
                  </span>
                  <ArrowIcon size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected ? (
        <div className={styles.flybyDetail} role="status">
          <UsersIcon size={18} />
          <p>
            Rencontre avec <strong>{selected.otherDisplayName}</strong> à{' '}
            {formatDistanceApart(selected.distanceApartM)} du point de passage, le{' '}
            {formatDateTimeMs(selected.meetingTimeMs)}.
          </p>
        </div>
      ) : null}
    </section>
  );
}
