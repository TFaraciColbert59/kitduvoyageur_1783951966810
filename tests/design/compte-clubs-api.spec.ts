/**
 * Task 17 — route `POST /api/compte/clubs` et kits recommandés du bootstrap.
 *
 * Contrat verrouillé :
 * - 401 avant toute lecture Supabase ;
 * - zod strict : action inconnue, corps illisible, identifiant non UUID ou
 *   champ supplémentaire → 400 ;
 * - `join` insère la seule adhésion de l'appelant, idempotente si elle existe
 *   déjà ; `leave` supprime la sienne ; `rsvp` persiste sa participation à un
 *   événement réel (upsert), 404 si l'événement n'existe pas, 409 s'il est
 *   passé, 403 sur refus RLS ;
 * - aucune clé service : l'écriture reste bornée au client RLS de session ;
 * - `mapClubs` expose `recommendedKits` depuis les recommandations réelles
 *   (`club_recommended_kits` + `kits`/`materiel_kits`) et un tableau vide
 *   quand la table est vide (aucune invention).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { POST } from '@/app/api/compte/clubs/route';
import {
  loadAccountBootstrap,
  mapClubs,
  type ClubRecommendedKitRow,
} from '@/features/compte/data/accountBootstrap';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CLUB_ID = '22222222-2222-4222-8222-222222222222';
const EVENT_ID = '33333333-3333-4333-8333-333333333333';
const MEMBER_ID = '44444444-4444-4444-8444-444444444444';

const NOW = new Date('2026-10-21T12:00:00Z');
const inDays = (days: number): string => {
  const date = new Date(NOW);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};
const FUTURE = inDays(4);
const PAST = inDays(-2);

type Row = Record<string, unknown>;
type Result = { data: unknown; error: unknown };

const ok = (data: unknown = null): Result => ({ data, error: null });
const fail = (code: string): Result => ({ data: null, error: { code } });

interface HarnessOptions {
  user?: { id: string } | null;
  club?: Result;
  membership?: Result;
  /** File de lectures `club_members` (join en conflit : lecture + relecture). */
  memberships?: Result[];
  event?: Result;
  insert?: Result;
  upsert?: Result;
  remove?: Result;
}

interface DeleteCall {
  table: string;
  filters: Array<[string, unknown]>;
}

interface HarnessCalls {
  tables: string[];
  eqs: Array<{ table: string; column: string; value: unknown }>;
  inserts: Array<{ table: string; row: Row }>;
  upserts: Array<{ table: string; row: Row; options: Row }>;
  deletes: DeleteCall[];
}

function selectResultFor(table: string, options: HarnessOptions): Result {
  if (table === 'clubs') return options.club ?? ok({ id: CLUB_ID });
  if (table === 'club_members') {
    return options.memberships?.shift() ?? options.membership ?? ok(null);
  }
  if (table === 'club_events') return options.event ?? ok(null);
  return ok(null);
}

function writeChain(result: Result): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.single = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);
  chain.then = (resolveThen: (value: Result) => unknown) =>
    Promise.resolve(result).then(resolveThen);
  return chain;
}

function builder(table: string, options: HarnessOptions, calls: HarnessCalls): Record<string, unknown> {
  const filters: Array<[string, unknown]> = [];
  let mode: 'select' | 'delete' = 'select';
  const resolve = () =>
    mode === 'delete' ? (options.remove ?? ok(null)) : selectResultFor(table, options);

  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn((column: string, value: unknown) => {
    filters.push([column, value]);
    calls.eqs.push({ table, column, value });
    return chain;
  });
  chain.in = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.gt = vi.fn(self);
  chain.neq = vi.fn(self);
  chain.or = vi.fn(self);
  chain.maybeSingle = vi.fn(async () => resolve());
  chain.single = vi.fn(async () => resolve());
  chain.then = (resolveThen: (value: Result) => unknown) =>
    Promise.resolve(resolve()).then(resolveThen);
  chain.delete = vi.fn(() => {
    mode = 'delete';
    calls.deletes.push({ table, filters });
    return chain;
  });
  chain.insert = vi.fn((row: Row) => {
    calls.inserts.push({ table, row });
    return writeChain(options.insert ?? ok(null));
  });
  chain.upsert = vi.fn((row: Row, upsertOptions: Row) => {
    calls.upserts.push({ table, row, options: upsertOptions });
    return writeChain(options.upsert ?? ok(null));
  });
  return chain;
}

function harness(options: HarnessOptions = {}) {
  const calls: HarnessCalls = { tables: [], eqs: [], inserts: [], upserts: [], deletes: [] };
  const user = options.user === undefined ? { id: USER_ID } : options.user;
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user } })) },
    from: vi.fn((table: string) => {
      calls.tables.push(table);
      return builder(table, options, calls);
    }),
  };
  return { client, calls };
}

function use(harnessed: ReturnType<typeof harness>) {
  vi.mocked(createClient).mockResolvedValue(harnessed.client as never);
  return harnessed;
}

function post(body: unknown) {
  return new NextRequest('http://localhost/api/compte/clubs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  // Les pannes d'infrastructure sont testées : pas de bruit dans la sortie.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('POST /api/compte/clubs — session et validation', () => {
  it('refuse un visiteur non authentifié (401) sans toucher la base', async () => {
    const h = use(harness({ user: null }));

    const response = await POST(post({ action: 'join', clubId: CLUB_ID }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthenticated' });
    expect(h.calls.tables).toEqual([]);
  });

  it('refuse une action inconnue (400)', async () => {
    use(harness());

    const response = await POST(post({ action: 'rejoindre', clubId: CLUB_ID }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_action' });
  });

  it('refuse un corps illisible, un identifiant non UUID ou un champ en trop (400)', async () => {
    use(harness());

    expect((await POST(post('pas-du-json'))).status).toBe(400);
    expect((await POST(post({ action: 'join', clubId: 'c1' }))).status).toBe(400);
    expect(
      await (await POST(post({ action: 'join', clubId: CLUB_ID, userId: USER_ID }))).json()
    ).toEqual({ error: 'invalid_body' });
    expect((await POST(post({ action: 'rsvp', clubId: CLUB_ID }))).status).toBe(400);
  });
});

describe('POST /api/compte/clubs — join', () => {
  it('insère la seule adhésion de l’appelant (200)', async () => {
    const h = use(harness({ membership: ok(null), insert: ok(null) }));

    const response = await POST(post({ action: 'join', clubId: CLUB_ID }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ clubId: CLUB_ID, joined: true });
    expect(h.calls.inserts).toEqual([
      {
        table: 'club_members',
        row: {
          club_id: CLUB_ID,
          user_id: USER_ID,
          role: 'member',
          status: 'active',
        },
      },
    ]);
    // L'adhésion existante est cherchée pour l'appelant seulement.
    expect(h.calls.eqs).toContainEqual({
      table: 'club_members',
      column: 'user_id',
      value: USER_ID,
    });
  });

  it('reste idempotent quand l’adhésion active existe déjà (200, aucune écriture)', async () => {
    const h = use(
      harness({
        membership: ok({ id: MEMBER_ID, role: 'member', status: 'active' }),
      })
    );

    const response = await POST(post({ action: 'join', clubId: CLUB_ID }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ clubId: CLUB_ID, joined: true });
    expect(h.calls.inserts).toEqual([]);
  });

  it('refuse une adhésion en attente (409) et une adhésion bannie (403)', async () => {
    use(harness({ membership: ok({ id: MEMBER_ID, role: 'member', status: 'pending' }) }));
    const pending = await POST(post({ action: 'join', clubId: CLUB_ID }));
    expect(pending.status).toBe(409);
    expect(await pending.json()).toEqual({ error: 'membership_pending' });

    use(harness({ membership: ok({ id: MEMBER_ID, role: 'member', status: 'banned' }) }));
    const banned = await POST(post({ action: 'join', clubId: CLUB_ID }));
    expect(banned.status).toBe(403);
    expect(await banned.json()).toEqual({ error: 'forbidden' });
  });

  it('sur conflit 23505, relit l’adhésion active et reste idempotent (200)', async () => {
    const h = use(
      harness({
        memberships: [
          ok(null),
          ok({ id: MEMBER_ID, role: 'member', status: 'active' }),
        ],
        insert: fail('23505'),
      })
    );

    const response = await POST(post({ action: 'join', clubId: CLUB_ID }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ clubId: CLUB_ID, joined: true });
    expect(h.calls.inserts).toHaveLength(1);
    // Deux lectures de l'adhésion (avant l'insert puis après le conflit 23505).
    expect(
      h.calls.eqs.filter(
        (call) => call.table === 'club_members' && call.column === 'user_id'
      )
    ).toHaveLength(2);
  });

  it('sur conflit 23505, applique le statut réel : pending 409, banned 403', async () => {
    use(
      harness({
        memberships: [
          ok(null),
          ok({ id: MEMBER_ID, role: 'member', status: 'pending' }),
        ],
        insert: fail('23505'),
      })
    );
    const pending = await POST(post({ action: 'join', clubId: CLUB_ID }));
    expect(pending.status).toBe(409);
    expect(await pending.json()).toEqual({ error: 'membership_pending' });

    use(
      harness({
        memberships: [
          ok(null),
          ok({ id: MEMBER_ID, role: 'member', status: 'banned' }),
        ],
        insert: fail('23505'),
      })
    );
    const banned = await POST(post({ action: 'join', clubId: CLUB_ID }));
    expect(banned.status).toBe(403);
    expect(await banned.json()).toEqual({ error: 'forbidden' });
  });

  it('renvoie 404 pour un club invisible, sans écrire', async () => {
    const h = use(harness({ club: ok(null) }));

    const response = await POST(post({ action: 'join', clubId: CLUB_ID }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
    expect(h.calls.inserts).toEqual([]);
  });

  it('traduit un refus RLS en 403 et une panne en 500', async () => {
    use(harness({ insert: fail('42501') }));
    const forbidden = await POST(post({ action: 'join', clubId: CLUB_ID }));
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ error: 'forbidden' });

    use(harness({ insert: fail('XX000') }));
    const broken = await POST(post({ action: 'join', clubId: CLUB_ID }));
    expect(broken.status).toBe(500);
    expect(await broken.json()).toEqual({ error: 'server_error' });
  });
});

describe('POST /api/compte/clubs — leave', () => {
  it('supprime l’adhésion active de l’appelant (200)', async () => {
    const h = use(
      harness({
        membership: ok({ id: MEMBER_ID, role: 'member', status: 'active' }),
        remove: ok(null),
      })
    );

    const response = await POST(post({ action: 'leave', clubId: CLUB_ID }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ clubId: CLUB_ID, joined: false });
    expect(h.calls.deletes).toHaveLength(1);
    expect(h.calls.deletes[0].table).toBe('club_members');
    expect(h.calls.deletes[0].filters).toEqual([
      ['club_id', CLUB_ID],
      ['user_id', USER_ID],
    ]);
  });

  it('autorise le retrait d’une demande en attente (200)', async () => {
    const h = use(
      harness({
        membership: ok({ id: MEMBER_ID, role: 'member', status: 'pending' }),
        remove: ok(null),
      })
    );

    const response = await POST(post({ action: 'leave', clubId: CLUB_ID }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ clubId: CLUB_ID, joined: false });
    expect(h.calls.deletes).toHaveLength(1);
  });

  it('ne supprime jamais une adhésion bannie (403, aucun delete)', async () => {
    const h = use(
      harness({
        membership: ok({ id: MEMBER_ID, role: 'member', status: 'banned' }),
        remove: ok(null),
      })
    );

    const response = await POST(post({ action: 'leave', clubId: CLUB_ID }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
    expect(h.calls.deletes).toEqual([]);
  });

  it('reste idempotent sans adhésion (200) et refuse un club invisible (404)', async () => {
    use(harness({ remove: ok(null) }));
    const response = await POST(post({ action: 'leave', clubId: CLUB_ID }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ clubId: CLUB_ID, joined: false });

    use(harness({ club: ok(null) }));
    const missing = await POST(post({ action: 'leave', clubId: CLUB_ID }));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'not_found' });
  });

  it('traduit un refus RLS en 403', async () => {
    use(
      harness({
        membership: ok({ id: MEMBER_ID, role: 'member', status: 'active' }),
        remove: fail('42501'),
      })
    );

    const response = await POST(post({ action: 'leave', clubId: CLUB_ID }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
  });
});

describe('POST /api/compte/clubs — rsvp', () => {
  const event = (overrides: Row = {}) => ({
    id: EVENT_ID,
    club_id: CLUB_ID,
    event_date: FUTURE,
    ...overrides,
  });

  it('upsert la participation de l’appelant à un événement réel (200)', async () => {
    const h = use(
      harness({
        event: ok(event()),
        membership: ok({ id: MEMBER_ID, role: 'member', status: 'active' }),
        upsert: ok(null),
      })
    );

    const response = await POST(post({ action: 'rsvp', clubId: CLUB_ID, eventId: EVENT_ID }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      clubId: CLUB_ID,
      eventId: EVENT_ID,
      attending: true,
    });
    expect(h.calls.upserts).toEqual([
      {
        table: 'club_event_participants',
        row: { event_id: EVENT_ID, user_id: USER_ID },
        options: { onConflict: 'event_id,user_id', ignoreDuplicates: true },
      },
    ]);
  });

  it('retire la participation avec attending=false (200)', async () => {
    const h = use(
      harness({
        event: ok(event()),
        membership: ok({ id: MEMBER_ID, role: 'member', status: 'active' }),
        remove: ok(null),
      })
    );

    const response = await POST(
      post({ action: 'rsvp', clubId: CLUB_ID, eventId: EVENT_ID, attending: false })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      clubId: CLUB_ID,
      eventId: EVENT_ID,
      attending: false,
    });
    expect(h.calls.upserts).toEqual([]);
    expect(h.calls.deletes).toHaveLength(1);
    expect(h.calls.deletes[0].filters).toEqual([
      ['event_id', EVENT_ID],
      ['user_id', USER_ID],
    ]);
  });

  it('renvoie 404 si l’événement n’existe pas, sans écrire', async () => {
    const h = use(harness({ event: ok(null) }));

    const response = await POST(post({ action: 'rsvp', clubId: CLUB_ID, eventId: EVENT_ID }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
    expect(h.calls.upserts).toEqual([]);
  });

  it('refuse un événement d’un autre club (400)', async () => {
    use(harness({ event: ok(event({ club_id: '55555555-5555-4555-8555-555555555555' })) }));

    const response = await POST(post({ action: 'rsvp', clubId: CLUB_ID, eventId: EVENT_ID }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_club' });
  });

  it('refuse un événement passé (409), sans écrire', async () => {
    const h = use(
      harness({
        event: ok(event({ event_date: PAST })),
        membership: ok({ id: MEMBER_ID, role: 'member', status: 'active' }),
      })
    );

    const response = await POST(post({ action: 'rsvp', clubId: CLUB_ID, eventId: EVENT_ID }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'invalid_state' });
    expect(h.calls.upserts).toEqual([]);
  });

  it('refuse un membre banni (403 membership_required, aucune écriture)', async () => {
    const h = use(
      harness({
        event: ok(event()),
        membership: ok({ id: MEMBER_ID, role: 'member', status: 'banned' }),
        upsert: ok(null),
      })
    );

    const response = await POST(post({ action: 'rsvp', clubId: CLUB_ID, eventId: EVENT_ID }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'membership_required' });
    expect(h.calls.upserts).toEqual([]);
  });

  it('refuse un candidat en attente et un non-membre (403 membership_required)', async () => {
    for (const membership of [
      ok({ id: MEMBER_ID, role: 'member', status: 'pending' }),
      ok(null),
    ]) {
      use(harness({ event: ok(event()), membership, upsert: ok(null) }));
      const response = await POST(post({ action: 'rsvp', clubId: CLUB_ID, eventId: EVENT_ID }));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'membership_required' });
    }
  });

  it('contrôle le club de l’événement même sans clubId dans le corps', async () => {
    use(
      harness({
        event: ok(event()),
        membership: ok({ id: MEMBER_ID, role: 'member', status: 'banned' }),
      })
    );

    const response = await POST(post({ action: 'rsvp', eventId: EVENT_ID }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'membership_required' });
  });

  it('autorise un événement sans club à tout utilisateur connecté (200)', async () => {
    const h = use(
      harness({
        event: ok(event({ club_id: null })),
        membership: ok(null),
        upsert: ok(null),
      })
    );

    const response = await POST(post({ action: 'rsvp', eventId: EVENT_ID }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      clubId: null,
      eventId: EVENT_ID,
      attending: true,
    });
    expect(h.calls.upserts).toHaveLength(1);
  });

  it('traduit un refus RLS en 403 et une panne en 500', async () => {
    const activeMembership = ok({ id: MEMBER_ID, role: 'member', status: 'active' });
    use(harness({ event: ok(event()), membership: activeMembership, upsert: fail('42501') }));
    const forbidden = await POST(post({ action: 'rsvp', clubId: CLUB_ID, eventId: EVENT_ID }));
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ error: 'forbidden' });

    use(harness({ event: ok(event()), membership: activeMembership, upsert: fail('XX000') }));
    const broken = await POST(post({ action: 'rsvp', clubId: CLUB_ID, eventId: EVENT_ID }));
    expect(broken.status).toBe(500);
    expect(await broken.json()).toEqual({ error: 'server_error' });
  });
});

describe('bootstrap — kits recommandés des clubs', () => {
  const members = [{ club_id: CLUB_ID, role: 'Membre', status: 'active' }];
  const clubs = [{ id: CLUB_ID, name: 'Club Alpin', members_count: 3 }];
  const recommendations: ClubRecommendedKitRow[] = [
    {
      club_id: CLUB_ID,
      kit_id: 'k-cat',
      name: 'Kit Trek Confort',
      image: 'https://img/cat.jpg',
      weight_g: 4600,
      items: 4,
      note: 'Validé par le club',
    },
    {
      club_id: CLUB_ID,
      kit_id: 'k-mat',
      name: 'Kit perso',
      image: 'https://img/mat.jpg',
      weight_g: 3100,
      items: null,
      note: '',
    },
    // Une recommandation sans fiche kit résolue ne doit pas inventer de nom.
    { club_id: CLUB_ID, kit_id: 'k-missing', name: null },
  ];

  it('mappe les recommandations vers le club et renvoie [] sans donnée', () => {
    const mapped = mapClubs(members, clubs, [], [], recommendations);

    expect(mapped[0].recommendedKits).toEqual([
      {
        id: 'k-cat',
        name: 'Kit Trek Confort',
        image: 'https://img/cat.jpg',
        cover: 'https://img/cat.jpg',
        weight: 4600,
        items: 4,
        note: 'Validé par le club',
      },
      {
        id: 'k-mat',
        name: 'Kit perso',
        image: 'https://img/mat.jpg',
        cover: 'https://img/mat.jpg',
        weight: 3100,
        items: null,
        note: '',
      },
    ]);

    // Statut d'adhésion réel : seul un membre actif est « joined ».
    expect(mapped[0].membershipStatus).toBe('active');
    expect(mapped[0].joined).toBe(true);
    const banned = mapClubs([{ ...members[0], status: 'banned' }], clubs);
    expect(banned[0].membershipStatus).toBe('banned');
    expect(banned[0].joined).toBe(false);
    const pending = mapClubs([{ ...members[0], status: 'pending' }], clubs);
    expect(pending[0].membershipStatus).toBe('pending');
    expect(pending[0].joined).toBe(false);

    // Table vide : tableau vide, jamais un kit de démonstration.
    expect(mapClubs(members, clubs)[0].recommendedKits).toEqual([]);
  });

  it('loadAccountBootstrap alimente les clubs depuis club_recommended_kits et kits', async () => {
    const from = vi.fn((table: string) => {
      const eqs: Array<[string, unknown]> = [];
      const ins: Array<[string, unknown]> = [];
      const rows = (): Row[] => {
        if (table === 'club_members') {
          return [{ club_id: CLUB_ID, role: 'Membre', status: 'active' }];
        }
        if (table === 'clubs') {
          return [{ id: CLUB_ID, name: 'Club Alpin', members_count: 3 }];
        }
        if (table === 'club_recommended_kits') {
          return [
            { club_id: CLUB_ID, kit_id: 'k-cat', note: 'Validé par le club' },
            { club_id: CLUB_ID, kit_id: 'k-mat', note: '' },
            { club_id: CLUB_ID, kit_id: 'k-missing', note: '' },
          ];
        }
        if (table === 'kits') {
          return [
            {
              id: 'k-cat',
              nom: 'Kit Trek Confort',
              image: 'https://img/cat.jpg',
              poids_total_g: 4600,
              nb_articles: 4,
            },
          ];
        }
        if (table === 'materiel_kits') {
          // Deux lectures : les kits personnels du profil, puis les fiches des
          // kits recommandés (`in('id', …)`). Seule la seconde porte des ids.
          if (ins.some(([column]) => column === 'id')) {
            return [
              {
                id: 'k-mat',
                name: 'Kit perso',
                total_weight_g: 3100,
                cover_image_url: 'https://img/mat.jpg',
              },
            ];
          }
          return [];
        }
        return [];
      };

      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = vi.fn(self);
      chain.eq = vi.fn((column: string, value: unknown) => {
        eqs.push([column, value]);
        return chain;
      });
      chain.in = vi.fn((column: string, values: unknown) => {
        ins.push([column, values]);
        return chain;
      });
      chain.order = vi.fn(self);
      chain.limit = vi.fn(self);
      chain.gt = vi.fn(self);
      chain.gte = vi.fn(self);
      chain.neq = vi.fn(self);
      chain.or = vi.fn(self);
      chain.maybeSingle = vi.fn(async () => ({ data: rows()[0] ?? null, error: null }));
      chain.single = vi.fn(async () => ({ data: rows()[0] ?? null, error: null }));
      chain.then = (resolveThen: (value: { data: Row[]; error: unknown }) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(resolveThen);
      return chain;
    });

    const client = {
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: USER_ID,
              email_confirmed_at: '2026-01-01T00:00:00Z',
            },
          },
        })),
      },
      from,
    };

    const payload = await loadAccountBootstrap(client as never);

    expect(payload.authenticated).toBe(true);
    if (!payload.authenticated) throw new Error('bootstrap non authentifié');
    expect(payload.clubs).toHaveLength(1);
    expect(payload.clubs[0].membershipStatus).toBe('active');
    expect(payload.clubs[0].joined).toBe(true);
    expect(payload.clubs[0].recommendedKits).toEqual([
      {
        id: 'k-cat',
        name: 'Kit Trek Confort',
        image: 'https://img/cat.jpg',
        cover: 'https://img/cat.jpg',
        weight: 4600,
        items: 4,
        note: 'Validé par le club',
      },
      {
        id: 'k-mat',
        name: 'Kit perso',
        image: 'https://img/mat.jpg',
        cover: 'https://img/mat.jpg',
        weight: 3100,
        items: null,
        note: '',
      },
    ]);

    expect(from).toHaveBeenCalledWith('club_recommended_kits');
    expect(from).toHaveBeenCalledWith('kits');
    expect(from).toHaveBeenCalledWith('materiel_kits');
  });
});
