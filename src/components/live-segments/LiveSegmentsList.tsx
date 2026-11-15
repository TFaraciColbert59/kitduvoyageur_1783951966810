'use client';

/**
 * Lot S03-UI — liste des Live Segments disponibles autour du lecteur.
 *
 * Chaque carte affiche uniquement des données du catalogue (distance réelle,
 * D+, objectif fantôme). Un segment sans fantôme le dit explicitement.
 */

import React from 'react';
import type { LiveSegmentSummaryView } from './types';
import {
  directionLabel,
  formatDistance,
  formatElevation,
  ghostKindLabel,
  sportLabel,
} from './format';
import {
  LiveSegmentBadge,
  LiveSegmentButton,
  LiveSegmentEmpty,
  cx,
} from './primitives';
import styles from './live-segments.module.css';

export interface LiveSegmentsListProps {
  segments: readonly LiveSegmentSummaryView[];
  selectedId?: string | null;
  busy?: boolean;
  onStart: (segment: LiveSegmentSummaryView) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function LiveSegmentsList({
  segments,
  selectedId,
  busy = false,
  onStart,
  emptyTitle = 'Aucun segment à proximité',
  emptyDescription = 'Déplacez-vous ou élargissez le rayon pour découvrir un Live Segment.',
  className,
}: LiveSegmentsListProps) {
  if (segments.length === 0) {
    return (
      <div className={cx(styles.listWrap, className)}>
        <LiveSegmentEmpty title={emptyTitle} description={emptyDescription} icon="compass" />
      </div>
    );
  }

  return (
    <ul className={cx(styles.segmentList, className)} aria-label="Segments disponibles">
      {segments.map((segment) => {
        const ghost = segment.ghostProfiles[0] ?? null;
        const selected = selectedId === segment.id;
        return (
          <li key={segment.id} className={styles.segmentItem}>
            <article
              className={cx(styles.segmentCard, selected && styles.segmentCardSelected)}
              aria-current={selected ? 'true' : undefined}
            >
              <div className={styles.segmentTop}>
                <div className={styles.headingBlock}>
                  <p className={styles.eyebrow}>
                    {segment.region} · {sportLabel(segment.sport)}
                  </p>
                  <h3 className={styles.segmentTitle}>{segment.name}</h3>
                </div>
                <LiveSegmentBadge tone={ghost ? 'info' : 'neutral'} icon={ghost ? 'target' : 'info'}>
                  {ghost ? ghostKindLabel(ghost.kind) : 'Sans fantôme'}
                </LiveSegmentBadge>
              </div>

              <dl className={styles.segmentMeta}>
                <div>
                  <dt>Distance</dt>
                  <dd>{formatDistance(segment.totalDistanceM)}</dd>
                </div>
                <div>
                  <dt>Dénivelé</dt>
                  <dd>{formatElevation(segment.elevationGainM)}</dd>
                </div>
                <div>
                  <dt>Sens</dt>
                  <dd>{directionLabel(segment.direction)}</dd>
                </div>
                <div>
                  <dt>De vous</dt>
                  <dd>
                    {segment.distanceFromViewerM !== null
                      ? formatDistance(segment.distanceFromViewerM)
                      : '—'}
                  </dd>
                </div>
              </dl>

              {ghost ? (
                <p className={styles.segmentGhost}>
                  Objectif : {ghost.label} · {formatDistance(segment.totalDistanceM)} à parcourir
                </p>
              ) : (
                <p className={styles.segmentGhostMuted}>
                  Aucun temps de référence publié : vous courrez sans comparaison.
                </p>
              )}

              <LiveSegmentButton
                fullWidth
                variant={selected ? 'secondary' : 'primary'}
                disabled={busy}
                onClick={() => onStart(segment)}
                aria-label={`Démarrer le segment ${segment.name}`}
              >
                {selected ? 'Segment sélectionné' : 'Démarrer'}
              </LiveSegmentButton>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
