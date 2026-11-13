'use client';

/**
 * Lot S03-UI / S4.09 — carte de résultat d'un Live Segment.
 *
 * Le verdict affiché est celui du moteur (`finalResult`), y compris les
 * invalidations : jamais de « record » décoratif sur un effort non valide.
 */

import React from 'react';
import type { LiveSegmentSnapshot } from '@/features/live-segments';
import {
  formatClock,
  formatDistance,
  formatPercent,
  invalidationLabel,
} from './format';
import {
  LiveSegmentBadge,
  LiveSegmentButton,
  LiveSegmentPanel,
  LiveSegmentStat,
  cx,
} from './primitives';
import styles from './live-segments.module.css';

export interface LiveSegmentResultCardProps {
  snapshot: LiveSegmentSnapshot;
  onAcknowledge?: () => void;
  onRestart?: () => void;
  className?: string;
}

export function LiveSegmentResultCard({
  snapshot,
  onAcknowledge,
  onRestart,
  className,
}: LiveSegmentResultCardProps) {
  const result = snapshot.finalResult;
  const aborted = snapshot.state === 'aborted';
  const valid = !aborted && (result?.isValidForLeaderboard ?? false);
  const invalidation = invalidationLabel(result?.invalidationReason);
  const beatPr = result?.beatPr ?? false;
  const beatKom = result?.beatKom ?? false;

  return (
    <LiveSegmentPanel
      className={cx(styles.resultCard, className)}
      ariaLabel="Résultat du segment"
      testId="live-segment-result"
    >
      <div className={styles.resultHead}>
        <div className={styles.headingBlock}>
          <p className={styles.eyebrow}>{snapshot.segmentName ?? 'Live Segment'}</p>
          <h2 className={styles.resultTitle}>
            {aborted ? 'Effort interrompu' : valid ? 'Effort validé' : 'Effort non validé'}
          </h2>
          <p className={styles.subtitle}>
            {aborted
              ? 'Le chrono s’arrête ici. Aucun temps n’est envoyé au classement.'
              : valid
                ? 'Le temps peut être comparé aux références du segment.'
                : invalidation ?? 'Le temps reste local et n’est pas éligible au classement.'}
          </p>
        </div>
        <LiveSegmentBadge
          tone={valid ? 'success' : 'danger'}
          icon={valid ? 'check' : aborted ? 'stop' : 'alert'}
        >
          {valid ? 'Validé' : aborted ? 'Interrompu' : 'Invalidé'}
        </LiveSegmentBadge>
      </div>

      <div className={styles.resultTime}>
        <span className={styles.resultTimeValue}>{formatClock(result?.elapsedMs ?? snapshot.elapsedMs)}</span>
        <span className={styles.resultTimeLabel}>temps d’effort</span>
      </div>

      <div className={styles.statGrid}>
        <LiveSegmentStat
          label="Distance"
          value={formatDistance(result?.distanceCoveredM ?? snapshot.distanceCoveredM)}
          hint={`sur ${formatDistance(snapshot.totalDistanceM)}`}
        />
        <LiveSegmentStat
          label="Couverture"
          value={formatPercent(result?.coverageRatio ?? snapshot.progressRatio)}
          hint="du tracé parcouru"
        />
        <LiveSegmentStat
          label="Classement"
          value={valid ? 'Éligible' : 'Exclu'}
          hint={valid ? 'sous réserve du classement S02' : invalidation ?? undefined}
          tone={valid ? 'success' : 'danger'}
        />
      </div>

      {valid && (beatPr || beatKom) ? (
        <div className={styles.recordRow}>
          {beatPr ? (
            <LiveSegmentBadge tone="success" icon="star">
              Nouveau record personnel
            </LiveSegmentBadge>
          ) : null}
          {beatKom ? (
            <LiveSegmentBadge tone="success" icon="flag">
              Record du segment battu
            </LiveSegmentBadge>
          ) : null}
        </div>
      ) : null}

      {result?.queuedForSync ? (
        <p className={styles.queuedNote} role="status">
          Hors ligne : l’effort est conservé et sera synchronisé au retour du réseau.
        </p>
      ) : null}

      <div className={styles.resultActions}>
        {onRestart ? (
          <LiveSegmentButton variant="secondary" onClick={onRestart}>
            Rejouer ce segment
          </LiveSegmentButton>
        ) : null}
        {onAcknowledge ? (
          <LiveSegmentButton variant="primary" onClick={onAcknowledge}>
            Terminer
          </LiveSegmentButton>
        ) : null}
      </div>
    </LiveSegmentPanel>
  );
}
