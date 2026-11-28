'use client';

import type { ActivityProfileSpec } from '../specs/activityProfileSpec.types';

export interface PlatformTrackingCapabilities {
  runtime: 'capacitor_ios' | 'capacitor_android' | 'safari_web' | 'chromium_web' | 'desktop_web';
  hasNativeSqliteWal: boolean;
  hasReliableBackgroundGps: boolean;
  hasNativeBarometer: boolean;
  hasWebBluetooth: boolean;
  hasHealthKitWrite: boolean;
  hasDynamicIsland: boolean;
  altitudeConfidenceDefault: 'high' | 'medium' | 'low';
  degradedBannerMessageFr: string | null;
}

export interface NativeTrackerSnapshot {
  active: boolean;
  sessionId?: string;
  canonicalSlug?: string;
  domainState?: string;
  writerLeaseId?: string;
  distanceM?: number;
  elevGainM?: number;
  elevLossM?: number;
  altitudeM?: number | null;
  movingS?: number;
  lastPointSeq?: number;
  hrBpm?: number | null;
  powerW?: number | null;
  cadenceRpm?: number | null;
  lat?: number | null;
  lng?: number | null;
  horizAccM?: number | null;
}

interface CapacitorGlobal {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
    Plugins?: {
      LkdvNativeTracker?: {
        startSession(opts: Record<string, unknown>): Promise<NativeTrackerSnapshot>;
        pauseSession(opts?: { manual?: boolean }): Promise<NativeTrackerSnapshot>;
        resumeSession(): Promise<NativeTrackerSnapshot>;
        enterBivouacSleep(): Promise<NativeTrackerSnapshot>;
        resumeFromBivouac(): Promise<NativeTrackerSnapshot>;
        addWaypoint(opts: { kind: string; label: string }): Promise<NativeTrackerSnapshot>;
        calibrateAltitudeManual(opts: { altitudeM: number }): Promise<NativeTrackerSnapshot>;
        finishSession(): Promise<NativeTrackerSnapshot>;
        discardSession(): Promise<{ discarded: boolean }>;
        getRecoverableSession(): Promise<{ recovered: boolean; sessionId?: string; canonicalSlug?: string; domainState?: string; distanceM?: number; elevGainM?: number; movingS?: number }>;
        getSnapshot(): Promise<NativeTrackerSnapshot>;
      };
    };
  };
}

function getNativePlugin() {
  if (typeof window === 'undefined') return null;
  return (window as unknown as CapacitorGlobal).Capacitor?.Plugins?.LkdvNativeTracker ?? null;
}

/**
 * Matrice explicite de dégradation Web / PWA / Desktop vs App Native iOS (Correctif G1).
 */
export function detectPlatformCapabilities(userAgentOverride?: string): PlatformTrackingCapabilities {
  const cap = typeof window !== 'undefined' ? (window as unknown as CapacitorGlobal).Capacitor : undefined;
  const isNative = cap?.isNativePlatform?.() === true;
  const platform = cap?.getPlatform?.() ?? 'web';

  if (isNative && platform === 'ios') {
    return {
      runtime: 'capacitor_ios',
      hasNativeSqliteWal: true,
      hasReliableBackgroundGps: true,
      hasNativeBarometer: true,
      hasWebBluetooth: true,
      hasHealthKitWrite: true,
      hasDynamicIsland: true,
      altitudeConfidenceDefault: 'high',
      degradedBannerMessageFr: null,
    };
  }

  if (isNative && platform === 'android') {
    return {
      runtime: 'capacitor_android',
      hasNativeSqliteWal: true,
      hasReliableBackgroundGps: true,
      hasNativeBarometer: true,
      hasWebBluetooth: true,
      hasHealthKitWrite: false,
      hasDynamicIsland: false,
      altitudeConfidenceDefault: 'high',
      degradedBannerMessageFr: null,
    };
  }

  const ua = userAgentOverride ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua);
  const hasBluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  if (!isMobile) {
    return {
      runtime: 'desktop_web',
      hasNativeSqliteWal: false,
      hasReliableBackgroundGps: false,
      hasNativeBarometer: false,
      hasWebBluetooth: hasBluetooth,
      hasHealthKitWrite: false,
      hasDynamicIsland: false,
      altitudeConfidenceDefault: 'low',
      degradedBannerMessageFr:
        'Mode Desktop : privilégiez la préparation de trace, l’import .GPX/.FIT et l’analyse détaillée.',
    };
  }

  if (isSafari) {
    return {
      runtime: 'safari_web',
      hasNativeSqliteWal: false,
      hasReliableBackgroundGps: false,
      hasNativeBarometer: false,
      hasWebBluetooth: false,
      hasHealthKitWrite: false,
      hasDynamicIsland: false,
      altitudeConfidenceDefault: 'low',
      degradedBannerMessageFr:
        'Safari Web : gardez l’écran actif pendant la sortie (GPS arrière-plan et BLE réservés à l’app iOS).',
    };
  }

  return {
    runtime: 'chromium_web',
    hasNativeSqliteWal: false,
    hasReliableBackgroundGps: false,
    hasNativeBarometer: false,
    hasWebBluetooth: hasBluetooth,
    hasHealthKitWrite: false,
    hasDynamicIsland: false,
    altitudeConfidenceDefault: 'low',
    degradedBannerMessageFr:
      'Navigateur Web : altitude estimée par GPS seul (précision réduite) ; utilisez l’app native pour le suivi longue durée.',
  };
}

export async function startNativeTrackedSession(
  spec: ActivityProfileSpec,
  meta: { sessionId: string; userId: string },
): Promise<NativeTrackerSnapshot | null> {
  const plugin = getNativePlugin();
  if (!plugin) return null;
  return plugin.startSession({
    sessionId: meta.sessionId,
    userId: meta.userId,
    canonicalSlug: spec.identity.slugId,
    specVersion: spec.specVersion,
    distanceFilterM: spec.acquisition.distanceFilterStandardM,
    maxHorizontalAccuracyM: spec.acquisition.maxHorizontalAccuracyM,
    baroHysteresisM: spec.acquisition.barometer.hysteresisM,
    autoPauseEnabled: spec.algorithms.autoPause.defaultEnabled,
    lockAutoPauseDisabled: spec.algorithms.autoPause.lockDisabledBySafety,
    maxInstantSpeedKmh: spec.algorithms.antiCheat.maxInstantSpeedKmh,
  });
}

export async function enterNativeBivouacSleep(): Promise<NativeTrackerSnapshot | null> {
  const plugin = getNativePlugin();
  if (!plugin) return null;
  return plugin.enterBivouacSleep();
}

export async function resumeNativeFromBivouac(): Promise<NativeTrackerSnapshot | null> {
  const plugin = getNativePlugin();
  if (!plugin) return null;
  return plugin.resumeFromBivouac();
}

export async function checkRecoverableNativeSession() {
  const plugin = getNativePlugin();
  if (!plugin) return { recovered: false as const };
  return plugin.getRecoverableSession();
}
