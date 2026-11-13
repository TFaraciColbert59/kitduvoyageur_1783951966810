/**
 * Lot N02-UI — Surfaces dédiées des paquets hors ligne.
 *
 * Tous les composants consomment le contrat public `@/features/offline` et
 * restent purement présentationnels : aucun ne modifie `ExplorerV2.tsx`,
 * `SheetContent.tsx`, `useGpsTracker.ts`, le store ni les types d’état.
 */

export {
  OfflinePacksScreen,
  type OfflinePacksScreenProps,
  type OfflineScreenSubview,
} from './OfflinePacksScreen';
export { OfflineRegionCatalog, type OfflineRegionCatalogProps } from './OfflineRegionCatalog';
export { OfflineCustomZoneForm, type OfflineCustomZoneFormProps } from './OfflineCustomZoneForm';
export { OfflineCoveragePanel, type OfflineCoveragePanelProps } from './OfflineCoveragePanel';
export { OfflineIntegrityPanel, type OfflineIntegrityPanelProps } from './OfflineIntegrityPanel';
export {
  OfflineShortcutsPanel,
  type OfflineShortcutPlatform,
  type OfflineShortcutsPanelProps,
} from './OfflineShortcutsPanel';
export {
  OfflineRouteNavigationPanel,
  type OfflineRouteNavigationPanelProps,
} from './OfflineRouteNavigationPanel';
export {
  OfflineUpcomingPoiPanel,
  poiIcon,
  poiLabel,
  type OfflineUpcomingPoiPanelProps,
} from './OfflineUpcomingPoiPanel';
export {
  OFFLINE_STATUS_LABEL,
  OFFLINE_STATUS_TONE,
  OfflineBadge,
  OfflineButton,
  OfflineEmpty,
  OfflineEyebrow,
  OfflineIconButton,
  OfflineNotice,
  OfflinePanel,
  OfflinePanelHeader,
  OfflineProgress,
  OfflineStat,
  OfflineStatusBadge,
  cx,
  formatBytes,
  formatCount,
  formatDate,
  formatDistanceM,
  type OfflineTone,
} from './primitives';
