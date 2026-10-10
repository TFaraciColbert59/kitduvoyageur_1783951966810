/**
 * LKDV Social — Milestone 1 Adversarial Stress Test Suite
 * Spec: tests/messaging/adversarial-stress-m1.spec.ts
 *
 * EMPIRICAL CHALLENGER HARNESS:
 * 1. Monotonic sequence ordering under out-of-order delivery, timestamp collisions & malformed inputs
 * 2. Gap detection oracle & edge case fuzzing
 * 3. Unread count graceful degradation & boundary conditions
 * 4. Concurrent client send idempotency replay (100 parallel requests)
 * 5. Nonce entropy, collision resistance & TTL memory management
 * 6. Offline reconciliation FIFO queue, poisoned message quarantine & conflict resolution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sequenceService } from '@/features/messaging/services/domain/sequenceService';
import { idempotencyService } from '@/features/messaging/services/domain/idempotencyService';
import { offlineSyncQueue } from '@/features/messaging/services/domain/offlineSyncQueue';
import type { Message, PendingMessage } from '@/features/messaging/types/messaging.types';

describe('ADVERSARIAL STRESS TEST: Milestone 1 Foundation', () => {

  // ───────────────────────────────────────────────────────────────────────────
  // 1. SEQUENCE ORDERING & OUT-OF-ORDER RECOVERY
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Monotonic Sequence Ordering & Comparator Resilience', () => {
    it('STRESS-SEQ-01: Correctly restores strictly ascending order for 500 scrambled messages', () => {
      const count = 500;
      const baseDate = new Date('2026-10-04T10:00:00.000Z').getTime();

      // Generate 500 messages with sequence 1..500
      const messages: Message[] = Array.from({ length: count }, (_, i) => ({
        id: `msg-${i + 1}`,
        conversation_id: 'conv-stress-1',
        sender_id: `user-${(i % 5) + 1}`,
        sequence_number: i + 1,
        content: `Stress msg ${i + 1}`,
        message_type: 'text',
        created_at: new Date(baseDate + (i + 1) * 1000).toISOString(),
        updated_at: new Date(baseDate + (i + 1) * 1000).toISOString(),
      }));

      // Scramble with pseudo-random shuffle (Fisher-Yates)
      const scrambled = [...messages];
      for (let i = scrambled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [scrambled[i], scrambled[j]] = [scrambled[j], scrambled[i]];
      }

      // Ensure it is actually scrambled
      const isScrambled = scrambled.some((m, idx) => m.sequence_number !== idx + 1);
      expect(isScrambled).toBe(true);

      // Execute sort
      const sorted = sequenceService.sortMessages(scrambled);

      // Verify strict monotonic sequence ordering
      expect(sorted.length).toBe(count);
      for (let i = 0; i < count; i++) {
        expect(sorted[i].sequence_number).toBe(i + 1);
      }
    });

    it('STRESS-SEQ-02: Timestamp collision stress — 100 messages with exact identical created_at', () => {
      const count = 100;
      const identicalTimestamp = '2026-10-04T12:00:00.000Z';

      const messages: Message[] = Array.from({ length: count }, (_, i) => ({
        id: `msg-${i + 1}`,
        conversation_id: 'conv-stress-2',
        sender_id: 'user-alice',
        sequence_number: i + 1,
        content: `Collision msg ${i + 1}`,
        message_type: 'text',
        created_at: identicalTimestamp,
        updated_at: identicalTimestamp,
      }));

      // Reverse order input
      const reversed = [...messages].reverse();
      const sorted = sequenceService.sortMessages(reversed);

      expect(sorted.length).toBe(count);
      for (let i = 0; i < count; i++) {
        expect(sorted[i].sequence_number).toBe(i + 1);
      }
    });

    it('STRESS-SEQ-03: Inverse timestamp skew — messages where later sequence has earlier timestamp', () => {
      // Skew scenario: Clock drift between client and server
      const m1: Message = {
        id: 'msg-1',
        conversation_id: 'c1',
        sender_id: 'u1',
        sequence_number: 1,
        content: 'Seq 1 with late clock',
        message_type: 'text',
        created_at: '2026-10-04T12:30:00.000Z', // 12:30
        updated_at: '2026-10-04T12:30:00.000Z',
      };

      const m2: Message = {
        id: 'msg-2',
        conversation_id: 'c1',
        sender_id: 'u2',
        sequence_number: 2,
        content: 'Seq 2 with early clock',
        message_type: 'text',
        created_at: '2026-10-04T12:00:00.000Z', // 12:00 (earlier!)
        updated_at: '2026-10-04T12:00:00.000Z',
      };

      // sequence_number MUST dominate over timestamp
      const sorted = sequenceService.sortMessages([m2, m1]);
      expect(sorted[0].sequence_number).toBe(1);
      expect(sorted[1].sequence_number).toBe(2);
      expect(sorted[0].id).toBe('msg-1');
      expect(sorted[1].id).toBe('msg-2');
    });

    it('STRESS-SEQ-04: Malformed and unparseable created_at timestamps degrade gracefully to tiebreakers', () => {
      const m1: Message = {
        id: 'msg-a',
        conversation_id: 'c1',
        sender_id: 'u1',
        content: 'Corrupt time 1',
        message_type: 'text',
        created_at: 'not-a-valid-date',
        updated_at: 'invalid',
      };

      const m2: Message = {
        id: 'msg-b',
        conversation_id: 'c1',
        sender_id: 'u1',
        content: 'Corrupt time 2',
        message_type: 'text',
        created_at: '',
        updated_at: '',
      };

      // Should not throw, should fall back to ID tie-breaker
      expect(() => sequenceService.compareMessages(m1, m2)).not.toThrow();
      const sorted = sequenceService.sortMessages([m2, m1]);
      expect(sorted[0].id).toBe('msg-a');
      expect(sorted[1].id).toBe('msg-b');
    });

    it('STRESS-SEQ-05: Immutability — sortMessages must never mutate the input array', () => {
      const messages: Message[] = [
        { id: '2', conversation_id: 'c1', sender_id: 'u1', sequence_number: 2, content: 'B', message_type: 'text', created_at: '2026-10-04T10:00:00Z', updated_at: '2026-10-04T10:00:00Z' },
        { id: '1', conversation_id: 'c1', sender_id: 'u1', sequence_number: 1, content: 'A', message_type: 'text', created_at: '2026-10-04T10:00:00Z', updated_at: '2026-10-04T10:00:00Z' },
      ];

      const copy = [...messages];
      const sorted = sequenceService.sortMessages(messages);

      expect(messages[0].id).toBe(copy[0].id);
      expect(messages[1].id).toBe(copy[1].id);
      expect(sorted).not.toBe(messages);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. GAP DETECTION ORACLE & FUZZING
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Gap Detection Oracle & Boundary Fuzzing', () => {
    it('STRESS-GAP-01: Continuous sequences yield zero gaps', () => {
      const messages: Message[] = Array.from({ length: 50 }, (_, i) => ({
        id: `m-${i + 1}`,
        conversation_id: 'c1',
        sender_id: 'u1',
        sequence_number: i + 1,
        content: `Msg ${i + 1}`,
        message_type: 'text',
        created_at: '2026-10-04T10:00:00Z',
        updated_at: '2026-10-04T10:00:00Z',
      }));

      expect(sequenceService.detectSequenceGaps(messages)).toEqual([]);
    });

    it('STRESS-GAP-02: Isolated single missing sequence detects [from: N, to: N]', () => {
      // Sequence: 1, 2, 4, 5 (missing 3)
      const messages: Message[] = [1, 2, 4, 5].map((seq) => ({
        id: `m-${seq}`,
        conversation_id: 'c1',
        sender_id: 'u1',
        sequence_number: seq,
        content: `Msg ${seq}`,
        message_type: 'text',
        created_at: '2026-10-04T10:00:00Z',
        updated_at: '2026-10-04T10:00:00Z',
      }));

      const gaps = sequenceService.detectSequenceGaps(messages);
      expect(gaps).toEqual([{ from: 3, to: 3 }]);
    });

    it('STRESS-GAP-03: Multi-span gap intervals with duplicate and scrambled inputs', () => {
      // Missing: 3..4, 7..9, 12..14
      const present = [1, 2, 5, 6, 10, 11, 15];
      // Inject duplicates and scramble
      const withDupes = [...present, 2, 5, 11, 1, 15].reverse();

      const messages: Message[] = withDupes.map((seq, idx) => ({
        id: `m-${idx}`,
        conversation_id: 'c1',
        sender_id: 'u1',
        sequence_number: seq,
        content: `Msg ${seq}`,
        message_type: 'text',
        created_at: '2026-10-04T10:00:00Z',
        updated_at: '2026-10-04T10:00:00Z',
      }));

      const gaps = sequenceService.detectSequenceGaps(messages);
      expect(gaps).toEqual([
        { from: 3, to: 4 },
        { from: 7, to: 9 },
        { from: 12, to: 14 },
      ]);
    });

    it('STRESS-GAP-04: Boundary conditions — empty, single element, or null sequence messages', () => {
      expect(sequenceService.detectSequenceGaps([])).toEqual([]);

      const singleMsg: Message[] = [{
        id: 'm1',
        conversation_id: 'c1',
        sender_id: 'u1',
        sequence_number: 10,
        content: 'Single',
        message_type: 'text',
        created_at: '2026-10-04T10:00:00Z',
        updated_at: '2026-10-04T10:00:00Z',
      }];
      expect(sequenceService.detectSequenceGaps(singleMsg)).toEqual([]);

      const nullSeqMsgs: Message[] = [
        { id: 'm1', conversation_id: 'c1', sender_id: 'u1', content: 'No seq', message_type: 'text', created_at: '2026-10-04T10:00:00Z', updated_at: '2026-10-04T10:00:00Z' },
        { id: 'm2', conversation_id: 'c1', sender_id: 'u1', content: 'No seq', message_type: 'text', created_at: '2026-10-04T10:00:00Z', updated_at: '2026-10-04T10:00:00Z' },
      ];
      expect(sequenceService.detectSequenceGaps(nullSeqMsgs)).toEqual([]);
    });

    it('STRESS-GAP-05: Massive gap spans (e.g. sequence 1 to 1,000,000)', () => {
      const messages: Message[] = [
        { id: 'm1', conversation_id: 'c1', sender_id: 'u1', sequence_number: 1, content: '1', message_type: 'text', created_at: '2026-10-04T10:00:00Z', updated_at: '2026-10-04T10:00:00Z' },
        { id: 'm2', conversation_id: 'c1', sender_id: 'u1', sequence_number: 1000000, content: '1M', message_type: 'text', created_at: '2026-10-04T10:00:00Z', updated_at: '2026-10-04T10:00:00Z' },
      ];

      const gaps = sequenceService.detectSequenceGaps(messages);
      expect(gaps).toEqual([{ from: 2, to: 999999 }]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. UNREAD COUNTING & DEGRADATION GRACEFULNESS
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Unread Counting Graceful Degradation', () => {
    it('STRESS-UNREAD-01: Never returns negative numbers even when read sequence exceeds conversation sequence', () => {
      // Race condition where member read pointer is updated before conversation last_sequence syncs
      expect(sequenceService.calculateUnreadCount(5, 10)).toBe(0);
      expect(sequenceService.calculateUnreadCount(0, 50)).toBe(0);
      expect(sequenceService.calculateUnreadCount(-5, 0)).toBe(0);
    });

    it('STRESS-UNREAD-02: Handles undefined, null, NaN or missing inputs safely', () => {
      expect(sequenceService.calculateUnreadCount(undefined as any, 5)).toBe(0);
      expect(sequenceService.calculateUnreadCount(10, undefined as any)).toBe(10);
      expect(sequenceService.calculateUnreadCount(null as any, null as any)).toBe(0);
      expect(sequenceService.calculateUnreadCount(NaN, NaN)).toBe(0);
    });

    it('STRESS-UNREAD-03: Boundary checks on isMessageUnread', () => {
      expect(sequenceService.isMessageUnread(10, 10)).toBe(false); // Exactly read
      expect(sequenceService.isMessageUnread(11, 10)).toBe(true);  // Unread next
      expect(sequenceService.isMessageUnread(9, 10)).toBe(false);  // Previously read
      expect(sequenceService.isMessageUnread(1, 0)).toBe(true);   // First message unread
      expect(sequenceService.isMessageUnread(0, 0)).toBe(false);  // Sequence 0
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. CLIENT SEND IDEMPOTENCY & CONCURRENCY REPLAY
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Client Send Idempotency & High-Concurrency Replay', () => {
    it('STRESS-IDEMP-01: 100 concurrent requests with IDENTICAL nonce results in EXACTLY 1 row and 100 successes', async () => {
      // Stateful simulated Postgres store with atomic row-level lock & unique constraint
      const insertedRows = new Map<string, { id: string; conversation_id: string; client_nonce: string; sequence_number: number; content: string }>();
      let sequenceCounter = 0;
      let dbLock = false;

      // Atomic simulated DB operation
      async function simulateDbInsert(convId: string, nonce: string, content: string) {
        // Spin-wait lock to simulate Postgres row-level table lock during trigger
        while (dbLock) {
          await new Promise((r) => setTimeout(r, 1));
        }
        dbLock = true;
        try {
          // Check unique constraint (convId, nonce)
          for (const row of insertedRows.values()) {
            if (row.conversation_id === convId && row.client_nonce === nonce) {
              const err = new Error(`duplicate key value violates unique constraint "uq_messages_conversation_client_nonce"`);
              (err as any).code = '23505';
              throw err;
            }
          }

          sequenceCounter++;
          const newRow = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            conversation_id: convId,
            client_nonce: nonce,
            sequence_number: sequenceCounter,
            content,
          };
          insertedRows.set(newRow.id, newRow);
          return newRow;
        } finally {
          dbLock = false;
        }
      }

      // Simulated client send endpoint with idempotency retry handler
      async function sendWithIdempotency(convId: string, nonce: string, content: string) {
        idempotencyService.trackInFlight(nonce, convId);
        try {
          const inserted = await simulateDbInsert(convId, nonce, content);
          idempotencyService.markConfirmed(nonce);
          return { ...inserted, status: 'sent', isDuplicate: false };
        } catch (err: any) {
          if (idempotencyService.isDuplicateKeyError(err)) {
            // Find existing row
            for (const row of insertedRows.values()) {
              if (row.conversation_id === convId && row.client_nonce === nonce) {
                idempotencyService.markConfirmed(nonce);
                return { ...row, status: 'sent', isDuplicate: true };
              }
            }
          }
          idempotencyService.markFailed(nonce);
          throw err;
        }
      }

      const TARGET_NONCE = 'replayed-nonce-abc-123';
      const CONV_ID = 'conv-concurrent-test';

      // Launch 100 simultaneous concurrent send requests
      const concurrentSends = Array.from({ length: 100 }, (_, idx) =>
        sendWithIdempotency(CONV_ID, TARGET_NONCE, `Payload attempt ${idx}`)
      );

      const results = await Promise.all(concurrentSends);

      // Invariant 1: Exactly 1 row inserted in the database
      expect(insertedRows.size).toBe(1);

      // Invariant 2: Exactly 1 result had isDuplicate: false, 99 had isDuplicate: true
      const originals = results.filter((r) => !r.isDuplicate);
      const duplicates = results.filter((r) => r.isDuplicate);
      expect(originals.length).toBe(1);
      expect(duplicates.length).toBe(99);

      // Invariant 3: All 100 requests returned status 'sent' with identical message ID & sequence_number
      const canonicalId = originals[0].id;
      const canonicalSeq = originals[0].sequence_number;
      expect(canonicalSeq).toBe(1);

      for (const res of results) {
        expect(res.status).toBe('sent');
        expect(res.id).toBe(canonicalId);
        expect(res.sequence_number).toBe(canonicalSeq);
        expect(res.client_nonce).toBe(TARGET_NONCE);
      }
    });

    it('STRESS-IDEMP-02: Multi-tenant concurrency — 10 distinct nonces each sent 10 times in parallel (100 total)', async () => {
      const store = new Map<string, { id: string; nonce: string }>();

      async function insertOrRecover(convId: string, nonce: string) {
        if (store.has(nonce)) {
          return { data: store.get(nonce)!, isDup: true };
        }
        const row = { id: `msg-${nonce}`, nonce };
        store.set(nonce, row);
        return { data: row, isDup: false };
      }

      const tasks: Promise<any>[] = [];
      for (let n = 0; n < 10; n++) {
        const nonce = `batch-nonce-${n}`;
        for (let r = 0; r < 10; r++) {
          tasks.push(insertOrRecover('conv-multi', nonce));
        }
      }

      const results = await Promise.all(tasks);
      expect(results.length).toBe(100);
      expect(store.size).toBe(10);
    });

    it('STRESS-IDEMP-03: Nonce generator entropy — 2,000 nonces generated with 0 collisions and strict format', () => {
      const count = 2000;
      const seen = new Set<string>();

      for (let i = 0; i < count; i++) {
        const nonce = idempotencyService.generateNonce();
        expect(nonce).toMatch(/^nonce_\d+_[a-zA-Z0-9_-]+$/);
        expect(seen.has(nonce)).toBe(false);
        seen.add(nonce);
      }

      expect(seen.size).toBe(count);
    });

    it('STRESS-IDEMP-04: isDuplicateKeyError recognizes all Postgres 23505 formats and rejects others', () => {
      // Direct Postgres code
      expect(idempotencyService.isDuplicateKeyError({ code: '23505' })).toBe(true);

      // PostgREST string error messages
      expect(idempotencyService.isDuplicateKeyError({
        message: 'duplicate key value violates unique constraint "messages_conversation_id_client_nonce_key"'
      })).toBe(true);
      expect(idempotencyService.isDuplicateKeyError({
        message: 'Key (conversation_id, client_nonce)=(1, 2) already exists.'
      })).toBe(false); // Only catches unique constraint or duplicate key substring

      // Negative controls: foreign key, RLS, syntax errors
      expect(idempotencyService.isDuplicateKeyError({ code: '23503', message: 'foreign_key_violation' })).toBe(false);
      expect(idempotencyService.isDuplicateKeyError({ code: '42501', message: 'insufficient_privilege' })).toBe(false);
      expect(idempotencyService.isDuplicateKeyError(null)).toBe(false);
      expect(idempotencyService.isDuplicateKeyError(undefined)).toBe(false);
      expect(idempotencyService.isDuplicateKeyError({})).toBe(false);
    });

    it('STRESS-IDEMP-05: In-flight TTL cleanup prunes stale nonces after 10 minutes', () => {
      vi.useFakeTimers();
      try {
        const nonce = idempotencyService.generateNonce();
        idempotencyService.trackInFlight(nonce, 'conv-ttl');
        expect(idempotencyService.isNonceInFlight(nonce)).toBe(true);

        // Advance clock by 9 minutes (should still be in flight)
        vi.advanceTimersByTime(9 * 60 * 1000);
        expect(idempotencyService.isNonceInFlight(nonce)).toBe(true);

        // Advance clock by 2 more minutes (11 minutes total > 10m TTL)
        vi.advanceTimersByTime(2 * 60 * 1000);
        expect(idempotencyService.isNonceInFlight(nonce)).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. OFFLINE SYNC QUEUE & POISON MESSAGE QUARANTINE
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Offline Sync Queue Poison Message Quarantine & FIFO Guarantee', () => {
    beforeEach(() => {
      offlineSyncQueue.clear();
    });

    it('STRESS-OFFLINE-01: FIFO order preserved during offline queue flush', async () => {
      const executionOrder: string[] = [];

      offlineSyncQueue.enqueue({
        tempId: 'temp-1',
        conversationId: 'c1',
        senderId: 'u1',
        content: 'First',
        messageType: 'text',
        clientNonce: 'nonce-fifo-1',
      });

      // Small delay in creation timestamp
      const item2 = offlineSyncQueue.enqueue({
        tempId: 'temp-2',
        conversationId: 'c1',
        senderId: 'u1',
        content: 'Second',
        messageType: 'text',
        clientNonce: 'nonce-fifo-2',
      });
      item2.createdAt = new Date(Date.now() + 1000).toISOString();

      const item3 = offlineSyncQueue.enqueue({
        tempId: 'temp-3',
        conversationId: 'c1',
        senderId: 'u1',
        content: 'Third',
        messageType: 'text',
        clientNonce: 'nonce-fifo-3',
      });
      item3.createdAt = new Date(Date.now() + 2000).toISOString();

      const mockSender = async (pending: PendingMessage) => {
        executionOrder.push(pending.tempId);
        return {
          id: `canonical-${pending.tempId}`,
          conversation_id: pending.conversationId,
          sender_id: pending.senderId,
          sequence_number: executionOrder.length,
          content: pending.content,
          message_type: 'text',
          status: 'sent',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Message;
      };

      const result = await offlineSyncQueue.reconcile('c1', mockSender);

      expect(result.flushedCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(executionOrder).toEqual(['temp-1', 'temp-2', 'temp-3']);
      expect(offlineSyncQueue.getPending('c1').length).toBe(0);
    });

    it('STRESS-OFFLINE-02: Poison message fails MAX_RETRIES (5) and is quarantined without crashing sync', async () => {
      // Temp-poison always throws, temp-good succeeds
      offlineSyncQueue.enqueue({
        tempId: 'temp-poison',
        conversationId: 'c1',
        senderId: 'u1',
        content: 'Corrupt payload',
        messageType: 'text',
        clientNonce: 'nonce-poison',
      });

      offlineSyncQueue.enqueue({
        tempId: 'temp-good',
        conversationId: 'c1',
        senderId: 'u1',
        content: 'Valid payload',
        messageType: 'text',
        clientNonce: 'nonce-good',
      });

      const mockSender = async (pending: PendingMessage) => {
        if (pending.tempId === 'temp-poison') {
          throw new Error('Database rejection: corrupt payload');
        }
        return {
          id: 'canonical-good',
          conversation_id: pending.conversationId,
          sender_id: pending.senderId,
          sequence_number: 10,
          content: pending.content,
          message_type: 'text',
          status: 'sent',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Message;
      };

      // Run reconciliation 5 times until poison message reaches MAX_RETRIES
      for (let attempt = 1; attempt <= 4; attempt++) {
        await offlineSyncQueue.reconcile('c1', mockSender);
        const poison = offlineSyncQueue.getPending('c1').find((m) => m.tempId === 'temp-poison');
        expect(poison?.retryCount).toBe(attempt);
        expect(poison?.status).toBe('pending');
      }

      // 5th attempt: should mark poison as 'failed'
      const finalResult = await offlineSyncQueue.reconcile('c1', mockSender);
      expect(finalResult.failedCount).toBe(1);

      const poison = offlineSyncQueue.getPending('c1').find((m) => m.tempId === 'temp-poison');
      expect(poison?.status).toBe('failed');
      expect(poison?.lastError).toContain('corrupt payload');
    });

    it('STRESS-OFFLINE-03: resolveConflicts strictly prefers server canonical messages over local optimistic duplicates', () => {
      const sharedNonce = 'nonce-sync-conflict-99';

      const serverMsg: Message = {
        id: 'msg-canonical-srv',
        conversation_id: 'c1',
        sender_id: 'u1',
        sequence_number: 42,
        client_nonce: sharedNonce,
        content: 'Canonical Server Content',
        message_type: 'text',
        created_at: '2026-10-04T10:00:00Z',
        updated_at: '2026-10-04T10:00:00Z',
        status: 'sent',
      };

      const localOptimisticMsg: Message = {
        id: 'temp-local-draft',
        conversation_id: 'c1',
        sender_id: 'u1',
        client_nonce: sharedNonce,
        content: 'Draft Local Content',
        message_type: 'text',
        created_at: '2026-10-04T09:59:00Z',
        updated_at: '2026-10-04T09:59:00Z',
        status: 'pending',
      };

      const resolved = offlineSyncQueue.resolveConflicts([serverMsg], [localOptimisticMsg]);

      expect(resolved.length).toBe(1);
      expect(resolved[0].id).toBe('msg-canonical-srv');
      expect(resolved[0].content).toBe('Canonical Server Content');
      expect(resolved[0].sequence_number).toBe(42);
      expect(resolved[0].status).toBe('sent');
    });
  });
});
