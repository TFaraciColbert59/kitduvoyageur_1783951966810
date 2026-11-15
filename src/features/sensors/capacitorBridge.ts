import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BleScanResult, BleTransportAdapter } from './bleManager';
import type {
  BleServiceKind,
  HealthBridgeAvailability,
  HealthConsentScope,
  HealthPermissionResult,
  HealthPlatform,
  HealthProvider,
  HealthSyncResult,
  HealthWorkoutReadResult,
  HealthWorkoutRecord,
  HealthWorkoutWriteInput,
  HealthWorkoutWriteResult,
  NativeHealthBridgeAdapter,
} from './types';

/**
 * Ponts Capacitor natifs D02 — Santé (S6.03) et Capteurs BLE GATT (S6.06, S6.07).
 *
 * Contrat Swift (`LKDVHealthBridgePlugin.swift` / HealthKit `HKHealthStore`) &
 * Kotlin (`LKDVHealthBridgePlugin.kt` / Android Health Connect `HealthConnectClient`) :
 * - `getAvailability()` -> `{ available, platform: 'ios'|'android', provider, reason? }`
 * - `requestPermissions({ scopes })` -> `{ status, permissions }`
 * - `readWorkouts({ sinceMs, untilMs })` -> `{ ok, provider, workouts }`
 * - `writeWorkout({ workout, existingExternalIds })` -> `{ ok, provider, externalId, deduplicated }`
 *
 * Contrat Swift (`LKDVBleSensorsPlugin.swift` / CoreBluetooth `CBCentralManager`) &
 * Kotlin (`LKDVBleSensorsPlugin.kt` / `BluetoothLeScanner` + `BluetoothGatt`) :
 * - `isAvailable()` -> `{ available, reason? }`
 * - `scanDevices({ services })` -> `{ devices: BleScanResult[] }`
 * - `connect({ deviceId })` -> `{ ok, error? }`
 * - `disconnect({ deviceId })` -> `{ ok }`
 * - `readBatteryLevel({ deviceId })` -> `{ bytes: number[] | null }`
 *
 * Invariant D02 : tant que les plugins Swift/Kotlin ne sont pas enregistrés dans
 * le binaire Capacitor courant, toute plateforme non-native ou dépourvue de pont
 * retourne explicitement `native_bridge_unavailable` / `ble_transport_unavailable`.
 */

export interface NativeHealthBridgeCapacitorPlugin {
  getAvailability(): Promise<{
    available: boolean;
    platform?: 'ios' | 'android' | 'web';
    provider?: 'apple_healthkit' | 'android_health_connect';
    reason?: string;
  }>;
  requestPermissions(options: { scopes: HealthConsentScope[] }): Promise<{
    results?: HealthPermissionResult[];
  }>;
  readWorkouts(options: { sinceMs: number; untilMs: number }): Promise<{
    ok: boolean;
    provider?: 'apple_healthkit' | 'android_health_connect';
    workouts?: HealthWorkoutRecord[];
    reason?: string;
  }>;
  writeWorkout(options: {
    workout: HealthWorkoutWriteInput;
    existingExternalIds: string[];
  }): Promise<{
    ok: boolean;
    provider?: 'apple_healthkit' | 'android_health_connect';
    externalId?: string;
    deduplicated?: boolean;
    reason?: string;
  }>;
}

export interface NativeBleSensorsCapacitorPlugin {
  isAvailable(): Promise<{ available: boolean; reason?: string }>;
  scanDevices(options: { services: readonly BleServiceKind[] }): Promise<{
    devices?: BleScanResult[];
  }>;
  connect(options: { deviceId: string }): Promise<{ ok: boolean; error?: string }>;
  disconnect(options: { deviceId: string }): Promise<{ ok?: boolean }>;
  readBatteryLevel(options: { deviceId: string }): Promise<{ bytes: number[] | null }>;
}

const nativeHealthPlugin = registerPlugin<NativeHealthBridgeCapacitorPlugin>('LKDVHealthBridge');
const nativeBlePlugin = registerPlugin<NativeBleSensorsCapacitorPlugin>('LKDVBleSensors');

export function isCapacitorNativeRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (!Capacitor?.isNativePlatform?.()) return false;
    const platform = Capacitor.getPlatform?.();
    return platform === 'ios' || platform === 'android';
  } catch {
    return false;
  }
}

export interface SensorsNativeRuntimeStatus {
  platform: 'ios' | 'android' | 'web';
  isNativeApp: boolean;
  webBluetoothSupported: boolean;
  healthBridgePlugin: 'LKDVHealthBridge';
  bleSensorsPlugin: 'LKDVBleSensors';
}

export function inspectSensorsNativeRuntime(): SensorsNativeRuntimeStatus {
  const isNative = isCapacitorNativeRuntime();
  let platform: 'ios' | 'android' | 'web' = 'web';
  if (isNative) {
    const detected = Capacitor.getPlatform?.();
    if (detected === 'ios' || detected === 'android') platform = detected;
  }
  const webBluetoothSupported =
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { bluetooth?: unknown }).bluetooth === 'object' &&
    (navigator as Navigator & { bluetooth?: unknown }).bluetooth !== null;

  return {
    platform,
    isNativeApp: isNative,
    webBluetoothSupported,
    healthBridgePlugin: 'LKDVHealthBridge',
    bleSensorsPlugin: 'LKDVBleSensors',
  };
}

/**
 * Adaptateur Santé Capacitor (HealthKit iOS / Health Connect Android).
 * Échoue de manière explicite (`native_bridge_unavailable`) hors binaire natif
 * ou si le plugin Swift/Kotlin n'est pas compilé dans la build courante.
 */
export class CapacitorHealthBridgeAdapter implements NativeHealthBridgeAdapter {
  get platform(): HealthPlatform {
    if (!isCapacitorNativeRuntime()) return 'web';
    return Capacitor.getPlatform?.() === 'ios' ? 'ios' : 'android';
  }

  get provider(): HealthProvider | null {
    if (this.platform === 'ios') return 'apple_healthkit';
    if (this.platform === 'android') return 'android_health_connect';
    return null;
  }

  async getAvailability(): Promise<HealthBridgeAvailability> {
    if (!isCapacitorNativeRuntime()) {
      return {
        status: 'native_bridge_unavailable',
        platform: 'web',
        provider: null,
        reason:
          'Navigation web : Apple HealthKit (iOS) et Health Connect (Android) exigent le pont natif Capacitor.',
      };
    }

    const platform = Capacitor.getPlatform?.() === 'ios' ? 'ios' : 'android';
    try {
      const res = await nativeHealthPlugin.getAvailability();
      if (!res?.available) {
        return {
          status: 'native_bridge_unavailable',
          platform,
          provider: res?.provider ?? null,
          reason: res?.reason ?? 'Plugin natif LKDVHealthBridge indisponible sur cet appareil.',
        };
      }
      return {
        status: 'available',
        platform,
        provider:
          res.provider ?? (platform === 'ios' ? 'apple_healthkit' : 'android_health_connect'),
        reason: null,
      };
    } catch {
      return {
        status: 'native_bridge_unavailable',
        platform,
        provider: null,
        reason: 'Plugin Capacitor LKDVHealthBridge non enregistré dans cette build native.',
      };
    }
  }

  private unavailablePermissionResults(
    scopes: readonly HealthConsentScope[],
    reason: string,
  ): HealthPermissionResult[] {
    return scopes.map((scope) => ({
      scope,
      granted: false,
      status: 'native_bridge_unavailable' as const,
      reason,
    }));
  }

  async requestPermissions(
    scopes: readonly HealthConsentScope[],
  ): Promise<HealthPermissionResult[]> {
    if (!isCapacitorNativeRuntime()) {
      return this.unavailablePermissionResults(scopes, 'native_bridge_unavailable');
    }
    try {
      const res = await nativeHealthPlugin.requestPermissions({ scopes: [...scopes] });
      if (Array.isArray(res?.results) && res.results.length > 0) {
        return res.results;
      }
      return this.unavailablePermissionResults(scopes, 'native_bridge_unavailable');
    } catch {
      return this.unavailablePermissionResults(scopes, 'native_bridge_unavailable');
    }
  }

  async requestNativePermissions(
    scopes: HealthConsentScope[],
  ): Promise<{
    granted: HealthConsentScope[];
    denied: HealthConsentScope[];
    unavailable?: boolean;
  }> {
    if (!isCapacitorNativeRuntime()) {
      return { granted: [], denied: [...scopes], unavailable: true };
    }
    try {
      const results = await this.requestPermissions(scopes);
      return {
        granted: results.filter((r) => r.granted).map((r) => r.scope),
        denied: results.filter((r) => !r.granted).map((r) => r.scope),
        unavailable: results.length === 0 ? true : undefined,
      };
    } catch {
      return { granted: [], denied: [...scopes], unavailable: true };
    }
  }

  async readWorkouts(params: {
    sinceMs: number;
    untilMs: number;
  }): Promise<HealthSyncResult<HealthWorkoutRecord[]>> {
    const availability = await this.getAvailability();
    if (availability.status !== 'available' || !availability.provider) {
      return {
        ok: false,
        status: 'native_bridge_unavailable',
        reason: availability.reason ?? 'native_bridge_unavailable',
      };
    }
    try {
      const res = await nativeHealthPlugin.readWorkouts(params);
      if (!res?.ok) {
        return {
          ok: false,
          status: 'native_bridge_unavailable',
          reason: res?.reason ?? 'Lecture HealthKit/Health Connect refusée par le pont natif.',
        };
      }
      return {
        ok: true,
        status: 'available',
        provider: res.provider ?? availability.provider,
        data: Array.isArray(res.workouts) ? res.workouts : [],
      };
    } catch {
      return {
        ok: false,
        status: 'native_bridge_unavailable',
        reason: 'Échec de lecture sur LKDVHealthBridge.',
      };
    }
  }

  async writeWorkout(
    workout: HealthWorkoutWriteInput,
    existingExternalIds: ReadonlySet<string>,
  ): Promise<HealthSyncResult<HealthWorkoutWriteResult>> {
    const availability = await this.getAvailability();
    if (availability.status !== 'available' || !availability.provider) {
      return {
        ok: false,
        status: 'native_bridge_unavailable',
        reason: availability.reason ?? 'native_bridge_unavailable',
      };
    }
    try {
      const res = await nativeHealthPlugin.writeWorkout({
        workout,
        existingExternalIds: Array.from(existingExternalIds),
      });
      if (!res?.ok || !res.externalId) {
        return {
          ok: false,
          status: 'native_bridge_unavailable',
          reason: res?.reason ?? 'Écriture santé refusée par le pont natif.',
        };
      }
      return {
        ok: true,
        status: 'available',
        provider: res.provider ?? availability.provider,
        data: {
          externalId: res.externalId,
          deduplicated: res.deduplicated === true,
        },
      };
    } catch {
      return {
        ok: false,
        status: 'native_bridge_unavailable',
        reason: 'Échec d’écriture sur LKDVHealthBridge.',
      };
    }
  }
}

/**
 * Adaptateur BLE Capacitor (CoreBluetooth iOS / Android BLE GATT).
 * Sur navigateur sans pont natif, retourne `isAvailable() = false` sauf si
 * un pont natif Capacitor `LKDVBleSensors` répond positivement.
 */
export class CapacitorBleTransportAdapter implements BleTransportAdapter {
  async isAvailable(): Promise<boolean> {
    if (!isCapacitorNativeRuntime()) return false;
    try {
      const res = await nativeBlePlugin.isAvailable();
      return res?.available === true;
    } catch {
      return false;
    }
  }

  async scanDevices(services: readonly BleServiceKind[]): Promise<BleScanResult[]> {
    if (!(await this.isAvailable())) return [];
    try {
      const res = await nativeBlePlugin.scanDevices({ services });
      return Array.isArray(res?.devices) ? res.devices : [];
    } catch {
      return [];
    }
  }

  async connect(deviceId: string): Promise<{ ok: boolean; error?: string }> {
    if (!(await this.isAvailable())) {
      return { ok: false, error: 'ble_transport_unavailable' };
    }
    try {
      const res = await nativeBlePlugin.connect({ deviceId });
      return res?.ok ? { ok: true } : { ok: false, error: res?.error ?? 'ble_connect_failed' };
    } catch {
      return { ok: false, error: 'ble_transport_unavailable' };
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    if (!isCapacitorNativeRuntime()) return;
    try {
      await nativeBlePlugin.disconnect({ deviceId });
    } catch {
      /* ignore */
    }
  }

  async readBatteryLevel(deviceId: string): Promise<Uint8Array | null> {
    if (!(await this.isAvailable())) return null;
    try {
      const res = await nativeBlePlugin.readBatteryLevel({ deviceId });
      return Array.isArray(res?.bytes) ? new Uint8Array(res.bytes) : null;
    } catch {
      return null;
    }
  }
}

export function createDefaultHealthBridgeAdapter(): NativeHealthBridgeAdapter {
  return new CapacitorHealthBridgeAdapter();
}

export function createDefaultBleTransportAdapter(): BleTransportAdapter {
  return new CapacitorBleTransportAdapter();
}
