/**
 * Lot S03-UI — surfaces publiques des Live Segments (S4.09, S4.10).
 *
 * Tous les composants consomment le contrat `src/features/live-segments` et
 * restent en dehors des fichiers verrouillés (ExplorerV2, SheetContent,
 * useGpsTracker, state/*).
 */

export {
  LiveSegmentAlertBanner,
  type LiveSegmentAlertBannerProps,
} from './LiveSegmentAlertBanner';
export { GhostComparison, type GhostComparisonProps } from './GhostComparison';
export { LiveSegmentHud, type LiveSegmentHudProps } from './LiveSegmentHud';
export {
  LiveSegmentResultCard,
  type LiveSegmentResultCardProps,
} from './LiveSegmentResultCard';
export { LiveSegmentsList, type LiveSegmentsListProps } from './LiveSegmentsList';
export {
  LiveSegmentDeviceSync,
  type LiveSegmentDeviceSyncProps,
} from './LiveSegmentDeviceSync';
export { LiveSegmentsScreen, type LiveSegmentsScreenProps } from './LiveSegmentsScreen';
export {
  useLiveSegmentSession,
  type LiveSegmentSession,
  type LiveSegmentSessionOptions,
} from './useLiveSegmentSession';
export {
  createLiveSegmentsApi,
  LiveSegmentsApiError,
  type LiveSegmentsApi,
  type ListLiveSegmentsQuery,
} from './api';
export {
  LiveSegmentBadge,
  LiveSegmentButton,
  LiveSegmentEmpty,
  LiveSegmentEyebrow,
  LiveSegmentHeader,
  LiveSegmentIconButton,
  LiveSegmentPanel,
  LiveSegmentProgress,
  LiveSegmentSignalBadge,
  LiveSegmentSpinner,
  LiveSegmentStat,
  LiveSegmentStateBadge,
  cx,
} from './primitives';
export {
  clampRatio,
  deltaDirection,
  describeAlert,
  directionLabel,
  formatClock,
  formatClockTime,
  formatDelta,
  formatDeltaLabel,
  formatDistance,
  formatDuration,
  formatElevation,
  formatPercent,
  formatProjectedFinish,
  formatSignedDelta,
  ghostKindLabel,
  invalidationLabel,
  remainingDistanceM,
  signalPresentation,
  sportLabel,
  statePresentation,
  type AlertPresentation,
  type DeltaDirection,
  type LiveSegmentTone,
  type StatePresentation,
} from './format';
export type {
  DeviceSyncRequestBody,
  DeviceSyncResponse,
  ListLiveSegmentsResponse,
  LiveSegmentDetailResponse,
  LiveSegmentSummaryView,
  SubmitEffortResponse,
} from './types';
