import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { ClubCapability, ClubRole } from '@/features/clubs';

const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const FOUNDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const VOLUNTEER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const MEMBER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const mockState = vi.hoisted(() => ({
  viewerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' as string | null,
  viewerCaps: [] as ClubCapability[],
  budgetRows: [] as Record<string, unknown>[],
  lastInsert: null as Record<string, unknown> | null,
  lastUpsert: null as Record<string, unknown> | null,
  lastDeleteTable: null as string | null,
}));

vi.mock('@/lib/queries/publicProfilesCore', () => ({
  fetchPublicProfilesWith: vi.fn(async () => ({})),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockState.viewerId ? { id: mockState.viewerId } : null },
      })),
    },
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'club_get_viewer_capabilities') {
        return { data: mockState.viewerCaps, error: null };
      }
      if (fn === 'club_has_capability') {
        return {
          data: mockState.viewerCaps.includes(args.p_capability as ClubCapability),
          error: null,
        };
      }
      return { data: null, error: null };
    }),
    from: (table: string) => {
      const clubRow = {
        id: CLUB_ID,
        slug: 'cordee-des-alpes',
        name: 'Cordée des Alpes',
        description: 'Club test',
        category: 'trail',
        privacy: 'open',
        created_by: FOUNDER_ID,
        created_at: '2026-01-01T00:00:00.000Z',
      };
      const memberRows = [
        { club_id: CLUB_ID, user_id: FOUNDER_ID, role: 'founder' as ClubRole, status: 'active', joined_at: '2026-01-01T00:00:00.000Z' },
        { club_id: CLUB_ID, user_id: ADMIN_ID, role: 'admin' as ClubRole, status: 'active', joined_at: '2026-01-02T00:00:00.000Z' },
        { club_id: CLUB_ID, user_id: VOLUNTEER_ID, role: 'volunteer' as ClubRole, status: 'active', joined_at: '2026-01-03T00:00:00.000Z' },
        { club_id: CLUB_ID, user_id: MEMBER_ID, role: 'member' as ClubRole, status: 'active', joined_at: '2026-01-04T00:00:00.000Z' },
      ];

      let rows: Record<string, unknown>[] = [];
      if (table === 'clubs') rows = [clubRow];
      else if (table === 'club_members') rows = memberRows;
      else if (table === 'club_budget_entries') rows = mockState.budgetRows;

      let insertedRow: Record<string, unknown> | null = null;
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        is: () => chain,
        or: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: rows, error: null }),
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
        single: () => Promise.resolve({ data: insertedRow ?? rows[0] ?? null, error: null }),
        insert: (payload: Record<string, unknown>) => {
          mockState.lastInsert = payload;
          insertedRow = {
            id: '99999999-9999-4999-8999-999999999999',
            created_at: '2026-06-01T00:00:00.000Z',
            updated_at: '2026-06-01T00:00:00.000Z',
            ...payload,
          };
          return chain;
        },
        upsert: (payload: Record<string, unknown>) => {
          mockState.lastUpsert = payload;
          return Promise.resolve({ data: payload, error: null });
        },
        delete: () => {
          mockState.lastDeleteTable = table;
          return chain;
        },
        then: (resolve: (val: { data: unknown; error: null }) => void) =>
          resolve({ data: rows, error: null }),
      };
      return chain;
    },
  })),
}));

import { DELETE as deleteClub } from '../[id]/route';
import { PATCH as patchPermissions } from '../[id]/permissions/route';
import { GET as getBudget, POST as postBudget } from '../[id]/budget/route';
import { POST as postVolunteers } from '../[id]/volunteers/route';

function makeJsonReq(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost',
      host: 'localhost',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('Club Admin V2 — API routes (DELETE club, permissions, budget, volunteers)', () => {
  beforeEach(() => {
    mockState.viewerId = FOUNDER_ID;
    mockState.viewerCaps = [];
    mockState.budgetRows = [];
    mockState.lastInsert = null;
    mockState.lastUpsert = null;
    mockState.lastDeleteTable = null;
  });

  it('DELETE /api/clubs/[id] : réservé au Fondateur avec confirmation slug/nom', async () => {
    // Admin refusé (403)
    mockState.viewerId = ADMIN_ID;
    mockState.viewerCaps = ['club.edit_settings'];
    const adminRes = await deleteClub(
      makeJsonReq(`http://localhost/api/clubs/${CLUB_ID}`, 'DELETE', {
        confirmSlug: 'cordee-des-alpes',
      }),
      { params: Promise.resolve({ id: CLUB_ID }) },
    );
    expect(adminRes.status).toBe(403);

    // Fondateur avec mauvais slug -> 400
    mockState.viewerId = FOUNDER_ID;
    const badSlugRes = await deleteClub(
      makeJsonReq(`http://localhost/api/clubs/${CLUB_ID}`, 'DELETE', {
        confirmSlug: 'wrong-slug',
      }),
      { params: Promise.resolve({ id: CLUB_ID }) },
    );
    expect(badSlugRes.status).toBe(400);

    // Fondateur avec bon slug -> 200
    const okRes = await deleteClub(
      makeJsonReq(`http://localhost/api/clubs/${CLUB_ID}`, 'DELETE', {
        confirmSlug: 'cordee-des-alpes',
      }),
      { params: Promise.resolve({ id: CLUB_ID }) },
    );
    expect(okRes.status).toBe(200);
    expect(mockState.lastDeleteTable).toBe('clubs');
  });

  it('PATCH /api/clubs/[id]/permissions : bloque toute escalade de rang ou de capacité', async () => {
    mockState.viewerId = ADMIN_ID;
    mockState.viewerCaps = ['permissions.delegate', 'budget.view'];

    // Admin ne peut pas modifier la policy du rôle admin (rang égal)
    const peerRes = await patchPermissions(
      makeJsonReq(`http://localhost/api/clubs/${CLUB_ID}/permissions`, 'PATCH', {
        action: 'set_role_policy',
        role: 'admin',
        capability: 'budget.view',
        allowed: false,
      }),
      { params: Promise.resolve({ id: CLUB_ID }) },
    );
    expect(peerRes.status).toBe(403);

    // Admin ne peut pas déléguer une capacité qu'il ne possède pas
    const escalateRes = await patchPermissions(
      makeJsonReq(`http://localhost/api/clubs/${CLUB_ID}/permissions`, 'PATCH', {
        action: 'set_role_policy',
        role: 'volunteer',
        capability: 'budget.approve_and_manage',
        allowed: true,
      }),
      { params: Promise.resolve({ id: CLUB_ID }) },
    );
    expect(escalateRes.status).toBe(403);

    // Admin peut déléguer une capacité qu'il détient à un rang inférieur
    const okRes = await patchPermissions(
      makeJsonReq(`http://localhost/api/clubs/${CLUB_ID}/permissions`, 'PATCH', {
        action: 'set_role_policy',
        role: 'volunteer',
        capability: 'budget.view',
        allowed: true,
      }),
      { params: Promise.resolve({ id: CLUB_ID }) },
    );
    expect(okRes.status).toBe(200);
    expect(mockState.lastUpsert).toMatchObject({ role: 'volunteer', capability: 'budget.view', allowed: true });
  });

  it('POST & GET /api/clubs/[id]/budget : force proposed pour bénévole et protège export CSV', async () => {
    mockState.viewerId = VOLUNTEER_ID;
    mockState.viewerCaps = ['budget.view', 'budget.propose_expense'];

    // Bénévole qui demande status='approved' est forcé à 'proposed'
    const postRes = await postBudget(
      makeJsonReq(`http://localhost/api/clubs/${CLUB_ID}/budget`, 'POST', {
        kind: 'expense',
        category: 'Ravitaillement',
        label: 'Eau marathon',
        amountCents: 12000,
        status: 'approved',
      }),
      { params: Promise.resolve({ id: CLUB_ID }) },
    );
    expect(postRes.status).toBe(201);
    expect(mockState.lastInsert?.status).toBe('proposed');

    // Bénévole ne peut pas exporter en CSV (403)
    const volCsvRes = await getBudget(
      new NextRequest(`http://localhost/api/clubs/${CLUB_ID}/budget?format=csv`),
      { params: Promise.resolve({ id: CLUB_ID }) },
    );
    expect(volCsvRes.status).toBe(403);

    // Admin avec budget.approve_and_manage peut exporter en CSV avec protection formula injection
    mockState.viewerId = ADMIN_ID;
    mockState.viewerCaps = ['budget.view', 'budget.approve_and_manage'];
    mockState.budgetRows = [
      {
        id: '88888888-8888-4888-8888-888888888888',
        club_id: CLUB_ID,
        event_id: null,
        kind: 'expense',
        category: 'Logistique',
        label: '=CMD() injection',
        amount_cents: 4500,
        status: 'approved',
        notes: null,
        receipt_url: null,
        created_by: VOLUNTEER_ID,
        approved_by: ADMIN_ID,
        approved_at: '2026-06-01T12:00:00.000Z',
        created_at: '2026-06-01T10:00:00.000Z',
        updated_at: '2026-06-01T12:00:00.000Z',
      },
    ];
    const adminCsvRes = await getBudget(
      new NextRequest(`http://localhost/api/clubs/${CLUB_ID}/budget?format=csv`),
      { params: Promise.resolve({ id: CLUB_ID }) },
    );
    expect(adminCsvRes.status).toBe(200);
    expect(adminCsvRes.headers.get('content-type')).toContain('text/csv');
    const csvText = await adminCsvRes.text();
    expect(csvText).toContain("'=CMD() injection");
  });

  it('POST /api/clubs/[id]/volunteers : autorise le bénévole habilité et refuse le membre simple', async () => {
    mockState.viewerId = MEMBER_ID;
    mockState.viewerCaps = ['salons.post'];
    const denied = await postVolunteers(
      makeJsonReq(`http://localhost/api/clubs/${CLUB_ID}/volunteers`, 'POST', {
        action: 'create_shift',
        eventId: EVENT_ID,
        title: 'Ravitaillement km 15',
        capacity: 6,
      }),
      { params: Promise.resolve({ id: CLUB_ID }) },
    );
    expect(denied.status).toBe(403);

    mockState.viewerId = VOLUNTEER_ID;
    mockState.viewerCaps = ['volunteers.manage_shifts'];
    const created = await postVolunteers(
      makeJsonReq(`http://localhost/api/clubs/${CLUB_ID}/volunteers`, 'POST', {
        action: 'create_shift',
        eventId: EVENT_ID,
        title: 'Ravitaillement km 15',
        capacity: 6,
      }),
      { params: Promise.resolve({ id: CLUB_ID }) },
    );
    expect(created.status).toBe(201);
    expect(mockState.lastInsert).toMatchObject({
      event_id: EVENT_ID,
      title: 'Ravitaillement km 15',
      capacity: 6,
    });
  });
});
