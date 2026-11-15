'use client';

import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Pont Live Activity (iOS 16.2+ & Android Material 3) — P7-20.
 *
 * Sur iOS : ActivityKit (Dynamic Island & Lock Screen).
 * Sur Android : Service de notification continue avec chronomètre.
 * Sur le Web : No-op gracieux.
 */

export interface LiveActivityState {
  distanceM: number;
  elevGainM: number;
  movingS: number;
  paused: boolean;
  offRoute: boolean;
  /** Instruction du prochain virage (K4.12 / S1.06). */
  nextManeuverInstruction?: string | null;
  /** Nom d'icône du prochain virage (K4.12 / S1.06). */
  nextManeuverIcon?: string | null;
  /** Distance restante jusqu'au prochain virage (m). */
  nextManeuverDistanceM?: number | null;
  /** Libellé d'écart hors trace ou recalcul. */
  offRouteLabel?: string | null;
  /** Rythme formaté (allure ou vitesse) pour affichage lock screen. */
  formattedRhythm?: string | null;
  /** Identifiant stable de session locale. */
  clientSessionId?: string | null;
}

export interface LiveActivityStart extends LiveActivityState {
  sport: string;
  startedAt: number;
}

interface LiveActivityPlugin {
  isSupported(): Promise<{ supported: boolean; platform?: string; reason?: string }>;
  start(options: LiveActivityStart): Promise<{ supported: boolean; id?: string; reason?: string }>;
  update(options: LiveActivityState): Promise<{ supported: boolean; id?: string }>;
  end(options: LiveActivityState): Promise<{ supported: boolean; ended?: boolean }>;
}

const native = registerPlugin<LiveActivityPlugin>('LkdvLiveActivity');

function supportsLiveTracking(): boolean {
  if (!Capacitor?.isNativePlatform?.()) return false;
  const platform = Capacitor.getPlatform?.();
  return platform === 'ios' || platform === 'android';
}

/** Vrai si le natif iOS/Android répond que le suivi en direct est supporté. */
export async function isLiveActivitySupported(): Promise<boolean> {
  if (!supportsLiveTracking()) return false;
  try {
    const result = await native.isSupported();
    return result.supported === true;
  } catch {
    return false;
  }
}

export async function startLiveActivity(payload: LiveActivityStart): Promise<boolean> {
  if (!supportsLiveTracking()) return false;
  try {
    const result = await native.start(payload);
    return result.supported === true;
  } catch {
    return false;
  }
}

export async function updateLiveActivity(state: LiveActivityState): Promise<void> {
  if (!supportsLiveTracking()) return;
  try {
    await native.update(state);
  } catch {
    /* un suivi live ne doit jamais faire échouer le suivi principal */
  }
}

export async function endLiveActivity(state: LiveActivityState): Promise<void> {
  if (!supportsLiveTracking()) return;
  try {
    await native.end(state);
  } catch {
    /* idem */
  }
}
