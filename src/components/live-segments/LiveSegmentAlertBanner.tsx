'use client';

/**
 * Lot S03-UI / S4.09 — bannière d'alerte d'approche, de départ, d'arrivée,
 * de sortie de tracé et de perte GPS.
 *
 * Une seule alerte est rendue à la fois (la plus récente de la file). Le
 * contenu vient de `describeAlert` ; aucun texte métier n'est dupliqué ici.
 */

import React from 'react';
import type { LiveSegmentAlert, LiveSegmentSnapshot } from '@/features/live-segments';
import { XpIcon } from '@/features/explorer-v2/ui/XpIcon';
import { describeAlert, type LiveSegmentTone } from './format';
import { LiveSegmentButton, LiveSegmentIconButton, cx } from './primitives';
import styles from './live-segments.module.css';

export interface LiveSegmentAlertBannerProps {
  alert: LiveSegmentAlert | null;
  snapshot: LiveSegmentSnapshot;
  onDismiss?: () => void;
  onAction?: () => void;
  className?: string;
}

function actionLabelFor(type: LiveSegmentAlert['type']): string | null {
  switch (type) {
    case 'approach':
      return 'Voir le segment';
    case 'finish':
      return 'Voir le résultat';
    case 'aborted':
      return 'Fermer';
    default:
      return null;
  }
}

export function LiveSegmentAlertBanner({
  alert,
  snapshot,
  onDismiss,
  onAction,
  className,
}: LiveSegmentAlertBannerProps) {
  if (!alert) return null;

  const presentation = describeAlert(alert, snapshot);
  const urgent = presentation.tone === 'danger' || presentation.tone === 'warning';
  const actionLabel = actionLabelFor(alert.type);

  return (
    <section
      className={cx(styles.alertBanner, className)}
      data-tone={presentation.tone}
      data-alert={alert.type}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <span className={styles.alertIcon} aria-hidden="true">
        <XpIcon name={presentation.icon} size={20} />
      </span>
      <div className={styles.alertBody}>
        <p className={styles.alertTitle}>{presentation.title}</p>
        <p className={styles.alertDescription}>{presentation.description}</p>
      </div>
      <div className={styles.alertActions}>
        {actionLabel && onAction ? (
          <LiveSegmentButton
            variant="ghost"
            className={styles.alertAction}
            onClick={onAction}
          >
            {actionLabel}
          </LiveSegmentButton>
        ) : null}
        {onDismiss ? (
          <LiveSegmentIconButton
            label="Fermer l’alerte"
            icon="x"
            size={16}
            className={styles.alertClose}
            onClick={onDismiss}
          />
        ) : null}
      </div>
    </section>
  );
}

export type { LiveSegmentTone };
