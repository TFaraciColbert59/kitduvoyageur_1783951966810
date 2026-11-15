'use client';

/**
 * Lot S03-UI / S4.09 — HUD temps réel d'un Live Segment.
 *
 * Trois surfaces selon l'état du contrat :
 *  - approche : distance à la ligne, fantôme choisi, possibilité d'annuler ;
 *  - actif (y compris hors tracé / GPS perdu) : chrono, progression, écart
 *    fantôme, pause et arrêt ;
 *  - terminé / interrompu : carte de résultat (verdict du moteur).
 */

import React from 'react';
import type { LiveSegmentSnapshot } from '@/features/live-segments';
import { GhostComparison } from './GhostComparison';
import { LiveSegmentResultCard } from './LiveSegmentResultCard';
import {
  formatClock,
  formatDistance,
  formatPercent,
  ghostKindLabel,
  remainingDistanceM,
} from './format';
import {
  LiveSegmentBadge,
  LiveSegmentButton,
  LiveSegmentPanel,
  LiveSegmentProgress,
  LiveSegmentSignalBadge,
  LiveSegmentStateBadge,
  LiveSegmentStat,
  cx,
} from './primitives';
import styles from './live-segments.module.css';

export interface LiveSegmentHudProps {
  snapshot: LiveSegmentSnapshot;
  isPaused?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onAcknowledge?: () => void;
  onRestart?: () => void;
  className?: string;
}

export function LiveSegmentHud({
  snapshot,
  isPaused = false,
  onPause,
  onResume,
  onStop,
  onAcknowledge,
  onRestart,
  className,
}: LiveSegmentHudProps) {
  if (snapshot.state === 'idle' || !snapshot.isVisible) return null;

  if (snapshot.state === 'completed' || snapshot.state === 'aborted') {
    return (
      <LiveSegmentResultCard
        snapshot={snapshot}
        onAcknowledge={onAcknowledge}
        onRestart={onRestart}
        className={className}
      />
    );
  }

  if (snapshot.state === 'approaching') {
    return (
      <LiveSegmentPanel
        className={cx(styles.hud, className)}
        ariaLabel="Approche du segment"
        testId="live-segment-approach"
      >
        <div className={styles.hudTop}>
          <LiveSegmentStateBadge state="approaching" />
          <LiveSegmentSignalBadge quality={snapshot.signalQuality} />
        </div>
        <div className={styles.approachMain}>
          <span className={styles.approachDistance}>
            {formatDistance(snapshot.distanceToStartM)}
          </span>
          <div className={styles.headingBlock}>
            <h2 className={styles.hudTitle}>{snapshot.segmentName ?? 'Live Segment'}</h2>
            <p className={styles.subtitle}>
              {snapshot.activeGhostKind
                ? `${ghostKindLabel(snapshot.activeGhostKind)}${snapshot.activeGhostLabel ? ` · ${snapshot.activeGhostLabel}` : ''}`
                : 'Sans fantôme'}
            </p>
          </div>
        </div>
        <p className={styles.approachHint}>
          Le chrono part automatiquement au passage de la ligne de départ.
        </p>
        <div className={styles.hudActions}>
          {onStop ? (
            <LiveSegmentButton variant="secondary" onClick={onStop}>
              Annuler l’approche
            </LiveSegmentButton>
          ) : null}
        </div>
      </LiveSegmentPanel>
    );
  }

  const remaining = remainingDistanceM(snapshot);
  const statusNotice =
    snapshot.state === 'off_route'
      ? 'Vous êtes hors du tracé : revenez sur le segment pour valider l’effort.'
      : snapshot.state === 'gps_lost'
        ? 'Signal GPS perdu : le chrono continue, la validité de l’effort est compromise.'
        : null;

  return (
    <LiveSegmentPanel
      className={cx(styles.hud, className)}
      ariaLabel="Live Segment en cours"
      testId="live-segment-hud"
    >
      <div className={styles.hudTop}>
        <div className={styles.badgeRow}>
          <LiveSegmentStateBadge state={snapshot.state} />
          <LiveSegmentSignalBadge quality={snapshot.signalQuality} />
          {isPaused ? (
            <LiveSegmentBadge tone="warning" icon="pause">
              En pause
            </LiveSegmentBadge>
          ) : null}
        </div>
        <span className={styles.hudDirection}>
          {snapshot.matchedDirection === 'reverse' ? 'Sens inverse' : 'Sens direct'}
        </span>
      </div>

      <div className={styles.hudMain}>
        <div className={styles.headingBlock}>
          <p className={styles.eyebrow}>En direct</p>
          <h2 className={styles.hudTitle}>{snapshot.segmentName ?? 'Live Segment'}</h2>
        </div>
        <div className={styles.hudClock} aria-label={`Temps écoulé ${formatClock(snapshot.elapsedMs)}`}>
          {formatClock(snapshot.elapsedMs)}
        </div>
      </div>

      {statusNotice ? (
        <p className={styles.hudNotice} role="status">
          {statusNotice}
        </p>
      ) : null}

      <LiveSegmentProgress
        ratio={snapshot.progressRatio}
        label="Progression sur le segment"
        valueText={formatPercent(snapshot.progressRatio)}
        tone={snapshot.state === 'off_route' ? 'warning' : 'success'}
      />

      <div className={styles.hudDistanceRow}>
        <span>{formatDistance(snapshot.distanceCoveredM)} parcourus</span>
        <span>{formatDistance(remaining)} restants</span>
      </div>

      <GhostComparison snapshot={snapshot} />

      <div className={styles.statGrid}>
        <LiveSegmentStat
          label="Distance"
          value={formatDistance(snapshot.distanceCoveredM)}
          hint={`sur ${formatDistance(snapshot.totalDistanceM)}`}
        />
        <LiveSegmentStat label="Restant" value={formatDistance(remaining)} />
        <LiveSegmentStat
          label="Fantôme"
          value={snapshot.activeGhostLabel ?? 'Aucun'}
          hint={ghostKindLabel(snapshot.activeGhostKind)}
        />
      </div>

      <div className={styles.hudActions}>
        {isPaused ? (
          <LiveSegmentButton variant="primary" onClick={onResume}>
            Reprendre
          </LiveSegmentButton>
        ) : (
          <LiveSegmentButton variant="secondary" onClick={onPause}>
            Mettre en pause
          </LiveSegmentButton>
        )}
        <LiveSegmentButton variant="danger" onClick={onStop}>
          Arrêter
        </LiveSegmentButton>
      </div>
    </LiveSegmentPanel>
  );
}
