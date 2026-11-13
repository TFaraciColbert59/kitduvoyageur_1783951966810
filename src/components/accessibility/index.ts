/**
 * @fileoverview Composants UI d'accessibilité LKDV (Lot O02-UI).
 *
 * Briques prêtes à monter autour des écrans verrouillés (ExplorerV2,
 * SheetContent, drawers Compte) sans les modifier : préférences persistables,
 * live-region ARIA, focus trap, carte clavier, audit WCAG/RGAA et lien
 * d'évitement.
 */

export {
  AccessibilityStyles,
  ACCESSIBILITY_UI_CSS,
} from './AccessibilityStyles';
export { AccessibilityRuntime } from './AccessibilityRuntime';
export {
  LiveRegion,
  ScreenReaderAnnouncerProvider,
  useAnnouncer,
  useLiveAnnouncement,
  type AnnouncerContextValue,
  type LiveRegionProps,
  type ScreenReaderAnnouncerProviderProps,
  type UseLiveAnnouncementResult,
} from './LiveRegion';
export {
  AccessibleDrawer,
  type AccessibleDrawerProps,
  type AccessibleDrawerSide,
} from './AccessibleDrawer';
export {
  MapKeyboardRegion,
  type MapKeyboardRegionProps,
} from './MapKeyboardRegion';
export {
  AccessibilityPreferencesPanel,
  type AccessibilityPreferencesPanelProps,
} from './AccessibilityPreferencesPanel';
export {
  ContrastAuditTable,
  LKDV_CONTRAST_SAMPLES,
  resolveContrastPair,
  resolveCssColor,
  type ContrastAuditTableProps,
} from './ContrastAuditTable';
export {
  SkipToContentLink,
  type SkipToContentLinkProps,
} from './SkipToContentLink';
export {
  AccessibilitySettingsScreen,
  type AccessibilitySettingsScreenProps,
} from './AccessibilitySettingsScreen';
