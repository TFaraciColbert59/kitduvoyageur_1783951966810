'use client';

/**
 * Lot N01 / K4.07 — Liste « À venir » des POI, lieux et Highlights.
 *
 * Les distances sont celles du moteur (`distanceRemainingM` le long du tracé),
 * jamais une distance à vol d’oiseau recalculée dans l’interface.
 */

import React from 'react';
import type { UpcomingWaypointItem } from '@/features/navigation';
import { XpIcon } from '../../ui/XpIcon';
import {
  GuidanceBadge,
  GuidanceEmpty,
  GuidancePanel,
  GuidancePanelHeader,
  formatEtaLabel,
  poiIcon,
  poiLabel,
} from './primitives';
import styles from './guidanceUi.module.css';

export interface UpcomingWaypointsListProps {
  items: readonly UpcomingWaypointItem[];
  maxItems?: number;
  onSelect?: (item: UpcomingWaypointItem) => void;
  emptyLabel?: string;
  className?: string;
}

export function UpcomingWaypointsList({
  items,
  maxItems = 5,
  onSelect,
  emptyLabel = 'Aucun repère à venir sur ce parcours.',
  className,
}: UpcomingWaypointsListProps) {
  const visible = items.slice(0, Math.max(0, maxItems));

  return (
    <GuidancePanel className={className} ariaLabel="Repères à venir">
      <GuidancePanelHeader
        eyebrow="À venir"
        title="POI et highlights"
        subtitle="Distances restantes le long du tracé."
        action={
          items.length > 0 ? (
            <GuidanceBadge tone="info">{`${items.length} repère${items.length > 1 ? 's' : ''}`}</GuidanceBadge>
          ) : null
        }
      />

      {visible.length === 0 ? (
        <GuidanceEmpty>{emptyLabel}</GuidanceEmpty>
      ) : (
        <ul className={styles.waypointList} aria-label="Repères à venir">
          {visible.map((item) => {
            const waypoint = item.waypoint;
            const eta = formatEtaLabel(item.etaSeconds);
            const meta = [poiLabel(waypoint.kind), eta ? `arrivée ${eta}` : null]
              .filter(Boolean)
              .join(' · ');
            const content = (
              <>
                <span className={styles.waypointIcon}>
                  <XpIcon name={poiIcon(waypoint.kind)} size={17} />
                </span>
                <span className={styles.waypointBody}>
                  <span className={styles.waypointName}>{waypoint.name}</span>
                  <span className={styles.waypointMeta}>
                    {waypoint.description?.trim() || meta}
                  </span>
                </span>
                <span className={styles.waypointDistance}>
                  <span className={styles.waypointDistanceValue}>{item.formattedDistance}</span>
                  {eta ? <span className={styles.waypointEta}>{eta}</span> : null}
                </span>
              </>
            );

            return (
              <li key={`${waypoint.id}:${waypoint.alongTrackM}`}>
                {onSelect ? (
                  <button
                    type="button"
                    className={styles.waypointItem}
                    data-kind={waypoint.kind}
                    onClick={() => onSelect(item)}
                    aria-label={`${waypoint.name}, ${poiLabel(waypoint.kind)}, ${item.formattedDistance}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={styles.waypointItem} data-kind={waypoint.kind}>
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </GuidancePanel>
  );
}
