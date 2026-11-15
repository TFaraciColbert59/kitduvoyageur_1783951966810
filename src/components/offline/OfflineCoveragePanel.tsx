'use client';

/**
 * Lot N02-UI / K4.16 — Couverture téléchargée sur la carte.
 *
 * Les limites affichées sont le `FeatureCollection` exact de
 * `buildDownloadedCoverageGeoJson`. L’évaluation de zoom signale toujours une
 * limite visible quand le zoom demandé dépasse le paquet : jamais de carte
 * blanche silencieuse.
 */

import React from 'react';
import {
  buildDownloadedCoverageGeoJson,
  evaluateViewportOfflineCoverage,
  type OfflineCoverageFeatureCollection,
  type OfflineInstalledPackRecord,
  type ViewportOfflineCoverageEvaluation,
  type ZoneBounds,
} from '@/features/offline';
import { XpIcon } from '@/features/explorer-v2/ui/XpIcon';
import {
  OfflineButton,
  OfflineEmpty,
  OfflineNotice,
  OfflinePanel,
  OfflinePanelHeader,
  OfflineStatusBadge,
  OfflineStat,
  formatBytes,
  formatCount,
} from './primitives';
import styles from './offlineUi.module.css';

export interface OfflineCoveragePanelProps {
  installedPacks: readonly OfflineInstalledPackRecord[];
  viewportBounds: ZoneBounds;
  requestedZoom: number;
  nowMs?: number;
  onShowOnMap?: (geoJson: OfflineCoverageFeatureCollection) => void;
}

const COVERAGE_LABEL: Readonly<Record<ViewportOfflineCoverageEvaluation['status'], string>> = {
  fully_covered: 'Emprise entièrement couverte',
  partially_covered: 'Couverture partielle',
  zoom_exceeds_pack_limit: 'Zoom au-delà du paquet',
  no_offline_coverage: 'Aucune couverture hors ligne',
};

const COVERAGE_TONE: Readonly<
  Record<ViewportOfflineCoverageEvaluation['status'], 'success' | 'warning' | 'danger' | 'neutral'>
> = {
  fully_covered: 'success',
  partially_covered: 'warning',
  zoom_exceeds_pack_limit: 'warning',
  no_offline_coverage: 'danger',
};

export function OfflineCoveragePanel({
  installedPacks,
  viewportBounds,
  requestedZoom,
  nowMs = Date.now(),
  onShowOnMap,
}: OfflineCoveragePanelProps) {
  const coverage = buildDownloadedCoverageGeoJson(installedPacks, nowMs);
  const viewport = evaluateViewportOfflineCoverage(viewportBounds, requestedZoom, installedPacks);

  const storedBytes = coverage.features.reduce(
    (total, feature) => total + feature.properties.storedBytes,
    0
  );
  const zoomLabel =
    viewport.effectiveMinZoom == null || viewport.effectiveMaxZoom == null
      ? '—'
      : `${viewport.effectiveMinZoom}–${viewport.effectiveMaxZoom}`;

  return (
    <OfflinePanel ariaLabel="Couverture hors ligne">
      <OfflinePanelHeader
        eyebrow="K4.16 · Couverture"
        title="Zones téléchargées sur la carte"
        subtitle="Limites en cache, tuiles dédupliquées et plafond de zoom explicite."
      />

      <div className={styles.metrics}>
        <OfflineStat label="Zones" value={formatCount(coverage.features.length)} />
        <OfflineStat label="Stocké" value={formatBytes(storedBytes)} />
        <OfflineStat label="Zooms" value={zoomLabel} />
      </div>

      <OfflineNotice
        tone={COVERAGE_TONE[viewport.status]}
        icon={viewport.status === 'no_offline_coverage' ? 'alert' : 'map'}
      >
        <strong>{COVERAGE_LABEL[viewport.status]}</strong>
        {viewport.visibleLimitNotice ? ` — ${viewport.visibleLimitNotice}` : null}
      </OfflineNotice>

      {coverage.features.length === 0 ? (
        <OfflineEmpty
          title="Aucune zone hors ligne"
          hint="Téléchargez une région ou une emprise libre pour voir sa couverture."
          icon="map"
        />
      ) : (
        <ul className={styles.list}>
          {coverage.features.map((feature) => (
            <li key={feature.id} className={styles.listItem}>
              <span className={styles.iconBubble}>
                <XpIcon name="map" size={18} />
              </span>
              <div className={styles.grow}>
                <p className={styles.itemTitle}>{feature.properties.title}</p>
                <p className={styles.itemMeta}>
                  {feature.properties.kind === 'route_corridor'
                    ? 'Couloir de parcours'
                    : feature.properties.kind === 'custom_zone'
                      ? 'Zone libre'
                      : 'Région'}{' '}
                  · zooms {feature.properties.minZoom}–{feature.properties.maxZoom} ·{' '}
                  {formatBytes(feature.properties.storedBytes)}
                </p>
              </div>
              <OfflineStatusBadge
                status={
                  feature.properties.isExpired
                    ? 'expired'
                    : feature.properties.status === 'degraded'
                      ? 'degraded'
                      : 'available'
                }
              />
            </li>
          ))}
        </ul>
      )}

      {onShowOnMap ? (
        <OfflineButton
          variant="secondary"
          fullWidth
          aria-label="Afficher la couverture téléchargée sur la carte"
          onClick={() => onShowOnMap(coverage)}
          disabled={coverage.features.length === 0}
        >
          <XpIcon name="map" size={16} />
          Afficher sur la carte
        </OfflineButton>
      ) : null}
    </OfflinePanel>
  );
}
