import { describe, expect, it } from 'vitest';
import {
  classifyBatteryStatus,
  computeReconnectDelayMs,
  createBleSensorDevice,
  reduceSensorDevice,
} from '../sensorStateMachine';
import type { SensorReconnectPolicy } from '../types';

describe('sensorStateMachine', () => {
  const policy: SensorReconnectPolicy = {
    baseDelayMs: 1_000,
    maxDelayMs: 5_000,
    maxAttempts: 3,
  };

  it('gère appairage, reconnexion avec backoff exponentiel borné et arrêt après maxAttempts', () => {
    let dev = createBleSensorDevice({
      deviceId: 'hr-polar-h10',
      name: 'Polar H10',
      services: ['heart_rate'],
      nowMs: 1000,
    });
    expect(dev.state).toBe('idle');
    expect(dev.paired).toBe(false);

    dev = reduceSensorDevice(dev, { type: 'START_CONNECT' }, policy, 1100);
    expect(dev.state).toBe('connecting');

    dev = reduceSensorDevice(dev, { type: 'CONNECT_SUCCESS', rssi: -62 }, policy, 1200);
    expect(dev.state).toBe('connected');
    expect(dev.paired).toBe(true);
    expect(dev.reconnectAttempt).toBe(0);

    // 1ère perte de lien -> backoff 1000 ms
    dev = reduceSensorDevice(dev, { type: 'LINK_LOST', reason: 'timeout' }, policy, 2000);
    expect(dev.state).toBe('reconnecting');
    expect(dev.reconnectAttempt).toBe(1);
    expect(dev.nextReconnectDelayMs).toBe(1000);

    // 2ème perte -> backoff 2000 ms
    dev = reduceSensorDevice(dev, { type: 'RECONNECT_ATTEMPT' }, policy, 3000);
    expect(dev.state).toBe('connecting');
    dev = reduceSensorDevice(dev, { type: 'LINK_LOST' }, policy, 3500);
    expect(dev.reconnectAttempt).toBe(2);
    expect(dev.nextReconnectDelayMs).toBe(2000);

    // 3ème perte -> backoff 4000 ms
    dev = reduceSensorDevice(dev, { type: 'LINK_LOST' }, policy, 5500);
    expect(dev.reconnectAttempt).toBe(3);
    expect(dev.nextReconnectDelayMs).toBe(4000);

    // 4ème perte -> dépasse maxAttempts=3 -> disconnected
    dev = reduceSensorDevice(dev, { type: 'LINK_LOST' }, policy, 9500);
    expect(dev.state).toBe('disconnected');
    expect(dev.nextReconnectDelayMs).toBeNull();
  });

  it('annule la reconnexion sur déconnexion manuelle et classe la batterie', () => {
    expect(computeReconnectDelayMs(4, { baseDelayMs: 1000, maxDelayMs: 5000, maxAttempts: 5 })).toBe(
      5000,
    );
    expect(classifyBatteryStatus(null)).toBe('unknown');
    expect(classifyBatteryStatus(85)).toBe('normal');
    expect(classifyBatteryStatus(20)).toBe('low');
    expect(classifyBatteryStatus(9)).toBe('critical');

    let dev = createBleSensorDevice({
      deviceId: 'pwr-1',
      name: 'Assioma Duo',
      services: ['cycling_power'],
    });
    dev = reduceSensorDevice(dev, { type: 'CONNECT_SUCCESS' }, policy, 1000);
    dev = reduceSensorDevice(dev, { type: 'BATTERY_UPDATED', batteryPercent: 10 }, policy, 1500);
    expect(dev.batteryStatus).toBe('critical');
    expect(dev.batteryPercent).toBe(10);

    dev = reduceSensorDevice(dev, { type: 'LINK_LOST' }, policy, 2000);
    expect(dev.state).toBe('reconnecting');

    dev = reduceSensorDevice(dev, { type: 'MANUAL_DISCONNECT' }, policy, 2100);
    expect(dev.state).toBe('disconnected');
    expect(dev.reconnectAttempt).toBe(0);
    expect(dev.nextReconnectDelayMs).toBeNull();
  });
});
