import {
  angleDiffDeg,
  buildDirectedTrace,
  computeBearingDeg,
  computeLiveDelta,
  haversineDistanceM,
  projectPointOntoTrace,
} from './geometry';
import { sanitizeSegmentForLive, selectPreferredGhost } from './privacy';
import type {
  EffortInvalidationReason,
  FinalSegmentEffort,
  GeoPoint,
  GhostProfile,
  GhostTargetKind,
  LiveSegmentAlert,
  LiveSegmentDefinition,
  LiveSegmentSnapshot,
  LiveSegmentState,
  LiveSegmentThresholds,
  PrivacyContext,
  SegmentPoint,
  SignalQuality,
} from './types';

export const DEFAULT_LIVE_SEGMENT_THRESHOLDS: LiveSegmentThresholds = {
  approachRadiusM: 150,
  approachExitRadiusM: 220,
  startRadiusM: 25,
  maxHeadingDiffDeg: 55,
  finishRadiusM: 25,
  offRouteThresholdM: 35,
  rejoinThresholdM: 22,
  offRouteGraceSamples: 3,
  offRouteAbortSamples: 6,
  maxAccuracyM: 30,
  maxGpsGapMs: 15_000,
  minCoverageRatio: 0.88,
  maxPlausibleSpeedMps: 35,
};

export interface LiveSegmentEngineOptions {
  thresholds?: Partial<LiveSegmentThresholds>;
  preferredGhostKind?: GhostTargetKind;
  isOnline?: boolean;
}

interface ActiveAttempt {
  segment: LiveSegmentDefinition;
  direction: 'forward' | 'reverse';
  trace: SegmentPoint[];
  ghost: GhostProfile | null;
  startedAtMs: number;
  startMonotonicMs: number;
  pausedDurationMs: number;
  pausedAtMonotonicMs: number | null;
  hadPause: boolean;
  hadGpsLoss: boolean;
  hadTeleport: boolean;
  maxDistanceCoveredM: number;
  currentDistanceM: number;
  offRouteConsecutiveCount: number;
  lastGoodPoint: GeoPoint | null;
  lastGoodMonotonicMs: number;
  lastGoodDistanceAlongM: number;
}

interface ApproachingTarget {
  segment: LiveSegmentDefinition;
  direction: 'forward' | 'reverse';
  trace: SegmentPoint[];
  ghost: GhostProfile | null;
  distanceToStartM: number;
}

export class OfflineEffortQueue {
  private readonly queue: FinalSegmentEffort[] = [];
  private readonly seenEffortIds = new Set<string>();

  enqueue(effort: FinalSegmentEffort): boolean {
    if (this.seenEffortIds.has(effort.effortId)) {
      return false;
    }
    this.seenEffortIds.add(effort.effortId);
    this.queue.push(effort);
    return true;
  }

  peekAll(): readonly FinalSegmentEffort[] {
    return [...this.queue];
  }

  flush(): FinalSegmentEffort[] {
    const items = [...this.queue];
    this.queue.length = 0;
    return items;
  }

  size(): number {
    return this.queue.length;
  }
}

export class LiveSegmentEngine {
  private readonly thresholds: LiveSegmentThresholds;
  private readonly preferredGhostKind?: GhostTargetKind;
  private isOnline: boolean;
  private privacy: PrivacyContext;
  private segments: LiveSegmentDefinition[] = [];
  private state: LiveSegmentState = 'idle';
  private isVisible = false;
  private approaching: ApproachingTarget | null = null;
  private attempt: ActiveAttempt | null = null;
  private lastPoint: GeoPoint | null = null;
  private lastResult: FinalSegmentEffort | null = null;
  private signalQuality: SignalQuality = 'good';
  private effortCounter = 0;
  readonly offlineQueue = new OfflineEffortQueue();

  constructor(
    privacy: PrivacyContext,
    segments: readonly LiveSegmentDefinition[] = [],
    options: LiveSegmentEngineOptions = {},
  ) {
    this.privacy = privacy;
    this.thresholds = {
      ...DEFAULT_LIVE_SEGMENT_THRESHOLDS,
      ...options.thresholds,
    };
    this.preferredGhostKind = options.preferredGhostKind;
    this.isOnline = options.isOnline ?? true;
    this.setSegments(segments);
  }

  setOnline(online: boolean): void {
    this.isOnline = online;
  }

  updatePrivacy(privacy: PrivacyContext): void {
    this.privacy = privacy;
    this.setSegments(this.segments);
    if (!this.privacy.optedInLiveSegments && this.state !== 'idle') {
      this.reset();
    }
  }

  setSegments(segments: readonly LiveSegmentDefinition[]): void {
    const sanitized: LiveSegmentDefinition[] = [];
    for (const seg of segments) {
      const clean = sanitizeSegmentForLive(seg, this.privacy);
      if (clean) {
        sanitized.push(clean);
      }
    }
    this.segments = sanitized;
  }

  pause(monotonicMs: number): void {
    if (!this.attempt || this.attempt.pausedAtMonotonicMs !== null) {
      return;
    }
    this.attempt.pausedAtMonotonicMs = monotonicMs;
    this.attempt.hadPause = true;
  }

  resume(monotonicMs: number): void {
    if (!this.attempt || this.attempt.pausedAtMonotonicMs === null) {
      return;
    }
    const delta = Math.max(0, monotonicMs - this.attempt.pausedAtMonotonicMs);
    this.attempt.pausedDurationMs += delta;
    this.attempt.pausedAtMonotonicMs = null;
    this.attempt.lastGoodMonotonicMs = monotonicMs;
  }

  /**
   * Withdraws the temporary banner/overlay after completion or abort (S4.09 visibility rule).
   */
  acknowledgeResolution(): LiveSegmentSnapshot {
    if (this.state === 'completed' || this.state === 'aborted') {
      this.state = 'idle';
      this.isVisible = false;
      this.attempt = null;
      this.approaching = null;
      this.lastResult = null;
    }
    return this.getSnapshot([]);
  }

  reset(): void {
    this.state = 'idle';
    this.isVisible = false;
    this.approaching = null;
    this.attempt = null;
    this.lastPoint = null;
    this.lastResult = null;
    this.signalQuality = 'good';
  }

  ingestPoint(point: GeoPoint): LiveSegmentSnapshot {
    const alerts: LiveSegmentAlert[] = [];

    if (!this.privacy.optedInLiveSegments) {
      this.reset();
      return this.getSnapshot(alerts);
    }

    const monotonicMs = point.monotonicMs ?? point.timestampMs;
    const isAccuracyDegraded =
      point.accuracyM !== undefined && point.accuracyM > this.thresholds.maxAccuracyM;

    const movementHeadingDeg = this.computeMovementHeading(point);

    if (this.state === 'completed' || this.state === 'aborted') {
      // Auto-withdraw resolved state once a new point arrives after resolution.
      this.acknowledgeResolution();
    }

    if (this.state === 'idle' || this.state === 'approaching') {
      this.signalQuality = isAccuracyDegraded ? 'degraded' : 'good';
      this.handleIdleOrApproaching(point, monotonicMs, movementHeadingDeg, isAccuracyDegraded, alerts);
    } else if (this.attempt) {
      this.handleActiveAttempt(point, monotonicMs, isAccuracyDegraded, alerts);
    }

    this.lastPoint = point;
    return this.getSnapshot(alerts);
  }

  private computeMovementHeading(point: GeoPoint): number | null {
    if (!this.lastPoint) {
      return null;
    }
    const movedM = haversineDistanceM(this.lastPoint, point);
    if (movedM < 2) {
      return null;
    }
    return computeBearingDeg(this.lastPoint, point);
  }

  private getAllowedDirections(
    segment: LiveSegmentDefinition,
  ): Array<'forward' | 'reverse'> {
    if (segment.direction === 'bidirectional') {
      return ['forward', 'reverse'];
    }
    return [segment.direction];
  }

  private handleIdleOrApproaching(
    point: GeoPoint,
    monotonicMs: number,
    headingDeg: number | null,
    isAccuracyDegraded: boolean,
    alerts: LiveSegmentAlert[],
  ): void {
    if (this.state === 'approaching' && this.approaching) {
      const startPt = this.approaching.trace[0];
      const distToStart = haversineDistanceM(point, startPt);
      this.approaching.distanceToStartM = distToStart;

      // Check start gate first (only on good GPS fix)
      if (!isAccuracyDegraded && distToStart <= this.thresholds.startRadiusM) {
        const startBearing = computeBearingDeg(
          this.approaching.trace[0],
          this.approaching.trace[1],
        );
        const headingOk =
          headingDeg === null ||
          angleDiffDeg(headingDeg, startBearing) <= this.thresholds.maxHeadingDiffDeg;

        if (headingOk) {
          this.startAttempt(this.approaching, point, monotonicMs, alerts);
          return;
        }
      }

      // Hysteresis: only exit approaching if beyond approachExitRadiusM
      if (distToStart > this.thresholds.approachExitRadiusM) {
        this.state = 'idle';
        this.isVisible = false;
        this.approaching = null;
      }
      return;
    }

    // State is idle: scan for closest eligible segment start within approachRadiusM
    let bestCandidate: ApproachingTarget | null = null;
    for (const seg of this.segments) {
      for (const dir of this.getAllowedDirections(seg)) {
        const trace = buildDirectedTrace(seg.points, dir);
        if (trace.length < 2) {
          continue;
        }
        const distToStart = haversineDistanceM(point, trace[0]);
        if (distToStart > this.thresholds.approachRadiusM) {
          continue;
        }

        const startBearing = computeBearingDeg(trace[0], trace[1]);
        if (
          headingDeg !== null &&
          angleDiffDeg(headingDeg, startBearing) > this.thresholds.maxHeadingDiffDeg
        ) {
          continue;
        }

        if (!bestCandidate || distToStart < bestCandidate.distanceToStartM) {
          bestCandidate = {
            segment: seg,
            direction: dir,
            trace,
            ghost: selectPreferredGhost(seg, this.preferredGhostKind),
            distanceToStartM: distToStart,
          };
        }
      }
    }

    if (bestCandidate) {
      this.approaching = bestCandidate;
      this.state = 'approaching';
      this.isVisible = true;
      alerts.push({
        type: 'approach',
        segmentId: bestCandidate.segment.id,
        timestampMs: point.timestampMs,
        deltaMs: null,
      });

      // Immediate start if already inside start gate with good accuracy
      if (!isAccuracyDegraded && bestCandidate.distanceToStartM <= this.thresholds.startRadiusM) {
        this.startAttempt(bestCandidate, point, monotonicMs, alerts);
      }
    }
  }

  private startAttempt(
    target: ApproachingTarget,
    point: GeoPoint,
    monotonicMs: number,
    alerts: LiveSegmentAlert[],
  ): void {
    const proj = projectPointOntoTrace(point, target.trace);
    this.attempt = {
      segment: target.segment,
      direction: target.direction,
      trace: target.trace,
      ghost: target.ghost,
      startedAtMs: point.timestampMs,
      startMonotonicMs: monotonicMs,
      pausedDurationMs: 0,
      pausedAtMonotonicMs: null,
      hadPause: false,
      hadGpsLoss: false,
      hadTeleport: false,
      maxDistanceCoveredM: proj.distanceAlongM,
      currentDistanceM: proj.distanceAlongM,
      offRouteConsecutiveCount: 0,
      lastGoodPoint: point,
      lastGoodMonotonicMs: monotonicMs,
      lastGoodDistanceAlongM: proj.distanceAlongM,
    };
    this.approaching = null;
    this.state = 'active';
    this.isVisible = true;
    this.signalQuality = 'good';

    alerts.push({
      type: 'start',
      segmentId: target.segment.id,
      timestampMs: point.timestampMs,
      deltaMs: 0,
    });
  }

  private handleActiveAttempt(
    point: GeoPoint,
    monotonicMs: number,
    isAccuracyDegraded: boolean,
    alerts: LiveSegmentAlert[],
  ): void {
    const attempt = this.attempt!;
    const dtSinceLastGoodMs = monotonicMs - attempt.lastGoodMonotonicMs;

    // Detect GPS loss if gap exceeds maxGpsGapMs
    if (dtSinceLastGoodMs > this.thresholds.maxGpsGapMs) {
      if (this.state !== 'gps_lost') {
        this.state = 'gps_lost';
        this.signalQuality = 'lost';
        attempt.hadGpsLoss = true;
        alerts.push({
          type: 'gps_lost',
          segmentId: attempt.segment.id,
          timestampMs: point.timestampMs,
          deltaMs: null,
        });
      }
    }

    if (isAccuracyDegraded) {
      if (this.state !== 'gps_lost') {
        this.signalQuality = 'degraded';
      }
      return;
    }

    // Good accuracy fix arrived: check for GPS restoration & teleportation
    if (this.state === 'gps_lost') {
      alerts.push({
        type: 'gps_restored',
        segmentId: attempt.segment.id,
        timestampMs: point.timestampMs,
        deltaMs: null,
      });
      this.state = 'active';
    }
    this.signalQuality = 'good';

    const proj = projectPointOntoTrace(point, attempt.trace);

    if (attempt.lastGoodPoint && dtSinceLastGoodMs > 0) {
      const straightDistM = haversineDistanceM(attempt.lastGoodPoint, point);
      const dtSec = dtSinceLastGoodMs / 1000;
      const impliedSpeedMps = straightDistM / dtSec;
      const traceJumpM = proj.distanceAlongM - attempt.lastGoodDistanceAlongM;

      if (
        impliedSpeedMps > this.thresholds.maxPlausibleSpeedMps ||
        (attempt.hadGpsLoss && traceJumpM > attempt.segment.totalDistanceM * 0.25)
      ) {
        attempt.hadTeleport = true;
      }
    }

    attempt.lastGoodPoint = point;
    attempt.lastGoodMonotonicMs = monotonicMs;
    attempt.lastGoodDistanceAlongM = proj.distanceAlongM;

    // Off-route / Rejoin hysteresis
    if (proj.distanceToTraceM > this.thresholds.offRouteThresholdM) {
      attempt.offRouteConsecutiveCount += 1;

      if (
        this.state === 'active' &&
        attempt.offRouteConsecutiveCount >= this.thresholds.offRouteGraceSamples
      ) {
        this.state = 'off_route';
        alerts.push({
          type: 'off_route',
          segmentId: attempt.segment.id,
          timestampMs: point.timestampMs,
          deltaMs: null,
        });
      }

      if (
        this.state === 'off_route' &&
        attempt.offRouteConsecutiveCount >= this.thresholds.offRouteAbortSamples
      ) {
        this.state = 'aborted';
        alerts.push({
          type: 'aborted',
          segmentId: attempt.segment.id,
          timestampMs: point.timestampMs,
          deltaMs: null,
          reason: 'off_route_aborted',
        });
      }
      return;
    }

    if (proj.distanceToTraceM <= this.thresholds.rejoinThresholdM) {
      attempt.offRouteConsecutiveCount = 0;
      if (this.state === 'off_route') {
        this.state = 'active';
        alerts.push({
          type: 'rejoined',
          segmentId: attempt.segment.id,
          timestampMs: point.timestampMs,
          deltaMs: null,
        });
      }
    }

    attempt.currentDistanceM = proj.distanceAlongM;
    attempt.maxDistanceCoveredM = Math.max(attempt.maxDistanceCoveredM, proj.distanceAlongM);

    // Finish gate check
    const finishPt = attempt.trace[attempt.trace.length - 1];
    const distToFinish = haversineDistanceM(point, finishPt);
    const totalDist = attempt.segment.totalDistanceM;

    if (
      distToFinish <= this.thresholds.finishRadiusM &&
      proj.distanceAlongM >= totalDist - this.thresholds.finishRadiusM
    ) {
      this.completeAttempt(point, monotonicMs, alerts);
    }
  }

  private completeAttempt(
    point: GeoPoint,
    monotonicMs: number,
    alerts: LiveSegmentAlert[],
  ): void {
    const attempt = this.attempt!;
    const elapsedMs = this.computeElapsedMs(attempt, monotonicMs);
    const totalDist = attempt.segment.totalDistanceM;
    const coverageRatio = Math.min(1, attempt.maxDistanceCoveredM / Math.max(1, totalDist));

    let invalidationReason: EffortInvalidationReason | undefined;
    if (attempt.hadTeleport) {
      invalidationReason = 'gps_teleport_detected';
    } else if (attempt.hadGpsLoss) {
      invalidationReason = 'gps_lost_during_effort';
    } else if (attempt.hadPause) {
      invalidationReason = 'paused_during_effort';
    } else if (coverageRatio < this.thresholds.minCoverageRatio) {
      invalidationReason = 'insufficient_coverage';
    }

    const isValidForLeaderboard = invalidationReason === undefined;

    const prGhost = attempt.segment.ghostProfiles.find((g) => g.kind === 'pr');
    const komGhost = attempt.segment.ghostProfiles.find(
      (g) => g.kind === 'kom' || g.kind === 'qom',
    );

    const beatPr = isValidForLeaderboard && prGhost ? elapsedMs < prGhost.totalTimeMs : false;
    const beatKom = isValidForLeaderboard && komGhost ? elapsedMs < komGhost.totalTimeMs : false;

    this.effortCounter += 1;
    const effort: FinalSegmentEffort = {
      effortId: `${attempt.segment.id}:${attempt.startedAtMs}:${this.effortCounter}`,
      segmentId: attempt.segment.id,
      segmentVersion: attempt.segment.version,
      sport: attempt.segment.sport,
      direction: attempt.direction,
      startedAtMs: attempt.startedAtMs,
      finishedAtMs: point.timestampMs,
      elapsedMs,
      distanceCoveredM: Number(attempt.maxDistanceCoveredM.toFixed(2)),
      coverageRatio: Number(coverageRatio.toFixed(4)),
      isValidForLeaderboard,
      invalidationReason,
      beatPr,
      beatKom,
      queuedForSync: !this.isOnline,
    };

    if (!this.isOnline) {
      this.offlineQueue.enqueue(effort);
    }

    this.lastResult = effort;
    this.state = 'completed';

    const deltaMs =
      attempt.ghost !== null ? elapsedMs - attempt.ghost.totalTimeMs : null;

    alerts.push({
      type: 'finish',
      segmentId: attempt.segment.id,
      timestampMs: point.timestampMs,
      deltaMs,
    });
  }

  private computeElapsedMs(attempt: ActiveAttempt, monotonicMs: number): number {
    const effectiveEnd = attempt.pausedAtMonotonicMs ?? monotonicMs;
    return Math.max(0, effectiveEnd - attempt.startMonotonicMs - attempt.pausedDurationMs);
  }

  private getSnapshot(alerts: LiveSegmentAlert[]): LiveSegmentSnapshot {
    if (this.state === 'approaching' && this.approaching) {
      return {
        state: 'approaching',
        isVisible: this.isVisible,
        segmentId: this.approaching.segment.id,
        segmentName: this.approaching.segment.name,
        sport: this.approaching.segment.sport,
        matchedDirection: this.approaching.direction,
        distanceToStartM: Number(this.approaching.distanceToStartM.toFixed(1)),
        distanceCoveredM: 0,
        totalDistanceM: this.approaching.segment.totalDistanceM,
        progressRatio: 0,
        elapsedMs: 0,
        isLiveEstimate: true,
        signalQuality: this.signalQuality,
        activeGhostKind: this.approaching.ghost?.kind ?? null,
        activeGhostLabel: this.approaching.ghost?.label ?? null,
        deltaMs: null,
        deltaDistanceM: null,
        projectedFinishMs: this.approaching.ghost?.totalTimeMs ?? null,
        alerts,
        finalResult: null,
      };
    }

    if (this.attempt) {
      const monotonicNow =
        this.lastPoint?.monotonicMs ??
        this.lastPoint?.timestampMs ??
        this.attempt.startMonotonicMs;
      const elapsedMs =
        this.state === 'completed' && this.lastResult
          ? this.lastResult.elapsedMs
          : this.computeElapsedMs(this.attempt, monotonicNow);

      const totalDist = this.attempt.segment.totalDistanceM;
      const distCovered = Math.min(totalDist, this.attempt.currentDistanceM);
      const progressRatio = Math.min(1, Math.max(0, distCovered / Math.max(1, totalDist)));

      let deltaMs: number | null = null;
      let deltaDistanceM: number | null = null;
      let projectedFinishMs: number | null = null;

      if (this.attempt.ghost) {
        const delta = computeLiveDelta(
          elapsedMs,
          distCovered,
          this.attempt.ghost,
          totalDist,
        );
        deltaMs = delta.deltaMs;
        deltaDistanceM = delta.deltaDistanceM;
        projectedFinishMs = delta.projectedFinishMs;
      }

      return {
        state: this.state,
        isVisible: this.isVisible,
        segmentId: this.attempt.segment.id,
        segmentName: this.attempt.segment.name,
        sport: this.attempt.segment.sport,
        matchedDirection: this.attempt.direction,
        distanceToStartM: 0,
        distanceCoveredM: Number(distCovered.toFixed(2)),
        totalDistanceM: totalDist,
        progressRatio: Number(progressRatio.toFixed(4)),
        elapsedMs,
        isLiveEstimate: this.state !== 'completed',
        signalQuality: this.signalQuality,
        activeGhostKind: this.attempt.ghost?.kind ?? null,
        activeGhostLabel: this.attempt.ghost?.label ?? null,
        deltaMs,
        deltaDistanceM,
        projectedFinishMs,
        alerts,
        finalResult: this.lastResult,
      };
    }

    return {
      state: 'idle',
      isVisible: false,
      segmentId: null,
      segmentName: null,
      sport: null,
      matchedDirection: null,
      distanceToStartM: null,
      distanceCoveredM: 0,
      totalDistanceM: 0,
      progressRatio: 0,
      elapsedMs: 0,
      isLiveEstimate: true,
      signalQuality: this.signalQuality,
      activeGhostKind: null,
      activeGhostLabel: null,
      deltaMs: null,
      deltaDistanceM: null,
      projectedFinishMs: null,
      alerts,
      finalResult: null,
    };
  }
}
