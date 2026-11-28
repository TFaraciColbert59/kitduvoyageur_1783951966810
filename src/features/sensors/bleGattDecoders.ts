import type {
  ComputedCscMetrics,
  DecodedCscFrame,
  DecodedCyclingPowerFrame,
  DecodedFtmsIndoorBikeFrame,
  DecodedFtmsRowerFrame,
  DecodedFtmsTreadmillFrame,
  DecodedHeartRateFrame,
  DecodedRscFrame,
  SensorContactStatus,
} from './types';

function toDataView(input: DataView | Uint8Array): DataView {
  if (input instanceof DataView) return input;
  return new DataView(input.buffer, input.byteOffset, input.byteLength);
}

/**
 * Décode la caractéristique GATT Heart Rate Measurement (0x2A37, service 0x180D).
 * Retourne `null` si la trame est tronquée ou invalide.
 */
export function decodeHeartRateMeasurement(
  input: DataView | Uint8Array,
): DecodedHeartRateFrame | null {
  const view = toDataView(input);
  if (view.byteLength < 2) return null;

  const flags = view.getUint8(0);
  const isUint16 = (flags & 0x01) !== 0;
  const contactBits = (flags >> 1) & 0x03;
  const hasEnergyExpended = (flags & 0x08) !== 0;
  const hasRrInterval = (flags & 0x10) !== 0;

  let contactStatus: SensorContactStatus = 'not_supported';
  if (contactBits === 2) contactStatus = 'no_contact';
  else if (contactBits === 3) contactStatus = 'contact_detected';

  let offset = 1;
  let heartRateBpm: number;
  if (isUint16) {
    if (offset + 2 > view.byteLength) return null;
    heartRateBpm = view.getUint16(offset, true);
    offset += 2;
  } else {
    if (offset + 1 > view.byteLength) return null;
    heartRateBpm = view.getUint8(offset);
    offset += 1;
  }

  let energyExpendedKj: number | null = null;
  if (hasEnergyExpended) {
    if (offset + 2 > view.byteLength) return null;
    energyExpendedKj = view.getUint16(offset, true);
    offset += 2;
  }

  const rrIntervalsMs: number[] = [];
  if (hasRrInterval) {
    if (offset + 2 > view.byteLength) return null;
    while (offset + 2 <= view.byteLength) {
      const rawRr = view.getUint16(offset, true);
      rrIntervalsMs.push(Math.round((rawRr * 1000) / 1024));
      offset += 2;
    }
  }

  return {
    kind: 'heart_rate',
    heartRateBpm,
    contactStatus,
    energyExpendedKj,
    rrIntervalsMs,
  };
}

/**
 * Décode la caractéristique GATT CSC Measurement (0x2A5B, service 0x1816).
 */
export function decodeCscMeasurement(input: DataView | Uint8Array): DecodedCscFrame | null {
  const view = toDataView(input);
  if (view.byteLength < 1) return null;

  const flags = view.getUint8(0);
  const hasWheel = (flags & 0x01) !== 0;
  const hasCrank = (flags & 0x02) !== 0;

  let offset = 1;
  let cumulativeWheelRevolutions: number | null = null;
  let lastWheelEventTime1024s: number | null = null;
  let cumulativeCrankRevolutions: number | null = null;
  let lastCrankEventTime1024s: number | null = null;

  if (hasWheel) {
    if (offset + 6 > view.byteLength) return null;
    cumulativeWheelRevolutions = view.getUint32(offset, true);
    lastWheelEventTime1024s = view.getUint16(offset + 4, true);
    offset += 6;
  }

  if (hasCrank) {
    if (offset + 4 > view.byteLength) return null;
    cumulativeCrankRevolutions = view.getUint16(offset, true);
    lastCrankEventTime1024s = view.getUint16(offset + 2, true);
  }

  return {
    kind: 'cycling_sc',
    cumulativeWheelRevolutions,
    lastWheelEventTime1024s,
    cumulativeCrankRevolutions,
    lastCrankEventTime1024s,
  };
}

/**
 * Calcule vitesse (m/s) et cadence (rpm) à partir de deux trames CSC consécutives.
 * Gère le wrap-around uint16/uint32 et ne retourne aucune valeur inventée si deltaT == 0.
 */
export function computeCscMetrics(
  prev: DecodedCscFrame,
  curr: DecodedCscFrame,
  wheelCircumferenceMm: number = 2105,
): ComputedCscMetrics {
  let speedMs: number | null = null;
  let cadenceRpm: number | null = null;

  if (
    prev.cumulativeWheelRevolutions !== null &&
    curr.cumulativeWheelRevolutions !== null &&
    prev.lastWheelEventTime1024s !== null &&
    curr.lastWheelEventTime1024s !== null &&
    wheelCircumferenceMm > 0
  ) {
    const deltaTimeTicks = (curr.lastWheelEventTime1024s - prev.lastWheelEventTime1024s + 65536) % 65536;
    const deltaRevs =
      curr.cumulativeWheelRevolutions >= prev.cumulativeWheelRevolutions
        ? curr.cumulativeWheelRevolutions - prev.cumulativeWheelRevolutions
        : 0x1_0000_0000 - prev.cumulativeWheelRevolutions + curr.cumulativeWheelRevolutions;

    if (deltaTimeTicks > 0) {
      const deltaTimeS = deltaTimeTicks / 1024;
      const distanceM = (deltaRevs * wheelCircumferenceMm) / 1000;
      speedMs = distanceM / deltaTimeS;
    }
  }

  if (
    prev.cumulativeCrankRevolutions !== null &&
    curr.cumulativeCrankRevolutions !== null &&
    prev.lastCrankEventTime1024s !== null &&
    curr.lastCrankEventTime1024s !== null
  ) {
    const deltaTimeTicks = (curr.lastCrankEventTime1024s - prev.lastCrankEventTime1024s + 65536) % 65536;
    const deltaRevs = (curr.cumulativeCrankRevolutions - prev.cumulativeCrankRevolutions + 65536) % 65536;

    if (deltaTimeTicks > 0) {
      const deltaTimeMin = deltaTimeTicks / 1024 / 60;
      cadenceRpm = deltaRevs / deltaTimeMin;
    }
  }

  return { speedMs, cadenceRpm };
}

/**
 * Décode la caractéristique GATT Cycling Power Measurement (0x2A63, service 0x1818).
 */
export function decodeCyclingPowerMeasurement(
  input: DataView | Uint8Array,
): DecodedCyclingPowerFrame | null {
  const view = toDataView(input);
  if (view.byteLength < 4) return null;

  const flags = view.getUint16(0, true);
  const instantaneousPowerWatts = view.getInt16(2, true);
  let offset = 4;

  let pedalPowerBalancePercent: number | null = null;
  if ((flags & 0x0001) !== 0) {
    if (offset + 1 > view.byteLength) return null;
    pedalPowerBalancePercent = view.getUint8(offset) * 0.5;
    offset += 1;
  }

  let accumulatedTorqueNm: number | null = null;
  if ((flags & 0x0004) !== 0) {
    if (offset + 2 > view.byteLength) return null;
    accumulatedTorqueNm = view.getUint16(offset, true) / 32;
    offset += 2;
  }

  let cumulativeWheelRevolutions: number | null = null;
  let lastWheelEventTime1024s: number | null = null;
  if ((flags & 0x0010) !== 0) {
    if (offset + 6 > view.byteLength) return null;
    cumulativeWheelRevolutions = view.getUint32(offset, true);
    lastWheelEventTime1024s = view.getUint16(offset + 4, true);
    offset += 6;
  }

  let cumulativeCrankRevolutions: number | null = null;
  let lastCrankEventTime1024s: number | null = null;
  if ((flags & 0x0020) !== 0) {
    if (offset + 4 > view.byteLength) return null;
    cumulativeCrankRevolutions = view.getUint16(offset, true);
    lastCrankEventTime1024s = view.getUint16(offset + 2, true);
  }

  return {
    kind: 'cycling_power',
    instantaneousPowerWatts,
    pedalPowerBalancePercent,
    accumulatedTorqueNm,
    cumulativeWheelRevolutions,
    lastWheelEventTime1024s,
    cumulativeCrankRevolutions,
    lastCrankEventTime1024s,
  };
}

/**
 * Décode la caractéristique GATT Running Speed & Cadence Measurement (0x2A53, service 0x1814).
 */
export function decodeRscMeasurement(input: DataView | Uint8Array): DecodedRscFrame | null {
  const view = toDataView(input);
  if (view.byteLength < 4) return null;

  const flags = view.getUint8(0);
  const hasStrideLength = (flags & 0x01) !== 0;
  const hasTotalDistance = (flags & 0x02) !== 0;
  const isRunning = (flags & 0x04) !== 0;

  const instantaneousSpeedMs = view.getUint16(1, true) / 256;
  const instantaneousCadenceSpm = view.getUint8(3);
  let offset = 4;

  let strideLengthM: number | null = null;
  if (hasStrideLength) {
    if (offset + 2 > view.byteLength) return null;
    strideLengthM = view.getUint16(offset, true) / 100;
    offset += 2;
  }

  let totalDistanceM: number | null = null;
  if (hasTotalDistance) {
    if (offset + 4 > view.byteLength) return null;
    totalDistanceM = view.getUint32(offset, true) / 10;
  }

  return {
    kind: 'running_sc',
    instantaneousSpeedMs,
    instantaneousCadenceSpm,
    strideLengthM,
    totalDistanceM,
    isRunning,
  };
}

/**
 * Décode la caractéristique GATT Battery Level (0x2A19, service 0x180F).
 */
export function decodeBatteryLevel(input: DataView | Uint8Array): number | null {
  const view = toDataView(input);
  if (view.byteLength < 1) return null;
  const level = view.getUint8(0);
  if (level > 100) return null;
  return level;
}

/**
 * Décode FTMS Indoor Bike Data (0x2AD2, service 0x1826).
 */
export function decodeFtmsIndoorBikeData(
  input: DataView | Uint8Array,
): DecodedFtmsIndoorBikeFrame | null {
  const view = toDataView(input);
  if (view.byteLength < 2) return null;
  const flags = view.getUint16(0, true);
  let offset = 2;

  let instantaneousSpeedKmh: number | null = null;
  if ((flags & 0x0001) === 0) {
    if (offset + 2 > view.byteLength) return null;
    instantaneousSpeedKmh = view.getUint16(offset, true) / 100;
    offset += 2;
  }
  if ((flags & 0x0002) !== 0) offset += 2; // Avg Speed

  let instantaneousCadenceRpm: number | null = null;
  if ((flags & 0x0004) !== 0) {
    if (offset + 2 > view.byteLength) return null;
    instantaneousCadenceRpm = view.getUint16(offset, true) * 0.5;
    offset += 2;
  }
  if ((flags & 0x0008) !== 0) offset += 2; // Avg Cadence
  if ((flags & 0x0010) !== 0) offset += 3; // Total Distance uint24
  if ((flags & 0x0020) !== 0) offset += 2; // Resistance Level sint16

  let instantaneousPowerWatts: number | null = null;
  if ((flags & 0x0040) !== 0) {
    if (offset + 2 > view.byteLength) return null;
    instantaneousPowerWatts = view.getInt16(offset, true);
    offset += 2;
  }
  if ((flags & 0x0080) !== 0) offset += 2; // Avg Power
  if ((flags & 0x0100) !== 0) offset += 5; // Expended Energy

  let heartRateBpm: number | null = null;
  if ((flags & 0x0200) !== 0 && offset + 1 <= view.byteLength) {
    heartRateBpm = view.getUint8(offset);
  }

  return {
    kind: 'ftms_indoor_bike',
    instantaneousSpeedKmh,
    instantaneousCadenceRpm,
    instantaneousPowerWatts,
    heartRateBpm,
  };
}

/**
 * Décode FTMS Treadmill Data (0x2ACD, service 0x1826).
 */
export function decodeFtmsTreadmillData(
  input: DataView | Uint8Array,
): DecodedFtmsTreadmillFrame | null {
  const view = toDataView(input);
  if (view.byteLength < 2) return null;
  const flags = view.getUint16(0, true);
  let offset = 2;

  let instantaneousSpeedKmh: number | null = null;
  if ((flags & 0x0001) === 0) {
    if (offset + 2 > view.byteLength) return null;
    instantaneousSpeedKmh = view.getUint16(offset, true) / 100;
    offset += 2;
  }
  if ((flags & 0x0002) !== 0) offset += 2; // Avg Speed

  let totalDistanceM: number | null = null;
  if ((flags & 0x0004) !== 0) {
    if (offset + 3 > view.byteLength) return null;
    totalDistanceM =
      view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
    offset += 3;
  }

  let inclinePct: number | null = null;
  if ((flags & 0x0008) !== 0) {
    if (offset + 4 > view.byteLength) return null;
    inclinePct = view.getInt16(offset, true) / 10;
  }

  return {
    kind: 'ftms_treadmill',
    instantaneousSpeedKmh,
    inclinePct,
    totalDistanceM,
  };
}

/**
 * Décode FTMS Rower Data (0x2AD1, service 0x1826 — Concept2 PM5 / WaterRower).
 */
export function decodeFtmsRowerData(
  input: DataView | Uint8Array,
): DecodedFtmsRowerFrame | null {
  const view = toDataView(input);
  if (view.byteLength < 2) return null;
  const flags = view.getUint16(0, true);
  let offset = 2;

  let strokeRateSpm: number | null = null;
  let strokeCount: number | null = null;
  if ((flags & 0x0001) === 0) {
    if (offset + 3 > view.byteLength) return null;
    strokeRateSpm = view.getUint8(offset) * 0.5;
    strokeCount = view.getUint16(offset + 1, true);
    offset += 3;
  }
  if ((flags & 0x0002) !== 0) offset += 1; // Avg Stroke Rate
  if ((flags & 0x0004) !== 0) offset += 3; // Total Distance uint24

  let instantaneousPaceSec500m: number | null = null;
  if ((flags & 0x0008) !== 0) {
    if (offset + 2 > view.byteLength) return null;
    instantaneousPaceSec500m = view.getUint16(offset, true);
    offset += 2;
  }
  if ((flags & 0x0010) !== 0) offset += 2; // Avg Pace

  let instantaneousPowerWatts: number | null = null;
  if ((flags & 0x0020) !== 0) {
    if (offset + 2 > view.byteLength) return null;
    instantaneousPowerWatts = view.getInt16(offset, true);
  }

  return {
    kind: 'ftms_rower',
    strokeRateSpm,
    strokeCount,
    instantaneousPaceSec500m,
    instantaneousPowerWatts,
  };
}

/**
 * Encode une commande FTMS Control Point (0x2AD9) : Set Target Power (OpCode 0x05)
 * pour piloter un home-trainer en mode ERG (Lot 11 / V3).
 */
export function encodeFtmsSetTargetPowerErg(targetWatts: number): Uint8Array {
  const clamped = Math.max(0, Math.min(2000, Math.round(targetWatts)));
  const buf = new Uint8Array(3);
  const view = new DataView(buf.buffer);
  view.setUint8(0, 0x05); // OpCode Set Target Power
  view.setInt16(1, clamped, true);
  return buf;
}
