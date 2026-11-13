'use client';

/**
 * Lot N02-UI — Écran conteneur des paquets hors ligne.
 *
 * Quatre vues : paquets installés, régions prédéfinies (K4.14), emprise libre
 * (K4.15), couverture (K4.16). Le sous-drawer mémorise et restaure le contexte
 * exact du drawer parent via le contrat `openOfflineSubDrawer` /
 * `closeOfflineSubDrawerAndRestoreParent`.
 */

import React from 'react';
import {
  closeOfflineSubDrawerAndRestoreParent,
  listPredefinedRegions,
  openOfflineSubDrawer,
  type DrawerReturnContext,
  type MultiZoneSelectionState,
  type OfflineCoverageFeatureCollection,
  type OfflineDownloadProgress,
  type OfflineDrawerSubViewState,
  type OfflineInstalledPackRecord,
  type OfflinePackSizeEstimate,
  type OfflineRouteNavigationData,
  type OfflineUpcomingPoiViewItem,
  type PredefinedRegionCatalogItem,
  type ZoneBounds,
} from '@/features/offline';
import { XpIcon } from '@/features/explorer-v2/ui/XpIcon';
import { OfflineRegionCatalog } from './OfflineRegionCatalog';
import { OfflineCustomZoneForm } from './OfflineCustomZoneForm';
import { OfflineCoveragePanel } from './OfflineCoveragePanel';
import { OfflineIntegrityPanel } from './OfflineIntegrityPanel';
import { OfflineShortcutsPanel } from './OfflineShortcutsPanel';
import { OfflineUpcomingPoiPanel } from './OfflineUpcomingPoiPanel';
import { OfflineRouteNavigationPanel } from './OfflineRouteNavigationPanel';
import {
  OfflineBadge,
  OfflineButton,
  OfflineEmpty,
  OfflineIconButton,
  OfflinePanel,
  OfflinePanelHeader,
  OfflineStatusBadge,
  cx,
  formatBytes,
  formatCount,
  formatDate,
} from './primitives';
import styles from './offlineUi.module.css';

export type OfflineScreenSubview = OfflineDrawerSubViewState['activeSubView'];

export interface OfflinePacksScreenProps {
  installedPacks: readonly OfflineInstalledPackRecord[];
  returnContext: DrawerReturnContext;
  initialSubView?: OfflineScreenSubview;
  regions?: readonly PredefinedRegionCatalogItem[];
  progress?: OfflineDownloadProgress | null;
  activeRegionId?: string | null;
  selectedRegionId?: string | null;
  upcomingItems?: readonly OfflineUpcomingPoiViewItem[];
  routeData?: OfflineRouteNavigationData | null;
  routeName?: string | null;
  coverageViewport?: { bounds: ZoneBounds; zoom: number };
  onDownloadRegion?: (
    region: PredefinedRegionCatalogItem,
    estimate: OfflinePackSizeEstimate
  ) => void;
  onSelectRegion?: (region: PredefinedRegionCatalogItem, estimate: OfflinePackSizeEstimate) => void;
  onResumeRegion?: (region: PredefinedRegionCatalogItem, estimate: OfflinePackSizeEstimate) => void;
  onPausePack?: (packId: string) => void;
  onDeletePack?: (packId: string) => void;
  onDownloadZones?: (multi: MultiZoneSelectionState) => void;
  onShowCoverage?: (geoJson: OfflineCoverageFeatureCollection) => void;
  onLaunchShortcut?: (deepLinkUri: string) => void;
  onReturn?: (context: DrawerReturnContext) => void;
  onSubViewChange?: (subView: OfflineScreenSubview) => void;
}

const KIND_LABEL: Readonly<Record<OfflineInstalledPackRecord['manifest']['kind'], string>> = {
  predefined_region: 'Région',
  custom_zone: 'Zone libre',
  route_corridor: 'Couloir de parcours',
};

function packIcon(kind: OfflineInstalledPackRecord['manifest']['kind']): string {
  if (kind === 'route_corridor') return 'route';
  if (kind === 'custom_zone') return 'layers';
  return 'map';
}

export function OfflinePacksScreen({
  installedPacks,
  returnContext,
  initialSubView = 'root',
  regions = listPredefinedRegions(),
  progress = null,
  activeRegionId = null,
  selectedRegionId = null,
  upcomingItems,
  routeData = null,
  routeName = null,
  coverageViewport = {
    bounds: { west: 5.35, south: 43.18, east: 5.58, north: 43.26 },
    zoom: 12,
  },
  onDownloadRegion,
  onSelectRegion,
  onResumeRegion,
  onPausePack,
  onDeletePack,
  onDownloadZones,
  onShowCoverage,
  onLaunchShortcut,
  onReturn,
  onSubViewChange,
}: OfflinePacksScreenProps) {
  const [view, setView] = React.useState<OfflineDrawerSubViewState>(() => ({
    activeSubView: initialSubView,
    returnContext: { ...returnContext },
  }));
  const [selectedPackId, setSelectedPackId] = React.useState<string | null>(null);

  const goTo = (subView: OfflineScreenSubview) => {
    setView(openOfflineSubDrawer(subView, view.returnContext));
    onSubViewChange?.(subView);
  };

  const goBack = () => {
    const restored = closeOfflineSubDrawerAndRestoreParent(view);
    setView({ activeSubView: 'root', returnContext: restored });
    onSubViewChange?.('root');
  };

  const close = () => {
    onReturn?.(closeOfflineSubDrawerAndRestoreParent(view));
  };

  const totalBytes = installedPacks.reduce((total, pack) => total + pack.actualStoredBytes, 0);
  const selectedPack = selectedPackId
    ? (installedPacks.find((pack) => pack.manifest.packId === selectedPackId) ?? null)
    : null;

  return (
    <section className={styles.screen} aria-label="Paquets hors ligne">
      <header className={styles.header}>
        <div className={styles.headingBlock}>
          <OfflineBadge tone="neutral" icon="offline">
            Hors ligne · N02
          </OfflineBadge>
          <h1 className={styles.titleLarge} style={{ margin: 0 }}>
            Cartes et parcours sur l’appareil
          </h1>
          <p className={styles.subtitle}>
            Régions durables, emprises libres, intégrité et accès système — sans réseau.
          </p>
        </div>
        {onReturn ? (
          <OfflineIconButton
            label="Fermer les téléchargements hors ligne"
            icon="x"
            onClick={close}
          />
        ) : null}
      </header>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Paquets</span>
          <span className={styles.metricValue}>{formatCount(installedPacks.length)}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Sur l’appareil</span>
          <span className={styles.metricValue}>{formatBytes(totalBytes)}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Séances</span>
          <span className={styles.metricValue}>Protégées</span>
        </div>
      </div>

      <nav className={styles.tabs} aria-label="Vues hors ligne">
        <button
          type="button"
          className={styles.tab}
          aria-pressed={view.activeSubView === 'root'}
          onClick={goBack}
        >
          Paquets
        </button>
        <button
          type="button"
          className={styles.tab}
          aria-pressed={view.activeSubView === 'predefined_regions'}
          onClick={() => goTo('predefined_regions')}
        >
          Régions
        </button>
        <button
          type="button"
          className={styles.tab}
          aria-pressed={view.activeSubView === 'custom_zone_selector'}
          onClick={() => goTo('custom_zone_selector')}
        >
          Zone libre
        </button>
        <button
          type="button"
          className={styles.tab}
          aria-pressed={view.activeSubView === 'coverage_overlay'}
          onClick={() => goTo('coverage_overlay')}
        >
          Couverture
        </button>
      </nav>

      {view.activeSubView === 'root' ? (
        <div className={styles.stack}>
          <OfflinePanel ariaLabel="Paquets installés">
            <OfflinePanelHeader
              eyebrow="Paquets sur l’appareil"
              title="Disponibles hors ligne"
              subtitle="Seuls les paquets vérifiés sont utilisables par le guidage."
              action={
                <OfflineButton
                  variant="secondary"
                  aria-label="Télécharger une nouvelle région"
                  onClick={() => goTo('predefined_regions')}
                >
                  <XpIcon name="plus" size={16} />
                  Ajouter
                </OfflineButton>
              }
            />

            {installedPacks.length === 0 ? (
              <OfflineEmpty
                title="Aucun paquet hors ligne"
                hint="Commencez par une région prédéfinie ou dessinez une emprise libre."
                icon="offline"
              />
            ) : (
              <ul className={styles.list}>
                {installedPacks.map((pack) => (
                  <li key={pack.manifest.packId} className={styles.listItem}>
                    <span className={styles.iconBubble}>
                      <XpIcon name={packIcon(pack.manifest.kind)} size={18} />
                    </span>
                    <div className={styles.grow}>
                      <p className={styles.itemTitle}>{pack.manifest.title}</p>
                      <p className={styles.itemMeta}>
                        {KIND_LABEL[pack.manifest.kind]} · zooms {pack.manifest.minZoom}–
                        {pack.manifest.maxZoom} · {formatBytes(pack.actualStoredBytes)} ·{' '}
                        {formatDate(pack.manifest.verifiedAtMs)}
                      </p>
                      <div className={styles.row}>
                        <OfflineStatusBadge status={pack.status} />
                        {pack.manifest.pinned ? (
                          <OfflineBadge tone="info" icon="shield">
                            Épinglé
                          </OfflineBadge>
                        ) : null}
                        {pack.capabilities.viewMapAround.status !== 'available' ? (
                          <OfflineBadge tone="warning" icon="info">
                            Carte {pack.capabilities.viewMapAround.status}
                          </OfflineBadge>
                        ) : null}
                      </div>
                    </div>
                    <div className={styles.stackTight}>
                      <OfflineButton
                        variant="ghost"
                        aria-label={`Voir l’intégrité de ${pack.manifest.title}`}
                        onClick={() =>
                          setSelectedPackId((current) =>
                            current === pack.manifest.packId ? null : pack.manifest.packId
                          )
                        }
                      >
                        <XpIcon name="shield" size={16} />
                        Intégrité
                      </OfflineButton>
                      {onPausePack &&
                      (pack.status === 'available' || pack.status === 'degraded') ? (
                        <OfflineButton
                          variant="ghost"
                          aria-label={`Mettre en pause ${pack.manifest.title}`}
                          onClick={() => onPausePack(pack.manifest.packId)}
                        >
                          <XpIcon name="pause" size={16} />
                          Pause
                        </OfflineButton>
                      ) : null}
                      {onDeletePack ? (
                        <OfflineButton
                          variant="ghost"
                          aria-label={`Supprimer ${pack.manifest.title}`}
                          onClick={() => onDeletePack(pack.manifest.packId)}
                        >
                          <XpIcon name="x" size={16} />
                          Supprimer
                        </OfflineButton>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {selectedPack ? <OfflineIntegrityPanel record={selectedPack} /> : null}
          </OfflinePanel>

          {routeData ? <OfflineRouteNavigationPanel routeData={routeData} /> : null}

          {upcomingItems ? (
            <OfflineUpcomingPoiPanel
              items={upcomingItems}
              routeName={routeName ?? routeData?.name ?? null}
            />
          ) : null}

          <OfflineShortcutsPanel installedPacks={installedPacks} onLaunch={onLaunchShortcut} />
        </div>
      ) : null}

      {view.activeSubView === 'predefined_regions' ? (
        <div className={styles.stack}>
          <OfflineButton
            variant="ghost"
            onClick={goBack}
            aria-label="Retour aux paquets hors ligne"
          >
            <XpIcon name="chevl" size={16} />
            Retour
          </OfflineButton>
          <OfflineRegionCatalog
            regions={regions}
            installedPacks={installedPacks}
            activeRegionId={activeRegionId}
            selectedRegionId={selectedRegionId}
            progress={progress}
            onSelect={onSelectRegion}
            onDownload={onDownloadRegion}
            onResume={onResumeRegion}
            onPause={onPausePack}
            onDelete={onDeletePack}
          />
        </div>
      ) : null}

      {view.activeSubView === 'custom_zone_selector' ? (
        <div className={styles.stack}>
          <OfflineButton
            variant="ghost"
            onClick={goBack}
            aria-label="Retour aux paquets hors ligne"
          >
            <XpIcon name="chevl" size={16} />
            Retour
          </OfflineButton>
          <OfflineCustomZoneForm
            installedPacks={installedPacks}
            onDownload={onDownloadZones}
            onShowLimits={onShowCoverage}
          />
        </div>
      ) : null}

      {view.activeSubView === 'coverage_overlay' ? (
        <div className={styles.stack}>
          <OfflineButton
            variant="ghost"
            onClick={goBack}
            aria-label="Retour aux paquets hors ligne"
          >
            <XpIcon name="chevl" size={16} />
            Retour
          </OfflineButton>
          <OfflineCoveragePanel
            installedPacks={installedPacks}
            viewportBounds={coverageViewport.bounds}
            requestedZoom={coverageViewport.zoom}
            onShowOnMap={onShowCoverage}
          />
        </div>
      ) : null}

      {view.activeSubView !== 'root' ? (
        <p className={styles.caption}>
          Retour au drawer parent : {view.returnContext.parentSheet} · onglet{' '}
          {view.returnContext.parentTab} · hauteur {view.returnContext.parentDetent}.
        </p>
      ) : null}

      <span className={cx(styles.visuallyHidden)} aria-live="polite">
        {installedPacks.length} paquet(s) hors ligne.
      </span>
    </section>
  );
}
