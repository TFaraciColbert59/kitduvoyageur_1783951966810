// Faux client Supabase pour les tests unitaires (aucun réseau).
// Reproduit juste la chaîne `from(table).select().eq().in().order()` + `update/insert/upsert`
// + `rpc`, avec un stockage en mémoire consultable par les assertions.
export type FakeRow = Record<string, any>;

export interface FakeDbOptions {
  tables: Record<string, FakeRow[]>;
  /** Tables dont la lecture doit échouer (test du chemin `db_error`). */
  errorTables?: readonly string[];
  /** Implémentation de `rpc(nom, args)`. */
  rpc?: (fn: string, args: Record<string, unknown>) => { data: unknown; error: { message: string } | null };
}

export interface FakeDbCall {
  readonly table: string;
  readonly op: string;
  readonly payload?: unknown;
}

type Filter = { col: string; value: unknown } | { col: string; values: readonly unknown[] };

let seq = 0;

export function createFakeDb(options: FakeDbOptions) {
  const tables = options.tables;
  const calls: FakeDbCall[] = [];
  const errorTables = new Set(options.errorTables ?? []);

  const tableRows = (table: string): FakeRow[] => {
    tables[table] ??= [];
    return tables[table];
  };

  const matches = (row: FakeRow, filters: readonly Filter[]): boolean =>
    filters.every((f) => ('values' in f ? f.values.includes(row[f.col]) : row[f.col] === f.value));

  const from = (table: string): any => {
    const filters: Filter[] = [];
    let op = 'select';
    let payload: FakeRow | FakeRow[] | undefined;
    let order: { column: string; ascending: boolean } | null = null;

    const execute = async (): Promise<{ data: unknown; error: { message: string } | null }> => {
      calls.push({ table, op, payload });
      if (errorTables.has(table)) return { data: null, error: { message: `erreur simulée ${table}` } };
      const rows = tableRows(table);
      if (op === 'update') {
        const patch = payload as FakeRow;
        const touched = rows.filter((r) => matches(r, filters));
        for (const r of touched) Object.assign(r, patch);
        return { data: touched, error: null };
      }
      if (op === 'insert') {
        const values = payload as FakeRow;
        const created = { id: values.id ?? `new-${++seq}`, ...values };
        rows.push(created);
        return { data: [created], error: null };
      }
      if (op === 'upsert') {
        const values = payload as FakeRow;
        const existing = rows.find((r) => r.user_id === values.user_id && r.kit_id === values.kit_id);
        if (existing) Object.assign(existing, values);
        else rows.push({ id: `new-${++seq}`, ...values });
        return { data: [values], error: null };
      }
      let data = rows.filter((r) => matches(r, filters));
      if (order) {
        const { column, ascending } = order;
        data = [...data].sort((a, b) => {
          const av = Number(a[column]);
          const bv = Number(b[column]);
          return ascending ? av - bv : bv - av;
        });
      }
      return { data, error: null };
    };

    const builder: any = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push({ col: column, value });
        return builder;
      },
      in: (column: string, values: readonly unknown[]) => {
        filters.push({ col: column, values });
        return builder;
      },
      order: (column: string, opts?: { ascending?: boolean }) => {
        order = { column, ascending: opts?.ascending ?? true };
        return builder;
      },
      update: (patch: FakeRow) => {
        op = 'update';
        payload = patch;
        return builder;
      },
      insert: (values: FakeRow) => {
        op = 'insert';
        payload = values;
        return builder;
      },
      upsert: (values: FakeRow) => {
        op = 'upsert';
        payload = values;
        return builder;
      },
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        execute().then(resolve, reject),
    };
    return builder;
  };

  return {
    from,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ table: `rpc:${fn}`, op: 'rpc', payload: args });
      if (options.rpc) return options.rpc(fn, args);
      return { data: null, error: { message: `rpc ${fn} non simulée` } };
    },
    /** Tables en mémoire (modifiées par les update/insert/upsert). */
    tables,
    calls,
  };
}
