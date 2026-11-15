'use client';

/**
 * Lot N01 / K4.08 — Bandeau visuel temporaire d'alerte waypoint / POI.
 *
 * Affiché pendant l'approche ou l'arrivée sur un repère puis retiré dès que
 * le contrôleur de session résout l'alerte (`activeWaypointAlert === null`).
 */

import React from 'react';
import {
  formatNavigationDistance,
  type NavigationUnits,
  type WaypointAlertEvent,
} from '@/features/navigation';
import { XpIcon } from '../../ui/XpIcon';
import { GuidanceBadge, cx, poiIcon, poiLabel } from './primitives';
import styles from './guidanceUi.module.css';

export interface WaypointAlertBannerProps {
  alert: WaypointAlertEvent | null;
  units?: NavigationUnits;
  className?: string;
}

export function WaypointAlertBanner({
  alert,
  units = 'metric',
  className,
}: WaypointAlertBannerProps) {
  if (!alert) return null;

  const isArrival = alert.stage === 'arrival';
  const distanceLabel =
    alert.distanceRemainingM <= 15
      ? 'Sur place'
      : `Dans ${formatNavigationDistance(alert.distanceRemainingM, units)}`;

  return (
    <section
      className={cx(styles.rerouteBanner, className)}
      data-status={isArrival ? 'recalculated' : 'recalculating_online'}
      data-waypoint-alert-stage={alert.stage}
      role="status"
      aria-live="polite"
      aria-label={`Alerte repère : ${alert.waypointName}`}
    >
      <span className={styles.returnArrow} aria-hidden="true">
        <XpIcon name={poiIcon(alert.waypointKind)} size={20} />
      </span>

      <div className={styles.grow}>
        <p className={styles.rerouteLabel}>{alert.title}</p>
        <p className={styles.rerouteSub}>
          {poiLabel(alert.waypointKind)} · {distanceLabel}
        </p>
      </div>

      <GuidanceBadge tone={isArrival ? 'success' : 'info'}>
        {isArrival ? 'Arrivée' : 'À proximité'}
      </GuidanceBadge>
    </section>
  );
}
