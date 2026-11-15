/**
 * K6.09 / K6.11 / S6.01 / S6.02 — Enregistrement autonome sur montre,
 * séparation horloge civile UTC / horloge monotone par `bootId`, reprise après
 * redémarrage, file locale de sorties hors ligne et rapprochement idempotent
 * côté téléphone.
 *
 * Invariants vérifiés :
 * 1. Identité de séance (`watchSessionId` UUID v4) figée avant le premier point
 *    et réutilisée comme `clientSessionId` côté téléphone (zéro double séance).
 * 2. Horloge monotone rattachée à `bootId` : un saut d'heure système (UTC avancé
 *    ou reculé) utilise le delta monotone du même démarrage et trace une anomalie
 *    sans fausser `elapsedMs`/`movingMs`.
 * 3. Redémarrage de la montre en cours de sortie (`bootId` modifié) : détection
 *    explicite (`reboot_detected`), incrément de `sourceGeneration`, `breakBefore`
 *    sur le premier point post-reboot, aucune soustraction entre deux `bootId`
 *    distincts ni durée inventée pendant l'extinction.
 * 4. Coupure Bluetooth/réseau et perte d'ACK : les lots (`WatchSessionBatchEnvelope`)
 *    sont rejouables sans perte ni doublon grâce au couple `(watchSessionId, seq)`.
 */

import type {
  ReconciledPhoneSession,
  WatchAutonomousSession,
  WatchGpsPoint,
  WatchGpsPointInput,
  WatchPauseEvent,
  WatchPlatform,
  WatchSessionAckEnvelope,
  WatchSessionBatchEnvelope,
  WatchSessionSummaryPayload,
} from './types';

const CLOCK_DRIFT_THRESHOLD_MS = 5_000;

export function formatWatchPointKey(watchSessionId: string, seq: number): string {
  return `${watchSessionId}:${String(seq).padStart(12, '0')}`;
}

export function generateWatchUuid(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

/** Distance géodésique Haversine en mètres. */
export function haversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return R * c;
}

export interface StartWatchSessionOptions {
  watchSessionId?: string;
  deviceId: string;
  platform: WatchPlatform;
  sport: string;
  routePackId?: string | null;
  startedAtUtcMs: number;
  monotonicMs?: number | null;
  bootId: string;
}

/**
 * File locale persistante côté montre (Apple Watch / Wear OS).
 * Gère le cycle de vie d'une ou plusieurs sorties enregistrées sans téléphone,
 * la reprise après crash/redémarrage et l'émission de lots idempotents.
 */
export class WatchOfflineSessionQueue {
  private readonly sessions = new Map<string, WatchAutonomousSession>();

  /**
   * Démarre une séance ou reprend la séance locale ouverte pour éviter toute
   * création implicite de doublon au relancement de l'app montre (Recherche 01).
   */
  startOrResumeSession(options: StartWatchSessionOptions): {
    session: WatchAutonomousSession;
    resumedExisting: boolean;
  } {
    if (options.watchSessionId) {
      const byId = this.sessions.get(options.watchSessionId);
      if (byId) {
        this.detectRebootIfNeeded(
          byId,
          options.bootId,
          options.startedAtUtcMs,
          options.monotonicMs ?? null,
        );
        return { session: this.cloneSession(byId), resumedExisting: true };
      }
    }

    // Si une séance non terminée existe déjà sur ce même appareil, on la reprend
    for (const existing of this.sessions.values()) {
      if (
        existing.deviceId === options.deviceId &&
        existing.status !== 'finished'
      ) {
        this.detectRebootIfNeeded(
          existing,
          options.bootId,
          options.startedAtUtcMs,
          options.monotonicMs ?? null,
        );
        return { session: this.cloneSession(existing), resumedExisting: true };
      }
    }

    const watchSessionId = options.watchSessionId ?? generateWatchUuid();
    const session: WatchAutonomousSession = {
      watchSessionId,
      deviceId: options.deviceId,
      platform: options.platform,
      sport: options.sport,
      routePackId: options.routePackId ?? null,
      status: 'recording',
      syncState: 'pending_local',
      sourceGeneration: 1,
      currentBootId: options.bootId,
      startedAtUtcMs: options.startedAtUtcMs,
      endedAtUtcMs: null,
      lastTimestampUtcMs: options.startedAtUtcMs,
      lastMonotonicMs: options.monotonicMs ?? null,
      elapsedMs: 0,
      movingMs: 0,
      distanceM: 0,
      elevGainM: 0,
      elevLossM: 0,
      lastPointSeq: 0,
      ackedThroughSeq: 0,
      lastEventSeq: 0,
      ackedEventSeq: 0,
      summaryAcked: false,
      points: [],
      events: [],
      clockAnomalies: [],
      updatedAtUtcMs: options.startedAtUtcMs,
    };

    this.sessions.set(watchSessionId, session);
    return { session: this.cloneSession(session), resumedExisting: false };
  }

  private detectRebootIfNeeded(
    session: WatchAutonomousSession,
    bootId: string,
    atUtcMs: number,
    monotonicMs: number | null,
  ): boolean {
    if (session.currentBootId === bootId) return false;
    session.currentBootId = bootId;
    session.sourceGeneration += 1;
    session.lastMonotonicMs = monotonicMs;
    session.lastTimestampUtcMs = Math.max(session.lastTimestampUtcMs, atUtcMs);
    this.pushEvent(session, {
      type: 'reboot_detected',
      atUtcMs,
      monotonicMs,
      bootId,
      reason: 'Redémarrage matériel détecté : rupture d’horloge monotone isolée.',
    });
    return true;
  }

  private pushEvent(
    session: WatchAutonomousSession,
    eventInput: Omit<WatchPauseEvent, 'seq'>,
  ): WatchPauseEvent {
    session.lastEventSeq += 1;
    const event: WatchPauseEvent = {
      seq: session.lastEventSeq,
      ...eventInput,
    };
    session.events.push(event);
    session.updatedAtUtcMs = eventInput.atUtcMs;
    if (session.syncState === 'synced') {
      session.syncState = 'partially_acked';
    }
    return event;
  }

  /**
   * Ajoute une observation GPS à la séance autonome.
   * Refuse les coordonnées non finies et n'invente aucune métrique capteur.
   */
  appendPoint(
    watchSessionId: string,
    input: WatchGpsPointInput,
  ): WatchGpsPoint {
    const session = this.sessions.get(watchSessionId);
    if (!session) {
      throw new Error(`Watch session not found: ${watchSessionId}`);
    }
    if (session.status === 'finished') {
      throw new Error(`Cannot append point to finished session: ${watchSessionId}`);
    }
    if (
      !Number.isFinite(input.lat) ||
      !Number.isFinite(input.lng) ||
      Math.abs(input.lat) > 90 ||
      Math.abs(input.lng) > 180
    ) {
      throw new Error('Invalid GPS coordinates');
    }

    const previousPoint =
      session.points.length > 0 ? session.points[session.points.length - 1] : null;
    const rebooted = this.detectRebootIfNeeded(
      session,
      input.bootId,
      input.recordedAtUtcMs,
      input.monotonicMs ?? null,
    );

    // Calcul de durée protégé contre les sauts d'horloge système et les reboots
    const deltaUtcMs = input.recordedAtUtcMs - session.lastTimestampUtcMs;
    let effectiveDeltaMs = 0;

    if (!rebooted) {
      const hasMonotonic =
        typeof input.monotonicMs === 'number' &&
        Number.isFinite(input.monotonicMs) &&
        typeof session.lastMonotonicMs === 'number' &&
        Number.isFinite(session.lastMonotonicMs);

      const monotonicDeltaMs = hasMonotonic
        ? (input.monotonicMs as number) - (session.lastMonotonicMs as number)
        : null;

      if (
        monotonicDeltaMs !== null &&
        monotonicDeltaMs >= 0 &&
        (deltaUtcMs < 0 ||
          Math.abs(deltaUtcMs - monotonicDeltaMs) > CLOCK_DRIFT_THRESHOLD_MS)
      ) {
        session.clockAnomalies.push({
          atUtcMs: input.recordedAtUtcMs,
          previousUtcMs: session.lastTimestampUtcMs,
          deltaUtcMs,
          monotonicDeltaMs,
          bootId: input.bootId,
        });
        this.pushEvent(session, {
          type: 'clock_jump_detected',
          atUtcMs: input.recordedAtUtcMs,
          monotonicMs: input.monotonicMs ?? null,
          bootId: input.bootId,
          reason: `Saut d'horloge civile (${deltaUtcMs} ms vs monotone ${monotonicDeltaMs} ms)`,
        });
        effectiveDeltaMs = monotonicDeltaMs;
      } else if (monotonicDeltaMs !== null && monotonicDeltaMs >= 0) {
        effectiveDeltaMs = monotonicDeltaMs;
      } else if (deltaUtcMs > 0) {
        effectiveDeltaMs = deltaUtcMs;
      } else if (deltaUtcMs < 0) {
        session.clockAnomalies.push({
          atUtcMs: input.recordedAtUtcMs,
          previousUtcMs: session.lastTimestampUtcMs,
          deltaUtcMs,
          monotonicDeltaMs: null,
          bootId: input.bootId,
        });
        effectiveDeltaMs = 0;
      }
    }

    const isPaused = session.status === 'paused';
    const lastEvent =
      session.events.length > 0 ? session.events[session.events.length - 1] : null;
    const hadBreakEventSincePreviousPoint =
      previousPoint !== null &&
      lastEvent !== null &&
      (lastEvent.type === 'resume' ||
        lastEvent.type === 'reboot_detected' ||
        lastEvent.type === 'handoff_to_watch') &&
      lastEvent.atUtcMs >= previousPoint.recordedAtUtcMs;

    const breakBefore =
      previousPoint === null || rebooted || isPaused || hadBreakEventSincePreviousPoint;

    session.elapsedMs += effectiveDeltaMs;
    if (!isPaused && !rebooted) {
      session.movingMs += effectiveDeltaMs;
    }

    if (previousPoint && !isPaused && !breakBefore) {
      const segDist = haversineDistanceM(
        previousPoint.lat,
        previousPoint.lng,
        input.lat,
        input.lng,
      );
      session.distanceM += segDist;

      if (
        typeof previousPoint.eleM === 'number' &&
        Number.isFinite(previousPoint.eleM) &&
        typeof input.eleM === 'number' &&
        Number.isFinite(input.eleM)
      ) {
        const diffEle = input.eleM - previousPoint.eleM;
        if (diffEle > 0) session.elevGainM += diffEle;
        else if (diffEle < 0) session.elevLossM += Math.abs(diffEle);
      }
    }

    session.lastPointSeq += 1;
    session.lastTimestampUtcMs = input.recordedAtUtcMs;
    session.lastMonotonicMs = input.monotonicMs ?? null;
    session.updatedAtUtcMs = input.recordedAtUtcMs;

    const point: WatchGpsPoint = {
      key: formatWatchPointKey(watchSessionId, session.lastPointSeq),
      watchSessionId,
      seq: session.lastPointSeq,
      recordedAtUtcMs: input.recordedAtUtcMs,
      monotonicMs: input.monotonicMs ?? null,
      bootId: input.bootId,
      lat: input.lat,
      lng: input.lng,
      eleM: typeof input.eleM === 'number' && Number.isFinite(input.eleM) ? input.eleM : null,
      accuracyM:
        typeof input.accuracyM === 'number' && Number.isFinite(input.accuracyM)
          ? input.accuracyM
          : null,
      speedMps:
        typeof input.speedMps === 'number' && Number.isFinite(input.speedMps)
          ? input.speedMps
          : null,
      heartRateBpm:
        typeof input.heartRateBpm === 'number' && Number.isFinite(input.heartRateBpm)
          ? input.heartRateBpm
          : null,
      drawn: input.drawn ?? !isPaused,
      breakBefore,
    };

    session.points.push(point);
    if (session.syncState === 'synced') {
      session.syncState = 'partially_acked';
    }
    return { ...point };
  }

  pauseSession(
    watchSessionId: string,
    atUtcMs: number,
    monotonicMs: number | null,
    bootId: string,
    reason?: string,
  ): WatchAutonomousSession {
    const session = this.sessions.get(watchSessionId);
    if (!session) throw new Error(`Watch session not found: ${watchSessionId}`);
    if (session.status === 'finished' || session.status === 'paused') {
      return this.cloneSession(session);
    }

    this.detectRebootIfNeeded(session, bootId, atUtcMs, monotonicMs);
    const deltaMs = this.computeStepDeltaMs(session, atUtcMs, monotonicMs);
    session.elapsedMs += deltaMs;
    session.movingMs += deltaMs;
    session.lastTimestampUtcMs = atUtcMs;
    session.lastMonotonicMs = monotonicMs;
    session.status = 'paused';

    this.pushEvent(session, {
      type: 'pause',
      atUtcMs,
      monotonicMs,
      bootId,
      reason,
    });
    return this.cloneSession(session);
  }

  resumeSession(
    watchSessionId: string,
    atUtcMs: number,
    monotonicMs: number | null,
    bootId: string,
  ): WatchAutonomousSession {
    const session = this.sessions.get(watchSessionId);
    if (!session) throw new Error(`Watch session not found: ${watchSessionId}`);
    if (session.status !== 'paused') {
      return this.cloneSession(session);
    }

    const rebooted = this.detectRebootIfNeeded(session, bootId, atUtcMs, monotonicMs);
    if (!rebooted) {
      const deltaMs = this.computeStepDeltaMs(session, atUtcMs, monotonicMs);
      session.elapsedMs += deltaMs;
    }
    session.lastTimestampUtcMs = atUtcMs;
    session.lastMonotonicMs = monotonicMs;
    session.status = 'recording';

    this.pushEvent(session, {
      type: 'resume',
      atUtcMs,
      monotonicMs,
      bootId,
    });
    return this.cloneSession(session);
  }

  /**
   * Révocation de permission en cours de séance (Recherche 01) :
   * arrête proprement la capture tout en préservant l'intégralité des points déjà acquis.
   */
  handlePermissionRevoked(
    watchSessionId: string,
    atUtcMs: number,
    monotonicMs: number | null,
    bootId: string,
  ): WatchAutonomousSession {
    const session = this.sessions.get(watchSessionId);
    if (!session) throw new Error(`Watch session not found: ${watchSessionId}`);
    if (session.status !== 'finished') {
      session.status = 'paused';
      this.pushEvent(session, {
        type: 'permission_revoked',
        atUtcMs,
        monotonicMs,
        bootId,
        reason: 'Permission localisation/santé retirée : données acquises conservées.',
      });
    }
    return this.cloneSession(session);
  }

  finishSession(
    watchSessionId: string,
    endedAtUtcMs: number,
    monotonicMs: number | null,
    bootId: string,
  ): WatchAutonomousSession {
    const session = this.sessions.get(watchSessionId);
    if (!session) throw new Error(`Watch session not found: ${watchSessionId}`);
    if (session.status === 'finished') {
      return this.cloneSession(session);
    }

    const wasPaused = session.status === 'paused';
    const rebooted = this.detectRebootIfNeeded(session, bootId, endedAtUtcMs, monotonicMs);
    if (!rebooted) {
      const deltaMs = this.computeStepDeltaMs(session, endedAtUtcMs, monotonicMs);
      session.elapsedMs += deltaMs;
      if (!wasPaused) {
        session.movingMs += deltaMs;
      }
    }

    session.lastTimestampUtcMs = endedAtUtcMs;
    session.lastMonotonicMs = monotonicMs;
    session.endedAtUtcMs = endedAtUtcMs;
    session.status = 'finished';
    session.updatedAtUtcMs = endedAtUtcMs;
    return this.cloneSession(session);
  }

  private computeStepDeltaMs(
    session: WatchAutonomousSession,
    atUtcMs: number,
    monotonicMs: number | null,
  ): number {
    if (
      typeof monotonicMs === 'number' &&
      Number.isFinite(monotonicMs) &&
      typeof session.lastMonotonicMs === 'number' &&
      Number.isFinite(session.lastMonotonicMs) &&
      monotonicMs >= session.lastMonotonicMs
    ) {
      return monotonicMs - session.lastMonotonicMs;
    }
    const utcDelta = atUtcMs - session.lastTimestampUtcMs;
    return utcDelta > 0 ? utcDelta : 0;
  }

  /**
   * Construit les lots en attente d'acquittement pour une séance.
   * Si la connexion Bluetooth coupe avant la réception de l'ACK, le prochain appel
   * renvoie exactement les mêmes séquences (`fromSeq = ackedThroughSeq + 1`).
   */
  buildPendingBatches(
    watchSessionId: string,
    options: { maxPointsPerBatch?: number; nowUtcMs?: number } = {},
  ): WatchSessionBatchEnvelope[] {
    const session = this.sessions.get(watchSessionId);
    if (!session) return [];

    const maxPoints = Math.max(1, options.maxPointsPerBatch ?? 100);
    const nowUtcMs = options.nowUtcMs ?? Date.now();
    const unackedPoints = session.points.filter((pt) => pt.seq > session.ackedThroughSeq);
    const unackedEvents = session.events.filter((ev) => ev.seq > session.ackedEventSeq);
    const needsSummary = session.status === 'finished' && !session.summaryAcked;

    if (unackedPoints.length === 0 && unackedEvents.length === 0 && !needsSummary) {
      return [];
    }

    session.syncState = 'transferring';
    const batches: WatchSessionBatchEnvelope[] = [];

    if (unackedPoints.length === 0) {
      const summary = needsSummary ? this.buildSummaryPayload(session) : null;
      batches.push({
        batchId: `${session.watchSessionId}:gen${session.sourceGeneration}:seq${session.ackedThroughSeq}-${session.lastPointSeq}:ev${session.lastEventSeq}`,
        watchSessionId: session.watchSessionId,
        deviceId: session.deviceId,
        platform: session.platform,
        sport: session.sport,
        routePackId: session.routePackId,
        sourceGeneration: session.sourceGeneration,
        fromSeq: session.ackedThroughSeq,
        toSeq: session.lastPointSeq,
        points: [],
        events: unackedEvents.map((e) => ({ ...e })),
        summary,
        sentAtUtcMs: nowUtcMs,
      });
      return batches;
    }

    for (let offset = 0; offset < unackedPoints.length; offset += maxPoints) {
      const slice = unackedPoints.slice(offset, offset + maxPoints);
      const isLastChunk = offset + maxPoints >= unackedPoints.length;
      const fromSeq = slice[0].seq;
      const toSeq = slice[slice.length - 1].seq;
      const summary = isLastChunk && needsSummary ? this.buildSummaryPayload(session) : null;

      batches.push({
        batchId: `${session.watchSessionId}:gen${session.sourceGeneration}:seq${fromSeq}-${toSeq}`,
        watchSessionId: session.watchSessionId,
        deviceId: session.deviceId,
        platform: session.platform,
        sport: session.sport,
        routePackId: session.routePackId,
        sourceGeneration: session.sourceGeneration,
        fromSeq,
        toSeq,
        points: slice.map((p) => ({ ...p })),
        events: isLastChunk ? unackedEvents.map((e) => ({ ...e })) : [],
        summary,
        sentAtUtcMs: nowUtcMs,
      });
    }

    return batches;
  }

  private buildSummaryPayload(
    session: WatchAutonomousSession,
  ): WatchSessionSummaryPayload {
    const endedAt = session.endedAtUtcMs ?? session.lastTimestampUtcMs;
    return {
      watchSessionId: session.watchSessionId,
      deviceId: session.deviceId,
      platform: session.platform,
      sport: session.sport,
      routePackId: session.routePackId,
      startedAtUtcMs: session.startedAtUtcMs,
      endedAtUtcMs: endedAt,
      elapsedMs: Math.round(session.elapsedMs),
      movingMs: Math.round(session.movingMs),
      distanceM: Math.round(session.distanceM * 100) / 100,
      elevGainM: Math.round(session.elevGainM * 100) / 100,
      elevLossM: Math.round(session.elevLossM * 100) / 100,
      totalPoints: session.points.length,
      totalEvents: session.events.length,
      sourceGeneration: session.sourceGeneration,
      idempotencyKey: `watch-finish:${session.watchSessionId}`,
    };
  }

  /**
   * Applique de manière idempotente un accusé de réception du téléphone.
   * Un ACK ancien ou dupliqué ne fait jamais reculer `ackedThroughSeq`.
   */
  acknowledge(ack: WatchSessionAckEnvelope): WatchAutonomousSession | null {
    const session = this.sessions.get(ack.watchSessionId);
    if (!session) return null;

    if (ack.ackedThroughSeq > session.ackedThroughSeq) {
      session.ackedThroughSeq = Math.min(ack.ackedThroughSeq, session.lastPointSeq);
    }
    if (ack.ackedEventSeq > session.ackedEventSeq) {
      session.ackedEventSeq = Math.min(ack.ackedEventSeq, session.lastEventSeq);
    }
    if (ack.summaryAcked) {
      session.summaryAcked = true;
    }

    const allPointsAcked = session.ackedThroughSeq >= session.lastPointSeq;
    const allEventsAcked = session.ackedEventSeq >= session.lastEventSeq;
    const fullySynced =
      allPointsAcked &&
      allEventsAcked &&
      (session.status !== 'finished' || session.summaryAcked);

    session.syncState = fullySynced ? 'synced' : 'partially_acked';
    session.updatedAtUtcMs = ack.ackedAtUtcMs;
    return this.cloneSession(session);
  }

  getSession(watchSessionId: string): WatchAutonomousSession | null {
    const session = this.sessions.get(watchSessionId);
    return session ? this.cloneSession(session) : null;
  }

  listPendingSessions(): WatchAutonomousSession[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.syncState !== 'synced')
      .map((s) => this.cloneSession(s));
  }

  private cloneSession(session: WatchAutonomousSession): WatchAutonomousSession {
    return {
      ...session,
      points: session.points.map((p) => ({ ...p })),
      events: session.events.map((e) => ({ ...e })),
      clockAnomalies: session.clockAnomalies.map((a) => ({ ...a })),
    };
  }
}

/**
 * Récepteur et réconciliateur côté téléphone (iOS / Android).
 * Garantit qu'une séance enregistrée sur montre (même avec redémarrage et
 * coupures Bluetooth multiples) produit UNE SEULE séance canonique
 * (`clientSessionId === watchSessionId`), sans point perdu ni doublon.
 */
export class WatchSessionReconciler {
  private readonly reconciled = new Map<
    string,
    {
      meta: Omit<ReconciledPhoneSession, 'points' | 'events'>;
      pointsBySeq: Map<number, WatchGpsPoint>;
      eventsBySeq: Map<number, WatchPauseEvent>;
    }
  >();

  ingestBatch(
    batch: WatchSessionBatchEnvelope,
    nowUtcMs = Date.now(),
  ): {
    ack: WatchSessionAckEnvelope;
    session: ReconciledPhoneSession;
  } {
    let entry = this.reconciled.get(batch.watchSessionId);
    if (!entry) {
      const firstPointStart =
        batch.points.length > 0 ? batch.points[0].recordedAtUtcMs : batch.sentAtUtcMs;
      entry = {
        meta: {
          clientSessionId: batch.watchSessionId,
          watchSessionId: batch.watchSessionId,
          deviceId: batch.deviceId,
          platform: batch.platform,
          sport: batch.sport,
          routePackId: batch.routePackId,
          status: 'active',
          startedAtUtcMs: batch.summary?.startedAtUtcMs ?? firstPointStart,
          endedAtUtcMs: null,
          elapsedMs: 0,
          movingMs: 0,
          distanceM: 0,
          elevGainM: 0,
          elevLossM: 0,
          lastContiguousPointSeq: 0,
          lastEventSeq: 0,
          batchesReceivedCount: 0,
          duplicatePointsIgnored: 0,
          duplicateEventsIgnored: 0,
          summarySaved: false,
          updatedAtUtcMs: nowUtcMs,
        },
        pointsBySeq: new Map(),
        eventsBySeq: new Map(),
      };
      this.reconciled.set(batch.watchSessionId, entry);
    }

    entry.meta.batchesReceivedCount += 1;
    entry.meta.updatedAtUtcMs = nowUtcMs;

    for (const point of batch.points) {
      if (point.watchSessionId !== batch.watchSessionId) continue;
      if (entry.pointsBySeq.has(point.seq)) {
        entry.meta.duplicatePointsIgnored += 1;
        continue;
      }
      entry.pointsBySeq.set(point.seq, { ...point });
    }

    for (const event of batch.events) {
      if (entry.eventsBySeq.has(event.seq)) {
        entry.meta.duplicateEventsIgnored += 1;
        continue;
      }
      entry.eventsBySeq.set(event.seq, { ...event });
      if (event.seq > entry.meta.lastEventSeq) {
        entry.meta.lastEventSeq = event.seq;
      }
    }

    // Calcul du plus grand numéro de séquence contigu depuis 1
    while (entry.pointsBySeq.has(entry.meta.lastContiguousPointSeq + 1)) {
      entry.meta.lastContiguousPointSeq += 1;
    }

    if (batch.summary) {
      entry.meta.startedAtUtcMs = batch.summary.startedAtUtcMs;
      entry.meta.endedAtUtcMs = batch.summary.endedAtUtcMs;
      entry.meta.elapsedMs = batch.summary.elapsedMs;
      entry.meta.movingMs = batch.summary.movingMs;
      entry.meta.distanceM = batch.summary.distanceM;
      entry.meta.elevGainM = batch.summary.elevGainM;
      entry.meta.elevLossM = batch.summary.elevLossM;
      entry.meta.status = 'finished';
      entry.meta.summarySaved = true;
    } else {
      this.recomputeInterimMetricsFromPoints(entry);
    }

    const session = this.materializeSession(entry);
    const ack: WatchSessionAckEnvelope = {
      watchSessionId: batch.watchSessionId,
      ackedThroughSeq: entry.meta.lastContiguousPointSeq,
      ackedEventSeq: entry.meta.lastEventSeq,
      summaryAcked: entry.meta.summarySaved &&
        (!batch.summary || entry.meta.lastContiguousPointSeq >= batch.summary.totalPoints),
      canonicalClientSessionId: batch.watchSessionId,
      ackedAtUtcMs: nowUtcMs,
    };

    return { ack, session };
  }

  private recomputeInterimMetricsFromPoints(entry: {
    meta: Omit<ReconciledPhoneSession, 'points' | 'events'>;
    pointsBySeq: Map<number, WatchGpsPoint>;
  }): void {
    const ordered = Array.from(entry.pointsBySeq.values()).sort((a, b) => a.seq - b.seq);
    if (ordered.length === 0) return;

    entry.meta.startedAtUtcMs = Math.min(
      entry.meta.startedAtUtcMs,
      ordered[0].recordedAtUtcMs,
    );

    let dist = 0;
    let gain = 0;
    let loss = 0;
    for (let i = 1; i < ordered.length; i += 1) {
      const prev = ordered[i - 1];
      const curr = ordered[i];
      if (!curr.breakBefore && curr.drawn) {
        dist += haversineDistanceM(prev.lat, prev.lng, curr.lat, curr.lng);
        if (prev.eleM !== null && curr.eleM !== null) {
          const diff = curr.eleM - prev.eleM;
          if (diff > 0) gain += diff;
          else if (diff < 0) loss += Math.abs(diff);
        }
      }
    }

    entry.meta.distanceM = Math.round(dist * 100) / 100;
    entry.meta.elevGainM = Math.round(gain * 100) / 100;
    entry.meta.elevLossM = Math.round(loss * 100) / 100;
  }

  private materializeSession(entry: {
    meta: Omit<ReconciledPhoneSession, 'points' | 'events'>;
    pointsBySeq: Map<number, WatchGpsPoint>;
    eventsBySeq: Map<number, WatchPauseEvent>;
  }): ReconciledPhoneSession {
    const points = Array.from(entry.pointsBySeq.values())
      .sort((a, b) => a.seq - b.seq)
      .map((p) => ({ ...p }));
    const events = Array.from(entry.eventsBySeq.values())
      .sort((a, b) => a.seq - b.seq)
      .map((e) => ({ ...e }));

    return {
      ...entry.meta,
      points,
      events,
    };
  }

  getReconciledSession(watchSessionId: string): ReconciledPhoneSession | null {
    const entry = this.reconciled.get(watchSessionId);
    return entry ? this.materializeSession(entry) : null;
  }

  listReconciledSessions(): ReconciledPhoneSession[] {
    return Array.from(this.reconciled.values()).map((entry) =>
      this.materializeSession(entry),
    );
  }
}
