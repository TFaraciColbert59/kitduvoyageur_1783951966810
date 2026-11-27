/**
 * Universal Rust/WASM Routing Kernel Bridge (Node BFF + Browser Client / Offline).
 *
 * - Encodes `CompactCorridorGraph` + `KernelRoutingParams` into the exact `"LKDV"` v1
 *   little-endian binary buffer expected by `crates/lkdv-route-core`.
 * - Instantiates `public/wasm/lkdv_route_core.wasm` once and caches the compiled module.
 * - Decodes `"LDKR"` output directly into `KernelComputedRoute[]`.
 * - Automatically falls back to `planRoutesTs` (1:1 parity mirror) if WASM cannot load.
 */

import {
  CAP_FLAG_HAS_CRAMPONS,
  CAP_FLAG_HAS_EBIKE,
  CAP_FLAG_HAS_HEADLAMP,
  CAP_FLAG_HAS_RAIN_SHELL,
  CAP_FLAG_HAS_THERMAL,
  CAP_FLAG_HAS_WATER_FILTER,
  CAP_FLAG_NAUTICAL_PROVEN,
  CAP_FLAG_VIA_FERRATA_OK,
  CAP_FLAG_WINTER_AVALANCHE_TRAINED,
  ENV_FLAG_FLOOD_ALERT,
  ENV_FLAG_NIGHT_OVERLAP,
  ENV_FLAG_THUNDERSTORM,
  MODE_GRAVEL,
  MODE_KAYAK,
  MODE_RANDO,
  MODE_RAQUETTES,
  MODE_SKI,
  MODE_TRAIL,
  MODE_VAE,
  MODE_VELO,
  MODE_VTT,
  planRoutesTs,
  type KernelComputedRoute,
  type KernelRoutingParams,
} from './tsFallbackEngine';
import type {
  CompactCorridorGraph,
  RouteEnvironmentSnapshot,
  RoutingTravelMode,
  UserCapabilityManifest,
} from './types';

const INPUT_MAGIC = 0x56444b4c; // "LKDV"
const OUTPUT_MAGIC = 0x524b444c; // "LDKR"

interface WasmKernelExports {
  memory: WebAssembly.Memory;
  lkdv_alloc(len: number): number;
  lkdv_dealloc(ptr: number, len: number): void;
  lkdv_plan_routes(inputPtr: number, inputLen: number): number;
  lkdv_output_ptr(): number;
}

let cachedWasmModulePromise: Promise<WebAssembly.Module | null> | null = null;

async function loadWasmModule(): Promise<WebAssembly.Module | null> {
  if (cachedWasmModulePromise) return cachedWasmModulePromise;

  cachedWasmModulePromise = (async () => {
    try {
      if (typeof window === 'undefined') {
        // Node.js BFF / Vitest environment
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const wasmPath = path.join(process.cwd(), 'public', 'wasm', 'lkdv_route_core.wasm');
        const bytes = await fs.readFile(wasmPath);
        return await WebAssembly.compile(bytes);
      } else {
        // Browser runtime (online or cached via Service Worker / Cache Storage)
        const resp = await fetch('/wasm/lkdv_route_core.wasm');
        if (!resp.ok) return null;
        const buf = await resp.arrayBuffer();
        return await WebAssembly.compile(buf);
      }
    } catch {
      return null;
    }
  })();

  return cachedWasmModulePromise;
}

export function modeToKernelCode(mode: RoutingTravelMode): number {
  switch (mode) {
    case 'trail':
      return MODE_TRAIL;
    case 'velo':
      return MODE_VELO;
    case 'gravel':
      return MODE_GRAVEL;
    case 'vtt':
      return MODE_VTT;
    case 'vae':
      return MODE_VAE;
    case 'ski':
      return MODE_SKI;
    case 'raquettes':
      return MODE_RAQUETTES;
    case 'kayak':
      return MODE_KAYAK;
    case 'rando':
    case 'multimodal':
    default:
      return MODE_RANDO;
  }
}

export function buildKernelParams(
  manifest: UserCapabilityManifest,
  env: RouteEnvironmentSnapshot,
  activeMode: RoutingTravelMode,
  options?: { nightOverlap?: boolean },
): KernelRoutingParams {
  let capFlags = 0;
  if (manifest.hasWatercraftAndPfd) capFlags |= CAP_FLAG_NAUTICAL_PROVEN;
  if (manifest.viaFerrataOk && manifest.hasViaFerrataKit) capFlags |= CAP_FLAG_VIA_FERRATA_OK;
  if (manifest.winterAvalancheTrained && manifest.gear.hasAvalancheKit) {
    capFlags |= CAP_FLAG_WINTER_AVALANCHE_TRAINED;
  }
  if (manifest.gear.hasCramponsIceAxe) capFlags |= CAP_FLAG_HAS_CRAMPONS;
  if (manifest.gear.hasHeadlamp) capFlags |= CAP_FLAG_HAS_HEADLAMP;
  if (manifest.gear.hasRainShell) capFlags |= CAP_FLAG_HAS_RAIN_SHELL;
  if (manifest.gear.hasThermalLayer) capFlags |= CAP_FLAG_HAS_THERMAL;
  if (manifest.hasEbike) capFlags |= CAP_FLAG_HAS_EBIKE;
  if ((manifest.gear.hasWaterFilterOrCapacityL ?? 0) >= 2.5) capFlags |= CAP_FLAG_HAS_WATER_FILTER;

  let envFlags = 0;
  if (env.thunderstormRisk) envFlags |= ENV_FLAG_THUNDERSTORM;
  if (env.activeFloodAlert) envFlags |= ENV_FLAG_FLOOD_ALERT;
  if (options?.nightOverlap) envFlags |= ENV_FLAG_NIGHT_OVERLAP;

  const priorityCode =
    manifest.priority === 'securite'
      ? 1
      : manifest.priority === 'doux'
        ? 2
        : manifest.priority === 'rapide'
          ? 3
          : 0;

  const mobilityCode =
    manifest.mobilityProfile === 'famille'
      ? 1
      : manifest.mobilityProfile === 'senior'
        ? 2
        : manifest.mobilityProfile === 'pmr'
          ? 3
          : 0;

  return {
    modeCode: modeToKernelCode(activeMode),
    priorityCode,
    mobilityCode,
    capFlags,
    sacMaxGrade: manifest.sacMaxGrade,
    mtbMaxGrade: manifest.mtbMaxGrade,
    wwMaxGrade: manifest.whitewaterMaxGrade,
    avalancheBra: env.avalancheBraLevel,
    envFlags,
    bodyWeightKg: manifest.bodyWeightKg,
    packWeightKg: manifest.packWeightKg,
    flatSpeedKmh: manifest.flatSpeedKmh,
    ascentMPerH: manifest.ascentSpeedMPerH,
    speedPercentile: manifest.speedPercentile,
    vo2max: manifest.vo2maxMlKgMin,
    readinessScore: manifest.readiness.score ?? -1,
    acclimCeilingM: manifest.readiness.altitudeAcclimatization.ceilingM,
    windKmh: env.windKmh,
    ridgeWindKmh: env.ridgeWindKmh,
    precipMmH: env.precipMmH,
    snowDepthCm: env.snowDepthCm,
    freezingLevelM: env.freezingLevelM ?? -1,
    tempC: env.temperatureStartC ?? 12,
  };
}

export function encodeBinaryRequest(
  graph: CompactCorridorGraph,
  startNode: number,
  goalNode: number,
  params: KernelRoutingParams,
): Uint8Array {
  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;
  // Header: 6 u32 (24B) + Params: 9 u32 + 14 f32 (92B) + Nodes: N*16B + Edges: E*36B
  const totalBytes = 24 + 92 + nodeCount * 16 + edgeCount * 36;
  const buf = new ArrayBuffer(totalBytes);
  const view = new DataView(buf);
  let pos = 0;

  const writeU32 = (v: number) => {
    view.setUint32(pos, v >>> 0, true);
    pos += 4;
  };
  const writeF32 = (v: number) => {
    view.setFloat32(pos, v, true);
    pos += 4;
  };

  writeU32(INPUT_MAGIC);
  writeU32(1); // version
  writeU32(nodeCount);
  writeU32(edgeCount);
  writeU32(startNode);
  writeU32(goalNode);

  // Params (9 u32 + 14 f32)
  writeU32(params.modeCode);
  writeU32(params.priorityCode);
  writeU32(params.mobilityCode);
  writeU32(params.capFlags);
  writeU32(params.sacMaxGrade);
  writeU32(params.mtbMaxGrade);
  writeU32(params.wwMaxGrade);
  writeU32(params.avalancheBra);
  writeU32(params.envFlags);

  writeF32(params.bodyWeightKg);
  writeF32(params.packWeightKg);
  writeF32(params.flatSpeedKmh);
  writeF32(params.ascentMPerH);
  writeF32(params.speedPercentile);
  writeF32(params.vo2max);
  writeF32(params.readinessScore);
  writeF32(params.acclimCeilingM);
  writeF32(params.windKmh);
  writeF32(params.ridgeWindKmh);
  writeF32(params.precipMmH);
  writeF32(params.snowDepthCm);
  writeF32(params.freezingLevelM);
  writeF32(params.tempC);

  for (let i = 0; i < nodeCount; i++) {
    const n = graph.nodes[i]!;
    writeF32(n.lat);
    writeF32(n.lon);
    writeF32(n.eleM);
    writeU32(n.poiFlags);
  }

  for (let i = 0; i < edgeCount; i++) {
    const e = graph.edges[i]!;
    writeU32(e.from);
    writeU32(e.to);
    writeF32(e.lengthM);
    writeF32(e.dplusM);
    writeF32(e.dminusM);
    writeF32(e.maxSlopeDeg);
    writeU32(e.surface);
    const gradesPacked =
      (e.sacGrade & 0xff) | ((e.mtbGrade & 0xff) << 8) | ((e.wwGrade & 0xff) << 16);
    writeU32(gradesPacked);
    const flagsPacked = (e.flags & 0xffff) | ((e.hazardFlags & 0xffff) << 16);
    writeU32(flagsPacked);
  }

  return new Uint8Array(buf);
}

export function decodeBinaryResponse(bytes: Uint8Array): KernelComputedRoute[] {
  if (bytes.byteLength < 12) return [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  const readU32 = () => {
    const v = view.getUint32(pos, true);
    pos += 4;
    return v;
  };
  const readF32 = () => {
    const v = view.getFloat32(pos, true);
    pos += 4;
    return v;
  };

  const magic = readU32();
  if (magic !== OUTPUT_MAGIC) return [];
  const status = readU32();
  const routeCount = readU32();
  if (status !== 0 || routeCount === 0) return [];

  const routes: KernelComputedRoute[] = [];
  for (let r = 0; r < routeCount; r++) {
    const roleCode = readU32();
    const distanceM = readF32();
    const dplusM = readF32();
    const dminusM = readF32();
    const durationSec = readF32();
    const baseDurationSec = readF32();
    const packDeltaSec = readF32();
    const altitudeDeltaSec = readF32();
    const weatherDeltaSec = readF32();
    const fatigueDeltaSec = readF32();
    const kcal = readF32();
    const maxSlopeDeg = readF32();
    const exposed30M = readF32();
    const pavedM = readF32();
    const gravelM = readF32();
    const trailM = readF32();
    const technicalM = readF32();
    const maxSacGrade = readU32();
    const waterPts = readU32();
    const shelters = readU32();
    const overlapRatio = readF32();
    const pathLen = readU32();
    const nodePath: number[] = [];
    for (let k = 0; k < pathLen; k++) {
      nodePath.push(readU32());
    }
    routes.push({
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
      overlapRatio,
      nodePath,
      edgeIndices: [],
    });
  }
  return routes;
}

export interface KernelExecutionResult {
  engineUsed: 'rust_wasm_local' | 'ts_parity_local';
  routes: KernelComputedRoute[];
  computeTimeMs: number;
}

/**
 * Executes routing on a CompactCorridorGraph using Rust/WASM (`lkdv_route_core.wasm`)
 * with transparent fallback to the 1:1 TypeScript parity kernel (`planRoutesTs`).
 */
export async function executeRoutingKernel(
  graph: CompactCorridorGraph,
  startNode: number,
  goalNode: number,
  params: KernelRoutingParams,
  options?: { forceTsFallback?: boolean },
): Promise<KernelExecutionResult> {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  if (!options?.forceTsFallback) {
    const mod = await loadWasmModule();
    if (mod) {
      try {
        const instance = await WebAssembly.instantiate(mod, {});
        const exports = instance.exports as unknown as WasmKernelExports;
        const inputBytes = encodeBinaryRequest(graph, startNode, goalNode, params);
        const inputPtr = exports.lkdv_alloc(inputBytes.byteLength);
        try {
          new Uint8Array(exports.memory.buffer, inputPtr, inputBytes.byteLength).set(inputBytes);
          const outLen = exports.lkdv_plan_routes(inputPtr, inputBytes.byteLength);
          const outPtr = exports.lkdv_output_ptr();
          const outSlice = new Uint8Array(exports.memory.buffer, outPtr, outLen).slice();
          const routes = decodeBinaryResponse(outSlice);
          const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
          return {
            engineUsed: 'rust_wasm_local',
            routes,
            computeTimeMs: Math.max(0.1, Math.round(elapsed * 10) / 10),
          };
        } finally {
          exports.lkdv_dealloc(inputPtr, inputBytes.byteLength);
        }
      } catch {
        // Fall through to exact TS parity kernel
      }
    }
  }

  const routes = planRoutesTs(graph, startNode, goalNode, params);
  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return {
    engineUsed: 'ts_parity_local',
    routes,
    computeTimeMs: Math.max(0.1, Math.round(elapsed * 10) / 10),
  };
}
