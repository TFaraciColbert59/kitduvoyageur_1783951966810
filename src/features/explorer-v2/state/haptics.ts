'use client';

import { triggerNativeHaptic, type HapticStyle } from '@/lib/native/haptics';

/**
 * Table haptique de l'Explorer v2 (09_DESIGN.md §6).
 * Un seul retour par 80 ms maximum.
 */
export type HapticEvent =
  | 'tab'
  | 'mini'
  | 'compass'
  | 'sheet-open'
  | 'pin'
  | 'level'
  | 'countdown'
  | 'activity-start'
  | 'activity-saved'
  | 'back-on-route'
  | 'off-route'
  | 'sos-armed'
  | 'sos-fired'
  | 'stop-hold';

export const HAPTIC_TABLE: Record<HapticEvent, HapticStyle> = {
  tab: 'selection',
  mini: 'selection',
  compass: 'selection',
  'sheet-open': 'light',
  pin: 'light',
  level: 'medium',
  countdown: 'rigid',
  'activity-start': 'success',
  'activity-saved': 'success',
  'back-on-route': 'success',
  'off-route': 'warning',
  'sos-armed': 'warning',
  'sos-fired': 'error',
  'stop-hold': 'medium',
};

const MIN_GAP_MS = 80;
let lastAt = 0;

/** Émet le retour haptique d'un événement (silencieux si trop rapproché). */
export function haptic(event: HapticEvent, now: number = Date.now()): boolean {
  if (now - lastAt < MIN_GAP_MS) return false;
  lastAt = now;
  void triggerNativeHaptic(HAPTIC_TABLE[event]);
  return true;
}

/** Réinitialise le throttle (tests unitaires). */
export function resetHapticThrottle(): void {
  lastAt = 0;
}
