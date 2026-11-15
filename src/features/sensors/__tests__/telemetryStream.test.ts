import { describe, expect, it } from 'vitest';
import { BleSensorManager, type BleTransportAdapter } from '../bleManager';
import { QualifiedTelemetryStream } from '../telemetryStream';

describe('QualifiedTelemetryStream & BleSensorManager', () => {
  it("n'invente aucune valeur en l'absence de capteur réel", () => {
    const stream = new QualifiedTelemetryStream({ staleAfterMs: 5_000 });
    const snap = stream.getSnapshot(10_000);

    expect(snap.heartRateBpm).toEqual({
      value: null,
      qualification: 'unavailable',
      sourceDeviceId: null,
      updatedAtMs: null,
    });
    expect(snap.cyclingPowerWatts.qualification).toBe('unavailable');
    expect(snap.cyclingCadenceRpm.qualification).toBe('unavailable');
    expect(snap.runningSpeedMs.qualification).toBe('unavailable');

    expect(stream.getSummary()).toEqual({
      sampleCount: 0,
      avgHeartRateBpm: null,
      maxHeartRateBpm: null,
      avgPowerWatts: null,
      maxPowerWatts: null,
      avgCadenceRpm: null,
      avgSpeedMs: null,
    });
  });

  it('qualifie les mesures réelles en measured puis stale après expiration', () => {
    const stream = new QualifiedTelemetryStream({ staleAfterMs: 5_000 });
    stream.ingestFrame(
      'hr-1',
      {
        kind: 'heart_rate',
        heartRateBpm: 150,
        contactStatus: 'contact_detected',
        energyExpendedKj: null,
        rrIntervalsMs: [],
      },
      1_000,
    );
    stream.ingestFrame(
      'hr-1',
      {
        kind: 'heart_rate',
        heartRateBpm: 160,
        contactStatus: 'contact_detected',
        energyExpendedKj: null,
        rrIntervalsMs: [],
      },
      2_000,
    );

    const fresh = stream.getSnapshot(4_000);
    expect(fresh.heartRateBpm).toEqual({
      value: 160,
      qualification: 'measured',
      sourceDeviceId: 'hr-1',
      updatedAtMs: 2_000,
    });

    const stale = stream.getSnapshot(8_000);
    expect(stale.heartRateBpm.qualification).toBe('stale');

    const summary = stream.getSummary();
    expect(summary.sampleCount).toBe(2);
    expect(summary.avgHeartRateBpm).toBe(155);
    expect(summary.maxHeartRateBpm).toBe(160);
    expect(summary.avgPowerWatts).toBeNull();
  });

  it('pilote scan, connexion, batterie et notifications GATT via BleSensorManager', async () => {
    const transport: BleTransportAdapter = {
      async isAvailable() {
        return true;
      },
      async scanDevices() {
        return [
          {
            deviceId: 'hrm-1',
            name: 'HRM-Pro',
            services: ['heart_rate'],
            rssi: -58,
          },
        ];
      },
      async connect() {
        return { ok: true };
      },
      async disconnect() {},
      async readBatteryLevel() {
        return new Uint8Array([72]);
      },
    };

    const manager = new BleSensorManager({ transport });
    const scan = await manager.scan(['heart_rate'], 1_000);
    expect(scan.available).toBe(true);
    expect(scan.devices).toHaveLength(1);

    const connected = await manager.connect('hrm-1', 1_100);
    expect(connected?.state).toBe('connected');
    expect(connected?.batteryPercent).toBe(72);
    expect(connected?.batteryStatus).toBe('normal');

    const ok = manager.handleGattNotification('hrm-1', 'heart_rate', new Uint8Array([0x06, 145]), 1_200);
    expect(ok).toBe(true);

    const snap = manager.getTelemetrySnapshot(1_500);
    expect(snap.heartRateBpm.value).toBe(145);
    expect(snap.heartRateBpm.qualification).toBe('measured');
  });
});
