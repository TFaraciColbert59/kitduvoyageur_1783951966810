/**
 * Kit de gestes LKDV — point d'entrée unique.
 *
 * Deux familles (mission gestes, §2) :
 *  1. Gestes discrets (swipe, double-tap, long-press) → hooks React légers.
 *  2. Gestes à suivi physique du doigt (sheets, stories, visionneuse)
 *     → framer-motion via useDragDismiss.
 *
 * Règle : aucun hook n'embarque de logique haptique — le consommateur
 * appelle `useHapticFeedback` dans ses callbacks.
 */
export { useSwipe } from './useSwipe';
export type { UseDoubleTapOptions } from './useDoubleTap';
export { useDoubleTap } from './useDoubleTap';
export type { UseLongPressOptions } from './useLongPress';
export { useLongPress } from './useLongPress';
export type { UseDragDismissOptions, UseDragDismissResult } from './useDragDismiss';
export { useDragDismiss } from './useDragDismiss';
export {
  DEFAULT_DOUBLE_TAP_WINDOW_MS,
  DEFAULT_LONG_PRESS_MS,
  DEFAULT_MOVE_TOLERANCE_PX,
  DEFAULT_DISMISS_THRESHOLD_PX,
  DEFAULT_DISMISS_VELOCITY_PX_S,
  isWithinTapWindow,
  isMoveBeyondTolerance,
  shouldDismiss,
  shouldDragUp,
} from './gestureMath';
