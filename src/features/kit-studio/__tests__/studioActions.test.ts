// Tests des écritures serveur P1 : validation zod, propriété du kit, total recalculé en base.
// Aucun réseau : le client Supabase est un faux en mémoire.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseInput,
  placePreorderSchema,
  saveBagConfigSchema,
  saveKitItemPlacementSchema,
} from '../server/studioSchemas';
import {
  placePreorderFor,
  saveBagConfigFor,
  saveKitItemPlacementFor,
  type Db,
} from '../server/studioService';
import { createFakeDb } from './helpers/fakeDb';

const USER = 'u-1';
const OTHER = 'u-2';
const KIT = '11111111-1111-4111-8111-111111111111';
const KIT_ITEM = '22222222-2222-4222-8222-222222222222';
const OWNED_1 = '33333333-3333-4333-8333-333333333333';
const OWNED_2 = '44444444-4444-4444-8444-444444444444';
const OWNED_3 = '55555555-5555-4555-8555-555555555555';

function tables(over: Record<string, unknown[]> = {}) {
  return {
    materiel_kits: [{ id: KIT, user_id: USER }],
    one_pieces: [
      { id: 'corps:b28', kind: 'corps', active: true },
      { id: 'corps:b42', kind: 'corps', active: true },
      { id: 'mod:lid', kind: 'module', active: true },
      { id: 'mod:front', kind: 'module', active: true },
    ],
    one_bag_configs: [] as Record<string, unknown>[],
    materiel_kit_items: [{ id: KIT_ITEM, kit_id: KIT, user_id: USER, product_ownership_id: OWNED_1 }],
    product_ownership: [
      { id: OWNED_1, user_id: USER, name: 'Duvet', category: 'couchage', weight_g: 820, function_id: 'sleep' },
      { id: OWNED_2, user_id: USER, name: 'Gourde', category: 'eau', weight_g: 150, function_id: 'water' },
      { id: OWNED_3, user_id: USER, name: 'Objet non pesé', category: null, weight_g: null, function_id: null },
    ],
    one_preorders: [{ id: 'pre-1', total_cents: 14800 }],
    ...over,
  };
}

const fake = (over: Record<string, unknown[]> = {}, rpcData: unknown = 'pre-1') =>
  createFakeDb({
    tables: tables(over),
    rpc: () => ({ data: rpcData, error: null }),
  }) as unknown as Db & ReturnType<typeof createFakeDb>;

describe('validation zod des entrées', () => {
  it('accepte une configuration valide', () => {
    const r = parseInput(saveBagConfigSchema, {
      kitId: KIT,
      corpsId: 'corps:b28',
      modules: ['lid', 'hipp'],
      colors: { body: '#2D482A', harness: '#1E301C' },
    });
    expect(r.ok).toBe(true);
  });

  it('refuse un corps inconnu, une couleur non hexadécimale, une clé de couleur inconnue', () => {
    expect(parseInput(saveBagConfigSchema, { kitId: KIT, corpsId: 'mod:lid', modules: [], colors: {} }).ok).toBe(false);
    expect(parseInput(saveBagConfigSchema, { kitId: KIT, corpsId: 'corps:b28', modules: [], colors: { body: 'vert' } }).ok).toBe(false);
    expect(parseInput(saveBagConfigSchema, { kitId: KIT, corpsId: 'corps:b28', modules: [], colors: { inconnu: '#2D482A' } }).ok).toBe(false);
    expect(parseInput(saveBagConfigSchema, { kitId: KIT, corpsId: 'corps:b28', modules: ['bad'], colors: {} }).ok).toBe(false);
    expect(parseInput(saveBagConfigSchema, { kitId: 'pas-un-uuid', corpsId: 'corps:b28' }).ok).toBe(false);
  });

  it('refuse un placement invalide', () => {
    expect(parseInput(saveKitItemPlacementSchema, { kitId: KIT, itemId: KIT_ITEM, zone: 'dans-le-sac' }).ok).toBe(false);
    expect(parseInput(saveKitItemPlacementSchema, { kitId: KIT, itemId: 'abc', zone: 'main' }).ok).toBe(false);
    expect(parseInput(saveKitItemPlacementSchema, { kitId: KIT, itemId: KIT_ITEM, zone: 'main', slot: 'top', loadOrder: -1 }).ok).toBe(false);
    expect(parseInput(saveKitItemPlacementSchema, { kitId: KIT, itemId: KIT_ITEM, zone: 'main', extra: true }).ok).toBe(false);
  });

  it('refuse une précommande vide ou une pièce inconnue, et n’accepte AUCUN total', () => {
    expect(parseInput(placePreorderSchema, { items: [] }).ok).toBe(false);
    expect(parseInput(placePreorderSchema, { items: [{ pieceId: 'mod:inconnu', colorwayId: 'foret' }] }).ok).toBe(false);
    expect(parseInput(placePreorderSchema, { items: [{ pieceId: 'corps:b28', colorwayId: 'forêt' }] }).ok).toBe(false);
    expect(parseInput(placePreorderSchema, {
      items: [{ pieceId: 'corps:b28', colorwayId: 'foret' }],
      totalCents: 1,
    }).ok).toBe(false);
    expect(
      parseInput(placePreorderSchema, { items: [{ pieceId: 'corps:b28', colorwayId: 'foret' }] }).ok,
    ).toBe(true);
  });
});

describe('saveBagConfig (service)', () => {
  it('refuse un kit qui n’appartient pas à l’utilisateur, sans écrire', async () => {
    const db = fake();
    const r = await saveBagConfigFor(db, OTHER, {
      kitId: KIT, corpsId: 'corps:b28', modules: [], colors: {},
    });
    expect(r).toMatchObject({ ok: false, error: 'not_owner' });
    expect(db.calls.some((c) => c.op === 'upsert')).toBe(false);
  });

  it('refuse une pièce absente du catalogue', async () => {
    const db = fake();
    const r = await saveBagConfigFor(db, USER, {
      kitId: KIT, corpsId: 'corps:b28', modules: ['tool'], colors: {},
    });
    expect(r).toMatchObject({ ok: false, error: 'invalid_input' });
  });

  it('upsert une ligne one_bag_configs pour le couple utilisateur/kit', async () => {
    const db = fake();
    const r = await saveBagConfigFor(db, USER, {
      kitId: KIT, corpsId: 'corps:b28', modules: ['lid'], colors: { body: '#2D482A' },
    });
    expect(r.ok).toBe(true);
    expect(db.tables.one_bag_configs).toHaveLength(1);
    expect(db.tables.one_bag_configs[0]).toMatchObject({
      user_id: USER, kit_id: KIT, corps_id: 'corps:b28', modules: ['lid'], colors: { body: '#2D482A' },
    });
    // Deuxième écriture : mise à jour de la même ligne, pas de doublon.
    await saveBagConfigFor(db, USER, {
      kitId: KIT, corpsId: 'corps:b42', modules: [], colors: {},
    });
    expect(db.tables.one_bag_configs).toHaveLength(1);
    expect(db.tables.one_bag_configs[0]!.corps_id).toBe('corps:b42');
  });
});

describe('saveKitItemPlacement (service)', () => {
  it('met à jour zone/slot/ordre de la ligne de kit liée à l’objet possédé', async () => {
    const db = fake();
    const r = await saveKitItemPlacementFor(db, USER, {
      kitId: KIT, itemId: OWNED_1, zone: 'main', slot: 'top', loadOrder: 3,
    });
    expect(r).toEqual({ ok: true, data: { kitItemId: KIT_ITEM } });
    expect(db.tables.materiel_kit_items[0]).toMatchObject({ zone: 'main', slot: 'top', load_order: 3 });
  });

  it('crée la ligne de kit quand l’objet possédé n’y est pas encore', async () => {
    const db = fake();
    const r = await saveKitItemPlacementFor(db, USER, {
      kitId: KIT, itemId: OWNED_2, zone: 'sides', slot: null, loadOrder: null,
    });
    expect(r.ok).toBe(true);
    const created = db.tables.materiel_kit_items.find((i) => i.product_ownership_id === OWNED_2);
    expect(created).toMatchObject({
      kit_id: KIT, user_id: USER, name: 'Gourde', category: 'eau', weight_g: 150,
      function_id: 'water', zone: 'sides', slot: null, load_order: null,
    });
  });

  it('conserve un poids inconnu (null) à l’insertion — règle C-03, jamais 0 g', async () => {
    const db = fake();
    const r = await saveKitItemPlacementFor(db, USER, {
      kitId: KIT, itemId: OWNED_3, zone: 'main', slot: null, loadOrder: null,
    });
    expect(r.ok).toBe(true);
    const created = db.tables.materiel_kit_items.find((i) => i.product_ownership_id === OWNED_3);
    expect(created).toMatchObject({ weight_g: null });
    expect(created!.weight_g).not.toBe(0);
  });

  it('refuse un objet absent de l’inventaire et un kit non détenu', async () => {
    const db = fake();
    expect(await saveKitItemPlacementFor(db, USER, {
      kitId: KIT, itemId: '99999999-9999-4999-8999-999999999999', zone: 'main',
    })).toMatchObject({ ok: false, error: 'not_found' });
    expect(await saveKitItemPlacementFor(db, OTHER, {
      kitId: KIT, itemId: OWNED_1, zone: 'main',
    })).toMatchObject({ ok: false, error: 'not_owner' });
  });
});

describe('placePreorder (service)', () => {
  it('appelle la RPC sans total client et renvoie le total recalculé en base', async () => {
    const db = fake();
    const r = await placePreorderFor(db, USER, {
      items: [
        { pieceId: 'corps:b28', colorwayId: 'foret' },
        { pieceId: 'mod:hipp', colorwayId: 'foret' },
      ],
      label: 'P1',
      notify: true,
    });
    expect(r).toEqual({ ok: true, data: { preorderId: 'pre-1', totalCents: 14800 } });
    const call = db.calls.find((c) => c.table === 'rpc:one_place_preorder')!;
    expect(call.payload).toEqual({
      p_items: [
        { piece_id: 'corps:b28', colorway_id: 'foret' },
        { piece_id: 'mod:hipp', colorway_id: 'foret' },
      ],
      p_label: 'P1',
      p_notify: true,
    });
    expect(JSON.stringify(call.payload)).not.toContain('total');
  });

  it('refuse une pièce inconnue : le refus de la base remonte tel quel', async () => {
    const db = createFakeDb({
      tables: tables(),
      rpc: () => ({ data: null, error: { message: 'unknown_piece_or_colorway' } }),
    }) as unknown as Db;
    expect(await placePreorderFor(db, USER, {
      items: [{ pieceId: 'mod:hipp', colorwayId: 'foret' }],
    })).toMatchObject({ ok: false, error: 'unknown_piece_or_colorway' });
  });

  it('échoue proprement si le total relu manque', async () => {
    const db = createFakeDb({ tables: tables({ one_preorders: [] }), rpc: () => ({ data: 'pre-1', error: null }) }) as unknown as Db;
    expect(await placePreorderFor(db, USER, {
      items: [{ pieceId: 'corps:b28', colorwayId: 'foret' }],
    })).toMatchObject({ ok: false, error: 'db_error' });
  });
});

const state = vi.hoisted(() => ({
  user: { id: 'u-1' } as { id: string } | null,
  db: null as Record<string, unknown> | null,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    ...(state.db ?? {}),
    auth: { getUser: async () => ({ data: { user: state.user } }) },
  }),
}));

describe('server actions (session + validation + service)', () => {
  beforeEach(() => {
    const db = fake();
    state.db = { ...db };
    state.user = { id: USER };
  });

  it('refuse une entrée invalide sans toucher la base', async () => {
    const { saveBagConfig } = await import('../server/actions');
    const r = await saveBagConfig({ kitId: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('kitId');
  });

  it('exige une session', async () => {
    state.user = null;
    const { saveBagConfig } = await import('../server/actions');
    const r = await saveBagConfig({ kitId: KIT, corpsId: 'corps:b28', modules: [], colors: {} });
    expect(r).toMatchObject({ ok: false, error: 'session requise' });
  });

  it('précommande : renvoie le total serveur, jamais un total client', async () => {
    const { placePreorder } = await import('../server/actions');
    const r = await placePreorder({
      items: [{ pieceId: 'corps:b28', colorwayId: 'foret' }],
    });
    expect(r).toEqual({ ok: true, preorderId: 'pre-1', totalCents: 14800 });
    expect(state.user).toEqual({ id: USER });
  });
});
