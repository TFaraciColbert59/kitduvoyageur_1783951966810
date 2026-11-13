/**
 * Lot N01 — Surfaces UI dédiées du guidage Explorer v2.
 *
 * Tous les composants consomment le contrat livré dans `src/features/navigation`
 * (ré-exporté par `src/features/explorer-v2/guidance`) et restent purement
 * présentationnels : aucun ne modifie `ExplorerV2.tsx`, `SheetContent.tsx`,
 * `useGpsTracker.ts`, le store ni les types d’état.
 */

export { TurnByTurnBanner, type TurnByTurnBannerProps } from './TurnByTurnBanner';
export { RerouteBanner, type RerouteBannerProps } from './RerouteBanner';
export { JoinStartCard, type JoinStartCardProps } from './JoinStartCard';
export { OrientationCompass, type OrientationCompassProps } from './OrientationCompass';
export {
  UpcomingWaypointsList,
  type UpcomingWaypointsListProps,
} from './UpcomingWaypointsList';
export { ClimbDescentCard, buildSlopeSparkline, type ClimbDescentCardProps } from './ClimbDescentCard';
export { RouteSwapPicker, type RouteSwapPickerProps } from './RouteSwapPicker';
export { CustomFieldsEditor, type CustomFieldsEditorProps } from './CustomFieldsEditor';
export {
  AudioGuidanceControls,
  type AudioGuidanceControlsProps,
} from './AudioGuidanceControls';
export {
  LiveActivityPreview,
  type LiveActivityPreviewProps,
  type LockScreenPreviewAction,
  type LockScreenPreviewPlatform,
} from './LiveActivityPreview';

export {
  GuidanceBadge,
  GuidanceButton,
  GuidanceEmpty,
  GuidanceEyebrow,
  GuidanceIconButton,
  GuidanceLinkButton,
  GuidancePanel,
  GuidancePanelHeader,
  GuidanceSegmented,
  GuidanceSpinner,
  GuidanceStat,
  GuidanceSwitch,
  POI_KIND_ICON,
  POI_KIND_LABEL,
  cx,
  formatEtaLabel,
  poiIcon,
  poiLabel,
  type GuidanceSegmentOption,
  type GuidanceTone,
} from './primitives';
export { CompassRose, ManeuverGlyph } from './glyphs';
