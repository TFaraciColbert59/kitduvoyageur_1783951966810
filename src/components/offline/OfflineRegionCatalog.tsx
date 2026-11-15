'use client';

/**
 * Lot N02-UI / K4.14 — Catalogue des régions prédéfinies durables.
 *
 * Chaque région affiche une estimation réelle calculée par
 * `estimateOfflinePackSize` (tuiles, DEM, style, POI, itinéraires, aperçus) et
 * l'état exact du paquet local. Aucun prix, aucune date et aucun lieu ne sont
 * inventés : seuls les éléments du catalogue et du contrat sont rendus.
 */

import React from 'react';
import {
  estimateOfflinePackSize,
  type OfflineDownloadProgress,
  type OfflineInstalledPackRecord,
  type OfflinePackSizeEstimate,
  type PredefinedRegionCatalogItem,
} from '@/features/offline';
import { XpIcon } from '@/features/explorer-v2/ui/XpIcon';
import {
  OfflineBadge,
  OfflineButton,
  OfflineEmpty,
  OfflineEyebrow,
  OfflinePanel,
  OfflinePanelHeader,
  OfflineProgress,
  OfflineStatusBadge,
  cx,
  formatBytes,
  formatCount,
} from './primitives';
import styles from './offlineUi.module.css';

export interface OfflineRegionCatalogProps {
  regions: readonly PredefinedRegionCatalogItem[];
  installedPacks?: readonly OfflineInstalledPackRecord[];
  selectedRegionId?: string | null;
  activeRegionId?: string | null;
  progress?: OfflineDownloadProgress | null;
  onSelect?: (region: PredefinedRegionCatalogItem, estimate: OfflinePackSizeEstimate) => void;
  onDownload?: (region: PredefinedRegionCatalogItem, estimate: OfflinePackSizeEstimate) => void;
  onPause?: (packId: string) => void;
  onResume?: (region: PredefinedRegionCatalogItem, estimate: OfflinePackSizeEstimate) => void;
  onDelete?: (packId: string) => void;
}

function estimateForRegion(
  region: PredefinedRegionCatalogItem,
  installedPacks: readonly OfflineInstalledPackRecord[]
): OfflinePackSizeEstimate {
  return estimateOfflinePackSize({
    regionOrZoneId: region.regionId,
    bounds: region.bounds,
    minZoom: region.recommendedMinZoom,
    maxZoom: region.recommendedMaxZoom,
    poiCount: region.poiCount,
    routeCount: region.routeCount,
    mediaPreviewCount: 8,
    installedPacks,
  });
}

export function OfflineRegionCatalog({
  regions,
  installedPacks = [],
  selectedRegionId = null,
  activeRegionId = null,
  progress = null,
  onSelect,
  onDownload,
  onPause,
  onResume,
  onDelete,
}: OfflineRegionCatalogProps) {
  if (regions.length === 0) {
    return (
      <OfflinePanel ariaLabel="Régions hors ligne">
        <OfflinePanelHeader
          eyebrow="K4.14 · Régions durables"
          title="Régions prêtes à télécharger"
          subtitle="Aucune région prédéfinie n’est disponible pour ce pays."
        />
        <OfflineEmpty
          title="Aucune région au catalogue"
          hint="Choisissez une autre zone ou dessinez une emprise libre."
          icon="map"
        />
      </OfflinePanel>
    );
  }

  return (
    <OfflinePanel ariaLabel="Régions hors ligne">
      <OfflinePanelHeader
        eyebrow="K4.14 · Régions durables"
        title="Régions prêtes à télécharger"
        subtitle="Estimation avant téléchargement, tuiles déjà en cache déduites."
      />

      <ul className={styles.list}>
        {regions.map((region) => {
          const estimate = estimateForRegion(region, installedPacks);
          const installed = installedPacks.find(
            (pack) => pack.manifest.regionId === region.regionId
          );
          const isActive = activeRegionId === region.regionId;
          const isSelected = selectedRegionId === region.regionId;
          const showProgress = isActive && progress != null;

          return (
            <li
              key={region.regionId}
              className={cx(styles.listItem, styles.regionItem)}
              data-selected={isSelected ? 'true' : undefined}
            >
              <div className={styles.regionTop}>
                <div className={styles.row}>
                  <span className={styles.iconBubble}>
                    <XpIcon name="map" size={18} />
                  </span>
                  <div className={styles.headingBlock}>
                    <p className={styles.itemTitle}>{region.name}</p>
                    <p className={styles.itemMeta}>
                      {region.countryIsoA2} · zooms {region.recommendedMinZoom}–
                      {region.recommendedMaxZoom} · {formatCount(region.poiCount)} repères ·{' '}
                      {formatCount(region.routeCount)} itinéraires
                    </p>
                  </div>
                </div>
                {installed ? (
                  <OfflineStatusBadge status={installed.status} />
                ) : !region.unlocked ? (
                  <OfflineBadge tone="warning" icon="lock">
                    Verrouillée
                  </OfflineBadge>
                ) : (
                  <OfflineBadge tone="neutral" icon="down">
                    Non téléchargée
                  </OfflineBadge>
                )}
              </div>

              <div className={styles.metrics}>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Empreinte</span>
                  <span className={styles.metricValue}>
                    {formatBytes(estimate.totalEstimatedBytes)}
                  </span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Tuiles</span>
                  <span className={styles.metricValue}>{formatCount(estimate.totalTileCount)}</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Net à charger</span>
                  <span className={styles.metricValue}>
                    {formatBytes(estimate.netBytesToDownload)}
                  </span>
                </div>
              </div>

              {showProgress ? (
                <OfflineProgress
                  label={`Téléchargement de ${region.name}`}
                  value={progress!.verifiedResourcesCount}
                  max={progress!.totalResourcesCount}
                />
              ) : null}

              {installed ? (
                <p className={styles.itemMeta}>
                  {formatBytes(installed.actualStoredBytes)} sur l’appareil · vérifié le{' '}
                  {installed.manifest.verifiedAtMs
                    ? new Date(installed.manifest.verifiedAtMs).toLocaleDateString('fr-FR')
                    : '—'}
                </p>
              ) : null}

              <div className={styles.regionActions}>
                <OfflineButton
                  variant="secondary"
                  aria-label={`Choisir ${region.name}`}
                  onClick={() => onSelect?.(region, estimate)}
                >
                  <XpIcon name="check" size={16} />
                  Choisir
                </OfflineButton>

                {installed &&
                (installed.status === 'available' || installed.status === 'degraded') ? (
                  <>
                    {onPause ? (
                      <OfflineButton
                        variant="secondary"
                        aria-label={`Mettre en pause ${region.name}`}
                        onClick={() => onPause(installed.manifest.packId)}
                      >
                        <XpIcon name="pause" size={16} />
                        Pause
                      </OfflineButton>
                    ) : null}
                    {onDelete ? (
                      <OfflineButton
                        variant="danger"
                        aria-label={`Supprimer le paquet ${region.name}`}
                        onClick={() => onDelete(installed.manifest.packId)}
                      >
                        <XpIcon name="x" size={16} />
                        Supprimer
                      </OfflineButton>
                    ) : null}
                  </>
                ) : installed && installed.status === 'paused' && onResume ? (
                  <OfflineButton
                    aria-label={`Reprendre ${region.name}`}
                    onClick={() => onResume(region, estimate)}
                  >
                    <XpIcon name="down" size={16} />
                    Reprendre
                  </OfflineButton>
                ) : region.unlocked ? (
                  <OfflineButton
                    aria-label={`Télécharger ${region.name}`}
                    onClick={() => onDownload?.(region, estimate)}
                    disabled={showProgress}
                  >
                    <XpIcon name="down" size={16} />
                    Télécharger
                  </OfflineButton>
                ) : (
                  <OfflineButton disabled aria-label={`Région verrouillée ${region.name}`}>
                    <XpIcon name="lock" size={16} />
                    Indisponible
                  </OfflineButton>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <OfflineEyebrow>
        Les tuiles publiques OSM raster sont refusées : seuls les fournisseurs licenciés participent
        aux paquets hors ligne.
      </OfflineEyebrow>
    </OfflinePanel>
  );
}
