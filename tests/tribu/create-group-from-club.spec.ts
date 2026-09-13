/**
 * Phase 1 TRIBU — `createGroupFromClub` : création d'un groupe rattaché au club.
 *
 *   (a) entrée invalide → refus sans requête ;
 *   (b) session absente / club introuvable / non-membre → refus sans écriture ;
 *   (c) succès → groupe `club_only` + parent_club_id, invitations `pending`
 *       filtrées (self exclu, non-membres exclus), revalidation ;
 *   (d) échec d'invitation → création conservée (non bloquant).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createGroupFromClub } from '@/features/tribu/actions/createGroupFromClub';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '99999999-9999-4999-8999-999999999999';
const OUTSIDER_ID = '88888888-8888-4888-8888-888888888888';
const CLUB_ID = '22222222-2222-4222-8222-222222222222';
const GROUP_ID = '33333333-3333-4333-8333-333333333333';

interface SessionOptions {
  user?: { id: string } | null;
  club?: Record<string, unknown> | null;
  membership?: Record<string, unknown> | null;
  activeClubMembers?: Array<{ user_id: string }>;
  groupInsert?: { data: unknown; error: { message: string } | null };
  invitesError?: { message: string } | null;
}

function createSession(options: SessionOptions) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];
  const session = {
    calls,
    auth: {
      getUser: async () => ({ data: { user: options.user ?? null } }),
    },
    from(table: string) {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.maybeSingle = async () => {
        calls.push({ table, op: 'select-single' });
        if (table === 'clubs') return { data: options.club ?? null, error: null };
        return { data: options.membership ?? null, error: null };
      };
      builder.in = async () => {
        calls.push({ table, op: 'select-in' });
        return { data: options.activeClubMembers ?? [], error: null };
      };
      builder.insert = (payload: unknown) => {
        calls.push({ table, op: 'insert', payload });
        if (table === 'travel_groups') {
          return {
            select: () => ({
              single: async () =>
                options.groupInsert ?? {
                  data: { id: GROUP_ID, name: 'Groupe test' },
                  error: null,
                },
            }),
          };
        }
        return Promise.resolve({ data: null, error: options.invitesError ?? null });
      };
      return builder;
    },
  };
  return session;
}

const mockedCreateClient = vi.mocked(createClient);
const mockedRevalidate = vi.mocked(revalidatePath);

describe('createGroupFromClub — action serveur', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(a) refuse une entrée invalide sans requête', async () => {
    const result = await createGroupFromClub({ clubId: 'pas-un-uuid', name: 'X' });
    expect(result).toEqual({ ok: false, error: 'Données invalides.' });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('(b1) refuse une session absente', async () => {
    mockedCreateClient.mockResolvedValue(createSession({ user: null }) as never);
    const result = await createGroupFromClub({ clubId: CLUB_ID, name: 'Groupe test' });
    expect(result).toEqual({ ok: false, error: 'Connexion requise pour créer un groupe.' });
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });

  it('(b2) refuse un club introuvable', async () => {
    mockedCreateClient.mockResolvedValue(createSession({ user: { id: USER_ID } }) as never);
    const result = await createGroupFromClub({ clubId: CLUB_ID, name: 'Groupe test' });
    expect(result).toEqual({ ok: false, error: 'Club introuvable.' });
  });

  it('(b3) refuse un non-membre du club sans écriture', async () => {
    const session = createSession({
      user: { id: USER_ID },
      club: { id: CLUB_ID, name: 'Club test' },
      membership: null,
    });
    mockedCreateClient.mockResolvedValue(session as never);

    const result = await createGroupFromClub({ clubId: CLUB_ID, name: 'Groupe test' });

    expect(result).toEqual({
      ok: false,
      error: 'Vous devez être membre du club pour créer un groupe.',
    });
    expect(session.calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });

  it('(c) crée un groupe club_only et invite les membres actifs du club', async () => {
    const session = createSession({
      user: { id: USER_ID },
      club: { id: CLUB_ID, name: 'Club test' },
      membership: { id: 'membership-1' },
      activeClubMembers: [{ user_id: OTHER_ID }, { user_id: OUTSIDER_ID }],
      groupInsert: { data: { id: GROUP_ID, name: 'Traversée test' }, error: null },
    });
    mockedCreateClient.mockResolvedValue(session as never);

    const result = await createGroupFromClub({
      clubId: CLUB_ID,
      name: 'Traversée test',
      memberIds: [OTHER_ID, OUTSIDER_ID, USER_ID],
    });

    expect(result).toEqual({ ok: true, groupId: GROUP_ID, name: 'Traversée test' });

    const groupInsert = session.calls.find(
      (c) => c.table === 'travel_groups' && c.op === 'insert'
    );
    expect(groupInsert?.payload).toMatchObject({
      name: 'Traversée test',
      owner_id: USER_ID,
      visibility: 'club_only',
      parent_club_id: CLUB_ID,
    });

    const invites = session.calls.find((c) => c.table === 'group_members' && c.op === 'insert');
    expect(invites?.payload).toEqual([
      { group_id: GROUP_ID, user_id: OTHER_ID, role: 'member', status: 'pending' },
      { group_id: GROUP_ID, user_id: OUTSIDER_ID, role: 'member', status: 'pending' },
    ]);
    // L'utilisateur courant n'est jamais invité (organizer posé par la DB).
    expect(JSON.stringify(invites?.payload)).not.toContain(USER_ID);
    expect(mockedRevalidate).toHaveBeenCalledWith('/clubs', 'layout');
  });

  it('(d) échec d\'invitation non bloquant : le groupe reste créé', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const session = createSession({
      user: { id: USER_ID },
      club: { id: CLUB_ID, name: 'Club test' },
      membership: { id: 'membership-1' },
      activeClubMembers: [{ user_id: OTHER_ID }],
      groupInsert: { data: { id: GROUP_ID, name: 'Groupe test' }, error: null },
      invitesError: { message: 'rls denied' },
    });
    mockedCreateClient.mockResolvedValue(session as never);

    const result = await createGroupFromClub({
      clubId: CLUB_ID,
      name: 'Groupe test',
      memberIds: [OTHER_ID],
    });

    expect(result).toEqual({ ok: true, groupId: GROUP_ID, name: 'Groupe test' });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
