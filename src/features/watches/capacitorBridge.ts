import { Capacitor, registerPlugin } from '@capacitor/core';
import { inspectWatchNativeTargets } from './nativeTargets';
import type {
  WatchDeviceProfile,
  WatchNativeTargetDiagnostic,
  WatchOfflineMapPack,
  WatchPlatform,
  WatchQueuedSession,
} from './types';

/**
 * Pont Capacitor D03 — Apple Watch (WatchConnectivity `WCSession`) &
 * Wear OS / Galaxy Watch (Wearable `DataClient` / `MessageClient`).
 *
 * Contrat Swift (`LkdvWatchConnectivityPlugin.swift`) :
 * - `getTargetDiagnostic()` -> `{ xcodeWatchKitTargetPresent, runtimeBridgeInjected, pairedWatch? }`
 * - `transferOfflinePack({ pack })` -> `{ ok, transferredBytes?, reason? }`
 * - `pullQueuedSessions()` -> `{ ok, sessions, reason? }`
 *
 * Contrat Kotlin (`LkdvWearDataLayerPlugin.kt`) :
 * - `getTargetDiagnostic()` -> `{ wearOsGradleModulePresent, runtimeBridgeInjected, pairedWatch? }`
 * - `transferOfflinePack({ pack })` -> `{ ok, transferredBytes?, reason? }`
 * - `pullQueuedSessions()` -> `{ ok, sessions, reason? }`
 *
 * Invariant D03 : tant qu'aucune cible WatchKit ni module Gradle `:wear` n'est
 * compilé/injecté au runtime, `inspectRuntimeWatchBridge()` retourne
 * explicitement `status: 'native_target_unavailable'` (aucune simulation).
 */

export interface NativeWatchCompanionPlugin {
  getTargetDiagnostic(): Promise<{
    xcodeWatchKitTargetPresent?: boolean;
    wearOsGradleModulePresent?: boolean;
    runtimeBridgeInjected?: boolean;
    pairedWatch?: WatchDeviceProfile | null;
  }>;
  transferOfflinePack(options: { pack: WatchOfflineMapPack }): Promise<{
    ok: boolean;
    transferredBytes?: number;
    reason?: string;
  }>;
  pullQueuedSessions(options: { platform?: WatchPlatform }): Promise<{
    ok: boolean;
    sessions?: WatchQueuedSession[];
    reason?: string;
  }>;
}

const watchPlugin = registerPlugin<NativeWatchCompanionPlugin>('LKDVWatchCompanion');

export interface WatchBridgeRuntimeInspection {
  diagnostic: WatchNativeTargetDiagnostic;
  pairedWatch: WatchDeviceProfile | null;
  bridgePluginName: 'LKDVWatchCompanion';
  platform: 'ios' | 'android' | 'web';
}

export async function inspectRuntimeWatchBridge(
  nowIso: string = new Date().toISOString(),
): Promise<WatchBridgeRuntimeInspection> {
  if (typeof window === 'undefined' || !Capacitor?.isNativePlatform?.()) {
    return {
      diagnostic: inspectWatchNativeTargets({ nowIso }),
      pairedWatch: null,
      bridgePluginName: 'LKDVWatchCompanion',
      platform: 'web',
    };
  }

  const detected = Capacitor.getPlatform?.();
  const platform: 'ios' | 'android' | 'web' =
    detected === 'ios' || detected === 'android' ? detected : 'web';

  if (platform === 'web') {
    return {
      diagnostic: inspectWatchNativeTargets({ nowIso }),
      pairedWatch: null,
      bridgePluginName: 'LKDVWatchCompanion',
      platform,
    };
  }

  try {
    const res = await watchPlugin.getTargetDiagnostic();
    return {
      diagnostic: inspectWatchNativeTargets({
        xcodeWatchKitTargetPresent: res?.xcodeWatchKitTargetPresent === true,
        wearOsGradleModulePresent: res?.wearOsGradleModulePresent === true,
        runtimeBridgeInjected: res?.runtimeBridgeInjected === true,
        nowIso,
      }),
      pairedWatch: res?.pairedWatch ?? null,
      bridgePluginName: 'LKDVWatchCompanion',
      platform,
    };
  } catch {
    return {
      diagnostic: inspectWatchNativeTargets({ nowIso }),
      pairedWatch: null,
      bridgePluginName: 'LKDVWatchCompanion',
      platform,
    };
  }
}

export async function sendPackToWatchCompanion(
  pack: WatchOfflineMapPack,
): Promise<{ ok: boolean; status: 'sent' | 'native_target_unavailable'; reason: string }> {
  const inspection = await inspectRuntimeWatchBridge();
  if (inspection.diagnostic.status !== 'available') {
    return {
      ok: false,
      status: 'native_target_unavailable',
      reason: inspection.diagnostic.summary,
    };
  }

  try {
    const res = await watchPlugin.transferOfflinePack({ pack });
    if (!res?.ok) {
      return {
        ok: false,
        status: 'native_target_unavailable',
        reason: res?.reason ?? 'Transfert compagnon refusé par la montre.',
      };
    }
    return { ok: true, status: 'sent', reason: 'Paquet transféré vers la montre.' };
  } catch {
    return {
      ok: false,
      status: 'native_target_unavailable',
      reason: 'Plugin LKDVWatchCompanion indisponible lors du transfert.',
    };
  }
}
