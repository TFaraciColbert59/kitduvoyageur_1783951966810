import type { ActivityProfileSpec } from '../../specs/activityProfileSpec.types';
import type { ActivityCompletedPayload, ActivitySourceOrigin } from '../activityEventBus';

export interface PhysiologyAndXpResult {
  formula: 'trimp_banister' | 'foster_srpe';
  trainingLoadScore: number;
  xpEarned: number;
}

/**
 * Payload IA strictement minimisé (< 450 tokens, 0 coordonnée GPS brute, 0 PII).
 */
export interface ActivityAiInsightInputV1 {
  schemaVersion: '1.0';
  sportSlug: string;
  sportLabelFr: string;
  familyId: string;
  distanceKm: number;
  movingMinutes: number;
  elevGainM: number;
  trainingLoadScore: number;
  loadFormula: 'trimp_banister' | 'foster_srpe';
  rpe: number | null;
  avgHrBpm: number | null;
  primarySpeedUnit: string;
  shortNoteExcerpt: string | null;
}

export type AiInsightGuardResult =
  | { allowed: true; payload: ActivityAiInsightInputV1; estimatedTokens: number }
  | { allowed: false; reason: 'rgpd_art9_sensitive' | 'strava_api_prohibition' };

export function computePhysiologyAndXp(
  profile: ActivityProfileSpec,
  payload: Pick<
    ActivityCompletedPayload,
    'distanceM' | 'movingS' | 'elevGainM' | 'avgHrBpm' | 'maxHrBpm' | 'restingHrBpm' | 'rpe'
  >,
): PhysiologyAndXpResult {
  const durationMin = Math.max(1, payload.movingS / 60);
  const rpe = Math.max(1, Math.min(10, payload.rpe ?? 5));

  let formula: 'trimp_banister' | 'foster_srpe' = 'foster_srpe';
  let load = durationMin * rpe;

  if (
    profile.algorithms.loadModelPrimary === 'banister_trimp_hr' &&
    payload.avgHrBpm &&
    payload.avgHrBpm > 60
  ) {
    const hrRest = payload.restingHrBpm ?? 60;
    const hrMax = payload.maxHrBpm ?? 190;
    const hrRatio = Math.max(0.1, Math.min(1, (payload.avgHrBpm - hrRest) / Math.max(40, hrMax - hrRest)));
    load = durationMin * hrRatio * 0.64 * Math.exp(1.92 * hrRatio);
    formula = 'trimp_banister';
  }

  const distKm = Math.max(0, payload.distanceM) / 1000;
  const elevFactor = Math.max(0, payload.elevGainM) / 100;
  const xpRaw = Math.round(15 + distKm * 6 + elevFactor * 12 + durationMin * 0.4);
  const xpEarned = Math.min(1500, Math.max(10, xpRaw));

  return {
    formula,
    trainingLoadScore: Math.round(load),
    xpEarned,
  };
}

/**
 * Garde-fou serveur strict avant tout appel à `/api/ai-assistant/activity-insight` :
 * 1. Bloque catégoriquement toute donnée RGPD Art. 9 (`rehab_physio_*`, santé sensible).
 * 2. Bloque catégoriquement toute activité issue de `strava_api` (interdiction CGU Strava IA).
 * 3. Minimise strictement le payload (< 450 tokens, aucune coordonnée GPS, aucun nom/email).
 */
export function buildAiActivityInsightPayload(
  profile: ActivityProfileSpec,
  payload: ActivityCompletedPayload,
): AiInsightGuardResult {
  if (
    profile.privacyAndCompliance.rgpdArt9SensitiveHealth ||
    !profile.privacyAndCompliance.aiInsightAllowedDefault
  ) {
    return { allowed: false, reason: 'rgpd_art9_sensitive' };
  }
  const source: ActivitySourceOrigin = payload.sourceOrigin;
  if (source === 'strava_api') {
    return { allowed: false, reason: 'strava_api_prohibition' };
  }

  const phys = computePhysiologyAndXp(profile, payload);
  const excerpt = payload.notes ? payload.notes.trim().slice(0, 200) : null;

  const insightInput: ActivityAiInsightInputV1 = {
    schemaVersion: '1.0',
    sportSlug: profile.identity.slugId,
    sportLabelFr: profile.identity.labelFr,
    familyId: profile.identity.familyId,
    distanceKm: Number((Math.max(0, payload.distanceM) / 1000).toFixed(2)),
    movingMinutes: Math.round(Math.max(0, payload.movingS) / 60),
    elevGainM: Math.round(Math.max(0, payload.elevGainM)),
    trainingLoadScore: phys.trainingLoadScore,
    loadFormula: phys.formula,
    rpe: payload.rpe ?? null,
    avgHrBpm: payload.avgHrBpm ? Math.round(payload.avgHrBpm) : null,
    primarySpeedUnit: profile.algorithms.primarySpeedUnit,
    shortNoteExcerpt: excerpt,
  };

  const jsonLen = JSON.stringify(insightInput).length;
  const estimatedTokens = Math.ceil(jsonLen / 4);

  return {
    allowed: true,
    payload: insightInput,
    estimatedTokens,
  };
}
