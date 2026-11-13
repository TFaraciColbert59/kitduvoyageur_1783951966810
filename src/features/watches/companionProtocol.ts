/**
 * Orchestrateur du protocole compagnon montre <-> téléphone
 * (`WatchConnectivity` sur iOS/watchOS, `Wear DataLayer` sur Android/Wear OS).
 *
 * Invariant D03 :
 * - Fail-closed avec statut explicite `native_target_unavailable` lorsqu'aucun
 *   adaptateur natif WatchKit / Wear OS n'est injecté ou lorsque l'adaptateur
 *   signale que la cible native est absente.
 * - Coordonne le vidage automatique de la file de sorties hors ligne à la
 *   reconnexion Bluetooth, avec accusés de réception idempotents.
 */

import { inspectWatchNativeTargets } from './nativeTargets';
import { WatchOfflineSessionQueue, WatchSessionReconciler } from './sessionQueue';
import type {
  ReconciledPhoneSession,
  WatchCompanionTransportAdapter,
  WatchLiveSyncFrame,
  WatchNativeAvailabilityStatus,
  WatchOfflinePackChunk,
  WatchProtocolMessage,
  WatchSessionAckEnvelope,
} from './types';

export interface FlushWatchQueueResult {
  status: WatchNativeAvailabilityStatus | 'flushed' | 'partially_flushed';
  batchesSent: number;
  acksApplied: number;
  reconciledSessions: ReconciledPhoneSession[];
}

export class WatchCompanionBridge {
  private readonly adapter: WatchCompanionTransportAdapter | null;
  private readonly watchQueue: WatchOfflineSessionQueue;
  private readonly phoneReconciler: WatchSessionReconciler;

  constructor(options: {
    adapter?: WatchCompanionTransportAdapter | null;
    watchQueue?: WatchOfflineSessionQueue;
    phoneReconciler?: WatchSessionReconciler;
  } = {}) {
    this.adapter = options.adapter ?? null;
    this.watchQueue = options.watchQueue ?? new WatchOfflineSessionQueue();
    this.phoneReconciler = options.phoneReconciler ?? new WatchSessionReconciler();
  }

  async getAvailabilityStatus(): Promise<WatchNativeAvailabilityStatus> {
    if (!this.adapter) {
      return inspectWatchNativeTargets().status;
    }
    const nativePresent = await this.adapter.isNativeTargetAvailable();
    if (!nativePresent) {
      return 'native_target_unavailable';
    }
    const reachable = await this.adapter.isCompanionReachable();
    if (!reachable) {
      return 'companion_disconnected';
    }
    return 'available';
  }

  /**
   * Vide les séances hors ligne en attente de la montre vers le téléphone.
   * Si la connexion tombe au milieu d'un envoi de lots, les lots déjà acquittés
   * restent acquis et un appel ultérieur reprend exactement à `ackedThroughSeq + 1`.
   */
  async flushPendingSessions(
    options: { maxPointsPerBatch?: number; nowUtcMs?: number } = {},
  ): Promise<FlushWatchQueueResult> {
    const status = await this.getAvailabilityStatus();
    if (status !== 'available' || !this.adapter) {
      return {
        status,
        batchesSent: 0,
        acksApplied: 0,
        reconciledSessions: this.phoneReconciler.listReconciledSessions(),
      };
    }

    const pendingSessions = this.watchQueue.listPendingSessions();
    let batchesSent = 0;
    let acksApplied = 0;
    let interrupted = false;

    for (const session of pendingSessions) {
      const batches = this.watchQueue.buildPendingBatches(session.watchSessionId, options);
      for (const batch of batches) {
        const reachable = await this.adapter.isCompanionReachable();
        if (!reachable) {
          interrupted = true;
          break;
        }

        const sendRes = await this.adapter.sendMessage({
          type: 'session_batch',
          channel: this.adapter.channel,
          payload: batch,
        });
        if (!sendRes.delivered) {
          interrupted = true;
          break;
        }

        batchesSent += 1;
        const { ack } = this.phoneReconciler.ingestBatch(batch, options.nowUtcMs);

        const ackDelivery = await this.adapter.sendMessage({
          type: 'session_ack',
          channel: this.adapter.channel,
          payload: ack,
        });

        // Si l'ACK est perdu sur le lien Bluetooth retour, le téléphone a déjà
        // enregistré le lot de manière idempotente, mais la montre ne marque pas
        // le lot comme acquitté et le renverra sans créer de doublon.
        if (!ackDelivery.delivered) {
          interrupted = true;
          break;
        }

        this.watchQueue.acknowledge(ack);
        acksApplied += 1;
      }

      if (interrupted) break;
    }

    return {
      status: interrupted ? 'partially_flushed' : 'flushed',
      batchesSent,
      acksApplied,
      reconciledSessions: this.phoneReconciler.listReconciledSessions(),
    };
  }

  async sendLiveSyncFrame(frame: WatchLiveSyncFrame): Promise<{
    delivered: boolean;
    status: WatchNativeAvailabilityStatus;
  }> {
    const status = await this.getAvailabilityStatus();
    if (status !== 'available' || !this.adapter) {
      return { delivered: false, status };
    }
    const res = await this.adapter.sendMessage({
      type: 'live_sync_frame',
      channel: this.adapter.channel,
      payload: frame,
    });
    return {
      delivered: res.delivered,
      status: res.delivered ? 'available' : 'companion_disconnected',
    };
  }

  async sendOfflinePackChunk(chunk: WatchOfflinePackChunk): Promise<{
    delivered: boolean;
    status: WatchNativeAvailabilityStatus;
  }> {
    const status = await this.getAvailabilityStatus();
    if (status !== 'available' || !this.adapter) {
      return { delivered: false, status };
    }
    const res = await this.adapter.sendMessage({
      type: 'offline_pack_chunk',
      channel: this.adapter.channel,
      payload: chunk,
    });
    return {
      delivered: res.delivered,
      status: res.delivered ? 'available' : 'companion_disconnected',
    };
  }
}

/**
 * Adaptateur mémoire / simulateur de lien Bluetooth (WatchConnectivity / Wear DataLayer)
 * utilisé pour les tests d'intégration du protocole compagnon (simulation de
 * coupure Bluetooth, perte d'ACK, reprise et rejeu idempotent).
 */
export class SimulatedWatchCompanionTransport implements WatchCompanionTransportAdapter {
  readonly channel: WatchCompanionTransportAdapter['channel'];
  readonly platform: WatchCompanionTransportAdapter['platform'];
  private nativeAvailable: boolean;
  private reachable: boolean;
  private dropNextAckCount = 0;
  private dropAfterSentMessages: number | null = null;
  private sentMessagesCount = 0;
  private readonly handlers = new Set<(message: WatchProtocolMessage) => void | Promise<void>>();
  readonly sentLog: WatchProtocolMessage[] = [];

  constructor(options: {
    platform: WatchCompanionTransportAdapter['platform'];
    nativeAvailable?: boolean;
    reachable?: boolean;
  }) {
    this.platform = options.platform;
    this.channel =
      options.platform === 'apple_watch' ? 'watch_connectivity' : 'wear_data_layer';
    this.nativeAvailable = options.nativeAvailable ?? true;
    this.reachable = options.reachable ?? true;
  }

  setNativeAvailable(available: boolean): void {
    this.nativeAvailable = available;
  }

  setReachable(reachable: boolean): void {
    this.reachable = reachable;
  }

  dropNextAcks(count: number): void {
    this.dropNextAckCount = Math.max(0, count);
  }

  disconnectAfterMessages(count: number | null): void {
    this.dropAfterSentMessages = count;
    this.sentMessagesCount = 0;
  }

  async isNativeTargetAvailable(): Promise<boolean> {
    return this.nativeAvailable;
  }

  async isCompanionReachable(): Promise<boolean> {
    return this.reachable;
  }

  async sendMessage(
    message: WatchProtocolMessage,
  ): Promise<{ delivered: boolean; reason?: string }> {
    if (!this.nativeAvailable) {
      return { delivered: false, reason: 'native_target_unavailable' };
    }
    if (!this.reachable) {
      return { delivered: false, reason: 'companion_disconnected' };
    }
    if (message.type === 'session_ack' && this.dropNextAckCount > 0) {
      this.dropNextAckCount -= 1;
      return { delivered: false, reason: 'ack_lost_over_ble' };
    }
    if (
      this.dropAfterSentMessages !== null &&
      this.sentMessagesCount >= this.dropAfterSentMessages
    ) {
      this.reachable = false;
      return { delivered: false, reason: 'ble_link_dropped' };
    }

    this.sentMessagesCount += 1;
    this.sentLog.push(message);
    for (const handler of this.handlers) {
      await handler(message);
    }
    return { delivered: true };
  }

  onMessage(handler: (message: WatchProtocolMessage) => void | Promise<void>): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}

export type { WatchSessionAckEnvelope };
