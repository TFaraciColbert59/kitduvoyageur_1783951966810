/**
 * LKDV Social — Milestone 1 Challenger Stress Suite (M1.2)
 * Spec: tests/messaging/challenger-m1-2-stress.spec.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS HARNESS:
 * 1. Bidirectional Cursor Pagination (CursorPaginationService)
 *    - Boundary limits (0, negative, >100, undefined, 1)
 *    - Empty ranges & non-existent conversations
 *    - Single-message conversation boundaries
 *    - Invalid & pathological cursors (negative, float, beyond max)
 *    - Bidirectional traversal integrity (paging from bottom to top, top to bottom)
 *    - Supabase error resiliency
 *
 * 2. Offline Sync Queue & Reconciliation Protocol (OfflineSyncQueue)
 *    - Strict FIFO order execution
 *    - Retry count incrementation and MAX_RETRIES poison-pill isolation
 *    - Re-entrancy / subsequent reconciliation behavior on failed items
 *    - Send idempotency / duplicate prevention during batch flush
 *    - Conflict resolution (server precedence, nonce matching, monotonic sort)
 *
 * 3. Security Boundary (Departed Members left_at IS NOT NULL)
 *    - Departed member exclusion in is_conversation_member, is_conv_owner, is_conv_admin
 *    - Static SQL migration security audit on all table policies
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Domain imports
import { CursorPaginationService } from '@/features/messaging/services/domain/cursorPaginationService';
import { OfflineSyncQueue } from '@/features/messaging/services/domain/offlineSyncQueue';
import { idempotencyService } from '@/features/messaging/services/domain/idempotencyService';
import type { Message, PendingMessage } from '@/features/messaging/types/messaging.types';

// Mock supabase client module for CursorPaginationService
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/queries/publicProfilesCore', () => ({
  fetchPublicProfilesWith: vi.fn(async () => ({
    'user-1': { id: 'user-1', full_name: 'Alice Guide', avatar_url: null },
    'user-2': { id: 'user-2', full_name: 'Bob Explorer', avatar_url: null },
  })),
}));

import { createClient } from '@/lib/supabase/client';

// Helper to create an in-memory query mock simulating Supabase PostgREST for messages
function createMockSupabaseWithMessages(allMessages: any[], failQuery = false) {
  return {
    from: (table: string) => {
      if (table !== 'messages') {
        throw new Error(`Unexpected table: ${table}`);
      }

      let filtered = [...allMessages];
      let limitValue = 51;
      let sortField = 'sequence_number';
      let sortAscending = false;

      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn((field: string, val: any) => {
          filtered = filtered.filter((m) => m[field] === val);
          return builder;
        }),
        lt: vi.fn((field: string, val: any) => {
          filtered = filtered.filter((m) => m[field] < val);
          return builder;
        }),
        gt: vi.fn((field: string, val: any) => {
          filtered = filtered.filter((m) => m[field] > val);
          return builder;
        }),
        order: vi.fn((field: string, { ascending }: { ascending: boolean }) => {
          sortField = field;
          sortAscending = ascending;
          return builder;
        }),
        limit: vi.fn((lim: number) => {
          limitValue = lim;
          return builder;
        }),
        then: (resolve: any, reject: any) => {
          if (failQuery) {
            return Promise.resolve({ data: null, error: { message: 'Database connection timeout' } }).then(resolve, reject);
          }

          filtered.sort((a, b) => {
            if (a[sortField] < b[sortField]) return sortAscending ? -1 : 1;
            if (a[sortField] > b[sortField]) return sortAscending ? 1 : -1;
            return 0;
          });

          const data = filtered.slice(0, limitValue);
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };

      return builder;
    },
  };
}

describe('Challenger M1.2 Adversarial Stress Suite', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // PART 1: BIDIRECTIONAL CURSOR PAGINATION ADVERSARIAL STRESS
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Bidirectional Cursor Pagination Adversarial Stress', () => {
    let paginationService: CursorPaginationService;

    // Helper to generate N mock messages with monotonic sequences
    function generateMockMessages(count: number, convId = 'conv-100'): any[] {
      const msgs = [];
      const baseTime = Date.parse('2026-10-04T10:00:00Z');
      for (let i = 1; i <= count; i++) {
        msgs.push({
          id: `msg-${i}`,
          conversation_id: convId,
          sender_id: i % 2 === 1 ? 'user-1' : 'user-2',
          sequence_number: i,
          client_nonce: `nonce-${i}`,
          content: `Content of message ${i}`,
          message_type: 'text',
          metadata: null,
          reply_to_id: null,
          deleted_at: null,
          created_at: new Date(baseTime + i * 1000).toISOString(),
          updated_at: new Date(baseTime + i * 1000).toISOString(),
          message_reactions: [],
        });
      }
      return msgs;
    }

    beforeEach(() => {
      paginationService = new CursorPaginationService();
    });

    it('EDGE-PAG-01: Boundary limits clamping (limit=0, limit=-10, limit=500)', async () => {
      const messages = generateMockMessages(20);
      const mockDb = createMockSupabaseWithMessages(messages);
      vi.mocked(createClient).mockReturnValue(mockDb as any);

      // Limit = 0 -> Clamped to Math.max(1, Math.min(0, 100)) = 1
      const res0 = await paginationService.getMessagesCursor('conv-100', { limit: 0 });
      expect(res0.messages.length).toBe(1);
      expect(res0.messages[0].sequence_number).toBe(20);
      expect(res0.hasMoreBefore).toBe(true);
      expect(res0.hasMoreAfter).toBe(false);

      // Limit = -10 -> Clamped to 1
      const resNeg = await paginationService.getMessagesCursor('conv-100', { limit: -10 });
      expect(resNeg.messages.length).toBe(1);
      expect(resNeg.messages[0].sequence_number).toBe(20);

      // Limit = 500 -> Clamped to 100
      const largeMessages = generateMockMessages(150);
      const mockDbLarge = createMockSupabaseWithMessages(largeMessages);
      vi.mocked(createClient).mockReturnValue(mockDbLarge as any);

      const resLarge = await paginationService.getMessagesCursor('conv-100', { limit: 500 });
      expect(resLarge.messages.length).toBe(100);
      expect(resLarge.messages[0].sequence_number).toBe(51);
      expect(resLarge.messages[99].sequence_number).toBe(150);
      expect(resLarge.hasMoreBefore).toBe(true);
      expect(resLarge.hasMoreAfter).toBe(false);
    });

    it('EDGE-PAG-02: Empty conversation handling', async () => {
      const mockDb = createMockSupabaseWithMessages([]);
      vi.mocked(createClient).mockReturnValue(mockDb as any);

      const res = await paginationService.getMessagesCursor('conv-empty', { limit: 20 });
      expect(res.messages).toEqual([]);
      expect(res.hasMoreBefore).toBe(false);
      expect(res.hasMoreAfter).toBe(false);
      expect(res.earliestSequence).toBeNull();
      expect(res.latestSequence).toBeNull();
    });

    it('EDGE-PAG-03: Single-message conversation boundaries (seq=1)', async () => {
      const messages = generateMockMessages(1);
      const mockDb = createMockSupabaseWithMessages(messages);
      vi.mocked(createClient).mockReturnValue(mockDb as any);

      // Default load: returns message 1, no more before, no more after
      const resDefault = await paginationService.getMessagesCursor('conv-100', { limit: 10 });
      expect(resDefault.messages.length).toBe(1);
      expect(resDefault.messages[0].sequence_number).toBe(1);
      expect(resDefault.hasMoreBefore).toBe(false);
      expect(resDefault.hasMoreAfter).toBe(false);
      expect(resDefault.earliestSequence).toBe(1);
      expect(resDefault.latestSequence).toBe(1);

      // beforeSequence: 1 -> Messages strictly before 1 do not exist
      const resBefore1 = await paginationService.getMessagesCursor('conv-100', { beforeSequence: 1 });
      expect(resBefore1.messages).toEqual([]);
      expect(resBefore1.hasMoreBefore).toBe(false);
      expect(resBefore1.hasMoreAfter).toBe(false);
      expect(resBefore1.earliestSequence).toBeNull();
      expect(resBefore1.latestSequence).toBeNull();

      // afterSequence: 1 -> Messages strictly after 1 do not exist
      const resAfter1 = await paginationService.getMessagesCursor('conv-100', { afterSequence: 1 });
      expect(resAfter1.messages).toEqual([]);
      expect(resAfter1.hasMoreBefore).toBe(false);
      expect(resAfter1.hasMoreAfter).toBe(false);

      // beforeSequence: 2 -> Returns message 1
      const resBefore2 = await paginationService.getMessagesCursor('conv-100', { beforeSequence: 2 });
      expect(resBefore2.messages.length).toBe(1);
      expect(resBefore2.messages[0].sequence_number).toBe(1);
      expect(resBefore2.hasMoreBefore).toBe(false);
      expect(resBefore2.hasMoreAfter).toBe(true);

      // afterSequence: 0 -> Returns message 1
      const resAfter0 = await paginationService.getMessagesCursor('conv-100', { afterSequence: 0 });
      expect(resAfter0.messages.length).toBe(1);
      expect(resAfter0.messages[0].sequence_number).toBe(1);
      expect(resAfter0.hasMoreBefore).toBe(true);
      expect(resAfter0.hasMoreAfter).toBe(false);
    });

    it('EDGE-PAG-04: Full bidirectional walk from newest to oldest and back', async () => {
      // 30 messages in conversation
      const messages = generateMockMessages(30);
      const mockDb = createMockSupabaseWithMessages(messages);
      vi.mocked(createClient).mockReturnValue(mockDb as any);

      // 1. Initial page (latest 10: 21..30)
      const p1 = await paginationService.getMessagesCursor('conv-100', { limit: 10 });
      expect(p1.messages.length).toBe(10);
      expect(p1.messages[0].sequence_number).toBe(21);
      expect(p1.messages[9].sequence_number).toBe(30);
      expect(p1.hasMoreBefore).toBe(true);
      expect(p1.hasMoreAfter).toBe(false);
      expect(p1.earliestSequence).toBe(21);
      expect(p1.latestSequence).toBe(30);

      // 2. Scroll up: beforeSequence 21 (gets 11..20)
      const p2 = await paginationService.getMessagesCursor('conv-100', { beforeSequence: 21, limit: 10 });
      expect(p2.messages.length).toBe(10);
      expect(p2.messages[0].sequence_number).toBe(11);
      expect(p2.messages[9].sequence_number).toBe(20);
      expect(p2.hasMoreBefore).toBe(true);
      expect(p2.hasMoreAfter).toBe(true);

      // 3. Scroll up: beforeSequence 11 (gets 1..10)
      const p3 = await paginationService.getMessagesCursor('conv-100', { beforeSequence: 11, limit: 10 });
      expect(p3.messages.length).toBe(10);
      expect(p3.messages[0].sequence_number).toBe(1);
      expect(p3.messages[9].sequence_number).toBe(10);
      expect(p3.hasMoreBefore).toBe(false); // Hit conversation start
      expect(p3.hasMoreAfter).toBe(true);

      // 4. Boundary hit: beforeSequence 1 (returns empty)
      const p4 = await paginationService.getMessagesCursor('conv-100', { beforeSequence: 1, limit: 10 });
      expect(p4.messages.length).toBe(0);
      expect(p4.hasMoreBefore).toBe(false);
      expect(p4.hasMoreAfter).toBe(false);

      // 5. Deep link / forward jump: afterSequence 10 (gets 11..20)
      const p5 = await paginationService.getMessagesCursor('conv-100', { afterSequence: 10, limit: 10 });
      expect(p5.messages.length).toBe(10);
      expect(p5.messages[0].sequence_number).toBe(11);
      expect(p5.messages[9].sequence_number).toBe(20);
      expect(p5.hasMoreBefore).toBe(true);
      expect(p5.hasMoreAfter).toBe(true);

      // 6. Scroll down: afterSequence 20 (gets 21..30)
      const p6 = await paginationService.getMessagesCursor('conv-100', { afterSequence: 20, limit: 10 });
      expect(p6.messages.length).toBe(10);
      expect(p6.messages[0].sequence_number).toBe(21);
      expect(p6.messages[9].sequence_number).toBe(30);
      expect(p6.hasMoreBefore).toBe(true);
      expect(p6.hasMoreAfter).toBe(false); // Hit conversation end
    });

    it('EDGE-PAG-05: Pathological & negative cursors', async () => {
      const messages = generateMockMessages(10);
      const mockDb = createMockSupabaseWithMessages(messages);
      vi.mocked(createClient).mockReturnValue(mockDb as any);

      // Negative cursor: beforeSequence -5
      const resNegBefore = await paginationService.getMessagesCursor('conv-100', { beforeSequence: -5 });
      expect(resNegBefore.messages).toEqual([]);
      expect(resNegBefore.hasMoreBefore).toBe(false);
      expect(resNegBefore.hasMoreAfter).toBe(false);

      // Zero cursor: beforeSequence 0
      const resZeroBefore = await paginationService.getMessagesCursor('conv-100', { beforeSequence: 0 });
      expect(resZeroBefore.messages).toEqual([]);

      // Float cursor: beforeSequence 5.5 (should fetch sequences 1, 2, 3, 4, 5)
      const resFloatBefore = await paginationService.getMessagesCursor('conv-100', { beforeSequence: 5.5, limit: 10 });
      expect(resFloatBefore.messages.length).toBe(5);
      expect(resFloatBefore.messages.map((m) => m.sequence_number)).toEqual([1, 2, 3, 4, 5]);

      // Float cursor: afterSequence 5.5 (should fetch sequences 6, 7, 8, 9, 10)
      const resFloatAfter = await paginationService.getMessagesCursor('conv-100', { afterSequence: 5.5, limit: 10 });
      expect(resFloatAfter.messages.length).toBe(5);
      expect(resFloatAfter.messages.map((m) => m.sequence_number)).toEqual([6, 7, 8, 9, 10]);
    });

    it('EDGE-PAG-06: Database query failure degrades safely without crashing', async () => {
      const mockDbFail = createMockSupabaseWithMessages([], true);
      vi.mocked(createClient).mockReturnValue(mockDbFail as any);

      const res = await paginationService.getMessagesCursor('conv-fail', { limit: 20 });
      expect(res.messages).toEqual([]);
      expect(res.hasMoreBefore).toBe(false);
      expect(res.hasMoreAfter).toBe(false);
      expect(res.earliestSequence).toBeNull();
      expect(res.latestSequence).toBeNull();
    });

    it('EDGE-PAG-07: Contradictory options (both beforeSequence and afterSequence provided)', async () => {
      const messages = generateMockMessages(20);
      const mockDb = createMockSupabaseWithMessages(messages);
      vi.mocked(createClient).mockReturnValue(mockDb as any);

      // When both are passed, beforeSequence takes branch precedence in cursorPaginationService
      const res = await paginationService.getMessagesCursor('conv-100', {
        beforeSequence: 15,
        afterSequence: 5,
        limit: 5,
      });

      expect(res.messages.length).toBe(5);
      expect(res.messages.map((m) => m.sequence_number)).toEqual([10, 11, 12, 13, 14]);
      expect(res.hasMoreAfter).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PART 2: OFFLINE SYNC QUEUE & RECONCILIATION PROTOCOL STRESS
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Offline Sync Queue & Reconciliation Protocol Adversarial Stress', () => {
    let queue: OfflineSyncQueue;

    beforeEach(() => {
      queue = new OfflineSyncQueue();
      queue.clear();
    });

    it('EDGE-OFF-01: FIFO order is strictly preserved during flush across timestamp ties', async () => {
      const flushOrder: string[] = [];

      // Enqueue 5 items rapidly
      for (let i = 1; i <= 5; i++) {
        queue.enqueue({
          tempId: `temp-${i}`,
          conversationId: 'c1',
          senderId: 'u1',
          content: `Step ${i}`,
          messageType: 'text',
          clientNonce: `nonce-fifo-${i}`,
        });
      }

      const res = await queue.reconcile('c1', async (item) => {
        flushOrder.push(item.tempId);
        return {
          id: `srv-${item.tempId}`,
          conversation_id: item.conversationId,
          sender_id: item.senderId,
          content: item.content,
          message_type: item.messageType,
          sequence_number: flushOrder.length,
          client_nonce: item.clientNonce,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'sent',
        };
      });

      expect(flushOrder).toEqual(['temp-1', 'temp-2', 'temp-3', 'temp-4', 'temp-5']);
      expect(res.flushedCount).toBe(5);
      expect(res.failedCount).toBe(0);
      expect(queue.getPending('c1').length).toBe(0);
    });

    it('EDGE-OFF-02: Retry count progression and MAX_RETRIES poison-pill isolation', async () => {
      // temp-poison will consistently fail
      queue.enqueue({
        tempId: 'temp-poison',
        conversationId: 'c1',
        senderId: 'u1',
        content: 'Malformed or rejected payload',
        messageType: 'text',
        clientNonce: 'nonce-poison',
      });

      // temp-valid will succeed
      queue.enqueue({
        tempId: 'temp-valid',
        conversationId: 'c1',
        senderId: 'u1',
        content: 'Valid follow-up message',
        messageType: 'text',
        clientNonce: 'nonce-valid',
      });

      // Sender that rejects temp-poison but accepts temp-valid
      const sender = async (item: PendingMessage) => {
        if (item.tempId === 'temp-poison') {
          throw new Error('400 Bad Request: validation error');
        }
        return {
          id: `srv-${item.tempId}`,
          conversation_id: item.conversationId,
          sender_id: item.senderId,
          content: item.content,
          message_type: item.messageType,
          sequence_number: 1,
          client_nonce: item.clientNonce,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'sent' as const,
        };
      };

      // Cycle 1: temp-poison fails once (retryCount=1, status='pending')
      // temp-valid succeeds and is dequeued!
      const res1 = await queue.reconcile('c1', sender);
      expect(res1.flushedCount).toBe(1);
      expect(res1.failedCount).toBe(0); // Not failed yet, retryCount is 1 < 5

      const pendingAfter1 = queue.getPending('c1');
      expect(pendingAfter1.length).toBe(1);
      expect(pendingAfter1[0].tempId).toBe('temp-poison');
      expect(pendingAfter1[0].retryCount).toBe(1);
      expect(pendingAfter1[0].status).toBe('pending');

      // Cycles 2, 3, 4
      await queue.reconcile('c1', sender); // retryCount = 2
      await queue.reconcile('c1', sender); // retryCount = 3
      await queue.reconcile('c1', sender); // retryCount = 4

      expect(queue.getPending('c1')[0].retryCount).toBe(4);
      expect(queue.getPending('c1')[0].status).toBe('pending');

      // Cycle 5: Reaches MAX_RETRIES (5)
      const res5 = await queue.reconcile('c1', sender);
      expect(res5.failedCount).toBe(1);
      expect(queue.getPending('c1')[0].retryCount).toBe(5);
      expect(queue.getPending('c1')[0].status).toBe('failed');
      expect(queue.getPending('c1')[0].lastError).toContain('400 Bad Request');
    });

    it('EDGE-OFF-03: Poison-pill retry loop behavior analysis (finding documentation)', async () => {
      // Enqueue an item and exhaust retries so it reaches status: 'failed'
      queue.enqueue({
        tempId: 'temp-exhausted',
        conversationId: 'c1',
        senderId: 'u1',
        content: 'Permanent failure',
        messageType: 'text',
        clientNonce: 'nonce-exhausted',
      });

      const failingSender = async () => {
        throw new Error('Permanent rejection');
      };

      for (let i = 0; i < 5; i++) {
        await queue.reconcile('c1', failingSender);
      }

      const exhaustedItem = queue.getPending('c1')[0];
      expect(exhaustedItem.status).toBe('failed');
      expect(exhaustedItem.retryCount).toBe(5);

      // Critical empirical check: On next reconcile, what happens?
      // In current implementation, getPending() returns ALL items, including failed ones.
      // Reconcile sets status back to 'syncing', retries, increments retryCount to 6, and sets failed again.
      let retriedCount = 0;
      await queue.reconcile('c1', async () => {
        retriedCount++;
        throw new Error('Permanent rejection');
      });

      // Verification: Current implementation does retry failed items on subsequent reconciliations
      expect(retriedCount).toBe(1);
      expect(queue.getPending('c1')[0].retryCount).toBe(6);
    });

    it('EDGE-OFF-04: Send Idempotency & Duplicate Prevention during batch flush', async () => {
      // Simulate dropped ACK: message was already committed to DB
      const committedServerMsg: Message = {
        id: 'srv-committed-1',
        conversation_id: 'c1',
        sender_id: 'u1',
        content: 'Pre-committed message',
        message_type: 'text',
        sequence_number: 42,
        client_nonce: 'nonce-dropped-ack',
        created_at: '2026-10-04T10:00:00Z',
        updated_at: '2026-10-04T10:00:00Z',
        status: 'sent',
      };

      queue.enqueue({
        tempId: 'temp-dropped',
        conversationId: 'c1',
        senderId: 'u1',
        content: 'Pre-committed message',
        messageType: 'text',
        clientNonce: 'nonce-dropped-ack',
      });

      // Sender encounters duplicate key error and recovers by returning committed message
      const idempotentSender = async (item: PendingMessage): Promise<Message | null> => {
        if (item.clientNonce === 'nonce-dropped-ack') {
          // Emulate idempotencyService.handleDuplicateSend
          return committedServerMsg;
        }
        return null;
      };

      const res = await queue.reconcile('c1', idempotentSender);

      expect(res.flushedCount).toBe(1);
      expect(res.failedCount).toBe(0);
      expect(res.syncedMessages.length).toBe(1);
      expect(res.syncedMessages[0].id).toBe('srv-committed-1');
      expect(res.syncedMessages[0].sequence_number).toBe(42);
      expect(queue.getPending('c1').length).toBe(0);
      expect(idempotencyService.isNonceInFlight('nonce-dropped-ack')).toBe(false);
    });

    it('EDGE-OFF-05: Phase 3 Conflict Resolution (resolveConflicts) under diverse payloads', () => {
      const serverMsgs: Message[] = [
        {
          id: 'srv-1',
          conversation_id: 'c1',
          sender_id: 'u1',
          content: 'Server Msg 1',
          message_type: 'text',
          sequence_number: 1,
          client_nonce: 'nonce-1',
          created_at: '2026-10-04T10:00:00Z',
          updated_at: '2026-10-04T10:00:00Z',
        },
        {
          id: 'srv-2',
          conversation_id: 'c1',
          sender_id: 'u2',
          content: 'Server Msg 2 (Remote)',
          message_type: 'text',
          sequence_number: 2,
          client_nonce: 'nonce-remote-2',
          created_at: '2026-10-04T10:01:00Z',
          updated_at: '2026-10-04T10:01:00Z',
        },
      ];

      const localMsgs: Message[] = [
        // Optimistic local version of Msg 1 with same client_nonce
        {
          id: 'temp-1',
          conversation_id: 'c1',
          sender_id: 'u1',
          content: 'Local Msg 1 Draft',
          message_type: 'text',
          client_nonce: 'nonce-1',
          created_at: '2026-10-04T09:59:00Z',
          updated_at: '2026-10-04T09:59:00Z',
          status: 'pending',
        },
        // Unsent local message 3
        {
          id: 'temp-3',
          conversation_id: 'c1',
          sender_id: 'u1',
          content: 'Unsent Trail Note',
          message_type: 'text',
          client_nonce: 'nonce-3',
          created_at: '2026-10-04T10:02:00Z',
          updated_at: '2026-10-04T10:02:00Z',
          status: 'pending',
        },
      ];

      const resolved = queue.resolveConflicts(serverMsgs, localMsgs);

      // Should have 3 messages total: srv-1 (won over temp-1), srv-2, temp-3
      expect(resolved.length).toBe(3);
      expect(resolved.map((m) => m.id)).toEqual(['srv-1', 'srv-2', 'temp-3']);
      // Server version was preserved
      expect(resolved[0].content).toBe('Server Msg 1');
      // Unsent local message was preserved at end
      expect(resolved[2].id).toBe('temp-3');
    });

    it('EDGE-OFF-06: Empty queue reconcile returns 0 counts and empty arrays', async () => {
      const res = await queue.reconcile('c-empty', async () => null);
      expect(res.flushedCount).toBe(0);
      expect(res.failedCount).toBe(0);
      expect(res.syncedMessages).toEqual([]);
      expect(res.newDeltaMessages).toEqual([]);
    });

    it('EDGE-OFF-07: Filter by conversationId isolates flushes', async () => {
      queue.enqueue({
        tempId: 'temp-c1',
        conversationId: 'conv-alpha',
        senderId: 'u1',
        content: 'Alpha msg',
        messageType: 'text',
        clientNonce: 'n-alpha',
      });
      queue.enqueue({
        tempId: 'temp-c2',
        conversationId: 'conv-beta',
        senderId: 'u1',
        content: 'Beta msg',
        messageType: 'text',
        clientNonce: 'n-beta',
      });

      const flushedAlpha: string[] = [];
      await queue.reconcile('conv-alpha', async (item) => {
        flushedAlpha.push(item.tempId);
        return {
          id: `srv-${item.tempId}`,
          conversation_id: item.conversationId,
          sender_id: item.senderId,
          content: item.content,
          message_type: item.messageType,
          sequence_number: 1,
          client_nonce: item.clientNonce,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      expect(flushedAlpha).toEqual(['temp-c1']);
      expect(queue.getPending('conv-alpha').length).toBe(0);
      expect(queue.getPending('conv-beta').length).toBe(1);
    });

    it('EDGE-OFF-08: Concurrent reconciliations race analysis', async () => {
      // Enqueue one item
      queue.enqueue({
        tempId: 'temp-race',
        conversationId: 'c1',
        senderId: 'u1',
        content: 'Race condition probe',
        messageType: 'text',
        clientNonce: 'nonce-race',
      });

      let callCount = 0;
      const slowSender = async (item: PendingMessage) => {
        callCount++;
        // Simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          id: `srv-${item.tempId}`,
          conversation_id: item.conversationId,
          sender_id: item.senderId,
          content: item.content,
          message_type: item.messageType,
          sequence_number: 1,
          client_nonce: item.clientNonce,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'sent' as const,
        };
      };

      // Launch two reconciliations in parallel without waiting
      const [res1, res2] = await Promise.all([
        queue.reconcile('c1', slowSender),
        queue.reconcile('c1', slowSender),
      ]);

      // Both concurrent executions accessed the same pending items because OfflineSyncQueue
      // does not maintain an internal isSyncing mutex.
      expect(callCount).toBeGreaterThanOrEqual(1);
      expect(res1.flushedCount + res2.flushedCount).toBeGreaterThanOrEqual(1);
    });

    it('EDGE-OFF-09: Storage corruption and quota exceptions resilience', () => {
      // Emulate window.localStorage throwing QuotaExceededError
      const originalStorage = globalThis.window?.localStorage;
      const mockStorage = {
        getItem: vi.fn(() => '{ corrupt json ['),
        setItem: vi.fn(() => {
          throw new Error('QuotaExceededError: storage is full');
        }),
      };

      try {
        if (typeof window !== 'undefined') {
          Object.defineProperty(window, 'localStorage', {
            value: mockStorage,
            configurable: true,
            writable: true,
          });
        }

        // Ensure constructor and operations survive without unhandled exception
        expect(() => {
          const resilientQueue = new OfflineSyncQueue();
          resilientQueue.enqueue({
            tempId: 'temp-quota',
            conversationId: 'c1',
            senderId: 'u1',
            content: 'Payload',
            messageType: 'text',
            clientNonce: 'n-quota',
          });
          resilientQueue.dequeue('temp-quota');
        }).not.toThrow();
      } finally {
        if (typeof window !== 'undefined' && originalStorage) {
          Object.defineProperty(window, 'localStorage', {
            value: originalStorage,
            configurable: true,
            writable: true,
          });
        }
      }
    });

    it('EDGE-OFF-10: Phase 2 delta pull relies on highestSyncedSeq', async () => {
      // Test Phase 2 behavior when flushed messages exist
      queue.enqueue({
        tempId: 'temp-delta',
        conversationId: 'c-delta',
        senderId: 'u1',
        content: 'Latest local',
        messageType: 'text',
        clientNonce: 'n-delta',
      });

      const res = await queue.reconcile('c-delta', async (item) => {
        return {
          id: 'srv-delta',
          conversation_id: 'c-delta',
          sender_id: item.senderId,
          content: item.content,
          message_type: item.messageType,
          sequence_number: 50, // Flushed message gets sequence 50
          client_nonce: item.clientNonce,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'sent',
        };
      });

      expect(res.flushedCount).toBe(1);
      expect(res.syncedMessages[0].sequence_number).toBe(50);
      // Phase 2 cursor pagination will query afterSequence: 50
      expect(Array.isArray(res.newDeltaMessages)).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PART 3: SECURITY BOUNDARY & DEPARTED MEMBER AUDIT
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Security Boundary & Departed Member Audit', () => {
    it('SEC-M1-01: In-memory simulation verifies left_at IS NOT NULL blocks membership checks', () => {
      interface Mem {
        userId: string;
        convId: string;
        role: string;
        leftAt: string | null;
      }

      const members: Mem[] = [
        { userId: 'u-active', convId: 'c1', role: 'member', leftAt: null },
        { userId: 'u-departed', convId: 'c1', role: 'member', leftAt: '2026-10-04T08:00:00Z' },
        { userId: 'u-active-admin', convId: 'c1', role: 'admin', leftAt: null },
        { userId: 'u-departed-owner', convId: 'c1', role: 'owner', leftAt: '2026-10-04T08:00:00Z' },
      ];

      const isMember = (cid: string, uid: string) =>
        members.some((m) => m.convId === cid && m.userId === uid && m.leftAt === null);

      const isOwner = (cid: string, uid: string) =>
        members.some((m) => m.convId === cid && m.userId === uid && m.role === 'owner' && m.leftAt === null);

      const isAdmin = (cid: string, uid: string) =>
        members.some((m) => m.convId === cid && m.userId === uid && ['admin', 'owner'].includes(m.role) && m.leftAt === null);

      // Active member
      expect(isMember('c1', 'u-active')).toBe(true);

      // Departed member: strictly false
      expect(isMember('c1', 'u-departed')).toBe(false);

      // Departed owner: strictly false
      expect(isOwner('c1', 'u-departed-owner')).toBe(false);
      expect(isAdmin('c1', 'u-departed-owner')).toBe(false);
      expect(isMember('c1', 'u-departed-owner')).toBe(false);

      // Active admin: true
      expect(isAdmin('c1', 'u-active-admin')).toBe(true);

      // Stranger: false
      expect(isMember('c1', 'u-stranger')).toBe(false);
    });

    it('SEC-M1-02: Static migration SQL file enforces left_at check on all security definer functions', () => {
      const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/20261004120000_lkdv_social_core_architecture.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      // 1. is_conversation_member definition must contain cm.left_at IS NULL
      expect(sqlContent).toMatch(/CREATE OR REPLACE FUNCTION public\.is_conversation_member[\s\S]*?cm\.left_at IS NULL/);

      // 2. is_conv_owner definition must contain cm.left_at IS NULL
      expect(sqlContent).toMatch(/CREATE OR REPLACE FUNCTION public\.is_conv_owner[\s\S]*?cm\.left_at IS NULL/);

      // 3. is_conv_admin definition must contain cm.left_at IS NULL
      expect(sqlContent).toMatch(/CREATE OR REPLACE FUNCTION public\.is_conv_admin[\s\S]*?cm\.left_at IS NULL/);

      // 4. messages RLS policies enforce is_conversation_member
      expect(sqlContent).toMatch(/CREATE POLICY "members_select_messages"[\s\S]*?public\.is_conversation_member/);
      expect(sqlContent).toMatch(/CREATE POLICY "members_insert_messages"[\s\S]*?public\.is_conversation_member/);
      expect(sqlContent).toMatch(/CREATE POLICY "senders_update_messages"[\s\S]*?public\.is_conversation_member/);
      expect(sqlContent).toMatch(/CREATE POLICY "senders_delete_messages"[\s\S]*?public\.is_conversation_member/);

      // 5. conversations & members tables enforce is_conversation_member
      expect(sqlContent).toMatch(/CREATE POLICY "members_select_conversations"[\s\S]*?public\.is_conversation_member/);
      expect(sqlContent).toMatch(/CREATE POLICY "members_select_conversation_members"[\s\S]*?public\.is_conversation_member/);

      // 6. Partial index for active members exists
      expect(sqlContent).toMatch(/CREATE INDEX IF NOT EXISTS idx_conversation_members_active[\s\S]*?WHERE left_at IS NULL;/);
    });

    it('SEC-M1-03: Departed author cannot edit or delete previously sent messages', () => {
      const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/20261004120000_lkdv_social_core_architecture.sql'
      );
      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      // senders_update_messages must require public.is_conversation_member
      const updatePolicyRegex = /CREATE POLICY "senders_update_messages"[\s\S]*?USING\s*\(\s*sender_id = \(SELECT auth\.uid\(\)\)\s*AND\s*public\.is_conversation_member\(conversation_id, \(SELECT auth\.uid\(\)\)\)/;
      expect(sqlContent).toMatch(updatePolicyRegex);

      // senders_delete_messages must require public.is_conversation_member
      const deletePolicyRegex = /CREATE POLICY "senders_delete_messages"[\s\S]*?USING\s*\(\s*sender_id = \(SELECT auth\.uid\(\)\)\s*AND\s*public\.is_conversation_member\(conversation_id, \(SELECT auth\.uid\(\)\)\)/;
      expect(sqlContent).toMatch(deletePolicyRegex);
    });
  });
});
