'use client';

/**
 * Lot S03-UI / S4.09 — comparaison fantôme en temps réel.
 *
 * La valeur centrale est l'écart signé du contrat (`deltaMs` négatif = avance).
 * Aucun temps de référence n'est inventé : sans fantôme autorisé, le panneau
 * l'annonce et n'affiche ni delta ni projection.
 */

import React from 'react';
import type { LiveSegmentSnapshot } from '@/features/live-segments';
import {
  clampRatio,
  deltaDirection,
  formatDelta,
  formatDeltaLabel,
  formatDistance,
  formatProjectedFinish,
  formatSignedDelta,
  ghostKindLabel,
  type DeltaDirection,
} from './format';
import {
  LiveSegmentEmpty,
  LiveSegmentStat,
  cx,
} from './primitives';
import styles from './live-segments.module.css';

const DELTA_HEADLINE: Record<Exclude<DeltaDirection, 'none'>, string> = {
  ahead: 'd’avance',
  behind: 'de retard',
  level: 'au niveau',
};

function signedDistance(deltaM: number | null): string {
  if (deltaM === null || !Number.isFinite(deltaM)) return '—';
  if (Math.abs(deltaM) < 1) return '0 m';
  return `${deltaM > 0 ? '+' : '−'} ${formatDistance(Math.abs(deltaM))}`;
}

export interface GhostComparisonProps {
  snapshot: LiveSegmentSnapshot;
  compact?: boolean;
  className?: string;
}

export function GhostComparison({ snapshot, compact = false, className }: GhostComparisonProps) {
  const direction = deltaDirection(snapshot.deltaMs);

  if (!snapshot.activeGhostKind) {
    return (
      <div className={cx(styles.ghostPanel, styles.ghostEmpty, className)}>
        <LiveSegmentEmpty
          icon="target"
          title="Aucun fantôme sélectionné"
          description="Choisissez un objectif ou un record pour comparer votre effort en direct."
        />
      </div>
    );
  }

  if (direction === 'none') {
    return (
      <div className={cx(styles.ghostPanel, className)} data-direction="none">
        <div className={styles.ghostTop}>
          <span className={styles.eyebrow}>Comparaison fantôme</span>
          <span className={styles.ghostKind}>{ghostKindLabel(snapshot.activeGhostKind)}</span>
        </div>
        <p className={styles.ghostHeadline}>En attente du premier point</p>
        <p className={styles.subtitle}>{snapshot.activeGhostLabel ?? 'Fantôme'}</p>
      </div>
    );
  }

  const headline = DELTA_HEADLINE[direction];
  const projected = formatProjectedFinish(snapshot.projectedFinishMs);
  const ghostDistanceM = Math.max(
    0,
    snapshot.distanceCoveredM - (snapshot.deltaDistanceM ?? 0),
  );
  const totalM = Math.max(1, snapshot.totalDistanceM);
  const ghostRatio = clampRatio(ghostDistanceM / totalM);
  const athleteRatio = clampRatio(snapshot.progressRatio);

  return (
    <section
      className={cx(styles.ghostPanel, className)}
      data-direction={direction}
      aria-label={`Comparaison avec ${snapshot.activeGhostLabel ?? 'le fantôme'}`}
    >
      <div className={styles.ghostTop}>
        <div className={styles.headingBlock}>
          <span className={styles.eyebrow}>Comparaison fantôme</span>
          <span className={styles.ghostKind}>
            {ghostKindLabel(snapshot.activeGhostKind)}
            {snapshot.activeGhostLabel ? ` · ${snapshot.activeGhostLabel}` : ''}
          </span>
        </div>
        <span className={styles.ghostDeltaChip} data-direction={direction}>
          {formatDeltaLabel(snapshot.deltaMs)}
        </span>
      </div>

      <p className={styles.ghostHeadline} aria-live="polite">
        <strong>{direction === 'level' ? 'Au niveau' : formatDelta(snapshot.deltaMs)}</strong>
        {direction === 'level' ? '' : ` ${headline}`}
      </p>
      <p className={styles.ghostAria}>
        {`${formatDelta(snapshot.deltaMs)} ${headline} sur ${snapshot.activeGhostLabel ?? 'le fantôme'}.`}
      </p>

      {!compact ? (
        <>
          <div className={styles.ghostRail} aria-hidden="true">
            <span className={styles.ghostRailFill} style={{ width: `${athleteRatio * 100}%` }} />
            <span
              className={styles.ghostMarker}
              style={{ left: `${ghostRatio * 100}%` }}
              data-kind="ghost"
            />
            <span
              className={styles.ghostMarker}
              style={{ left: `${athleteRatio * 100}%` }}
              data-kind="athlete"
            />
          </div>
          <div className={styles.ghostLegend} aria-hidden="true">
            <span>
              <i data-kind="athlete" /> Vous
            </span>
            <span>
              <i data-kind="ghost" /> {snapshot.activeGhostLabel ?? 'Fantôme'}
            </span>
          </div>

          <div className={styles.statGrid}>
            <LiveSegmentStat
              label="Écart temps"
              value={formatSignedDelta(snapshot.deltaMs)}
              tone={direction === 'ahead' ? 'success' : direction === 'behind' ? 'warning' : 'neutral'}
            />
            <LiveSegmentStat
              label="Écart distance"
              value={signedDistance(snapshot.deltaDistanceM)}
              hint={direction === 'ahead' ? 'devant le fantôme' : 'derrière le fantôme'}
              tone={direction === 'ahead' ? 'success' : direction === 'behind' ? 'warning' : 'neutral'}
            />
            <LiveSegmentStat
              label="Projection"
              value={projected ? projected.replace('Temps final estimé ', '') : '—'}
              hint={projected ? 'à l’allure actuelle' : 'pas assez de points'}
            />
          </div>
        </>
      ) : (
        <p className={styles.ghostCompact}>
          {signedDistance(snapshot.deltaDistanceM)}
          {projected ? ` · ${projected}` : ''}
        </p>
      )}
    </section>
  );
}
