import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * « Répartir le matériel commun » : `compasSetCarriersAction` écrit la répartition entière en UNE
 * demande, tout ou rien (invariant « Rien à moitié »). Ce qui est RÉEL : l'action, `requireEditor`, la
 * validation zod. Seule la base est remplacée, par le client Supabase en mémoire (pas de RLS rejouée :
 * « 0 ligne » est simulé par un objet disparu entre la lecture et l'écriture).
 *
 * Les pannes sont simulées à la frontière de la base : `failQuery` fait refuser une requête (erreur
 * rendue), `onQuery` lève (coupure) ou retire une ligne (geste concurrent).
 */
const h = vi.hoisted(() => ({
  db: null as unknown as MemorySupabase,
  report: vi.fn(async (..._args: unknown[]) => undefined),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: h.report }));

import { compasSetCarriersAction } from '../server/compasActions';
import { memorySupabase, type MemorySupabase, type QueryInfo } from './helpers/memorySupabase';

const OWNER = 'aaaaaaaa-0000-4000-8000-000000000001';
const LEA = 'aaaaaaaa-0000-4000-8000-000000000002';
const STRANGER = 'aaaaaaaa-0000-4000-8000-000000000009';
const TRIP = '11111111-1111-4111-8111-111111111111';
const OTHER_TRIP = '22222222-2222-4222-8222-222222222222';
const TENT = 'bbbbbbbb-0000-4000-8000-000000000001';
const STOVE = 'bbbbbbbb-0000-4000-8000-000000000002';
const POT = 'bbbbbbbb-0000-4000-8000-000000000003';
const FOREIGN = 'bbbbbbbb-0000-4000-8000-000000000004';

/** `n` : rang (à partir de 1) de la requête de ce type (table et opération) dans le test, la courante comprise. */
type Hook = (q: QueryInfo, n: number) => void;
type Failure = (q: QueryInfo, n: number) => { code: string; message: string } | undefined;

/** Un voyage, deux personnes (Tony et Léa) et trois objets communs sans porteur ; un 4e objet est celui d'un autre voyage. */
function setup(opts: { failQuery?: Failure; onQuery?: Hook; user?: string | null; canEdit?: boolean } = {}) {
  const nth: Record<string, number> = {};
  h.db = memorySupabase({
    user: () => (opts.user === null ? null : { id: opts.user ?? OWNER }),
    rpc: opts.canEdit === false ? () => ({ data: false, error: null }) : undefined,
    onQuery: (q) => {
      nth[`${q.table}:${q.op}`] = (nth[`${q.table}:${q.op}`] ?? 0) + 1;
      opts.onQuery?.(q, nth[`${q.table}:${q.op}`]);
    },
    failQuery: (q) => opts.failQuery?.(q, nth[`${q.table}:${q.op}`] ?? 0),
  });
  h.db.rows('trips').push({
    id: TRIP,
    user_id: OWNER,
    title: 'Trek',
    start_date: null,
    end_date: null,
    destination_name: null,
    destination_country_code: null,
    party_size: 2,
    budget_currency: 'EUR',
    metadata: {},
    updated_at: '2026-10-09T08:00:00.000000+00:00',
  });
  h.db.rows('trip_collaborators').push({ trip_id: TRIP, user_id: LEA, role: 'editor' });
  const item = (id: string, name: string, tripId = TRIP, owner: string | null = null, ownership = 'shared') => ({
    id,
    trip_id: tripId,
    item_name: name,
    owner_id: owner,
    ownership,
    updated_at: '2026-10-09T08:00:00.000000+00:00',
  });
  h.db.rows('trip_items').push(item(TENT, 'Tente'), item(STOVE, 'Réchaud'), item(POT, 'Popote'), item(FOREIGN, 'Autre', OTHER_TRIP));
  return { nth };
}

const send = (assignments: Array<{ itemId: string; carrierId: string | null }>, extra: Record<string, unknown> = {}) =>
  compasSetCarriersAction({ tripId: TRIP, tripSlug: 'trek', assignments, shared: true, ...extra } as never);
const itemRow = (id: string) => h.db.rows('trip_items').find((r) => r.id === id) as Record<string, unknown>;
const ownerOf = (id: string) => itemRow(id).owner_id;
const itemWrites = () => h.db.writes.filter((w) => w.table === 'trip_items');
/** Le seul contenu d'un état qui compte : porteur et mode, objet par objet. */
const state = () => h.db.rows('trip_items').map((r) => [r.id, r.owner_id, r.ownership]);

const SPLIT = [
  { itemId: TENT, carrierId: OWNER },
  { itemId: STOVE, carrierId: LEA },
  { itemId: POT, carrierId: LEA },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('compasSetCarriersAction : la répartition entière, en une demande', () => {
  it('confie chaque objet à son porteur : une écriture par porteur, pas une par objet', async () => {
    setup();
    expect(await send(SPLIT)).toEqual({ success: true });
    expect(ownerOf(TENT)).toBe(OWNER);
    expect(ownerOf(STOVE)).toBe(LEA);
    expect(ownerOf(POT)).toBe(LEA);
    for (const id of [TENT, STOVE, POT]) expect(itemRow(id).ownership).toBe('shared');
    // Deux porteurs : deux écritures, dont une de deux objets.
    expect(itemWrites().map((w) => w.ids.length).sort()).toEqual([1, 2]);
    // L'objet d'un autre voyage n'est jamais touché.
    expect(ownerOf(FOREIGN)).toBeNull();
  });

  it('l’annulation (porteur null) remet tout sans porteur, aussi en une demande', async () => {
    setup();
    await send(SPLIT);
    h.db.writes.length = 0;
    expect(await send(SPLIT.map((a) => ({ itemId: a.itemId, carrierId: null })))).toEqual({ success: true });
    for (const id of [TENT, STOVE, POT]) expect(ownerOf(id)).toBeNull();
    expect(itemWrites()).toHaveLength(1);
  });
});

describe('garde-fous : rien n’est écrit', () => {
  it('une personne étrangère au voyage : refusé avant toute écriture', async () => {
    setup();
    const res = await send([{ itemId: TENT, carrierId: OWNER }, { itemId: STOVE, carrierId: STRANGER }]);
    expect(res).toEqual({ success: false, error: 'Cette personne ne fait pas partie du voyage.' });
    expect(itemWrites()).toHaveLength(0);
  });

  it('un objet d’un autre voyage dans la liste : tout est refusé, même les objets valides', async () => {
    setup();
    const before = state();
    const res = await send([{ itemId: TENT, carrierId: OWNER }, { itemId: FOREIGN, carrierId: LEA }]);
    expect(res).toEqual({ success: false, error: 'Impossible de changer le porteur.' });
    expect(itemWrites()).toHaveLength(0);
    expect(state()).toEqual(before);
  });

  it('un objet inexistant : refusé, rien n’est écrit', async () => {
    setup();
    const res = await send([{ itemId: TENT, carrierId: OWNER }, { itemId: 'bbbbbbbb-0000-4000-8000-0000000000ff', carrierId: LEA }]);
    expect(res.success).toBe(false);
    expect(itemWrites()).toHaveLength(0);
  });

  it('lecture de l’état d’avant refusée par la base : rien n’est écrit', async () => {
    setup({ failQuery: (q) => (q.table === 'trip_items' && q.op === 'select' ? { code: '42501', message: 'rls' } : undefined) });
    expect(await send(SPLIT)).toEqual({ success: false, error: 'Impossible de changer le porteur.' });
    expect(itemWrites()).toHaveLength(0);
  });

  it.each([
    ['liste vide', []],
    ['objet en double', [{ itemId: TENT, carrierId: OWNER }, { itemId: TENT, carrierId: LEA }]],
    ['identifiant invalide', [{ itemId: 'x', carrierId: OWNER }]],
    ['porteur invalide', [{ itemId: TENT, carrierId: 'moi' }]],
  ])('entrée invalide (%s) : refusée par zod, la base n’est même pas interrogée', async (_name, assignments) => {
    const { nth } = setup();
    const res = await send(assignments as never);
    expect(res.success).toBe(false);
    expect(nth).toEqual({});
  });

  it('trop d’objets d’un coup : refusé par zod', async () => {
    const { nth } = setup();
    const many = Array.from({ length: 201 }, (_, i) => ({
      itemId: `cccccccc-0000-4000-8000-${String(i).padStart(12, '0')}`,
      carrierId: OWNER,
    }));
    expect((await send(many)).success).toBe(false);
    expect(nth).toEqual({});
  });

  it('sans session : refusé', async () => {
    setup({ user: null });
    expect(await send(SPLIT)).toEqual({ success: false, error: 'Connecte-toi pour modifier le voyage.' });
    expect(itemWrites()).toHaveLength(0);
  });

  it('un lecteur (ni propriétaire ni éditeur) : refusé', async () => {
    // `can_edit_trip` rend false pour Léa : la RLS la ferait taire, `requireEditor` aussi.
    setup({ user: LEA, canEdit: false });
    expect(await send(SPLIT)).toEqual({ success: false, error: 'Seuls les organisateurs et éditeurs peuvent modifier le kit.' });
    expect(itemWrites()).toHaveLength(0);
  });
});

describe('tout ou rien : un échec en cours de route remet ce qui était écrit', () => {
  it('la 2e écriture est refusée par la base : la 1re est remise, l’état est celui d’avant', async () => {
    setup({ failQuery: (q, n) => (q.table === 'trip_items' && q.op === 'update' && n === 2 ? { code: '57014', message: 'timeout' } : undefined) });
    const before = state();
    const res = await send(SPLIT);
    expect(res).toEqual({ success: false, error: 'Impossible de changer le porteur.' });
    expect(state()).toEqual(before);
  });

  it('la remise rétablit l’état d’AVANT de chaque objet, pas « sans porteur » : un objet déjà confié à Léa y retourne', async () => {
    setup({ failQuery: (q, n) => (q.table === 'trip_items' && q.op === 'update' && n === 2 ? { code: '57014', message: 'timeout' } : undefined) });
    itemRow(TENT).owner_id = LEA;
    itemRow(TENT).ownership = 'personal';
    const before = state();
    const res = await send(SPLIT);
    expect(res.success).toBe(false);
    expect(state()).toEqual(before);
    expect(ownerOf(TENT)).toBe(LEA);
    expect(itemRow(TENT).ownership).toBe('personal');
  });

  it('une coupure (la base lève) à la 2e écriture : tout est remis, réponse « Erreur serveur », panne journalisée', async () => {
    setup({
      onQuery: (q, n) => {
        if (q.table === 'trip_items' && q.op === 'update' && n === 2) throw new Error('connexion perdue');
      },
    });
    const before = state();
    const res = await send(SPLIT);
    expect(res).toEqual({ success: false, error: 'Erreur serveur' });
    expect(state()).toEqual(before);
    expect(h.report).toHaveBeenCalledWith('compas.compasSetCarriersAction', expect.any(Error));
  });

  it('une écriture qui touche moins d’objets que prévu (0 ligne pour l’un) : échec, et les autres sont remis', async () => {
    // Un geste concurrent supprime la popote entre la lecture et l'écriture du 2e porteur.
    setup({
      onQuery: (q, n) => {
        if (q.table === 'trip_items' && q.op === 'update' && n === 2)
          h.db.tables.trip_items = h.db.rows('trip_items').filter((r) => r.id !== POT);
      },
    });
    const res = await send(SPLIT);
    expect(res).toEqual({ success: false, error: 'Impossible de changer le porteur.' });
    // La tente (1er porteur) est remise sans porteur ; le réchaud, touché par l'écriture partielle, aussi.
    expect(ownerOf(TENT)).toBeNull();
    expect(ownerOf(STOVE)).toBeNull();
    expect(itemRow(STOVE).ownership).toBe('shared');
  });

  it('si la remise échoue elle aussi, la réponse le dit (nombre d’objets restés confiés) et la panne est journalisée', async () => {
    // 1re écriture : ok. 2e : refusée. Les deux remises (même état d'avant, un seul groupe) : refusées.
    setup({ failQuery: (q, n) => (q.table === 'trip_items' && q.op === 'update' && n >= 2 ? { code: '57014', message: 'timeout' } : undefined) });
    const res = await send(SPLIT);
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toMatch(/n’a pas pu être entièrement annulée/);
    expect(res.error).toMatch(/1 objet a gardé son nouveau porteur/);
    // Ce qui reste est exactement ce que la réponse annonce.
    expect(ownerOf(TENT)).toBe(OWNER);
    expect(h.report).toHaveBeenCalledWith('compas.compasSetCarriersAction.stuck', expect.any(Error));
  });

  it('une remise partielle est comptée ligne par ligne : seul l’objet non remis est annoncé', async () => {
    // Tente → Tony, réchaud → Léa, popote → aucun. Le 3e porteur (écriture n° 3) est refusé ; la remise de la
    // tente (n° 4) est refusée aussi, celle du réchaud (n° 5, autre état d'avant) passe.
    setup({
      failQuery: (q, n) => (q.table === 'trip_items' && q.op === 'update' && (n === 3 || n === 4) ? { code: '57014', message: 'timeout' } : undefined),
    });
    itemRow(STOVE).owner_id = OWNER;
    itemRow(STOVE).ownership = 'personal';
    const res = await send([
      { itemId: TENT, carrierId: OWNER },
      { itemId: STOVE, carrierId: LEA },
      { itemId: POT, carrierId: null },
    ]);
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toMatch(/1 objet a gardé son nouveau porteur/);
    // Le réchaud est revenu à Tony, en personnel ; la tente est restée chez Tony, en commun (nouvel état).
    expect(ownerOf(STOVE)).toBe(OWNER);
    expect(itemRow(STOVE).ownership).toBe('personal');
    expect(ownerOf(TENT)).toBe(OWNER);
    expect(itemRow(TENT).ownership).toBe('shared');
  });
});
