import type {
  BatteryStatus,
  BleSensorDevice,
  BleServiceKind,
  SensorReconnectPolicy,
} from './types';

export const DEFAULT_RECONNECT_POLICY: SensorReconnectPolicy = {
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  maxAttempts: 5,
};

export function classifyBatteryStatus(batteryPercent: number | null): BatteryStatus {
  if (batteryPercent === null || !Number.isFinite(batteryPercent)) return 'unknown';
  if (batteryPercent <= 10) return 'critical';
  if (batteryPercent <= 20) return 'low';
  return 'normal';
}

export function computeReconnectDelayMs(
  attempt: number,
  policy: SensorReconnectPolicy = DEFAULT_RECONNECT_POLICY,
): number | null {
  if (attempt < 1 || attempt > policy.maxAttempts) return null;
  const raw = policy.baseDelayMs * Math.pow(2, attempt - 1);
  return Math.min(raw, policy.maxDelayMs);
}

export function createBleSensorDevice(params: {
  deviceId: string;
  name: string;
  services: BleServiceKind[];
  rssi?: number | null;
  nowMs?: number;
}): BleSensorDevice {
  return {
    deviceId: params.deviceId,
    name: params.name,
    services: [...params.services],
    state: 'idle',
    rssi: params.rssi ?? null,
    batteryPercent: null,
    batteryStatus: 'unknown',
    reconnectAttempt: 0,
    nextReconnectDelayMs: null,
    lastConnectedAtMs: null,
    lastSeenAtMs: params.nowMs ?? null,
    lastError: null,
    paired: false,
  };
}

export type SensorDeviceEvent =
  | { type: 'START_CONNECT' }
  | { type: 'CONNECT_SUCCESS'; rssi?: number | null }
  | { type: 'LINK_LOST'; reason?: string }
  | { type: 'RECONNECT_ATTEMPT' }
  | { type: 'MANUAL_DISCONNECT' }
  | { type: 'UNPAIR' }
  | { type: 'BATTERY_UPDATED'; batteryPercent: number | null }
  | { type: 'RSSI_UPDATED'; rssi: number }
  | { type: 'BLE_UNAVAILABLE'; reason?: string }
  | { type: 'PERMISSION_DENIED'; reason?: string }
  | { type: 'ERROR'; reason: string };

export function reduceSensorDevice(
  device: BleSensorDevice,
  event: SensorDeviceEvent,
  policy: SensorReconnectPolicy = DEFAULT_RECONNECT_POLICY,
  nowMs: number = Date.now(),
): BleSensorDevice {
  switch (event.type) {
    case 'START_CONNECT':
      return {
        ...device,
        state: 'connecting',
        lastError: null,
        nextReconnectDelayMs: null,
      };

    case 'CONNECT_SUCCESS':
      return {
        ...device,
        state: 'connected',
        paired: true,
        rssi: event.rssi !== undefined ? event.rssi : device.rssi,
        reconnectAttempt: 0,
        nextReconnectDelayMs: null,
        lastConnectedAtMs: nowMs,
        lastSeenAtMs: nowMs,
        lastError: null,
      };

    case 'LINK_LOST': {
      // Un capteur jamais appairé ne lance pas de reconnexion automatique.
      if (!device.paired) {
        return {
          ...device,
          state: 'disconnected',
          reconnectAttempt: 0,
          nextReconnectDelayMs: null,
          lastError: event.reason ?? null,
        };
      }
      const nextAttempt = device.reconnectAttempt + 1;
      const delay = computeReconnectDelayMs(nextAttempt, policy);
      if (delay === null) {
        return {
          ...device,
          state: 'disconnected',
          reconnectAttempt: device.reconnectAttempt,
          nextReconnectDelayMs: null,
          lastError: event.reason ?? 'Nombre maximal de reconnexions atteint',
        };
      }
      return {
        ...device,
        state: 'reconnecting',
        reconnectAttempt: nextAttempt,
        nextReconnectDelayMs: delay,
        lastError: event.reason ?? null,
      };
    }

    case 'RECONNECT_ATTEMPT': {
      if (device.state !== 'reconnecting') return device;
      return {
        ...device,
        state: 'connecting',
        nextReconnectDelayMs: null,
      };
    }

    case 'MANUAL_DISCONNECT':
      return {
        ...device,
        state: 'disconnected',
        reconnectAttempt: 0,
        nextReconnectDelayMs: null,
        lastError: null,
      };

    case 'UNPAIR':
      return {
        ...device,
        state: 'idle',
        paired: false,
        reconnectAttempt: 0,
        nextReconnectDelayMs: null,
        batteryPercent: null,
        batteryStatus: 'unknown',
        lastError: null,
      };

    case 'BATTERY_UPDATED': {
      const validPercent =
        event.batteryPercent !== null &&
        Number.isFinite(event.batteryPercent) &&
        event.batteryPercent >= 0 &&
        event.batteryPercent <= 100
          ? Math.round(event.batteryPercent)
          : null;
      return {
        ...device,
        batteryPercent: validPercent,
        batteryStatus: classifyBatteryStatus(validPercent),
        lastSeenAtMs: nowMs,
      };
    }

    case 'RSSI_UPDATED':
      return {
        ...device,
        rssi: event.rssi,
        lastSeenAtMs: nowMs,
      };

    case 'BLE_UNAVAILABLE':
      return {
        ...device,
        state: 'unavailable',
        reconnectAttempt: 0,
        nextReconnectDelayMs: null,
        lastError: event.reason ?? 'Bluetooth LE indisponible',
      };

    case 'PERMISSION_DENIED':
      return {
        ...device,
        state: 'permission_denied',
        reconnectAttempt: 0,
        nextReconnectDelayMs: null,
        lastError: event.reason ?? 'Permission Bluetooth refusée',
      };

    case 'ERROR':
      return {
        ...device,
        state: 'error',
        nextReconnectDelayMs: null,
        lastError: event.reason,
      };
  }
}
