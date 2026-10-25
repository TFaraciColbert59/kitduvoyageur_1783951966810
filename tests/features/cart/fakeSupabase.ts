/**
 * Faux client Supabase pour les tests panier.
 *
 * Reproduit les chaînes PostgREST utilisées par `cartRepository` :
 * from().select().eq().eq().order() / .maybeSingle() / .insert() / .update()
 * / .delete() + supabase.rpc(). Chaque table est déléguée à un handler.
 */

export interface FakeResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

export interface QueryState {
  filters: Record<string, unknown>;
}

export type TableHandler = (
  operation: { type: 'select' | 'insert' | 'update' | 'delete'; payload?: unknown },
  state: QueryState
) => FakeResult | Promise<FakeResult>;

export interface FakeSupabaseOptions {
  tables: Record<string, TableHandler>;
  rpc?: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: null }>;
  userId?: string | null;
}

function makeChain(
  table: string,
  operation: { type: 'select' | 'insert' | 'update' | 'delete'; payload?: unknown },
  state: QueryState,
  options: FakeSupabaseOptions
) {
  const resolveResult = (): Promise<FakeResult> => {
    const handler = options.tables[table];
    if (!handler) {
      return Promise.resolve({ data: null, error: { message: 'table inconnue: ' + table } });
    }
    return Promise.resolve(handler(operation, state));
  };

  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      state.filters[column] = value;
      return chain;
    },
    order: () => chain,
    limit: () => chain,
    insert: (row: unknown) => {
      operation.type = 'insert';
      operation.payload = row;
      return chain;
    },
    update: (patch: unknown) => {
      operation.type = 'update';
      operation.payload = patch;
      return chain;
    },
    delete: () => {
      operation.type = 'delete';
      return chain;
    },
    maybeSingle: () => resolveResult(),
    single: () => resolveResult(),
  };

  // Une promesse n'est consommée que par les appels `await` sans terminateur
  // (`listCartLines`). Les autres chemins appellent maybeSingle/single.
  Object.defineProperty(chain, 'then', {
    enumerable: false,
    value: (
      onFulfilled?: (value: FakeResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => resolveResult().then(onFulfilled, onRejected),
  });

  return chain;
}

export function createFakeSupabase(options: FakeSupabaseOptions) {
  const from = (table: string) =>
    makeChain(table, { type: 'select' }, { filters: {} }, options);

  return {
    auth: {
      getUser: async () => ({
        data: { user: options.userId ? { id: options.userId } : null },
      }),
    },
    from,
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (!options.rpc) return { data: false, error: null };
      return options.rpc(name, args);
    },
  };
}

/** Ligne `cart_lines` prête à l'emploi. */
export function cartLineRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: 'user-1',
    trip_id: 'trip-1',
    kind: 'product',
    ref_id: '22222222-2222-4222-8222-222222222222',
    quantity: 1,
    unit_price_eur: 49.9,
    currency: 'EUR',
    metadata: { title: 'Sac a dos' },
    created_at: '2026-09-26T10:00:00.000Z',
    updated_at: '2026-09-26T10:00:00.000Z',
    ...overrides,
  };
}
