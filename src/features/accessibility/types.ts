/**
 * @fileoverview Contrat TypeScript complet pour le module d'accessibilité LKDV (Lot O02).
 * Couvre : préférences persistables, annonces ARIA/live-region, navigation clavier
 * carte & drawers (sans piège clavier + restauration du focus), et vérificateur
 * de contraste WCAG 2.1/2.2 AA/AAA & RGAA.
 */

export type ContrastPreferenceMode = 'system' | 'high' | 'standard';
export type MotionPreferenceMode = 'system' | 'reduce' | 'no-preference';
export type TextScalePreset = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export interface AccessibilityPreferences {
  /** Schéma de version pour la migration sûre du stockage local. */
  version: 1;
  /** Préférence de contraste élevé ('system' suit prefers-contrast / forced-colors). */
  contrastMode: ContrastPreferenceMode;
  /** Préférence de réduction de mouvement ('system' suit prefers-reduced-motion). */
  motionMode: MotionPreferenceMode;
  /** Facteur d'échelle typographique dynamique (borné entre 0.85 et 2.0, défaut 1.0). */
  textScale: number;
  /** Active les indices et descriptions enrichies pour VoiceOver / TalkBack. */
  screenReaderHints: boolean;
  /** Active les raccourcis clavier dédiés sur la carte et les drawers. */
  keyboardNavigation: boolean;
  /** Renforce l'anneau de focus visuel (RGAA / WCAG 2.4.7 & 2.4.11). */
  enhancedFocusIndicator: boolean;
}

export interface SystemAccessibilityEnvironment {
  prefersReducedMotion: boolean;
  prefersHighContrast: boolean;
  forcedColors: boolean;
}

export interface ResolvedAccessibilityPreferences {
  highContrast: boolean;
  reducedMotion: boolean;
  forcedColors: boolean;
  textScale: number;
  textScalePreset: TextScalePreset;
  screenReaderHints: boolean;
  keyboardNavigation: boolean;
  enhancedFocusIndicator: boolean;
  sources: {
    contrast: 'system' | 'user';
    motion: 'system' | 'user';
  };
}

export type AriaLivePoliteness = 'polite' | 'assertive' | 'off';

export interface AnnouncementOptions {
  politeness?: AriaLivePoliteness;
  /** Fenêtre de déduplication en ms pour éviter le spam lecteur d'écran (défaut 400ms). */
  dedupeWindowMs?: number;
  /** Délai avant nettoyage du texte de la live-region en ms (défaut 5000ms). */
  clearAfterMs?: number;
}

export interface AnnouncementRecord {
  message: string;
  politeness: AriaLivePoliteness;
  timestamp: number;
}

export interface ScreenReaderAnnouncer {
  announce: (message: string, options?: AnnouncementOptions) => boolean;
  clear: () => void;
  getHistory: () => readonly AnnouncementRecord[];
  destroy: () => void;
}

export interface FocusTrapOptions {
  /** Élément vers lequel restaurer le focus à la fermeture (défaut: document.activeElement à l'activation). */
  restoreFocusTo?: HTMLElement | null;
  /** Élément initialement focalisé à l'ouverture (défaut: premier élément focalisable). */
  initialFocus?: HTMLElement | null;
  /** Callback déclenché sur Escape — garantit l'absence de piège clavier. */
  onEscape?: () => void;
  /** Si true, autorise Tab à sortir du conteneur au lieu de boucler (défaut: false). */
  allowTabExit?: boolean;
}

export interface FocusTrapController {
  activate: () => void;
  deactivate: () => void;
  isActive: () => boolean;
  getFocusableCount: () => number;
}

export type MapPanDirection = 'up' | 'down' | 'left' | 'right';

export interface MapKeyboardHandlers {
  onPan?: (direction: MapPanDirection, stepMultiplier: number) => void;
  onZoom?: (delta: 1 | -1) => void;
  onResetView?: () => void;
  onActivateSelection?: () => void;
  onEscape?: () => void;
  onAnnounce?: (message: string) => void;
}

export type WcagConformanceLevel = 'AAA' | 'AA' | 'AA_LARGE' | 'FAIL';

export interface ContrastCheckOptions {
  /** Texte large (>= 18pt / 24px normal ou >= 14pt / 18.66px gras). */
  isLargeText?: boolean;
  /** Composant d'interface ou objet graphique (seuil WCAG 1.4.11 = 3:1). */
  isUiComponent?: boolean;
}

export interface ContrastEvaluation {
  ratio: number;
  formattedRatio: string;
  aaNormal: boolean;
  aaLarge: boolean;
  aaUi: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
  passesAA: boolean;
  passesAAA: boolean;
  level: WcagConformanceLevel;
}

export interface ContrastPairInput extends ContrastCheckOptions {
  id: string;
  label?: string;
  foreground: string;
  background: string;
}

export interface ContrastPairResult extends ContrastPairInput {
  evaluation: ContrastEvaluation;
}

export interface ContrastAuditReport {
  total: number;
  passedAA: number;
  passedAAA: number;
  failedAA: ContrastPairResult[];
  results: ContrastPairResult[];
  compliantAA: boolean;
  compliantAAA: boolean;
}
