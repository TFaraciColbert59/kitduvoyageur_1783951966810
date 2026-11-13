/**
 * Lot D02 (S6.06, S6.07) — qualification serveur de trames GATT réelles.
 *
 * Le serveur ne fabrique aucune mesure : il décode uniquement les octets
 * fournis, et laisse `QualifiedTelemetryStream` décider `measured` / `stale` /
 * `unavailable` selon l'horodatage réel de chaque trame.
 */
import { z } from 'zod';
import {
  QualifiedTelemetryStream,
  decodeCscMeasurement,
  decodeCyclingPowerMeasurement,
  decodeHeartRateMeasurement,
  decodeRscMeasurement,
} from '@/features/sensors';
import type {
  DecodedBleFrame,
  QualifiedTelemetrySnapshot,
  QualifiedTelemetrySummary,
  TelemetryMetricKey,
} from '@/features/sensors';

export const TELEMETRY_SERVICES = [
  'heart_rate',
  'cycling_sc',
  'cycling_power',
  'running_sc',
] as const;

export const telemetryFrameSchema = z.object({
  deviceId: z.string().trim().min(1).max(128),
  service: z.enum(TELEMETRY_SERVICES),
  /** Trame GATT brute, encodée en base64 (une caractéristique par entrée). */
  payloadBase64: z.string().trim().min(1).max(4096),
  atMs: z.number().int().nonnegative().max(4_102_444_800_000).optional(),
});

export const telemetryRequestSchema = z.object({
  frames: z.array(telemetryFrameSchema).min(1).max(500),
  nowMs: z.number().int().nonnegative().max(4_102_444_800_000).optional(),
  staleAfterMs: z.number().int().min(1).max(600_000).optional(),
  wheelCircumferenceMm: z.number().min(500).max(4_000).optional(),
});

export type TelemetryRequest = z.infer<typeof telemetryRequestSchema>;

export interface TelemetryFrameRejection {
  index: number;
  deviceId: string;
  service: (typeof TELEMETRY_SERVICES)[number];
  reason: 'invalid_base64' | 'undecodable_frame';
}

export interface TelemetryEvaluation {
  snapshot: QualifiedTelemetrySnapshot;
  summary: QualifiedTelemetrySummary;
  acceptedFrames: number;
  rejectedFrames: number;
  rejections: TelemetryFrameRejection[];
  metricKeys: readonly TelemetryMetricKey[];
}

const METRIC_KEYS: readonly TelemetryMetricKey[] = [
  'heartRateBpm',
  'cyclingSpeedMs',
  'cyclingCadenceRpm',
  'cyclingPowerWatts',
  'runningSpeedMs',
  'runningCadenceSpm',
  'strideLengthM',
];

/**
 * Décode une charge base64 stricte. Retourne `null` plutôt qu'une trame
 * partielle : une trame illisible ne doit jamais devenir une mesure.
 */
export function decodeBase64Frame(input: string): Uint8Array | null {
  const compact = input.replace(/\s+/g, '');
  if (compact.length === 0 || compact.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;

  try {
    const bytes = Uint8Array.from(Buffer.from(compact, 'base64'));
    return bytes.byteLength > 0 ? bytes : null;
  } catch {
    return null;
  }
}

function decodeFrame(
  service: (typeof TELEMETRY_SERVICES)[number],
  payload: Uint8Array,
): DecodedBleFrame | null {
  switch (service) {
    case 'heart_rate':
      return decodeHeartRateMeasurement(payload);
    case 'cycling_sc':
      return decodeCscMeasurement(payload);
    case 'cycling_power':
      return decodeCyclingPowerMeasurement(payload);
    case 'running_sc':
      return decodeRscMeasurement(payload);
  }
}

export function evaluateTelemetry(input: TelemetryRequest): TelemetryEvaluation {
  const nowMs = input.nowMs ?? Date.now();
  const stream = new QualifiedTelemetryStream({
    staleAfterMs: input.staleAfterMs,
    wheelCircumferenceMm: input.wheelCircumferenceMm,
  });

  const rejections: TelemetryFrameRejection[] = [];
  let acceptedFrames = 0;

  input.frames.forEach((frame, index) => {
    const bytes = decodeBase64Frame(frame.payloadBase64);
    if (!bytes) {
      rejections.push({
        index,
        deviceId: frame.deviceId,
        service: frame.service,
        reason: 'invalid_base64',
      });
      return;
    }

    const decoded = decodeFrame(frame.service, bytes);
    if (!decoded) {
      rejections.push({
        index,
        deviceId: frame.deviceId,
        service: frame.service,
        reason: 'undecodable_frame',
      });
      return;
    }

    stream.ingestFrame(frame.deviceId, decoded, frame.atMs ?? nowMs);
    acceptedFrames += 1;
  });

  return {
    snapshot: stream.getSnapshot(nowMs),
    summary: stream.getSummary(),
    acceptedFrames,
    rejectedFrames: rejections.length,
    rejections,
    metricKeys: METRIC_KEYS,
  };
}
