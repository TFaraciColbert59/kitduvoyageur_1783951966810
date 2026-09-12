/**
 * Phase 8 — Faux client Supabase (service_role) pour les tests webhook Stripe.
 * Aucun réseau : chaque opération est résolue selon la table et le type d'appel.
 */
import { vi } from 'vitest';

export interface FakeSupabaseConfig {
  /** Insert stripe_events renvoie une violation d'unicité 23505. */
  duplicateEvent?: boolean;
  /** Une commande existe déjà pour la session. */
  existingOrder?: boolean;
  /** Erreur d'infrastructure sur l'insert stripe_events. */
  eventInsertInfraError?: boolean;
  /** Produit renvoyé par `products.select(...).eq(...).maybeSingle()`. */
  product?: { price_eur: number; name: string; slug: string } | null;
  /** Kit renvoyé par `materiel_kits.select(...).eq(...).maybeSingle()`. */
  kit?: { user_id: string; ancestors: string[] | null } | null;
  /** Kit(s) renvoyé(s) par `materiel_kits.select(...).in(...)`. */
  ancestorKits?: { id: string; user_id: string }[];
  /** Config royaltie renvoyée par `royalty_config`. */
  royalty?: { value: { global_bps: number } } | null;
  /** Intent renvoyé par `checkout_intents`. */
  intent?: { payload: unknown[] } | null;
}

export interface FakeSupabaseCalls {
  inserts: { table: string; row: Record<string, unknown> }[];
  updates: { table: string; row: Record<string, unknown> }[];
  deletes: { table: string }[];
  rpcs: { fn: string; args: Record<string, unknown> }[];
}

export function createFakeSupabase(config: FakeSupabaseConfig = {}): {
  client: never;
  calls: FakeSupabaseCalls;
} {
  const calls: FakeSupabaseCalls = { inserts: [], updates: [], deletes: [], rpcs: [] };

  function resolveSingle(table: string, op: string, payload: unknown): { data: unknown; error: unknown } {
    if (op === 'insert') {
      calls.inserts.push({ table, row: payload as Record<string, unknown> });
      if (table === 'stripe_events') {
        if (config.eventInsertInfraError) {
          return { data: null, error: { code: '500', message: 'infra down' } };
        }
        if (config.duplicateEvent) {
          return { data: null, error: { code: '23505', message: 'duplicate key value' } };
        }
        return { data: { event_id: (payload as { event_id: string }).event_id }, error: null };
      }
      if (table === 'orders') return { data: { id: 'order-1' }, error: null };
      if (table === 'order_items') return { data: { id: 'oi-1' }, error: null };
      return { data: { id: 'row-1' }, error: null };
    }
    if (op === 'update') {
      calls.updates.push({ table, row: payload as Record<string, unknown> });
      return { data: null, error: null };
    }
    if (op === 'delete') {
      calls.deletes.push({ table });
      return { data: null, error: null };
    }
    if (table === 'orders') {
      return { data: config.existingOrder ? { id: 'order-existing' } : null, error: null };
    }
    if (table === 'products') return { data: config.product ?? null, error: null };
    if (table === 'materiel_kits') return { data: config.kit ?? null, error: null };
    if (table === 'royalty_config') return { data: config.royalty ?? null, error: null };
    if (table === 'checkout_intents') return { data: config.intent ?? null, error: null };
    return { data: null, error: null };
  }

  function resolve(table: string, op: string, payload: unknown): { data: unknown; error: unknown } {
    if (op === 'select' && table === 'materiel_kits' && payload !== undefined) {
      return { data: payload, error: null };
    }
    return resolveSingle(table, op, payload);
  }

  function builder(table: string) {
    const state = { op: 'select', payload: undefined as unknown };
    const self: Record<string, unknown> = {};
    const chain = () => self;
    Object.assign(self, {
      select: () => chain(),
      insert: (row: unknown) => {
        state.op = 'insert';
        state.payload = row;
        return chain();
      },
      update: (row: unknown) => {
        state.op = 'update';
        state.payload = row;
        return chain();
      },
      delete: () => {
        state.op = 'delete';
        return chain();
      },
      eq: () => chain(),
      in: () => {
        if (table === 'materiel_kits' && state.op === 'select') {
          state.payload = config.ancestorKits ?? [];
        }
        return chain();
      },
      order: () => chain(),
      limit: () => chain(),
      maybeSingle: async () => resolve(table, state.op, state.payload),
      single: async () => resolveSingle(table, state.op, state.payload),
      then: (resolveFn: (value: unknown) => unknown) =>
        Promise.resolve(resolve(table, state.op, state.payload)).then(resolveFn),
    });
    return self;
  }

  const client = {
    from: vi.fn((table: string) => builder(table)),
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.rpcs.push({ fn, args });
      return { data: null, error: null };
    }),
  };

  return { client: client as never, calls };
}
