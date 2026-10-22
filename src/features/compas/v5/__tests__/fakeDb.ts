/**
 * Base Supabase simulée en mémoire pour les tests des actions v5 : les filtres `eq` et `in`, `order`,
 * `limit`, `select`, `insert`, `update` et `delete` des lignes, comme le client réel les enchaîne.
 * Chaque mise à jour d'une ligne qui a `updated_at` le fait avancer (le déclencheur de la base).
 * Pas de RLS ici : les droits se testent en simulant `requireEditor`.
 */
export type Row = Record<string, unknown>;

export interface FakeDb {
  tables: Record<string, Row[]>;
  /** Tables dont l'écriture échoue (erreur renvoyée par la base). */
  failWrites: Set<string>;
  /** Journal des écritures : table, opération. */
  log: Array<{ table: string; op: 'insert' | 'update' | 'delete'; rows: Row[] }>;
  client: unknown;
}

let tick = 0;
let counter = 0;

export function createFakeDb(seed: Record<string, Row[]> = {}): FakeDb {
  const db: FakeDb = {
    tables: Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))])),
    failWrites: new Set(),
    log: [],
    client: null,
  };

  class Query {
    private filters: Array<(r: Row) => boolean> = [];
    private sort: Array<{ col: string; asc: boolean }> = [];
    private max: number | null = null;
    private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    private payload: Row | Row[] | null = null;
    private returning = false;

    constructor(private table: string) {}

    select() {
      if (this.op !== 'select') this.returning = true;
      return this;
    }
    insert(rows: Row | Row[]) {
      this.op = 'insert';
      this.payload = rows;
      return this;
    }
    update(patch: Row) {
      this.op = 'update';
      this.payload = patch;
      return this;
    }
    delete() {
      this.op = 'delete';
      return this;
    }
    eq(col: string, value: unknown) {
      this.filters.push((r) => r[col] === value);
      return this;
    }
    in(col: string, values: unknown[]) {
      this.filters.push((r) => values.includes(r[col]));
      return this;
    }
    order(col: string, opts?: { ascending?: boolean }) {
      this.sort.push({ col, asc: opts?.ascending !== false });
      return this;
    }
    limit(n: number) {
      this.max = n;
      return this;
    }

    private run(): { data: Row[] | null; error: { message: string; code?: string } | null } {
      const rows = (db.tables[this.table] ??= []);
      if (this.op !== 'select' && db.failWrites.has(this.table)) return { data: null, error: { message: 'écriture refusée', code: '42501' } };
      if (this.op === 'insert') {
        const list = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
        const made = list.map((r) => ({ id: `gen-${++counter}`, ...r }));
        rows.push(...made);
        db.log.push({ table: this.table, op: 'insert', rows: made.map((r) => ({ ...r })) });
        return { data: made.map((r) => ({ ...r })), error: null };
      }
      const hit = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === 'update') {
        for (const r of hit) {
          Object.assign(r, this.payload);
          if ('updated_at' in r || this.table === 'trips') r.updated_at = `2026-10-22T10:00:${String(++tick).padStart(2, '0')}.000Z`;
        }
        db.log.push({ table: this.table, op: 'update', rows: hit.map((r) => ({ ...r })) });
        return { data: hit.map((r) => ({ ...r })), error: null };
      }
      if (this.op === 'delete') {
        db.tables[this.table] = rows.filter((r) => !hit.includes(r));
        db.log.push({ table: this.table, op: 'delete', rows: hit.map((r) => ({ ...r })) });
        return { data: hit.map((r) => ({ ...r })), error: null };
      }
      let out = hit.map((r) => ({ ...r }));
      for (const { col, asc } of [...this.sort].reverse())
        out = out.sort((a, b) => ((a[col] as number) > (b[col] as number) ? 1 : (a[col] as number) < (b[col] as number) ? -1 : 0) * (asc ? 1 : -1));
      if (this.max != null) out = out.slice(0, this.max);
      return { data: out, error: null };
    }

    maybeSingle() {
      const r = this.run();
      return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error });
    }
    then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
      return Promise.resolve(this.run()).then(resolve, reject);
    }
  }

  db.client = {
    from: (table: string) => new Query(table),
    rpc: async () => ({ data: true, error: null }),
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  };
  return db;
}
