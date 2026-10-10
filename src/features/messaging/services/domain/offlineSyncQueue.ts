import type {
  Message,
  PendingMessage,
  SyncReconciliationResult,
} from '../../types/messaging.types';
import { idempotencyService } from './idempotencyService';
import { sequenceService } from './sequenceService';
import { cursorPaginationService } from './cursorPaginationService';

const STORAGE_KEY = 'lkdv_messaging_offline_queue_v1';
const MAX_RETRIES = 5;

export class OfflineSyncQueue {
  private inMemoryQueue: PendingMessage[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.inMemoryQueue = parsed;
          }
        }
      } catch {
        // Fallback to in-memory on storage parse failure
      }
    }
  }

  private persistToStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.inMemoryQueue));
      } catch {
        // Ignore quota errors in constrained environments
      }
    }
  }

  /**
   * Enqueues an outgoing message locally while offline or awaiting network ack.
   */
  enqueue(
    item: Omit<PendingMessage, 'retryCount' | 'status' | 'createdAt'>
  ): PendingMessage {
    const nonce = item.clientNonce || idempotencyService.generateNonce();
    idempotencyService.trackInFlight(nonce, item.conversationId);

    const pending: PendingMessage = {
      ...item,
      clientNonce: nonce,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
    };

    this.inMemoryQueue.push(pending);
    this.persistToStorage();
    return pending;
  }

  /**
   * Removes a successfully processed pending message by temporary ID.
   */
  dequeue(tempId: string): void {
    const idx = this.inMemoryQueue.findIndex((m) => m.tempId === tempId);
    if (idx >= 0) {
      this.inMemoryQueue.splice(idx, 1);
      this.persistToStorage();
    }
  }

  /**
   * Returns pending messages, optionally filtered by conversation.
   */
  getPending(conversationId?: string): PendingMessage[] {
    if (!conversationId) {
      return [...this.inMemoryQueue];
    }
    return this.inMemoryQueue.filter((m) => m.conversationId === conversationId);
  }

  /**
   * Updates status and optional error message of a pending item.
   */
  updateStatus(tempId: string, status: PendingMessage['status'], error?: string): void {
    const item = this.inMemoryQueue.find((m) => m.tempId === tempId);
    if (item) {
      item.status = status;
      if (error) {
        item.lastError = error;
      }
      this.persistToStorage();
    }
  }

  /**
   * Clears the entire offline queue.
   */
  clear(): void {
    this.inMemoryQueue = [];
    this.persistToStorage();
  }

  /**
   * 3-Phase Reconnection Reconciliation Protocol:
   * Phase 1: flush_pending in FIFO order
   * Phase 2: pull_delta for missed messages
   * Phase 3: resolve_conflicts and deduplicate
   */
  async reconcile(
    conversationId?: string,
    customSender?: (item: PendingMessage) => Promise<Message | null>
  ): Promise<SyncReconciliationResult> {
    const itemsToFlush = this.getPending(conversationId).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const syncedMessages: Message[] = [];
    let flushedCount = 0;
    let failedCount = 0;

    // --- Phase 1: Flush Pending (FIFO) ---
    for (const item of itemsToFlush) {
      this.updateStatus(item.tempId, 'syncing');

      try {
        let sentMessage: Message | null = null;
        if (customSender) {
          sentMessage = await customSender(item);
        }

        if (sentMessage) {
          idempotencyService.markConfirmed(item.clientNonce);
          this.dequeue(item.tempId);
          syncedMessages.push(sentMessage);
          flushedCount++;
        } else {
          item.retryCount++;
          if (item.retryCount >= MAX_RETRIES) {
            this.updateStatus(item.tempId, 'failed', 'Max retries exceeded');
            failedCount++;
          } else {
            this.updateStatus(item.tempId, 'pending');
          }
        }
      } catch (err: any) {
        item.retryCount++;
        const errMsg = err?.message || 'Reconciliation send error';
        if (item.retryCount >= MAX_RETRIES) {
          this.updateStatus(item.tempId, 'failed', errMsg);
          failedCount++;
        } else {
          this.updateStatus(item.tempId, 'pending', errMsg);
        }
      }
    }

    // --- Phase 2: Pull Delta ---
    let newDeltaMessages: Message[] = [];
    if (conversationId) {
      const highestSyncedSeq = syncedMessages.reduce(
        (max, m) => (m.sequence_number != null ? Math.max(max, m.sequence_number) : max),
        0
      );

      if (highestSyncedSeq > 0) {
        try {
          const deltaResult = await cursorPaginationService.getMessagesCursor(conversationId, {
            afterSequence: highestSyncedSeq,
            limit: 50,
          });
          newDeltaMessages = deltaResult.messages;
        } catch {
          // Delta pull error ignored, will re-sync on next interval
        }
      }
    }

    return {
      flushedCount,
      failedCount,
      syncedMessages,
      newDeltaMessages,
    };
  }

  /**
   * Resolves conflicts between server messages and local messages.
   * Deduplicates by client_nonce and id, ordered by sequenceService.
   */
  resolveConflicts(serverMessages: Message[], localMessages: Message[]): Message[] {
    const combined = new Map<string, Message>();

    // Server messages take precedence
    for (const msg of serverMessages) {
      const key = msg.client_nonce || msg.id;
      combined.set(key, msg);
    }

    // Add local messages if not already represented by server
    for (const msg of localMessages) {
      const key = msg.client_nonce || msg.id;
      if (!combined.has(key)) {
        combined.set(key, msg);
      }
    }

    return sequenceService.sortMessages(Array.from(combined.values()));
  }
}

export const offlineSyncQueue = new OfflineSyncQueue();
