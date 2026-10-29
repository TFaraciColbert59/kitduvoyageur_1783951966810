'use client';

import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Pont Live Activity (iOS 16.2+) — P7-20.
 *
 * Sur le web et sur Android, le pont est un **no-op** qui répond
 * `{ supported: false }` : aucun appel natif, aucune exception.
 * Le plugin Swift vit dans `ios/App/App/LiveActivity/`.
 */

export interface LiveActivityState {
  distanceM: number;
  elevGainM: number;
  movingS: number;
  paused: boolean;
  offRoute: boolean;
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

/** Vrai si le natif iOS répond que les Live Activities sont autorisées. */
export async function isLiveActivitySupported(): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'ios') return false;
  try {
    const result = await native.isSupported();
    return result.supported === true;
  } catch {
    return false;
  }
}

export async function startLiveActivity(payload: LiveActivityStart): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'ios') return false;
  try {
    const result = await native.start(payload);
    return result.supported === true;
  } catch {
    return false;
  }
}

export async function updateLiveActivity(state: LiveActivityState): Promise<void> {
  if (Capacitor.getPlatform() !== 'ios') return;
  try {
    await native.update(state);
  } catch {
    /* une Live Activity ne doit jamais faire échouer le suivi */
  }
}

export async function endLiveActivity(state: LiveActivityState): Promise<void> {
  if (Capacitor.getPlatform() !== 'ios') return;
  try {
    await native.end(state);
  } catch {
    /* idem */
  }
}
