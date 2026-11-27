/**
 * Pure TypeScript 1:1 parity mirror of `crates/lkdv-route-core` (Rust/WASM).
 *
 * Serves two critical purposes:
 * 1. Seamless zero-downtime fallback if WebAssembly is unavailable or blocked.
 * 2. Differential parity oracle in Vitest to guarantee Rust/WASM & TS agree identically
 *    on Silent Fail-Safe edge gating, biomechanical edge costs, and Admissible Alternatives.
 */

import {
  EDGE_FLAG_CYCLEWAY,
  EDGE_FLAG_EXPOSED_RIDGE,
  EDGE_FLAG_FERRY,
  EDGE_FLAG_FORD,
  EDGE_FLAG_FOREST_COVER,
  EDGE_FLAG_GLACIER_SNOW,
  EDGE_FLAG_ROAD_TRAFFIC,
  EDGE_FLAG_STEPS,
  EDGE_FLAG_VIA_FERRATA,
  EDGE_FLAG_WATERWAY,
  HAZARD_FLAG_AVALANCHE_SLOPE,
  HAZARD_FLAG_FIRE,
  HAZARD_FLAG_FLOOD,
  HAZARD_FLAG_REPORT_BLOCKED,
  SURFACE_DIRT_TRAIL,
  SURFACE_GRASS_FOREST,
  SURFACE_GRAVEL,
  SURFACE_PAVED,
  SURFACE_ROCK_SCREE,
  SURFACE_SNOW_ICE,
  SURFACE_WATER,
  type CompactCorridorGraph,
  type CompactGraphEdge,
  type CompactGraphNode,
} from './types';

export const MODE_RANDO = 0;
export const MODE_TRAIL = 1;
export const MODE_VELO = 2;
export const MODE_GRAVEL = 3;
export const MODE_VTT = 4;
export const MODE_VAE = 5;
export const MODE_SKI = 6;
export const MODE_RAQUETTES = 7;
export const MODE_KAYAK = 8;

export const CAP_FLAG_NAUTICAL_PROVEN = 1 << 0;
export const CAP_FLAG_VIA_FERRATA_OK = 1 << 1;
export const CAP_FLAG_WINTER_AVALANCHE_TRAINED = 1 << 2;
export const CAP_FLAG_HAS_CRAMPONS = 1 << 3;
export const CAP_FLAG_HAS_HEADLAMP = 1 << 4;
export const CAP_FLAG_HAS_RAIN_SHELL = 1 << 5;
export const CAP_FLAG_HAS_THERMAL = 1 << 6;
export const CAP_FLAG_HAS_EBIKE = 1 << 7;
export const CAP_FLAG_HAS_WATER_FILTER = 1 << 8;

export const ENV_FLAG_THUNDERSTORM = 1 << 0;
export const ENV_FLAG_FLOOD_ALERT = 1 << 1;
export const ENV_FLAG_NIGHT_OVERLAP = 1 << 2;

export const POI_FLAG_WATER = 1 << 0;
export const POI_FLAG_SHELTER = 1 << 1;

export interface KernelRoutingParams {
  modeCode: number;
  priorityCode: number;
  mobilityCode: number;
  capFlags: number;
  sacMaxGrade: number;
  mtbMaxGrade: number;
  wwMaxGrade: number;
  avalancheBra: number;
  envFlags: number;
  bodyWeightKg: number;
  packWeightKg: number;
  flatSpeedKmh: number;
  ascentMPerH: number;
  speedPercentile: number;
  vo2max: number;
  readinessScore: number;
  acclimCeilingM: number;
  windKmh: number;
  ridgeWindKmh: number;
  precipMmH: number;
  snowDepthCm: number;
  freezingLevelM: number;
  tempC: number;
}

export interface KernelComputedRoute {
  roleCode: number; // 0=recommended, 1=safer, 2=gentler, 3=faster
  distanceM: number;
  dplusM: number;
  dminusM: number;
  durationSec: number;
  baseDurationSec: number;
  packDeltaSec: number;
  altitudeDeltaSec: number;
  weatherDeltaSec: number;
  fatigueDeltaSec: number;
  kcal: number;
  maxSlopeDeg: number;
  exposed30M: number;
  pavedM: number;
  gravelM: number;
  trailM: number;
  technicalM: number;
  maxSacGrade: number;
  waterPts: number;
  shelters: number;
  overlapRatio: number;
  nodePath: number[];
  edgeIndices: number[];
}

interface ObjectiveWeights {
  timeW: number;
  energyW: number;
  safetyW: number;
  comfortW: number;
}

function objectiveWeightsForRole(role: number, userPriority: number): ObjectiveWeights {
  if (role === 1) return { timeW: 0.70, energyW: 0.25, safetyW: 3.40, comfortW: 0.65 };
  if (role === 2) return { timeW: 0.65, energyW: 2.30, safetyW: 1.15, comfortW: 1.25 };
  if (role === 3) return { timeW: 1.45, energyW: 0.15, safetyW: 0.60, comfortW: 0.10 };
  if (userPriority === 1) return { timeW: 0.85, energyW: 0.45, safetyW: 2.20, comfortW: 0.55 };
  if (userPriority === 2) return { timeW: 0.85, energyW: 1.45, safetyW: 1.10, comfortW: 0.90 };
  if (userPriority === 3) return { timeW: 1.25, energyW: 0.35, safetyW: 0.90, comfortW: 0.20 };
  return { timeW: 1.00, energyW: 0.65, safetyW: 1.35, comfortW: 0.45 };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat * 0.5) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon * 0.5) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function isEdgeAllowedTs(
  edge: CompactGraphEdge,
  toNode: CompactGraphNode,
  p: KernelRoutingParams,
): boolean {
  if ((edge.hazardFlags & HAZARD_FLAG_FIRE) !== 0) return false;
  if ((edge.hazardFlags & HAZARD_FLAG_REPORT_BLOCKED) !== 0) return false;

  const isWaterway = (edge.flags & EDGE_FLAG_WATERWAY) !== 0 || edge.surface === SURFACE_WATER;
  const isFerry = (edge.flags & EDGE_FLAG_FERRY) !== 0;
  const isFord = (edge.flags & EDGE_FLAG_FORD) !== 0;
  const isSteps = (edge.flags & EDGE_FLAG_STEPS) !== 0;
  const isViaFerrata = (edge.flags & EDGE_FLAG_VIA_FERRATA) !== 0;
  const isGlacier = (edge.flags & EDGE_FLAG_GLACIER_SNOW) !== 0;

  if (isWaterway) {
    if (p.modeCode !== MODE_KAYAK) return false;
    if ((p.capFlags & CAP_FLAG_NAUTICAL_PROVEN) === 0) return false;
    if ((p.envFlags & ENV_FLAG_FLOOD_ALERT) !== 0 || (edge.hazardFlags & HAZARD_FLAG_FLOOD) !== 0) {
      return false;
    }
    if (edge.wwGrade > p.wwMaxGrade) return false;
    return true;
  }

  if (p.modeCode === MODE_KAYAK && (edge.flags & EDGE_FLAG_ROAD_TRAFFIC) !== 0) return false;
  if (isFerry) return false;

  if (isFord) {
    if (
      (p.envFlags & ENV_FLAG_FLOOD_ALERT) !== 0 ||
      (edge.hazardFlags & HAZARD_FLAG_FLOOD) !== 0 ||
      p.mobilityCode === 3 ||
      p.mobilityCode === 1
    ) {
      return false;
    }
  }

  if (isViaFerrata && (p.capFlags & CAP_FLAG_VIA_FERRATA_OK) === 0) return false;
  if (isGlacier && (p.capFlags & CAP_FLAG_HAS_CRAMPONS) === 0) return false;

  if (p.mobilityCode === 3) {
    if (isSteps || edge.maxSlopeDeg > 8.5) return false;
    if (edge.surface !== SURFACE_PAVED && edge.surface !== SURFACE_GRAVEL) return false;
    if (edge.sacGrade > 1) return false;
  }

  if (
    p.modeCode === MODE_RANDO ||
    p.modeCode === MODE_TRAIL ||
    p.modeCode === MODE_SKI ||
    p.modeCode === MODE_RAQUETTES
  ) {
    if (edge.sacGrade > p.sacMaxGrade) return false;
  }

  if (
    p.modeCode === MODE_VELO ||
    p.modeCode === MODE_GRAVEL ||
    p.modeCode === MODE_VTT ||
    p.modeCode === MODE_VAE
  ) {
    if (isSteps || isViaFerrata || edge.mtbGrade === 255) return false;
    if (
      p.modeCode === MODE_VELO &&
      edge.surface !== SURFACE_PAVED &&
      (edge.flags & EDGE_FLAG_CYCLEWAY) === 0
    ) {
      return false;
    }
    if (
      p.modeCode === MODE_GRAVEL &&
      (edge.surface === SURFACE_ROCK_SCREE || edge.surface === SURFACE_SNOW_ICE)
    ) {
      return false;
    }
    if (edge.mtbGrade > p.mtbMaxGrade) return false;
  }

  const snowyTerrain =
    p.snowDepthCm >= 15.0 ||
    (p.freezingLevelM > 0.0 && toNode.eleM >= p.freezingLevelM && p.precipMmH > 0.1) ||
    (edge.hazardFlags & HAZARD_FLAG_AVALANCHE_SLOPE) !== 0;

  if (snowyTerrain && edge.maxSlopeDeg >= 30.0) {
    const avyOk = (p.capFlags & CAP_FLAG_WINTER_AVALANCHE_TRAINED) !== 0;
    if (!avyOk || p.avalancheBra >= 4) return false;
  }

  return true;
}

function minettiWalkJKgM(grade: number): number {
  const i = clamp(grade, -0.45, 0.45);
  const i2 = i * i;
  const i3 = i2 * i;
  const i4 = i2 * i2;
  const i5 = i4 * i;
  return Math.max(0.8, 280.5 * i5 - 58.7 * i4 - 76.8 * i3 + 51.9 * i2 + 19.6 * i + 2.5);
}

function minettiRunJKgM(grade: number): number {
  const i = clamp(grade, -0.45, 0.45);
  const i2 = i * i;
  const i3 = i2 * i;
  const i4 = i2 * i2;
  const i5 = i4 * i;
  return Math.max(1.7, 155.4 * i5 - 30.4 * i4 - 43.3 * i3 + 46.3 * i2 + 19.5 * i + 3.6);
}

function surfaceEta(surface: number): number {
  switch (surface) {
    case SURFACE_PAVED:
      return 1.00;
    case SURFACE_DIRT_TRAIL:
      return 1.12;
    case SURFACE_GRAVEL:
      return 1.16;
    case SURFACE_GRASS_FOREST:
      return 1.18;
    case SURFACE_ROCK_SCREE:
      return 1.50;
    case SURFACE_SNOW_ICE:
      return 1.85;
    case SURFACE_WATER:
      return 1.10;
    default:
      return 1.15;
  }
}

function campbellWalkSpeedMps(gradeDeg: number, flatSpeedKmh: number, percentile: number): number {
  const shifted = gradeDeg + 1.53;
  const lorentz = 1.0 / (1.0 + (shifted / 16.5) ** 2);
  const pFactor = 0.86 + (clamp(percentile, 5.0, 95.0) / 100.0) * 0.28;
  const flatMps = (clamp(flatSpeedKmh, 2.2, 7.5) / 3.6) * (0.5 + 0.5 * pFactor);
  const steepDownBrake = gradeDeg < -12.0 ? 1.0 / (1.0 + (-gradeDeg - 12.0) * 0.035) : 1.0;
  return Math.max(0.22, flatMps * (0.28 + 0.72 * lorentz) * steepDownBrake);
}

interface EdgeEval {
  totalCost: number;
  durationSec: number;
  baseDurationSec: number;
  packDeltaSec: number;
  altitudeDeltaSec: number;
  weatherDeltaSec: number;
  fatigueDeltaSec: number;
  kcal: number;
}

function evaluateEdgeTs(
  edge: CompactGraphEdge,
  fromNode: CompactGraphNode,
  toNode: CompactGraphNode,
  p: KernelRoutingParams,
  weights: ObjectiveWeights,
  edgePenalty: number,
): EdgeEval {
  const distM = Math.max(1.0, edge.lengthM);
  const dplus = Math.max(0.0, edge.dplusM);
  const dminus = Math.max(0.0, edge.dminusM);
  const netGrade = (dplus - dminus) / distM;
  const gradeDeg = (Math.atan(netGrade) * 180) / Math.PI;
  const meanEle = (fromNode.eleM + toNode.eleM) * 0.5;
  const eta = surfaceEta(edge.surface);

  let baseSpeedMps = 1.1;
  switch (p.modeCode) {
    case MODE_TRAIL:
      baseSpeedMps = campbellWalkSpeedMps(gradeDeg, p.flatSpeedKmh * 1.48, p.speedPercentile);
      break;
    case MODE_VELO: {
      const flat = 6.4;
      baseSpeedMps =
        netGrade > 0.01
          ? Math.max(1.5, flat / (1.0 + netGrade * 18.0))
          : Math.min(11.5, flat * (1.0 + Math.min(0.08, -netGrade) * 4.0));
      break;
    }
    case MODE_GRAVEL: {
      const flat = 5.4 / Math.sqrt(eta);
      baseSpeedMps =
        netGrade > 0.01
          ? Math.max(1.3, flat / (1.0 + netGrade * 19.0))
          : Math.min(9.5, flat * (1.0 + Math.min(0.08, -netGrade) * 3.0));
      break;
    }
    case MODE_VTT: {
      const flat = 4.4 / Math.sqrt(eta);
      baseSpeedMps =
        netGrade > 0.01
          ? Math.max(1.1, flat / (1.0 + netGrade * 20.0))
          : Math.min(8.5, flat * (1.0 + Math.min(0.10, -netGrade) * 2.5));
      break;
    }
    case MODE_VAE: {
      const flat = 5.8 / Math.sqrt(eta);
      baseSpeedMps =
        netGrade > 0.01
          ? Math.max(2.6, flat / (1.0 + netGrade * 9.5))
          : Math.min(9.0, flat * 1.15);
      break;
    }
    case MODE_SKI: {
      if (netGrade > 0.02) {
        const vamMps = clamp(p.ascentMPerH, 220.0, 1100.0) / 3600.0;
        baseSpeedMps = clamp(vamMps / Math.max(0.03, netGrade), 0.45, 1.35);
      } else if (netGrade < -0.04) {
        baseSpeedMps = 4.2;
      } else {
        baseSpeedMps = 1.3;
      }
      break;
    }
    case MODE_RAQUETTES:
      baseSpeedMps = campbellWalkSpeedMps(gradeDeg, p.flatSpeedKmh * 0.78, p.speedPercentile);
      break;
    case MODE_KAYAK:
      baseSpeedMps = 1.55;
      break;
    default: {
      const techMult =
        edge.sacGrade <= 1
          ? 1.00
          : edge.sacGrade === 2
            ? 0.94
            : edge.sacGrade === 3
              ? 0.84
              : edge.sacGrade === 4
                ? 0.74
                : edge.sacGrade === 5
                  ? 0.64
                  : 0.56;
      baseSpeedMps =
        (campbellWalkSpeedMps(gradeDeg, p.flatSpeedKmh, p.speedPercentile) / Math.pow(eta, 0.45)) *
        techMult;
      break;
    }
  }

  const baseDurationSec = distM / Math.max(0.2, baseSpeedMps);

  const bodyKg = clamp(p.bodyWeightKg, 35.0, 180.0);
  const packKg = clamp(p.packWeightKg, 0.0, 35.0);
  const loadRatio = packKg / bodyKg;
  const uphillAmp = netGrade > 0.02 ? 1.35 : 0.65;
  const packMult =
    p.modeCode === MODE_VELO || p.modeCode === MODE_VAE || p.modeCode === MODE_KAYAK
      ? 1.0 + loadRatio * 0.35
      : 1.0 + loadRatio * 1.15 * uphillAmp;
  const packDeltaSec = baseDurationSec * (packMult - 1.0);

  const effectiveAltM = Math.max(0.0, meanEle - Math.max(1500.0, p.acclimCeilingM));
  const altitudeDeltaSec = baseDurationSec * ((effectiveAltM / 100.0) * 0.011);

  const exposedRidge = (edge.flags & EDGE_FLAG_EXPOSED_RIDGE) !== 0;
  const forestCover = (edge.flags & EDGE_FLAG_FOREST_COVER) !== 0;
  const localWind = exposedRidge
    ? p.ridgeWindKmh
    : forestCover
      ? p.windKmh * 0.45
      : p.windKmh;
  const windSlowdown = localWind > 25.0 ? Math.min(0.45, (localWind - 25.0) * 0.006) : 0.0;
  const precipSlowdown =
    p.precipMmH > 0.5
      ? Math.min(
          0.28,
          Math.min(12.0, p.precipMmH) *
            0.015 *
            ((p.capFlags & CAP_FLAG_HAS_RAIN_SHELL) === 0 ? 1.45 : 1.0),
        )
      : 0.0;
  const weatherDeltaSec = baseDurationSec * (windSlowdown + precipSlowdown);

  const fatigueSlowdown =
    p.readinessScore >= 0.0 && p.readinessScore < 65.0
      ? ((65.0 - p.readinessScore) / 65.0) * 0.22
      : 0.0;
  const fatigueDeltaSec = baseDurationSec * fatigueSlowdown;

  const durationSec =
    baseDurationSec + packDeltaSec + altitudeDeltaSec + weatherDeltaSec + fatigueDeltaSec;

  const jKgM = p.modeCode === MODE_TRAIL ? minettiRunJKgM(netGrade) : minettiWalkJKgM(netGrade);
  const totalMass = bodyKg + packKg;
  const modeEnergyScale =
    p.modeCode === MODE_VELO || p.modeCode === MODE_GRAVEL
      ? 0.34
      : p.modeCode === MODE_VTT
        ? 0.46
        : p.modeCode === MODE_VAE
          ? 0.22
          : p.modeCode === MODE_KAYAK
            ? 0.55
            : 1.0;
  const kcal = (jKgM * eta * totalMass * distM * modeEnergyScale) / 4184.0;

  let safetyRiskSec = 0.0;
  if ((p.envFlags & ENV_FLAG_THUNDERSTORM) !== 0 && exposedRidge) {
    safetyRiskSec += distM * 1.4;
  }
  if (localWind > 40.0 && exposedRidge) {
    safetyRiskSec += distM * 0.55;
  }
  if (edge.maxSlopeDeg >= 30.0) {
    safetyRiskSec += distM * (0.25 + p.avalancheBra * 0.30);
  }
  if (
    (edge.flags & EDGE_FLAG_ROAD_TRAFFIC) !== 0 &&
    (p.modeCode === MODE_RANDO || p.modeCode === MODE_TRAIL)
  ) {
    safetyRiskSec += distM * 0.35;
  }
  if ((edge.flags & EDGE_FLAG_FORD) !== 0) {
    safetyRiskSec += 180.0;
  }
  if (forestCover && (p.precipMmH > 1.0 || localWind > 30.0 || p.tempC > 28.0)) {
    safetyRiskSec -= Math.min(distM * 0.08, durationSec * 0.15);
  }

  const comfortPenaltySec =
    edge.surface === SURFACE_ROCK_SCREE
      ? distM * 0.18
      : (edge.flags & EDGE_FLAG_STEPS) !== 0
        ? distM * 0.12
        : 0.0;

  const energyEquivSec = kcal * 9.5;
  const rawCost =
    weights.timeW * durationSec +
    weights.energyW * energyEquivSec +
    weights.safetyW * safetyRiskSec +
    weights.comfortW * comfortPenaltySec;

  const minAdmissibleCost = distM / 18.0;
  const totalCost = Math.max(minAdmissibleCost, rawCost) * Math.max(1.0, edgePenalty);

  return {
    totalCost,
    durationSec,
    baseDurationSec,
    packDeltaSec,
    altitudeDeltaSec,
    weatherDeltaSec,
    fatigueDeltaSec,
    kcal,
  };
}

class MinHeap {
  private items: Array<{ f: number; g: number; node: number }> = [];

  push(item: { f: number; g: number; node: number }): void {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.items[i]!, this.items[parent]!) < 0) {
        const tmp = this.items[i]!;
        this.items[i] = this.items[parent]!;
        this.items[parent] = tmp;
        i = parent;
      } else {
        break;
      }
    }
  }

  pop(): { f: number; g: number; node: number } | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0]!;
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      const len = this.items.length;
      while (true) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < len && this.compare(this.items[left]!, this.items[smallest]!) < 0) {
          smallest = left;
        }
        if (right < len && this.compare(this.items[right]!, this.items[smallest]!) < 0) {
          smallest = right;
        }
        if (smallest !== i) {
          const tmp = this.items[i]!;
          this.items[i] = this.items[smallest]!;
          this.items[smallest] = tmp;
          i = smallest;
        } else {
          break;
        }
      }
    }
    return top;
  }

  private compare(a: { f: number; g: number }, b: { f: number; g: number }): number {
    if (a.f !== b.f) return a.f - b.f;
    return a.g - b.g;
  }
}

function buildAdjacency(graph: CompactCorridorGraph): number[][] {
  const n = graph.nodes.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < graph.edges.length; i++) {
    const e = graph.edges[i]!;
    if (e.from >= 0 && e.from < n && e.to >= 0 && e.to < n) {
      adj[e.from]!.push(i);
    }
  }
  return adj;
}

function runAstarTs(
  graph: CompactCorridorGraph,
  adj: number[][],
  start: number,
  goal: number,
  params: KernelRoutingParams,
  roleCode: number,
  penalties?: Float64Array,
): KernelComputedRoute | null {
  const n = graph.nodes.length;
  if (start < 0 || start >= n || goal < 0 || goal >= n) return null;
  if (start === goal) {
    return {
      roleCode,
      distanceM: 0,
      dplusM: 0,
      dminusM: 0,
      durationSec: 0,
      baseDurationSec: 0,
      packDeltaSec: 0,
      altitudeDeltaSec: 0,
      weatherDeltaSec: 0,
      fatigueDeltaSec: 0,
      kcal: 0,
      maxSlopeDeg: 0,
      exposed30M: 0,
      pavedM: 0,
      gravelM: 0,
      trailM: 0,
      technicalM: 0,
      maxSacGrade: 0,
      waterPts: 0,
      shelters: 0,
      overlapRatio: 0,
      nodePath: [start],
      edgeIndices: [],
    };
  }

  const weights = objectiveWeightsForRole(roleCode, params.priorityCode);
  const maxSpeedMps =
    params.modeCode === MODE_VELO
      ? 12.0
      : params.modeCode === MODE_GRAVEL || params.modeCode === MODE_VTT || params.modeCode === MODE_VAE
        ? 10.0
        : 4.5;
  const hScale = weights.timeW / maxSpeedMps;
  const goalNode = graph.nodes[goal]!;

  const gScore = new Float64Array(n).fill(Infinity);
  const prevNode = new Int32Array(n).fill(-1);
  const prevEdge = new Int32Array(n).fill(-1);
  const heap = new MinHeap();

  gScore[start] = 0;
  const startNode = graph.nodes[start]!;
  heap.push({
    f: haversineM(startNode.lat, startNode.lon, goalNode.lat, goalNode.lon) * hScale,
    g: 0,
    node: start,
  });

  while (true) {
    const cur = heap.pop();
    if (!cur) break;
    const u = cur.node;
    if (u === goal) break;
    if (cur.g > gScore[u]! + 1e-9) continue;

    const uNode = graph.nodes[u]!;
    const out = adj[u]!;
    for (let k = 0; k < out.length; k++) {
      const eIdx = out[k]!;
      const edge = graph.edges[eIdx]!;
      const v = edge.to;
      const vNode = graph.nodes[v]!;
      if (!isEdgeAllowedTs(edge, vNode, params)) continue;
      const pen = penalties ? penalties[eIdx]! : 1.0;
      const evalRes = evaluateEdgeTs(edge, uNode, vNode, params, weights, pen);
      const tentativeG = cur.g + evalRes.totalCost;
      if (tentativeG + 1e-9 < gScore[v]!) {
        gScore[v] = tentativeG;
        prevNode[v] = u;
        prevEdge[v] = eIdx;
        const h = haversineM(vNode.lat, vNode.lon, goalNode.lat, goalNode.lon) * hScale;
        heap.push({ f: tentativeG + h, g: tentativeG, node: v });
      }
    }
  }

  if (!Number.isFinite(gScore[goal])) return null;

  const nodePath: number[] = [];
  const edgeIndices: number[] = [];
  let c = goal;
  while (c !== start && c !== -1) {
    nodePath.push(c);
    const eIdx = prevEdge[c]!;
    if (eIdx === -1) return null;
    edgeIndices.push(eIdx);
    c = prevNode[c]!;
  }
  nodePath.push(start);
  nodePath.reverse();
  edgeIndices.reverse();

  const evalWeights = objectiveWeightsForRole(0, params.priorityCode);
  let distanceM = 0;
  let dplusM = 0;
  let dminusM = 0;
  let durationSec = 0;
  let baseDurationSec = 0;
  let packDeltaSec = 0;
  let altitudeDeltaSec = 0;
  let weatherDeltaSec = 0;
  let fatigueDeltaSec = 0;
  let kcal = 0;
  let maxSlopeDeg = 0;
  let exposed30M = 0;
  let pavedM = 0;
  let gravelM = 0;
  let trailM = 0;
  let technicalM = 0;
  let maxSacGrade = 0;

  for (const eIdx of edgeIndices) {
    const edge = graph.edges[eIdx]!;
    const uNode = graph.nodes[edge.from]!;
    const vNode = graph.nodes[edge.to]!;
    const b = evaluateEdgeTs(edge, uNode, vNode, params, evalWeights, 1.0);
    const len = edge.lengthM;
    distanceM += len;
    dplusM += edge.dplusM;
    dminusM += edge.dminusM;
    durationSec += b.durationSec;
    baseDurationSec += b.baseDurationSec;
    packDeltaSec += b.packDeltaSec;
    altitudeDeltaSec += b.altitudeDeltaSec;
    weatherDeltaSec += b.weatherDeltaSec;
    fatigueDeltaSec += b.fatigueDeltaSec;
    kcal += b.kcal;
    if (edge.maxSlopeDeg > maxSlopeDeg) maxSlopeDeg = edge.maxSlopeDeg;
    if (edge.maxSlopeDeg >= 30.0) exposed30M += len;
    if (edge.surface === SURFACE_PAVED) pavedM += len;
    else if (edge.surface === SURFACE_GRAVEL) gravelM += len;
    else if (edge.surface === SURFACE_DIRT_TRAIL || edge.surface === SURFACE_GRASS_FOREST) {
      trailM += len;
    } else {
      technicalM += len;
    }
    if (edge.sacGrade > maxSacGrade) maxSacGrade = edge.sacGrade;
  }

  let waterPts = 0;
  let shelters = 0;
  for (const nid of nodePath) {
    const f = graph.nodes[nid]!.poiFlags;
    if ((f & POI_FLAG_WATER) !== 0) waterPts += 1;
    if ((f & POI_FLAG_SHELTER) !== 0) shelters += 1;
  }

  return {
    roleCode,
    distanceM,
    dplusM,
    dminusM,
    durationSec,
    baseDurationSec,
    packDeltaSec,
    altitudeDeltaSec,
    weatherDeltaSec,
    fatigueDeltaSec,
    kcal,
    maxSlopeDeg,
    exposed30M,
    pavedM,
    gravelM,
    trailM,
    technicalM,
    maxSacGrade,
    waterPts,
    shelters,
    overlapRatio: 0,
    nodePath,
    edgeIndices,
  };
}

function computeOverlap(
  graph: CompactCorridorGraph,
  cand: KernelComputedRoute,
  usedEdges: Set<number>,
): number {
  if (cand.distanceM <= 1.0) return 1.0;
  let shared = 0;
  for (const eIdx of cand.edgeIndices) {
    if (usedEdges.has(eIdx)) shared += graph.edges[eIdx]!.lengthM;
  }
  return clamp(shared / cand.distanceM, 0, 1);
}

export function planRoutesTs(
  graph: CompactCorridorGraph,
  startNode: number,
  goalNode: number,
  params: KernelRoutingParams,
): KernelComputedRoute[] {
  const adj = buildAdjacency(graph);
  const primary = runAstarTs(graph, adj, startNode, goalNode, params, 0);
  if (!primary) return [];

  const results: KernelComputedRoute[] = [primary];
  const penalties = new Float64Array(graph.edges.length).fill(1.0);
  const primaryEdgeSet = new Set<number>();
  for (const eIdx of primary.edgeIndices) {
    penalties[eIdx] = 1.65;
    primaryEdgeSet.add(eIdx);
  }

  for (const role of [1, 2, 3]) {
    if (results.length >= 3) break;
    const cand = runAstarTs(graph, adj, startNode, goalNode, params, role, penalties);
    if (!cand) continue;
    const ovPrimary = computeOverlap(graph, cand, primaryEdgeSet);
    const stretchOk =
      cand.durationSec <= Math.max(primary.durationSec * 1.65, primary.durationSec + 900.0);
    const distinctFromAll = results.every((existing) => {
      const set = new Set<number>(existing.edgeIndices);
      return computeOverlap(graph, cand, set) <= 0.78;
    });
    if (ovPrimary <= 0.78 && stretchOk && distinctFromAll) {
      cand.overlapRatio = ovPrimary;
      for (const eIdx of cand.edgeIndices) {
        penalties[eIdx] = Math.min(3.5, penalties[eIdx]! * 1.45);
      }
      results.push(cand);
    }
  }

  return results;
}
