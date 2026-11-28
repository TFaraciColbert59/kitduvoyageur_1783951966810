import { describe, expect, it } from 'vitest';
import {
  decodeFtmsIndoorBikeData,
  decodeFtmsRowerData,
  decodeFtmsTreadmillData,
  encodeFtmsSetTargetPowerErg,
} from '../bleGattDecoders';

describe('Lot 04 / 11 — BLE GATT FTMS (0x1826) Decoders & ERG Control Point', () => {
  it('decodes FTMS Indoor Bike (0x2AD2) speed, cadence, power & HR', () => {
    // flags: bit 0=0 (inst speed present), bit 2=1 (cadence), bit 6=1 (inst power), bit 9=1 (HR)
    const flags = 0x0004 | 0x0040 | 0x0200;
    const buf = new ArrayBuffer(9);
    const view = new DataView(buf);
    view.setUint16(0, flags, true);
    view.setUint16(2, 3250, true); // 32.50 km/h
    view.setUint16(4, 180, true);  // 90.0 rpm
    view.setInt16(6, 245, true);   // 245 W
    view.setUint8(8, 158);         // 158 bpm

    const decoded = decodeFtmsIndoorBikeData(view);
    expect(decoded).toEqual({
      kind: 'ftms_indoor_bike',
      instantaneousSpeedKmh: 32.5,
      instantaneousCadenceRpm: 90,
      instantaneousPowerWatts: 245,
      heartRateBpm: 158,
    });
  });

  it('decodes FTMS Treadmill (0x2ACD) speed, distance & incline', () => {
    const flags = 0x0004 | 0x0008;
    const buf = new ArrayBuffer(11);
    const view = new DataView(buf);
    view.setUint16(0, flags, true);
    view.setUint16(2, 1200, true); // 12.00 km/h
    view.setUint8(4, 0x10);
    view.setUint8(5, 0x27);
    view.setUint8(6, 0x00);        // 10 000 m
    view.setInt16(7, 45, true);    // 4.5 % incline
    view.setInt16(9, 25, true);    // ramp angle

    const decoded = decodeFtmsTreadmillData(view);
    expect(decoded).toEqual({
      kind: 'ftms_treadmill',
      instantaneousSpeedKmh: 12,
      totalDistanceM: 10_000,
      inclinePct: 4.5,
    });
  });

  it('decodes FTMS Rower (0x2AD1) stroke rate, /500m pace & power', () => {
    const flags = 0x0008 | 0x0020;
    const buf = new ArrayBuffer(9);
    const view = new DataView(buf);
    view.setUint16(0, flags, true);
    view.setUint8(2, 56);          // 28 spm
    view.setUint16(3, 142, true);  // 142 strokes
    view.setUint16(5, 115, true);  // 1:55 /500m
    view.setInt16(7, 230, true);   // 230 W

    const decoded = decodeFtmsRowerData(view);
    expect(decoded).toEqual({
      kind: 'ftms_rower',
      strokeRateSpm: 28,
      strokeCount: 142,
      instantaneousPaceSec500m: 115,
      instantaneousPowerWatts: 230,
    });
  });

  it('encodes FTMS Control Point ERG target power (0x2AD9, OpCode 0x05)', () => {
    const bytes = encodeFtmsSetTargetPowerErg(265);
    expect(bytes[0]).toBe(0x05);
    const dv = new DataView(bytes.buffer);
    expect(dv.getInt16(1, true)).toBe(265);
  });
});
