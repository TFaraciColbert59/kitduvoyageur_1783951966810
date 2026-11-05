/**
 * src/features/kit-studio/scene/quality.ts
 * Automatic performance & battery degradation ladder (Lot L5-2 / C-19 / D-24).
 *
 * Exact order mandated by ARCHITECTURE_TO_BE §7 & MATRICE_ACCEPTATION C-19 / D-24:
 * - On low battery (`batteryLow = true`): ambience is cut FIRST (`ambienceEnabled: false`).
 * - On sustained slow frames (p95 frame time > 33.3 ms / FPS < 30):
 *   Tier 0 (HIGH):      maxDpr = 2.0, shadows = true,  postProcessing = true,  lod = 'high', degraded = false
 *   Tier 1 (DPR_1_5):   maxDpr = 1.5, shadows = true,  postProcessing = true,  lod = 'high', degraded = false
 *   Tier 2 (NO_SHADOW): maxDpr = 1.5, shadows = false, postProcessing = true,  lod = 'high', degraded = false
 *   Tier 3 (NO_POST):   maxDpr = 1.5, shadows = false, postProcessing = false, lod = 'high', degraded = false
 *   Tier 4 (LOW_LOD):   maxDpr = 1.5, shadows = false, postProcessing = false, lod = 'low',  degraded = false
 *   Tier 5 (DEGRADED):  maxDpr = 1.0, shadows = false, postProcessing = false, lod = 'low',  degraded = true (List mode)
 */

export const QUALITY_TIERS = [
  'HIGH',
  'DPR_1_5',
  'NO_SHADOWS',
  'NO_POST',
  'LOW_LOD',
  'DEGRADED',
] as const;

export type QualityTierId = (typeof QUALITY_TIERS)[number];

export interface QualityProfile {
  tierIndex: number;
  tier: QualityTierId;
  maxDpr: number;
  shadowsEnabled: boolean;
  postProcessingEnabled: boolean;
  lod: 'high' | 'low';
  ambienceEnabled: boolean;
  degradedToList: boolean;
}

const TIER_DEFINITIONS: readonly Omit<QualityProfile, 'ambienceEnabled'>[] = [
  {
    tierIndex: 0,
    tier: 'HIGH',
    maxDpr: 2.0,
    shadowsEnabled: true,
    postProcessingEnabled: true,
    lod: 'high',
    degradedToList: false,
  },
  {
    tierIndex: 1,
    tier: 'DPR_1_5',
    maxDpr: 1.5,
    shadowsEnabled: true,
    postProcessingEnabled: true,
    lod: 'high',
    degradedToList: false,
  },
  {
    tierIndex: 2,
    tier: 'NO_SHADOWS',
    maxDpr: 1.5,
    shadowsEnabled: false,
    postProcessingEnabled: true,
    lod: 'high',
    degradedToList: false,
  },
  {
    tierIndex: 3,
    tier: 'NO_POST',
    maxDpr: 1.5,
    shadowsEnabled: false,
    postProcessingEnabled: false,
    lod: 'high',
    degradedToList: false,
  },
  {
    tierIndex: 4,
    tier: 'LOW_LOD',
    maxDpr: 1.5,
    shadowsEnabled: false,
    postProcessingEnabled: false,
    lod: 'low',
    degradedToList: false,
  },
  {
    tierIndex: 5,
    tier: 'DEGRADED',
    maxDpr: 1.0,
    shadowsEnabled: false,
    postProcessingEnabled: false,
    lod: 'low',
    degradedToList: true,
  },
] as const;

export const SLOW_FRAME_P95_THRESHOLD_MS = 34; // < ~30 FPS
export const SAMPLE_WINDOW_FRAMES = 45;

export function computeP95FrameTimeMs(frameTimesMs: readonly number[]): number {
  if (frameTimesMs.length === 0) return 0;
  const sorted = [...frameTimesMs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx];
}

export class QualityGovernor {
  private tierIndex = 0;
  private batteryLow = false;
  private ambienceManuallyDisabled = false;
  private samples: number[] = [];

  constructor(initialTierIndex = 0) {
    this.tierIndex = Math.max(0, Math.min(TIER_DEFINITIONS.length - 1, initialTierIndex));
  }

  getProfile(): QualityProfile {
    const base = TIER_DEFINITIONS[this.tierIndex];
    // D-24: Ambience is cut FIRST when battery is low (before even dropping 3D tiers) or once tier >= 1
    const ambienceEnabled =
      !this.batteryLow && !this.ambienceManuallyDisabled && this.tierIndex === 0;
    return {
      ...base,
      ambienceEnabled,
    };
  }

  setBatteryStatus(params: { level: number; charging: boolean }): QualityProfile {
    const isLow = !params.charging && params.level <= 0.2;
    this.batteryLow = isLow;
    return this.getProfile();
  }

  stepDown(): QualityProfile {
    if (this.tierIndex < TIER_DEFINITIONS.length - 1) {
      this.tierIndex += 1;
    }
    return this.getProfile();
  }

  forceDegraded(): QualityProfile {
    this.tierIndex = TIER_DEFINITIONS.length - 1;
    return this.getProfile();
  }

  recordFrameTime(frameDeltaMs: number): { degradedStep: boolean; profile: QualityProfile } {
    if (!Number.isFinite(frameDeltaMs) || frameDeltaMs <= 0 || frameDeltaMs > 500) {
      return { degradedStep: false, profile: this.getProfile() };
    }

    this.samples.push(frameDeltaMs);
    if (this.samples.length < SAMPLE_WINDOW_FRAMES) {
      return { degradedStep: false, profile: this.getProfile() };
    }

    const p95 = computeP95FrameTimeMs(this.samples);
    this.samples = [];

    if (p95 > SLOW_FRAME_P95_THRESHOLD_MS) {
      // D-24: If ambience was still active, cut ambience first if battery/thermal pressure begins,
      // otherwise step down the 5-step WebGL ladder (DPR 2 -> 1.5 -> shadows -> post -> LOD -> List)
      const prevTier = this.tierIndex;
      this.stepDown();
      return {
        degradedStep: this.tierIndex !== prevTier,
        profile: this.getProfile(),
      };
    }

    return { degradedStep: false, profile: this.getProfile() };
  }

  resolveEffectiveDpr(devicePixelRatio: number): number {
    const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
    return Math.min(dpr, this.getProfile().maxDpr);
  }
}
