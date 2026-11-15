import {
  decodeBatteryLevel,
  decodeCscMeasurement,
  decodeCyclingPowerMeasurement,
  decodeHeartRateMeasurement,
  decodeRscMeasurement,
} from './bleGattDecoders';
import {
  createBleSensorDevice,
  DEFAULT_RECONNECT_POLICY,
  reduceSensorDevice,
} from './sensorStateMachine';
import { QualifiedTelemetryStream } from './telemetryStream';
import type {
  BleSensorDevice,
  BleServiceKind,
  QualifiedTelemetrySnapshot,
  QualifiedTelemetrySummary,
  SensorReconnectPolicy,
} from './types';

export interface BleScanResult {
  deviceId: string;
  name: string;
  services: BleServiceKind[];
  rssi: number | null;
}

export interface BleTransportAdapter {
  isAvailable(): Promise<boolean>;
  scanDevices(services: readonly BleServiceKind[]): Promise<BleScanResult[]>;
  connect(deviceId: string): Promise<{ ok: boolean; error?: string }>;
  disconnect(deviceId: string): Promise<void>;
  readBatteryLevel?(deviceId: string): Promise<Uint8Array | null>;
}

/**
 * Adaptateur par défaut lorsque aucun pont BLE natif/Web Bluetooth n'est disponible.
 * Retourne `isAvailable() = false` et aucun capteur factice.
 */
export class UnavailableBleTransportAdapter implements BleTransportAdapter {
  async isAvailable(): Promise<boolean> {
    return false;
  }

  async scanDevices(): Promise<BleScanResult[]> {
    return [];
  }

  async connect(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: 'ble_transport_unavailable' };
  }

  async disconnect(): Promise<void> {
    // no-op
  }
}

export interface BleSensorManagerOptions {
  transport?: BleTransportAdapter;
  reconnectPolicy?: SensorReconnectPolicy;
  staleAfterMs?: number;
  wheelCircumferenceMm?: number;
}

/**
 * Gestionnaire unifié des capteurs BLE GATT (S6.06, S6.07).
 * Pilote appairage, reconnexion bornée, batterie et flux de télémétrie qualifiée.
 */
export class BleSensorManager {
  private readonly transport: BleTransportAdapter;
  private readonly policy: SensorReconnectPolicy;
  private readonly devices = new Map<string, BleSensorDevice>();
  readonly telemetry: QualifiedTelemetryStream;

  constructor(options: BleSensorManagerOptions = {}) {
    this.transport = options.transport ?? new UnavailableBleTransportAdapter();
    this.policy = options.reconnectPolicy ?? DEFAULT_RECONNECT_POLICY;
    this.telemetry = new QualifiedTelemetryStream({
      staleAfterMs: options.staleAfterMs,
      wheelCircumferenceMm: options.wheelCircumferenceMm,
    });
  }

  getDevices(): BleSensorDevice[] {
    return Array.from(this.devices.values());
  }

  getDevice(deviceId: string): BleSensorDevice | undefined {
    return this.devices.get(deviceId);
  }

  async scan(
    services: readonly BleServiceKind[],
    nowMs: number = Date.now(),
  ): Promise<{ available: boolean; devices: BleSensorDevice[] }> {
    const available = await this.transport.isAvailable();
    if (!available) {
      return { available: false, devices: this.getDevices() };
    }
    const found = await this.transport.scanDevices(services);
    for (const item of found) {
      const existing = this.devices.get(item.deviceId);
      if (existing) {
        this.devices.set(
          item.deviceId,
          item.rssi !== null
            ? reduceSensorDevice(existing, { type: 'RSSI_UPDATED', rssi: item.rssi }, this.policy, nowMs)
            : existing,
        );
      } else {
        this.devices.set(
          item.deviceId,
          createBleSensorDevice({
            deviceId: item.deviceId,
            name: item.name,
            services: item.services,
            rssi: item.rssi,
            nowMs,
          }),
        );
      }
    }
    return { available: true, devices: this.getDevices() };
  }

  async connect(deviceId: string, nowMs: number = Date.now()): Promise<BleSensorDevice | null> {
    const current = this.devices.get(deviceId);
    if (!current) return null;

    const available = await this.transport.isAvailable();
    if (!available) {
      const updated = reduceSensorDevice(
        current,
        { type: 'BLE_UNAVAILABLE', reason: 'Bluetooth LE indisponible' },
        this.policy,
        nowMs,
      );
      this.devices.set(deviceId, updated);
      return updated;
    }

    const connecting = reduceSensorDevice(current, { type: 'START_CONNECT' }, this.policy, nowMs);
    this.devices.set(deviceId, connecting);

    const res = await this.transport.connect(deviceId);
    const next = res.ok
      ? reduceSensorDevice(connecting, { type: 'CONNECT_SUCCESS' }, this.policy, nowMs)
      : reduceSensorDevice(
          connecting,
          { type: 'ERROR', reason: res.error ?? 'Échec connexion BLE' },
          this.policy,
          nowMs,
        );

    this.devices.set(deviceId, next);

    let finalState = next;
    if (res.ok && this.transport.readBatteryLevel) {
      const rawBattery = await this.transport.readBatteryLevel(deviceId);
      if (rawBattery) {
        finalState = this.handleBatteryNotification(deviceId, rawBattery, nowMs) ?? next;
      }
    }

    return finalState;
  }

  async disconnect(deviceId: string, nowMs: number = Date.now()): Promise<BleSensorDevice | null> {
    const current = this.devices.get(deviceId);
    if (!current) return null;
    await this.transport.disconnect(deviceId);
    this.telemetry.clearDeviceState(deviceId);
    const next = reduceSensorDevice(current, { type: 'MANUAL_DISCONNECT' }, this.policy, nowMs);
    this.devices.set(deviceId, next);
    return next;
  }

  handleLinkLost(deviceId: string, reason?: string, nowMs: number = Date.now()): BleSensorDevice | null {
    const current = this.devices.get(deviceId);
    if (!current) return null;
    this.telemetry.clearDeviceState(deviceId);
    const next = reduceSensorDevice(current, { type: 'LINK_LOST', reason }, this.policy, nowMs);
    this.devices.set(deviceId, next);
    return next;
  }

  handleBatteryNotification(
    deviceId: string,
    payload: DataView | Uint8Array,
    nowMs: number = Date.now(),
  ): BleSensorDevice | null {
    const current = this.devices.get(deviceId);
    if (!current) return null;
    const batteryPercent = decodeBatteryLevel(payload);
    const next = reduceSensorDevice(
      current,
      { type: 'BATTERY_UPDATED', batteryPercent },
      this.policy,
      nowMs,
    );
    this.devices.set(deviceId, next);
    return next;
  }

  handleGattNotification(
    deviceId: string,
    service: BleServiceKind,
    payload: DataView | Uint8Array,
    nowMs: number = Date.now(),
  ): boolean {
    const current = this.devices.get(deviceId);
    if (!current || current.state !== 'connected') return false;

    const decoded =
      service === 'heart_rate'
        ? decodeHeartRateMeasurement(payload)
        : service === 'cycling_sc'
          ? decodeCscMeasurement(payload)
          : service === 'cycling_power'
            ? decodeCyclingPowerMeasurement(payload)
            : decodeRscMeasurement(payload);

    if (!decoded) return false;
    this.telemetry.ingestFrame(deviceId, decoded, nowMs);
    return true;
  }

  getTelemetrySnapshot(nowMs: number = Date.now()): QualifiedTelemetrySnapshot {
    return this.telemetry.getSnapshot(nowMs);
  }

  getTelemetrySummary(): QualifiedTelemetrySummary {
    return this.telemetry.getSummary();
  }
}
