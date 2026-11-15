import { describe, expect, it } from 'vitest';
import { decodeBase64Frame, evaluateTelemetry } from '../_lib/telemetry';

function base64(bytes: number[]): string {
  return Buffer.from(bytes).toString('base64');
}

describe('API télémétrie qualifiée', () => {
  it('décode une fréquence cardiaque réelle et la qualifie mesurée', () => {
    const result = evaluateTelemetry({
      frames: [
        {
          deviceId: 'polar-h10',
          service: 'heart_rate',
          payloadBase64: base64([0x00, 120]),
          atMs: 9_000,
        },
      ],
      nowMs: 10_000,
      staleAfterMs: 5_000,
    });

    expect(result.acceptedFrames).toBe(1);
    expect(result.rejectedFrames).toBe(0);
    expect(result.snapshot.heartRateBpm).toMatchObject({
      value: 120,
      qualification: 'measured',
      sourceDeviceId: 'polar-h10',
      updatedAtMs: 9_000,
    });
    expect(result.summary.avgHeartRateBpm).toBe(120);
    expect(result.summary.maxHeartRateBpm).toBe(120);
  });

  it('conserve la valeur mais la qualifie périmée au-delà du seuil', () => {
    const result = evaluateTelemetry({
      frames: [
        {
          deviceId: 'polar-h10',
          service: 'heart_rate',
          payloadBase64: base64([0x00, 99]),
          atMs: 1_000,
        },
      ],
      nowMs: 10_000,
      staleAfterMs: 5_000,
    });

    expect(result.snapshot.heartRateBpm.value).toBe(99);
    expect(result.snapshot.heartRateBpm.qualification).toBe('stale');
  });

  it('ne fabrique aucune mesure quand une trame est illisible', () => {
    const result = evaluateTelemetry({
      frames: [
        {
          deviceId: 'inconnu',
          service: 'heart_rate',
          payloadBase64: '!!!pas-du-base64!!!',
        },
      ],
      nowMs: 10_000,
    });

    expect(result.acceptedFrames).toBe(0);
    expect(result.rejectedFrames).toBe(1);
    expect(result.rejections[0]).toMatchObject({ reason: 'invalid_base64' });
    expect(result.snapshot.heartRateBpm).toMatchObject({
      value: null,
      qualification: 'unavailable',
    });
    expect(result.summary.avgHeartRateBpm).toBeNull();
  });

  it('rejette une trame base64 valide mais trop courte', () => {
    const result = evaluateTelemetry({
      frames: [
        { deviceId: 'rsc', service: 'running_sc', payloadBase64: base64([0x00]) },
      ],
      nowMs: 10_000,
    });

    expect(result.acceptedFrames).toBe(0);
    expect(result.rejections[0]).toMatchObject({ reason: 'undecodable_frame' });
  });

  it('décode une trame course et expose vitesse, cadence et foulée', () => {
    // flags 0x05 = foulée + course ; vitesse 256/256 = 1 m/s ; cadence 170 ;
    // foulée 120 cm = 1,20 m.
    const result = evaluateTelemetry({
      frames: [
        {
          deviceId: 'stryd',
          service: 'running_sc',
          payloadBase64: base64([0x05, 0x00, 0x01, 170, 120, 0]),
        },
      ],
      nowMs: 5_000,
    });

    expect(result.snapshot.runningSpeedMs.value).toBe(1);
    expect(result.snapshot.runningCadenceSpm.value).toBe(170);
    expect(result.snapshot.strideLengthM.value).toBeCloseTo(1.2, 5);
    expect(result.snapshot.cyclingPowerWatts.qualification).toBe('unavailable');
  });

  it('refuse un base64 non canonique', () => {
    expect(decodeBase64Frame('abc')).toBeNull();
    expect(decodeBase64Frame('****')).toBeNull();
  });
});
