/**
 * Task 18 — `recomputeParty` : recalcul personnalisé à chaque join.
 *
 * Couverture :
 *   (a) 1 → 2 membres : quantités (eau/nourriture ×N, perso ×1), `owner_id`
 *       partagé (transferts ≤ 5 kg) et budget prévisionnel recalculés ;
 *   (b) rejeu idempotent : mêmes comptes, `party_version` +1 seulement ;
 *   (c) membre retiré → retour à N-1 (quantités ET budget exacts) ;
 *   (d) snapshots manquants → moyennes population, aucun crash ;
 *   (e) helpers purs (règles par personne, transferts, base par personne).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { serviceHolder } = vi.hoisted(() => ({ serviceHolder: { client: {} as unknown } }));

vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: vi.fn(() => serviceHolder.client),
}));

import {
  recomputeParty,
  isPerPersonItem,
  itemQuantityForParty,
  planSharedItemOwnerAssignments,
  recomputePlannedBudgetLines,
} from '@/features/trips/server/recomputeParty';

const TRIP_ID = '18181818-1818-4818-8818-181818181818';
const OWNER_ID = '18181818-1818-4818-8818-000000000001';
const JOINER_ID = '18181818-1818-4818-8818-000000000002';

interface TableRows {
  trips: Record<string, unknown>[];
  trip_collaborators: Record<string, unknown>[];
  trip_member_profiles: Record<string, unknown>[];
  trip_steps: Record<string, unknown>[];
  trip_items: Record<string, unknown>[];
  trip_expenses: Record<string, unknown>[];
  trip_checklist_items: Record<string, unknown>[];
}

interface FakeDb extends TableRows {
  inserts: { table: string; values: unknown }[];
  deletes: { table: string; filters: [string, unknown][] }[];
  updates: { table: string; values: Record<string, unknown>; filters: [string, unknown][] }[];
}

function matches(row: Record<string, unknown>, filters: [string, unknown][]): boolean {
  return filters.every(([column, value]) => row[column] === value);
}

function createFakeDb(): FakeDb {
  return {
    trips: [
      {
        id: TRIP_ID,
        user_id: OWNER_ID,
        party_size: null,
        party_version: 0,
        primary_activity: 'hiking',
        difficulty: 'moderate',
        destination_country_code: null,
        start_date: null,
        end_date: null,
        budget_currency: 'EUR',
      },
    ],
    trip_collaborators: [{ trip_id: TRIP_ID, user_id: OWNER_ID, role: 'owner' }],
    trip_member_profiles: [],
    trip_steps: [
      {
        trip_id: TRIP_ID,
        day_number: 1,
        order_index: 0,
        distance_km: 10,
        elevation_gain_m: 500,
        elevation_loss_m: 300,
      },
    ],
    trip_items: [
      {
        id: 'item-water',
        trip_id: TRIP_ID,
        item_name: 'Gourde 1 L',
        category: 'Hydratation',
        quantity: 1,
        ownership: 'personal',
        owner_id: OWNER_ID,
        is_consumable: false,
        weight_grams: 200,
      },
      {
        id: 'item-food',
        trip_id: TRIP_ID,
        item_name: 'Repas lyophilisé',
        category: 'Alimentation / Cuisine',
        quantity: 1,
        ownership: 'personal',
        owner_id: OWNER_ID,
        is_consumable: true,
        weight_grams: 150,
      },
      {
        id: 'item-tent',
        trip_id: TRIP_ID,
        item_name: 'Tente 2 places',
        category: 'Bivouac / Sommeil',
        quantity: 1,
        ownership: 'shared',
        owner_id: null,
        is_consumable: false,
        weight_grams: 1000,
      },
    ],
    trip_expenses: [
      {
        id: 'exp-1',
        trip_id: TRIP_ID,
        title: 'Budget prévisionnel — Hébergement',
        amount: 30,
        category: 'hébergement',
        currency: 'EUR',
        expense_date: '2026-09-01',
        payer_id: OWNER_ID,
        is_planned: true,
        metadata: { source: 'autogen', party_size: 1 },
      },
    ],
    trip_checklist_items: [],
    inserts: [],
    deletes: [],
    updates: [],
  };
}

function createFakeClient(db: FakeDb): unknown {
  return {
    from(table: keyof TableRows) {
      const filters: [string, unknown][] = [];
      let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
      let values: unknown = null;
      let order: { column: string; ascending: boolean } | null = null;
      let limit: number | null = null;

      const rows = () => db[table] as Record<string, unknown>[];

      const execute = () => {
        if (op === 'insert') {
          const list = (Array.isArray(values) ? values : [values]) as Record<string, unknown>[];
          db.inserts.push({ table, values });
          for (const row of list) {
            rows().push({ id: `generated-${db.inserts.length}-${rows().length}`, ...row });
          }
          return { data: null, error: null };
        }
        if (op === 'update') {
          db.updates.push({ table, values: values as Record<string, unknown>, filters: [...filters] });
          for (const row of rows()) {
            if (matches(row, filters)) Object.assign(row, values);
          }
          return { data: null, error: null };
        }
        if (op === 'delete') {
          db.deletes.push({ table, filters: [...filters] });
          db[table] = rows().filter((row) => !matches(row, filters)) as never;
          return { data: null, error: null };
        }
        let result = rows().filter((row) => matches(row, filters));
        if (order) {
          const { column, ascending } = order;
          result = [...result].sort((a, b) =>
            ascending
              ? Number(a[column] ?? 0) - Number(b[column] ?? 0)
              : Number(b[column] ?? 0) - Number(a[column] ?? 0)
          );
        }
        if (limit != null) result = result.slice(0, limit);
        return { data: result, error: null };
      };

      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.insert = (input: unknown) => {
        op = 'insert';
        values = input;
        return builder;
      };
      builder.update = (input: unknown) => {
        op = 'update';
        values = input;
        return builder;
      };
      builder.delete = () => {
        op = 'delete';
        return builder;
      };
      builder.eq = (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      };
      builder.order = (column: string, options?: { ascending?: boolean }) => {
        order = { column, ascending: options?.ascending !== false };
        return builder;
      };
      builder.limit = (count: number) => {
        limit = count;
        return builder;
      };
      builder.maybeSingle = () => Promise.resolve({ data: execute().data?.[0] ?? null, error: null });
      builder.single = () => Promise.resolve({ data: execute().data?.[0] ?? null, error: null });
      builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(execute()).then(resolve, reject);
      return builder;
    },
  };
}

function addJoiner(db: FakeDb): void {
  db.trip_collaborators.push({ trip_id: TRIP_ID, user_id: JOINER_ID, role: 'editor' });
  db.trip_member_profiles.push({
    trip_id: TRIP_ID,
    user_id: JOINER_ID,
    flat_speed_kmh: 3,
    ascent_speed_m_per_h: 200,
    descent_speed_m_per_h: 300,
    pack_weight_kg: 20,
    max_carry_kg: 10,
    experience_level: 'beginner',
    limitations: null,
    is_child: false,
  });
}

describe('recomputeParty (Task 18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceHolder.client = {};
  });

  it('(a) 1 → 2 membres : quantités, portage partagé et budget recalculés', async () => {
    const db = createFakeDb();
    addJoiner(db);
    serviceHolder.client = createFakeClient(db);

    const result = await recomputeParty(TRIP_ID);

    expect(result.partySize).toBe(2);
    expect(result.version).toBe(1);
    expect(result.warnings.some((warning) => warning.includes('Profils manquants'))).toBe(true);

    const trip = db.trips[0];
    expect(trip.party_size).toBe(2);
    expect(trip.party_version).toBe(1);

    const items = new Map(db.trip_items.map((row) => [row.id as string, row]));
    expect(items.get('item-water')?.quantity).toBe(2);
    expect(items.get('item-food')?.quantity).toBe(2);
    expect(items.get('item-tent')?.quantity).toBe(1);
    // Le membre limitant (joiner, 10 kg de surcharge) transfère 1,4 kg au
    // propriétaire (marge 14 - 12,6) : la tente de 1 kg est portée par lui.
    expect(items.get('item-tent')?.owner_id).toBe(OWNER_ID);

    expect(db.trip_expenses).toHaveLength(1);
    const expense = db.trip_expenses[0];
    expect(expense.amount).toBe(60);
    expect(expense.split_type).toBe('equal');
    expect(expense.is_planned).toBe(true);
    expect((expense.metadata as Record<string, unknown>).source).toBe('party_recompute');
    expect((expense.metadata as Record<string, unknown>).party_size).toBe(2);
    expect((expense.metadata as Record<string, unknown>).per_person_eur).toBe(30);
  });

  it('(b) rejeu idempotent : mêmes comptes, party_version +1 seulement', async () => {
    const db = createFakeDb();
    addJoiner(db);
    serviceHolder.client = createFakeClient(db);

    await recomputeParty(TRIP_ID);
    const second = await recomputeParty(TRIP_ID);

    expect(second.partySize).toBe(2);
    expect(second.version).toBe(2);
    expect(db.trip_items).toHaveLength(3);
    expect(db.trip_expenses).toHaveLength(1);
    expect(db.trip_expenses[0].amount).toBe(60);
    expect(db.trip_items.find((row) => row.id === 'item-water')?.quantity).toBe(2);
    expect(db.trip_items.find((row) => row.id === 'item-tent')?.owner_id).toBe(OWNER_ID);

    const versions = db.updates
      .filter((entry) => entry.table === 'trips')
      .map((entry) => entry.values.party_version);
    expect(versions).toEqual([1, 2]);
  });

  it('(c) membre retiré : retour exact à N-1 (quantités, portage, budget)', async () => {
    const db = createFakeDb();
    addJoiner(db);
    serviceHolder.client = createFakeClient(db);
    await recomputeParty(TRIP_ID);

    // Le joiner portait la tente ; il quitte le voyage.
    db.trip_items = db.trip_items.map((row) =>
      row.id === 'item-tent' ? { ...row, owner_id: JOINER_ID } : row
    );
    db.trip_collaborators = db.trip_collaborators.filter(
      (row) => row.user_id !== JOINER_ID
    );
    db.trip_member_profiles = [];

    const result = await recomputeParty(TRIP_ID);

    expect(result.partySize).toBe(1);
    expect(result.version).toBe(2);
    expect(db.trips[0].party_size).toBe(1);
    expect(db.trip_items.find((row) => row.id === 'item-water')?.quantity).toBe(1);
    expect(db.trip_items.find((row) => row.id === 'item-food')?.quantity).toBe(1);
    // Plus de transfert à un seul membre : l'item partagé redevient à assigner.
    expect(db.trip_items.find((row) => row.id === 'item-tent')?.owner_id).toBeNull();
    expect(db.trip_expenses).toHaveLength(1);
    expect(db.trip_expenses[0].amount).toBe(30);
    expect((db.trip_expenses[0].metadata as Record<string, unknown>).party_size).toBe(1);
  });

  it('(d) snapshots manquants : moyennes population, aucune donnée inventée', async () => {
    const db = createFakeDb();
    serviceHolder.client = createFakeClient(db);

    const result = await recomputeParty(TRIP_ID);

    expect(result.partySize).toBe(1);
    expect(result.version).toBe(1);
    expect(result.warnings.some((warning) => warning.includes('moyennes'))).toBe(true);
    expect(db.trips[0].party_size).toBe(1);
    expect(db.trip_items.find((row) => row.id === 'item-tent')?.owner_id).toBeNull();
  });

  it('(e) helpers purs : règles par personne, transferts et base par personne', () => {
    expect(isPerPersonItem({ category: 'Hydratation' })).toBe(true);
    expect(isPerPersonItem({ category: 'Alimentation / Cuisine' })).toBe(true);
    expect(isPerPersonItem({ category: 'Bivouac / Sommeil' })).toBe(false);
    expect(isPerPersonItem({ category: 'Divers', is_consumable: true })).toBe(true);
    expect(itemQuantityForParty({ category: 'Hydratation' }, 4)).toBe(4);
    expect(itemQuantityForParty({ category: 'Bivouac / Sommeil' }, 4)).toBe(1);

    const assignments = planSharedItemOwnerAssignments(
      [
        { id: 'a', item_name: 'Tente', category: null, quantity: 1, ownership: 'shared', owner_id: null, is_consumable: false, weight_grams: 3000 },
        { id: 'b', item_name: 'Réchaud', category: null, quantity: 1, ownership: 'shared', owner_id: null, is_consumable: false, weight_grams: 4000 },
        { id: 'c', item_name: 'Trousse', category: null, quantity: 1, ownership: 'shared', owner_id: null, is_consumable: false, weight_grams: null },
      ],
      [{ fromMemberId: 'x', toMemberId: 'y', weightKg: 5, reason: 'test' }],
      ['x', 'y']
    );
    expect(assignments).toEqual([{ id: 'a', ownerId: 'y' }]);

    const lines = recomputePlannedBudgetLines(
      [
        {
          id: 'e1',
          title: 'Hébergement',
          amount: 45,
          category: 'hébergement',
          currency: 'EUR',
          expense_date: '2026-09-01',
          payer_id: OWNER_ID,
          metadata: { source: 'autogen', party_size: 3 },
        },
      ],
      2
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].amountEur).toBe(30);
    expect(lines[0].metadata.per_person_eur).toBe(15);
    expect(lines[0].metadata.source).toBe('party_recompute');
  });
});
