/**
 * Adversarial Stress & Edge Case Test Suite for /api/community/interactions
 * LKDV Community Architecture Milestone 3 (Requirement R4)
 *
 * Verifies:
 * 1. Authentication enforcement (401) & server failure handling (503)
 * 2. Invalid action types, malformed JSON, and unknown action payloads (400)
 * 3. Malformed UUIDs, SQL injection strings, non-string types, nil UUIDs (400)
 * 4. Invalid feedback types, invalid target types, and target missing errors (400)
 * 5. Save toggle idempotency, alternation, and fallback mechanics (RPC + table)
 * 6. Content feedback fallback mechanics (RPC + table upsert)
 * 7. GET query param validation, casing (postId vs post_id), and anonymous handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as interactionsPost, GET as interactionsGet } from '@/app/api/community/interactions/route';

const mockGetUser = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockCreateClient = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const VALID_POST_ID = '33333333-3333-4000-8000-333333333333';
const VALID_AUTHOR_ID = '11111111-1111-4000-8000-111111111111';
const VALID_CARNET_ID = '22222222-2222-4000-8000-222222222222';
const VALID_USER_ID = '99999999-9999-4000-8000-999999999999';

function setupDefaultSupabaseMock() {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: mockGetUser,
    },
    rpc: mockRpc,
    from: mockFrom,
  });
}

describe('Challenger M3: Adversarial Tests for /api/community/interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultSupabaseMock();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 1. AUTHENTICATION & SERVER FAILURE HARDENING
  // ════════════════════════════════════════════════════════════════════════════
  describe('1. Authentication & Service Resilience', () => {
    it('POST: rejects unauthenticated requests with 401 when user is null', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', postId: VALID_POST_ID }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/Authentification requise/i);
    });

    it('POST: rejects when auth.getUser() returns an error object', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'JWT expired', status: 401 },
      });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', postId: VALID_POST_ID }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/Authentification requise/i);
    });

    it('POST: returns 503 when createClient fails / server config missing', async () => {
      mockCreateClient.mockRejectedValueOnce(new Error('Supabase client failed'));

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', postId: VALID_POST_ID }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toMatch(/Configuration serveur indisponible/i);
    });

    it('GET: gracefully returns { isSaved: false } when client creation throws', async () => {
      mockCreateClient.mockRejectedValueOnce(new Error('No supabase env'));

      const req = new Request(`http://localhost:3000/api/community/interactions?postId=${VALID_POST_ID}`);
      const res = await interactionsGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.isSaved).toBe(false);
    });

    it('GET: gracefully returns { isSaved: false } when unauthenticated caller checks post', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

      const req = new Request(`http://localhost:3000/api/community/interactions?postId=${VALID_POST_ID}`);
      const res = await interactionsGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.isSaved).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. MALFORMED JSON & INVALID ACTION TYPES
  // ════════════════════════════════════════════════════════════════════════════
  describe('2. Payload & Action Type Validation', () => {
    it('POST: returns 400 on malformed JSON payload syntax', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"action": "save", "postId": broken-json...',
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/JSON invalide/i);
    });

    it('POST: returns 400 when body has empty object without action or feedbackType', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Paramètre "action" requis/i);
    });

    it('POST: returns 400 when action is an unknown / unsupported string', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_account', postId: VALID_POST_ID }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Action inconnue: "delete_account"/i);
    });

    it('POST: returns 400 when action is uppercase or arbitrary symbol', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SAVE', postId: VALID_POST_ID }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Action inconnue: "SAVE"/i);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. MALFORMED UUIDS & PATHOLOGICAL ID INJECTIONS
  // ════════════════════════════════════════════════════════════════════════════
  describe('3. UUID Strict Regex Enforcement & Injection Defense', () => {
    it.each([
      ['not-a-uuid'],
      ['12345'],
      ['33333333-3333-4000-8000-333333333333; DROP TABLE post_saves;'],
      ['33333333-3333-4000-8000-333333333333/../../etc/passwd'],
      ['zzzzzzzz-zzzz-4000-8000-zzzzzzzzzzzz'],
      ['33333333333340008000333333333333'], // missing dashes
      ['00000000-0000-0000-0000-000000000000'], // nil UUID (version 0 rejected by [1-5])
      ['33333333-3333-6000-8000-333333333333'], // invalid version 6
      ['33333333-3333-4000-c000-333333333333'], // invalid variant 'c' (only 8,9,a,b accepted)
    ])('POST save: rejects malformed UUID "%s" with 400', async (invalidUuid) => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', postId: invalidUuid }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/UUID valide requis/i);
    });

    it('POST save: rejects when postId is a non-string type (number, boolean, object)', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', postId: 99999 }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/UUID valide requis/i);
    });

    it('POST feedback: rejects malformed targetId with 400', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          targetType: 'post',
          targetId: 'invalid-id-string',
          feedbackType: 'hide',
        }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Paramètre "targetId" UUID valide requis/i);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. FEEDBACK VALIDATION (targetType, feedbackType, shorthand actions)
  // ════════════════════════════════════════════════════════════════════════════
  describe('4. Explicit Feedback Domain Rules', () => {
    it.each([
      ['comment'],
      ['user'],
      ['trip'],
      ['system'],
      ['<script>alert(1)</script>'],
    ])('POST feedback: rejects unsupported targetType "%s" with 400', async (invalidTargetType) => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          targetType: invalidTargetType,
          targetId: VALID_POST_ID,
          feedbackType: 'hide',
        }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/targetType invalide/i);
    });

    it.each([
      ['like'],
      ['love'],
      ['dislike'],
      ['block'],
      [''],
    ])('POST feedback: rejects invalid feedbackType "%s" with 400', async (invalidFeedbackType) => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          targetType: 'post',
          targetId: VALID_POST_ID,
          feedbackType: invalidFeedbackType,
        }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/feedbackType invalide/i);
    });

    it('POST feedback: accepts targetType "author" with valid author UUID', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockRpc.mockResolvedValueOnce({
        data: 'fb-author-1',
        error: null,
      });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          targetType: 'author',
          targetId: VALID_AUTHOR_ID,
          feedbackType: 'less_like_this',
        }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.targetType).toBe('author');
      expect(json.targetId).toBe(VALID_AUTHOR_ID);
      expect(mockRpc).toHaveBeenCalledWith('submit_content_feedback', {
        p_target_type: 'author',
        p_target_id: VALID_AUTHOR_ID,
        p_feedback_type: 'less_like_this',
        p_reason: null,
      });
    });

    it('POST feedback: accepts targetType "carnet" with valid carnet UUID', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockRpc.mockResolvedValueOnce({
        data: 'fb-carnet-1',
        error: null,
      });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          targetType: 'carnet',
          targetId: VALID_CARNET_ID,
          feedbackType: 'report',
          reason: 'Contenu non conforme aux règles LKDV',
        }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.targetType).toBe('carnet');
      expect(mockRpc).toHaveBeenCalledWith('submit_content_feedback', {
        p_target_type: 'carnet',
        p_target_id: VALID_CARNET_ID,
        p_feedback_type: 'report',
        p_reason: 'Contenu non conforme aux règles LKDV',
      });
    });

    it('POST feedback: shorthand "report" sets feedbackType="report" and targetType="post"', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockRpc.mockResolvedValueOnce({
        data: 'fb-report-1',
        error: null,
      });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'report',
          postId: VALID_POST_ID,
          reason: 'Inappropriate content',
        }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.feedbackType).toBe('report');
      expect(json.targetType).toBe('post');
    });

    it('POST feedback: fallback to content_feedback table upsert if RPC fails', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      // RPC throws
      mockRpc.mockRejectedValueOnce(new Error('RPC unavailable'));
      // Fallback upsert succeeds
      mockFrom.mockReturnValueOnce({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'upserted-feedback-uuid' },
              error: null,
            }),
          }),
        }),
      });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'hide',
          postId: VALID_POST_ID,
        }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.feedbackId).toBe('upserted-feedback-uuid');
    });

    it('POST feedback: returns 500 if both RPC and fallback upsert fail', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockRpc.mockRejectedValueOnce(new Error('RPC unavailable'));
      mockFrom.mockReturnValueOnce({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' },
            }),
          }),
        }),
      });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'hide',
          postId: VALID_POST_ID,
        }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toMatch(/Erreur lors de l’enregistrement du retour/i);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. SAVE TOGGLE IDEMPOTENCY & ALTERNATION STATE MACHINE
  // ════════════════════════════════════════════════════════════════════════════
  describe('5. Save Toggle Idempotency & Alternation Mechanics', () => {
    it('alternates saved state cleanly on repeated RPC calls: false -> true -> false', async () => {
      // Call 1: user saves post (RPC returns saved: true)
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockRpc.mockResolvedValueOnce({ data: { saved: true, post_id: VALID_POST_ID }, error: null });

      const req1 = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', postId: VALID_POST_ID }),
      });
      const res1 = await interactionsPost(req1);
      const json1 = await res1.json();
      expect(json1.saved).toBe(true);

      // Call 2: user toggles again (RPC returns saved: false)
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockRpc.mockResolvedValueOnce({ data: { saved: false, post_id: VALID_POST_ID }, error: null });

      const req2 = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', postId: VALID_POST_ID }),
      });
      const res2 = await interactionsPost(req2);
      const json2 = await res2.json();
      expect(json2.saved).toBe(false);
    });

    it('fallback table mutation: toggles from unsaved to saved (insert branch)', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockRpc.mockRejectedValueOnce(new Error('RPC missing'));

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'post_saves') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // not saved yet
                }),
              }),
            }),
            insert: mockInsert,
          };
        }
        return {};
      });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', postId: VALID_POST_ID }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.saved).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith({
        post_id: VALID_POST_ID,
        user_id: VALID_USER_ID,
      });
    });

    it('fallback table mutation: toggles from saved to unsaved (delete branch)', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockRpc.mockRejectedValueOnce(new Error('RPC missing'));

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'post_saves') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'save-row-1' }, error: null }), // already saved
                }),
              }),
            }),
            delete: mockDelete,
          };
        }
        return {};
      });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', postId: VALID_POST_ID }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.saved).toBe(false);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('fallback table mutation: handles select failure gracefully with 500', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockRpc.mockRejectedValueOnce(new Error('RPC missing'));

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'Read failure' } }),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', postId: VALID_POST_ID }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toMatch(/Erreur lors de la lecture des favoris/i);
    });

    it('fallback table mutation: handles insert failure with 500', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockRpc.mockRejectedValueOnce(new Error('RPC missing'));

      mockFrom.mockImplementation((table: string) => {
        if (table === 'post_saves') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            insert: vi.fn().mockResolvedValue({ error: { message: 'Insert failed' } }),
          };
        }
        return {};
      });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', postId: VALID_POST_ID }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toMatch(/Impossible d’enregistrer la publication/i);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 6. GET QUERY PARAMS & CASING DEFENSE
  // ════════════════════════════════════════════════════════════════════════════
  describe('6. GET Endpoint Query Parameter Validation', () => {
    it('GET: returns 400 when postId query parameter is completely missing', async () => {
      const req = new Request('http://localhost:3000/api/community/interactions');
      const res = await interactionsGet(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Paramètre "postId" UUID valide requis/i);
    });

    it('GET: returns 400 when postId query param is empty string', async () => {
      const req = new Request('http://localhost:3000/api/community/interactions?postId=');
      const res = await interactionsGet(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Paramètre "postId" UUID valide requis/i);
    });

    it('GET: returns 400 when postId contains SQL injection string', async () => {
      const req = new Request(`http://localhost:3000/api/community/interactions?postId=${VALID_POST_ID}'+OR+1=1--`);
      const res = await interactionsGet(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Paramètre "postId" UUID valide requis/i);
    });

    it('GET: supports snake_case post_id parameter seamlessly', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'save-row' }, error: null }),
            }),
          }),
        }),
      });

      const req = new Request(`http://localhost:3000/api/community/interactions?post_id=${VALID_POST_ID}`);
      const res = await interactionsGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.isSaved).toBe(true);
      expect(json.postId).toBe(VALID_POST_ID);
    });

    it('GET: returns isSaved: false when authenticated user has not saved post', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });

      const req = new Request(`http://localhost:3000/api/community/interactions?postId=${VALID_POST_ID}`);
      const res = await interactionsGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.isSaved).toBe(false);
      expect(json.postId).toBe(VALID_POST_ID);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 7. SNAKE_CASE PAYLOAD BODY COMPATIBILITY IN POST
  // ════════════════════════════════════════════════════════════════════════════
  describe('7. Snake_case Body Compatibility in POST', () => {
    it('POST: supports snake_case post_id and toggle_save action', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockRpc.mockResolvedValueOnce({ data: { saved: true, post_id: VALID_POST_ID }, error: null });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_save', post_id: VALID_POST_ID }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.saved).toBe(true);
    });

    it('POST: supports snake_case target_type, target_id, feedback_type', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: VALID_USER_ID } }, error: null });
      mockRpc.mockResolvedValueOnce({ data: 'fb-uuid-snake', error: null });

      const req = new Request('http://localhost:3000/api/community/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          target_type: 'post',
          target_id: VALID_POST_ID,
          feedback_type: 'hide',
        }),
      });

      const res = await interactionsPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.feedbackType).toBe('hide');
    });
  });
});
