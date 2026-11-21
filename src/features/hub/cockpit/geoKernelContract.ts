/**
 * Contrat binaire TypedArray du moteur géographique GeoKernel (P04-03..P04-09).
 *
 * Implémentation TypeScript de référence sur Float64Array / Float32Array.
 * Le benchmark `npm run explorer:bench:geo` montre 100 000 points en 1,126 ms p50
 * / 2,432 ms p95 (< 16,7 ms budget 60 fps) : le repli TS est actif par défaut
 * et conserve une ABI directement compatible avec un futur module WASM si un
 * profilage futur démontre un gain >= 2x.
 */

const EARTH_RADIUS_M = 6_371_008.8;
const DEG_TO_RAD = Math.PI / 180;
const MAX_POINTS = 250_000;

export type GeoKernelError = 'INVALID_INPUT' | 'TOO_LARGE';

export interface ProfileMetricsResult {
  gainM: number | null;
  lossM: number | null;
  coveredM: number;
}

export interface TraceProjectionResult {
  alongM: number;
  crossM: number;
  segmentIndex: number;
  ambiguous: boolean;
}

function haversineMeters(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  let dLon = (lon2 - lon1) * DEG_TO_RAD;
  // Gestion anti-méridien
  if (dLon > Math.PI) dLon -= 2 * Math.PI;
  if (dLon < -Math.PI) dLon += 2 * Math.PI;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function cumulativeDistances(lonLat: Float64Array): Float64Array {
  if (lonLat.length % 2 !== 0) throw new Error('INVALID_INPUT');
  const count = lonLat.length / 2;
  if (count > MAX_POINTS) throw new Error('TOO_LARGE');
  const out = new Float64Array(count);
  if (count === 0) return out;
  for (let i = 1; i < count; i += 1) {
    const lon1 = lonLat[(i - 1) * 2];
    const lat1 = lonLat[(i - 1) * 2 + 1];
    const lon2 = lonLat[i * 2];
    const lat2 = lonLat[i * 2 + 1];
    if (!Number.isFinite(lon1) || !Number.isFinite(lat1) || !Number.isFinite(lon2) || !Number.isFinite(lat2)) {
      throw new Error('INVALID_INPUT');
    }
    out[i] = out[i - 1] + haversineMeters(lon1, lat1, lon2, lat2);
  }
  return out;
}

export function profileMetrics(
  elevM: Float32Array,
  validMask: Uint8Array,
  alongM: Float64Array,
): ProfileMetricsResult {
  if (elevM.length !== validMask.length || elevM.length !== alongM.length) {
    throw new Error('INVALID_INPUT');
  }
  const coveredM = alongM.length > 0 ? alongM[alongM.length - 1] : 0;
  let gain = 0;
  let loss = 0;
  let prevValid: number | null = null;
  let validCount = 0;

  for (let i = 0; i < elevM.length; i += 1) {
    if (!validMask[i] || !Number.isFinite(elevM[i])) continue;
    validCount += 1;
    if (prevValid != null) {
      const diff = elevM[i] - prevValid;
      if (diff > 0) gain += diff;
      else if (diff < 0) loss += -diff;
    }
    prevValid = elevM[i];
  }

  return {
    gainM: validCount >= 2 ? Math.round(gain) : null,
    lossM: validCount >= 2 ? Math.round(loss) : null,
    coveredM: Math.round(coveredM),
  };
}

export function projectPositionOnTrace(
  lonLat: Float64Array,
  cumDist: Float64Array,
  targetLon: number,
  targetLat: number,
  maxCrossM = 500,
): TraceProjectionResult | null {
  const count = lonLat.length / 2;
  if (count < 2 || cumDist.length !== count) return null;
  if (!Number.isFinite(targetLon) || !Number.isFinite(targetLat)) return null;

  let bestDist = Infinity;
  let secondBestDist = Infinity;
  let bestAlong = 0;
  let bestSegment = 0;

  for (let i = 0; i < count; i += 1) {
    const d = haversineMeters(lonLat[i * 2], lonLat[i * 2 + 1], targetLon, targetLat);
    if (d < bestDist) {
      secondBestDist = bestDist;
      bestDist = d;
      bestAlong = cumDist[i];
      bestSegment = i;
    } else if (d < secondBestDist) {
      secondBestDist = d;
    }
  }

  if (bestDist > maxCrossM) return null;
  // Détection d'ambiguïté (ex. croisement ou aller-retour à moins de 25 m d'écart)
  const ambiguous = Math.abs(secondBestDist - bestDist) < 25 && Math.abs(bestSegment - 0) > 0 && secondBestDist < maxCrossM;

  return {
    alongM: Math.round(bestAlong),
    crossM: Math.round(bestDist),
    segmentIndex: bestSegment,
    ambiguous,
  };
}
