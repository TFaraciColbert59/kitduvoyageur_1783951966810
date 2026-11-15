// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockNative = vi.hoisted(() => ({
  isNative: false,
  platform: 'web' as 'web' | 'ios' | 'android',
  healthGetAvailability: vi.fn(),
  bleIsAvailable: vi.fn(),
  bleScan: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => mockNative.isNative,
    getPlatform: () => mockNative.platform,
  },
  registerPlugin: (name: string) => {
    if (name === 'LKDVHealthBridge') {
      return {
        getAvailability: mockNative.healthGetAvailability,
        requestPermissions: vi.fn(),
        readWorkouts: vi.fn(),
        writeWorkout: vi.fn(),
      };
    }
    return {
      isAvailable: mockNative.bleIsAvailable,
      scanDevices: mockNative.bleScan,
      connect: vi.fn(),
      disconnect: vi.fn(),
      readBatteryLevel: vi.fn(),
    };
  },
}));

import {
  CapacitorBleTransportAdapter,
  CapacitorHealthBridgeAdapter,
  inspectSensorsNativeRuntime,
} from '../capacitorBridge';

describe('D02 Capacitor native bridges — S6.03 / S6.06 / S6.07', () => {
  beforeEach(() => {
    mockNative.isNative = false;
    mockNative.platform = 'web';
    mockNative.healthGetAvailability.mockReset();
    mockNative.bleIsAvailable.mockReset();
    mockNative.bleScan.mockReset();
  });

  it('retourne explicitement native_bridge_unavailable et ble_transport_unavailable sur le web', async () => {
    const health = new CapacitorHealthBridgeAdapter();
    const ble = new CapacitorBleTransportAdapter();

    const avail = await health.getAvailability();
    expect(avail.status).toBe('native_bridge_unavailable');
    expect(avail.platform).toBe('web');

    expect(await ble.isAvailable()).toBe(false);
    expect(await ble.connect('hr-1')).toEqual({ ok: false, error: 'ble_transport_unavailable' });
    expect(inspectSensorsNativeRuntime().isNativeApp).toBe(false);
  });

  it('délègue au plugin natif Capacitor quand iOS/Android natif répond positivement', async () => {
    mockNative.isNative = true;
    mockNative.platform = 'ios';
    mockNative.healthGetAvailability.mockResolvedValue({
      available: true,
      provider: 'apple_healthkit',
    });
    mockNative.bleIsAvailable.mockResolvedValue({ available: true });
    mockNative.bleScan.mockResolvedValue({
      devices: [{ deviceId: 'polar-h10', name: 'Polar H10', services: ['heart_rate'], rssi: -55 }],
    });

    const health = new CapacitorHealthBridgeAdapter();
    const ble = new CapacitorBleTransportAdapter();

    const avail = await health.getAvailability();
    expect(avail).toEqual({
      status: 'available',
      platform: 'ios',
      provider: 'apple_healthkit',
      reason: null,
    });

    expect(await ble.isAvailable()).toBe(true);
    const scanned = await ble.scanDevices(['heart_rate']);
    expect(scanned).toHaveLength(1);
    expect(scanned[0].deviceId).toBe('polar-h10');
  });

  it('reste fail-closed sur natif si le plugin Swift/Kotlin n’est pas compilé', async () => {
    mockNative.isNative = true;
    mockNative.platform = 'android';
    mockNative.healthGetAvailability.mockRejectedValue(new Error('UNIMPLEMENTED'));
    mockNative.bleIsAvailable.mockRejectedValue(new Error('UNIMPLEMENTED'));

    const health = new CapacitorHealthBridgeAdapter();
    const ble = new CapacitorBleTransportAdapter();

    const avail = await health.getAvailability();
    expect(avail.status).toBe('native_bridge_unavailable');
    expect(avail.platform).toBe('android');
    expect(await ble.isAvailable()).toBe(false);
  });
});
