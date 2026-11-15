import { describe, expect, it } from 'vitest';
import {
  computeCscMetrics,
  decodeBatteryLevel,
  decodeCscMeasurement,
  decodeCyclingPowerMeasurement,
  decodeHeartRateMeasurement,
  decodeRscMeasurement,
} from '../bleGattDecoders';

describe('bleGattDecoders', () => {
  describe('0x180D / 0x2A37 Heart Rate Measurement', () => {
    it('décode une trame uint8 avec contact capteur, énergie et intervalles RR', () => {
      // flags: 0x1E = uint8 HR (0), contact detected (0b11 << 1 = 0x06), energy (0x08), RR (0x10)
      // HR = 152 bpm, Energy = 420 kJ (0x01A4 LE -> A4 01), RR = 1024 (1000 ms -> 00 04), 512 (500 ms -> 00 02)
      const bytes = new Uint8Array([0x1e, 152, 0xa4, 0x01, 0x00, 0x04, 0x00, 0x02]);
      const decoded = decodeHeartRateMeasurement(bytes);

      expect(decoded).toEqual({
        kind: 'heart_rate',
        heartRateBpm: 152,
        contactStatus: 'contact_detected',
        energyExpendedKj: 420,
        rrIntervalsMs: [1000, 500],
      });
    });

    it('décode une trame uint16 sans contact et sans champs optionnels', () => {
      // flags: 0x05 = uint16 HR (0x01) + no contact (0b10 << 1 = 0x04)
      // HR = 260 (0x0104 LE -> 04 01)
      const bytes = new Uint8Array([0x05, 0x04, 0x01]);
      const decoded = decodeHeartRateMeasurement(bytes);

      expect(decoded).toEqual({
        kind: 'heart_rate',
        heartRateBpm: 260,
        contactStatus: 'no_contact',
        energyExpendedKj: null,
        rrIntervalsMs: [],
      });
    });

    it('retourne null sur trame tronquée', () => {
      expect(decodeHeartRateMeasurement(new Uint8Array([0x00]))).toBeNull();
      expect(decodeHeartRateMeasurement(new Uint8Array([0x01, 0x50]))).toBeNull();
      expect(decodeHeartRateMeasurement(new Uint8Array([0x08, 120, 0x01]))).toBeNull();
    });
  });

  describe('0x1816 / 0x2A5B Cycling Speed & Cadence', () => {
    it('décode roue + pédalier et calcule vitesse/cadence avec wrap-around uint16', () => {
      // Frame 1: flags=0x03 (wheel+crank), wheelRev=100, wheelTime=65000, crankRev=50, crankTime=65000
      const buf1 = new ArrayBuffer(11);
      const v1 = new DataView(buf1);
      v1.setUint8(0, 0x03);
      v1.setUint32(1, 100, true);
      v1.setUint16(5, 65000, true);
      v1.setUint16(7, 50, true);
      v1.setUint16(9, 65000, true);

      // Frame 2 (+1024 ticks = 1.0s via wrap-around: (65000 + 1024) % 65536 = 488):
      // wheelRev=102 (+2 revs * 2.105m = 4.21 m/s), crankRev=52 (+2 revs / (1/60 min) = 120 rpm)
      const buf2 = new ArrayBuffer(11);
      const v2 = new DataView(buf2);
      v2.setUint8(0, 0x03);
      v2.setUint32(1, 102, true);
      v2.setUint16(5, 488, true);
      v2.setUint16(7, 52, true);
      v2.setUint16(9, 488, true);

      const f1 = decodeCscMeasurement(v1)!;
      const f2 = decodeCscMeasurement(v2)!;
      expect(f1.kind).toBe('cycling_sc');
      expect(f2.kind).toBe('cycling_sc');

      const metrics = computeCscMetrics(f1, f2, 2105);
      expect(metrics.speedMs).toBeCloseTo(4.21, 3);
      expect(metrics.cadenceRpm).toBeCloseTo(120, 3);
    });

    it('ne retourne aucune valeur inventée si deltaTime == 0', () => {
      const f = decodeCscMeasurement(new Uint8Array([0x03, 10, 0, 0, 0, 100, 0, 5, 0, 100, 0]))!;
      const metrics = computeCscMetrics(f, f, 2105);
      expect(metrics.speedMs).toBeNull();
      expect(metrics.cadenceRpm).toBeNull();
    });
  });

  describe('0x1818 / 0x2A63 Cycling Power Measurement', () => {
    it('décode puissance instantanée, balance pédale, couple et données roue/pédalier', () => {
      // flags: 0x0035 = balance(0x01) + torque(0x04) + wheel(0x10) + crank(0x20)
      const buf = new ArrayBuffer(17);
      const v = new DataView(buf);
      v.setUint16(0, 0x0035, true);
      v.setInt16(2, 285, true); // 285 W
      v.setUint8(4, 104); // 52.0%
      v.setUint16(5, 640, true); // 20.0 Nm (640 / 32)
      v.setUint32(7, 500, true); // wheel revs
      v.setUint16(11, 2048, true); // wheel time
      v.setUint16(13, 120, true); // crank revs
      v.setUint16(15, 2048, true); // crank time

      const decoded = decodeCyclingPowerMeasurement(v);
      expect(decoded).toEqual({
        kind: 'cycling_power',
        instantaneousPowerWatts: 285,
        pedalPowerBalancePercent: 52,
        accumulatedTorqueNm: 20,
        cumulativeWheelRevolutions: 500,
        lastWheelEventTime1024s: 2048,
        cumulativeCrankRevolutions: 120,
        lastCrankEventTime1024s: 2048,
      });
    });

    it('retourne null si la trame est trop courte', () => {
      expect(decodeCyclingPowerMeasurement(new Uint8Array([0x00, 0x00, 0x10]))).toBeNull();
    });
  });

  describe('0x1814 / 0x2A53 Running Speed & Cadence', () => {
    it('décode vitesse, cadence, foulée et distance totale en course', () => {
      // flags: 0x07 = stride(0x01) + totalDist(0x02) + running(0x04)
      // speed: 3.5 m/s -> 3.5 * 256 = 896 (0x0380)
      // cadence: 176 spm
      // stride: 118 cm -> 1.18 m
      // totalDistance: 5000.5 m -> 50005 dm
      const buf = new ArrayBuffer(10);
      const v = new DataView(buf);
      v.setUint8(0, 0x07);
      v.setUint16(1, 896, true);
      v.setUint8(3, 176);
      v.setUint16(4, 118, true);
      v.setUint32(6, 50005, true);

      const decoded = decodeRscMeasurement(v);
      expect(decoded).toEqual({
        kind: 'running_sc',
        instantaneousSpeedMs: 3.5,
        instantaneousCadenceSpm: 176,
        strideLengthM: 1.18,
        totalDistanceM: 5000.5,
        isRunning: true,
      });
    });
  });

  describe('0x180F / 0x2A19 Battery Level', () => {
    it('décode un niveau valide 0..100 et rejette >100', () => {
      expect(decodeBatteryLevel(new Uint8Array([84]))).toBe(84);
      expect(decodeBatteryLevel(new Uint8Array([0]))).toBe(0);
      expect(decodeBatteryLevel(new Uint8Array([101]))).toBeNull();
      expect(decodeBatteryLevel(new Uint8Array([]))).toBeNull();
    });
  });
});
