/**
 * Phase 2 TRIBU — actions du groupe éclair.
 *
 *   (a) suggestions : union co-membres + abonnements, dédupliquée ;
 *   (b) recherche : < 2 caractères → vide, sinon profils filtrés ;
 *   (c) création : champs éphémères, invitations filtrées, retour { ok } ;
 *   (d) session absente → refus.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import {
  getSocialSuggestions,
  searchTripPartners,
  createEphemeralGroup,
  convertEphemeralGroup,
} from '@/features/tribu/actions/ephemeralGroup';

const ME = '11111111-1111-4111-8111-111111111111';
const CO_MEMBER = '22222222-2222-4222-8222-222222222222';
const FOLLOWING = '33333333-3333-4333-8333-333333333333';
const NEW_GROUP = '44444444-4444-4444-8444-444444444444';

interface MockOptions {
  user?: { id: string } | null;
  myMemberships?: Array<{ group_id: string }>;
  coMembers?: Array<{ user_id: string }>;
  following?: Array<{ following_id: string }>;
  profiles?: Array<{ id: string; full_name: string | null; avatar_url: string | null }>;
  searchProfiles?: Array<{ id: string; full_name: string | null; avatar_url: string | null }>;
  groupInsert?: { data: unknown; error: { message: string } | null };
  invitesError?: { message: string } | null;
}

function createSession(options: MockOptions & { groupMemberSingle?: unknown; updateError?: { message: string } | null }) {
  const calls: Array<{ table: string; op: string; payload?: unknown; args?: unknown }> = [];

  function makeBuilder(table: string) {
    let mode: 'select' | 'in' | 'ilike' | 'update' | 'delete' = 'select';
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.limit = () => builder;
    builder.update = (payload: unknown) => {
      mode = 'update';
      calls.push({ table, op: 'update', payload });
      return builder;
    };
    builder.delete = () => {
      mode = 'delete';
      calls.push({ table, op: 'delete' });
      return builder;
    };
    builder.in = (column: string, values: unknown) => {
      mode = 'in';
      calls.push({ table, op: 'in', args: [column, values] });
      return builder;
    };
    builder.ilike = (column: string, value: unknown) => {
      mode = 'ilike';
      calls.push({ table, op: 'ilike', args: [column, value] });
      return builder;
    };
    builder.maybeSingle = async () =>
      table === 'group_members'
        ? { data: options.groupMemberSingle ?? null, error: null }
        : { data: null, error: null };
    builder.single = async () => options.groupInsert ?? { data: { id: NEW_GROUP, name: 'Sortie' }, error: null };
    builder.insert = (payload: unknown) => {
      calls.push({ table, op: 'insert', payload });
      if (table === 'travel_groups') {
        return {
          select: () => ({ single: async () => options.groupInsert ?? { data: { id: NEW_GROUP, name: 'Sortie du jour' }, error: null } }),
        };
      }
      return Promise.resolve({ data: null, error: options.invitesError ?? null });
    };
    builder.then = (resolve: (value: unknown) => unknown) => {
      if (mode === 'update') return resolve({ data: null, error: options.updateError ?? null });
      if (mode === 'delete') return resolve({ data: null, error: null });
      if (table === 'group_members') {
        if (mode === 'in') return resolve({ data: options.coMembers ?? [], error: null });
        return resolve({ data: options.myMemberships ?? [], error: null });
      }
      if (table === 'user_follows') return resolve({ data: options.following ?? [], error: null });
      if (table === 'public_profiles' && mode === 'ilike') {
        return resolve({ data: options.searchProfiles ?? [], error: null });
      }
      if (table === 'public_profiles') return resolve({ data: options.profiles ?? [], error: null });
      return resolve({ data: null, error: null });
    };
    return builder;
  }

  return {
    calls,
    auth: {
      getUser: async () => ({ data: { user: options.user ?? null } }),
    },
    from: (table: string) => makeBuilder(table),
  };
}

const mockedCreateClient = vi.mocked(createClient);

describe('ephemeralGroup — actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(a) suggestions : union dédupliquée co-membres + abonnements', async () => {
    mockedCreateClient.mockResolvedValue(
      createSession({
        user: { id: ME },
        myMemberships: [{ group_id: 'g1' }],
        coMembers: [{ user_id: CO_MEMBER }, { user_id: ME }],
        following: [{ following_id: CO_MEMBER }, { following_id: FOLLOWING }],
        profiles: [
          { id: CO_MEMBER, full_name: 'Zoé', avatar_url: null },
          { id: FOLLOWING, full_name: 'Marc', avatar_url: null },
        ],
      }) as never
    );

    const result = await getSocialSuggestions();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions.find((s) => s.id === CO_MEMBER)?.hint).toBe('Groupe commun');
    expect(result.suggestions.find((s) => s.id === FOLLOWING)?.hint).toBe('Abonnement');
    expect(result.suggestions.some((s) => s.id === ME)).toBe(false);
  });

  it('(b) recherche : ignore les requêtes trop courtes, sinon profils filtrés', async () => {
    const short = await searchTripPartners('a');
    expect(short).toEqual({ ok: true, suggestions: [] });
    expect(mockedCreateClient).not.toHaveBeenCalled();

    mockedCreateClient.mockResolvedValue(
      createSession({
        user: { id: ME },
        searchProfiles: [
          { id: CO_MEMBER, full_name: 'Zoé', avatar_url: null },
          { id: ME, full_name: 'Moi', avatar_url: null },
        ],
      }) as never
    );

    const result = await searchTripPartners('zo');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({ id: CO_MEMBER, name: 'Zoé', hint: 'Recherche' });
  });

  it('(c) création : éphémère + invitations filtrées', async () => {
    const session = createSession({
      user: { id: ME },
      groupInsert: { data: { id: NEW_GROUP, name: 'Sortie du jour' }, error: null },
    });
    mockedCreateClient.mockResolvedValue(session as never);

    const before = Date.now();
    const result = await createEphemeralGroup({
      title: '  Sortie test  ',
      inviteeIds: [CO_MEMBER, ME, CO_MEMBER],
    });
    const after = Date.now();

    expect(result).toEqual({ ok: true, groupId: NEW_GROUP, name: 'Sortie du jour' });

    const groupInsert = session.calls.find((c) => c.table === 'travel_groups' && c.op === 'insert');
    const payload = groupInsert?.payload as Record<string, unknown>;
    expect(payload).toMatchObject({ name: 'Sortie test', owner_id: ME, is_ephemeral: true, visibility: 'private' });
    const dissolveAt = new Date(payload.auto_dissolve_at as string).getTime();
    expect(dissolveAt).toBeGreaterThanOrEqual(before + 6 * 24 * 60 * 60 * 1000);
    expect(dissolveAt).toBeLessThanOrEqual(after + 8 * 24 * 60 * 60 * 1000);

    const invites = session.calls.find((c) => c.table === 'group_members' && c.op === 'insert');
    expect(invites?.payload).toEqual([
      { group_id: NEW_GROUP, user_id: CO_MEMBER, role: 'member', status: 'pending' },
    ]);
  });

  it('(d) session absente → refus sans écriture', async () => {
    const session = createSession({ user: null });
    mockedCreateClient.mockResolvedValue(session as never);

    const suggestions = await getSocialSuggestions();
    expect(suggestions).toEqual({ ok: false, error: 'Connexion requise.' });

    const created = await createEphemeralGroup({ inviteeIds: [] });
    expect(created).toEqual({ ok: false, error: 'Connexion requise pour créer une sortie.' });
    expect(session.calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });

    it('(e) conversion : réservée aux organisateurs, sinon refus sans update', async () => {    const memberSession = createSession({
      user: { id: ME },
      groupMemberSingle: { role: 'member', status: 'active' },
    });
    mockedCreateClient.mockResolvedValue(memberSession as never);

    const denied = await convertEphemeralGroup(NEW_GROUP);
    expect(denied).toEqual({ ok: false, error: 'Seul un organisateur peut convertir la sortie.' });
    expect(memberSession.calls.some((c) => c.op === 'update')).toBe(false);

    const organizerSession = createSession({
      user: { id: ME },
      groupMemberSingle: { role: 'organizer', status: 'active' },
    });
    mockedCreateClient.mockResolvedValue(organizerSession as never);

    const ok = await convertEphemeralGroup(NEW_GROUP);
    expect(ok).toEqual({ ok: true });
    const update = organizerSession.calls.find((c) => c.op === 'update');
    expect(update?.payload).toEqual({ is_ephemeral: false, auto_dissolve_at: null });
  });

  it('(f) échec des invitations : la sortie est compensée (supprimée)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const session = createSession({
      user: { id: ME },
      invitesError: { message: 'rls denied' },
    });
    mockedCreateClient.mockResolvedValue(session as never);

    const result = await createEphemeralGroup({ inviteeIds: [CO_MEMBER] });

    expect(result).toEqual({
      ok: false,
      error: 'Invitations impossibles — sortie non créée.',
    });
    expect(
      session.calls.some((c) => c.table === 'travel_groups' && c.op === 'delete')
    ).toBe(true);
    consoleSpy.mockRestore();
  });
});
