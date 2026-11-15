import { createHash } from 'node:crypto';
import { bearingDegrees, haversineDistanceM } from './privacy';
import type {
  ActivityReplayManifest,
  AudienceLevel,
  CameraKeyframe,
  FlyoverRenderJob,
  FlyoverTimeline,
  PublishableTrackProjection,
  ReplayHighlight,
  TrackMediaMarker,
} from './types';

export interface FlyoverOptions {
  targetDurationSec?: number;
  fps?: number;
  defaultPitchDeg?: number;
  defaultZoom?: number;
  nowMs?: number;
}

/**
 * K5.12 / S3.20 — Génère une timeline Flyover 3D déterministe depuis la projection publiable.
 * Aucun point masqué n'est jamais présent dans la projection d'entrée.
 */
export function generateFlyoverTimeline(
  track: PublishableTrackProjection,
  markers: readonly TrackMediaMarker[],
  options: FlyoverOptions = {},
): FlyoverTimeline {
  const fps = Math.max(1, Math.min(60, options.fps ?? 30));
  const durationSec = Math.max(5, Math.min(120, options.targetDurationSec ?? 24));
  const defaultPitchDeg = options.defaultPitchDeg ?? 55;
  const defaultZoom = options.defaultZoom ?? 14.5;
  const generatedAtMs = options.nowMs ?? Date.now();

  if (track.points.length === 0) {
    return {
      trackId: track.trackId,
      maskVersion: track.maskVersion,
      durationSec: 0,
      fps,
      keyframes: [],
      attachedMediaCount: 0,
      generatedAtMs,
    };
  }

  const cumulativeDist: number[] = [0];
  let totalDist = 0;
  for (let i = 1; i < track.points.length; i += 1) {
    totalDist += haversineDistanceM(track.points[i - 1], track.points[i]);
    cumulativeDist.push(totalDist);
  }

  const markerByPointIndex = new Map<number, TrackMediaMarker>();
  for (const m of markers) {
    let bestIdx = 0;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (let i = 0; i < cumulativeDist.length; i += 1) {
      const delta = Math.abs(cumulativeDist[i] - m.distanceAlongTrackM);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIdx = i;
      }
    }
    if (!markerByPointIndex.has(bestIdx)) {
      markerByPointIndex.set(bestIdx, m);
    }
  }

  const keyframes: CameraKeyframe[] = [];
  let runningGain = 0;

  for (let i = 0; i < track.points.length; i += 1) {
    const pt = track.points[i];
    if (i > 0) {
      const prevEle = track.points[i - 1].elevationM;
      const currEle = pt.elevationM;
      if (
        prevEle !== null &&
        prevEle !== undefined &&
        currEle !== null &&
        currEle !== undefined &&
        currEle > prevEle
      ) {
        runningGain += currEle - prevEle;
      }
    }

    const progress =
      totalDist > 0
        ? cumulativeDist[i] / totalDist
        : track.points.length > 1
          ? i / (track.points.length - 1)
          : 0;

    const nextPt = track.points[Math.min(i + 1, track.points.length - 1)];
    const prevPt = track.points[Math.max(0, i - 1)];
    const bearingDeg =
      i < track.points.length - 1
        ? bearingDegrees(pt, nextPt)
        : bearingDegrees(prevPt, pt);

    const attached = markerByPointIndex.get(i);
    const tSec = Number((progress * durationSec).toFixed(2));
    const speedMps =
      track.durationSec > 0 ? Number((track.totalDistanceM / track.durationSec).toFixed(2)) : 0;

    keyframes.push({
      tSec,
      progress: Number(progress.toFixed(4)),
      lat: pt.lat,
      lng: pt.lng,
      elevationM: pt.elevationM ?? 0,
      bearingDeg: Number(bearingDeg.toFixed(1)),
      pitchDeg: attached ? Math.min(70, defaultPitchDeg + 8) : defaultPitchDeg,
      zoom: attached ? Math.min(17, defaultZoom + 1.2) : defaultZoom,
      speedMps,
      ...(attached ? { attachedMediaId: attached.mediaId } : {}),
      statCallout: {
        distanceM: Math.round(cumulativeDist[i]),
        elevationGainM: Math.round(runningGain),
      },
    });
  }

  return {
    trackId: track.trackId,
    maskVersion: track.maskVersion,
    durationSec,
    fps,
    keyframes,
    attachedMediaCount: markerByPointIndex.size,
    generatedAtMs,
  };
}

/**
 * Calcule une clé d'idempotence unique par trace, version de masque et préréglage.
 */
export function buildFlyoverIdempotencyKey(
  trackId: string,
  maskVersion: string,
  preset = 'default',
): string {
  return createHash('sha256')
    .update(`${trackId}:${maskVersion}:${preset}`)
    .digest('hex')
    .slice(0, 24);
}

/**
 * Gestionnaire de file de rendu asynchrone pour Flyover / Replay.
 * Garantit :
 * - idempotence (un rejeu avec la même clé ne crée pas de double publication)
 * - invalidation immédiate des anciens rendus/liens si le masque ou l'audience change.
 */
export class FlyoverRenderQueue {
  private readonly jobsById = new Map<string, FlyoverRenderJob>();
  private readonly jobIdByIdempotency = new Map<string, string>();
  private readonly maxConcurrent: number;

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
  }

  enqueueRender(input: {
    trackId: string;
    maskVersion: string;
    audience: AudienceLevel;
    preset?: string;
    fallbackImageUrl?: string | null;
    nowMs?: number;
  }): { job: FlyoverRenderJob; deduplicated: boolean } {
    const nowMs = input.nowMs ?? Date.now();
    const idempotencyKey = buildFlyoverIdempotencyKey(
      input.trackId,
      input.maskVersion,
      input.preset ?? 'default',
    );

    const existingId = this.jobIdByIdempotency.get(idempotencyKey);
    if (existingId) {
      const existing = this.jobsById.get(existingId);
      if (existing && existing.status !== 'revoked' && existing.status !== 'cancelled' && existing.status !== 'failed') {
        return { job: existing, deduplicated: true };
      }
    }

    if (input.audience === 'private') {
      const blockedJob: FlyoverRenderJob = {
        jobId: `job_${idempotencyKey}_${nowMs}`,
        idempotencyKey,
        trackId: input.trackId,
        maskVersion: input.maskVersion,
        audience: input.audience,
        status: 'cancelled',
        outputUrl: null,
        fallbackImageUrl: null,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
        error: 'private_track_not_publishable',
      };
      this.jobsById.set(blockedJob.jobId, blockedJob);
      return { job: blockedJob, deduplicated: false };
    }

    const activeCount = Array.from(this.jobsById.values()).filter(
      (j) => j.status === 'queued' || j.status === 'rendering',
    ).length;

    const job: FlyoverRenderJob = {
      jobId: `job_${idempotencyKey}_${nowMs}`,
      idempotencyKey,
      trackId: input.trackId,
      maskVersion: input.maskVersion,
      audience: input.audience,
      status: activeCount < this.maxConcurrent ? 'rendering' : 'queued',
      outputUrl: null,
      fallbackImageUrl: input.fallbackImageUrl ?? null,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    this.jobsById.set(job.jobId, job);
    this.jobIdByIdempotency.set(idempotencyKey, job.jobId);
    return { job, deduplicated: false };
  }

  completeRender(jobId: string, outputUrl: string, nowMs = Date.now()): FlyoverRenderJob | null {
    const job = this.jobsById.get(jobId);
    if (!job || job.status === 'revoked' || job.status === 'cancelled') {
      return null;
    }
    const updated: FlyoverRenderJob = {
      ...job,
      status: 'ready',
      outputUrl,
      updatedAtMs: nowMs,
    };
    this.jobsById.set(jobId, updated);
    return updated;
  }

  failRender(jobId: string, error: string, nowMs = Date.now()): FlyoverRenderJob | null {
    const job = this.jobsById.get(jobId);
    if (!job || job.status === 'revoked') {
      return null;
    }
    const updated: FlyoverRenderJob = {
      ...job,
      status: 'failed',
      outputUrl: null,
      error,
      updatedAtMs: nowMs,
    };
    this.jobsById.set(jobId, updated);
    return updated;
  }

  /**
   * Invalide tous les rendus dont la version de masque ne correspond plus à `newMaskVersion`.
   * Supprime `outputUrl` et `fallbackImageUrl` pour éviter toute fuite d'ancien lien.
   */
  invalidateOutdatedMasks(
    trackId: string,
    newMaskVersion: string,
    nowMs = Date.now(),
  ): number {
    let invalidated = 0;
    for (const [jobId, job] of Array.from(this.jobsById.entries())) {
      if (job.trackId === trackId && job.maskVersion !== newMaskVersion && job.status !== 'revoked') {
        this.jobsById.set(jobId, {
          ...job,
          status: 'revoked',
          outputUrl: null,
          fallbackImageUrl: null,
          updatedAtMs: nowMs,
        });
        invalidated += 1;
      }
    }
    return invalidated;
  }

  revokeAllForTrack(trackId: string, nowMs = Date.now()): number {
    let revoked = 0;
    for (const [jobId, job] of Array.from(this.jobsById.entries())) {
      if (job.trackId === trackId && job.status !== 'revoked') {
        this.jobsById.set(jobId, {
          ...job,
          status: 'revoked',
          outputUrl: null,
          fallbackImageUrl: null,
          updatedAtMs: nowMs,
        });
        revoked += 1;
      }
    }
    return revoked;
  }

  getJob(jobId: string): FlyoverRenderJob | null {
    return this.jobsById.get(jobId) ?? null;
  }
}

/**
 * S3.21 — Génère le manifeste Activity Replay pour le fil communautaire.
 * Fail-closed : si l'audience est `'private'`, retourne un manifeste vide sans points ni URL.
 */
export function generateActivityReplay(
  track: PublishableTrackProjection,
  markers: readonly TrackMediaMarker[],
  options: { durationSec?: number; fallbackPreviewUrl?: string | null } = {},
): ActivityReplayManifest {
  if (track.audience === 'private' || track.points.length === 0) {
    return {
      trackId: track.trackId,
      maskVersion: track.maskVersion,
      audience: track.audience,
      durationSec: 0,
      points: [],
      highlights: [],
      fallbackPreviewUrl: null,
    };
  }

  const durationSec = Math.max(5, Math.min(60, options.durationSec ?? 15));
  const totalCount = track.points.length;

  const replayPoints = track.points.map((pt, idx) => ({
    lat: pt.lat,
    lng: pt.lng,
    elevationM: pt.elevationM ?? null,
    progress: totalCount > 1 ? Number((idx / (totalCount - 1)).toFixed(4)) : 0,
  }));

  const highlights: ReplayHighlight[] = [];
  const first = replayPoints[0];
  highlights.push({
    id: `${track.trackId}_start`,
    tSec: 0,
    progress: 0,
    kind: 'start',
    label: 'Départ',
    lat: first.lat,
    lng: first.lng,
    elevationM: first.elevationM,
  });

  // Sommet altimétrique si présent
  let peakIdx = -1;
  let peakEle = -Infinity;
  for (let i = 0; i < replayPoints.length; i += 1) {
    const ele = replayPoints[i].elevationM;
    if (ele !== null && ele > peakEle) {
      peakEle = ele;
      peakIdx = i;
    }
  }
  if (peakIdx > 0 && peakIdx < replayPoints.length - 1) {
    const pk = replayPoints[peakIdx];
    highlights.push({
      id: `${track.trackId}_peak`,
      tSec: Number((pk.progress * durationSec).toFixed(2)),
      progress: pk.progress,
      kind: 'peak',
      label: `Sommet ${Math.round(peakEle)} m`,
      lat: pk.lat,
      lng: pk.lng,
      elevationM: pk.elevationM,
    });
  }

  for (const m of markers) {
    const progress =
      track.totalDistanceM > 0
        ? Math.min(1, Math.max(0, m.distanceAlongTrackM / track.totalDistanceM))
        : 0;
    highlights.push({
      id: `media_${m.mediaId}`,
      tSec: Number((progress * durationSec).toFixed(2)),
      progress: Number(progress.toFixed(4)),
      kind: 'media',
      label: m.caption ?? (m.kind === 'video' ? 'Vidéo' : 'Photo'),
      lat: m.location.lat,
      lng: m.location.lng,
      elevationM: m.location.elevationM,
    });
  }

  const last = replayPoints[replayPoints.length - 1];
  if (replayPoints.length > 1) {
    highlights.push({
      id: `${track.trackId}_finish`,
      tSec: durationSec,
      progress: 1,
      kind: 'finish',
      label: 'Arrivée',
      lat: last.lat,
      lng: last.lng,
      elevationM: last.elevationM,
    });
  }

  highlights.sort((a, b) => a.tSec - b.tSec);

  return {
    trackId: track.trackId,
    maskVersion: track.maskVersion,
    audience: track.audience,
    durationSec,
    points: replayPoints,
    highlights,
    fallbackPreviewUrl: options.fallbackPreviewUrl ?? null,
  };
}
