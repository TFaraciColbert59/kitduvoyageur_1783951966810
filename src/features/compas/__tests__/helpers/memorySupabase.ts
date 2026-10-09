/**
 * Faux client Supabase en mémoire pour les actions serveur du Compas (tests).
 *
 * Tables en mémoire, sous-ensemble du constructeur de requêtes PostgREST
 * utilisé par le Compas (`select`, `insert`, `update`, `delete`, `eq`, `in`,
 * `is`, `gte`, `lte`, `order`, `limit`, `maybeSingle`, `single`, comptage
 * `head`), `rpc` et `auth.getUser`. Une mise à jour de `trips` reçoit un
 * nouveau `updated_at`, comme le trigger `trg_trips_updated_at` : les
 * écritures conditionnées (`updateTripMetadata`, prises de phase) se
 * comportent comme en base. Chaque écriture est notée dans `writes`.
 *
 * `onQuery` est appelé avant chaque requête : un test y simule un geste
 * concurrent (« Arrêter » pendant la préparation).
 *
 * Limites de fidélité (à garder en tête avant d'en tirer une conclusion) :
 * - `maybeSingle` sur plusieurs lignes rend la première, là où PostgREST
 *   renvoie l'erreur PGRST116 ;
 * - `order` ne trie que des valeurs numériques ;
 * - `insert` n'applique ni valeurs par défaut ni contraintes (clés, unicité,
 *   NOT NULL, RLS) : seul un `id` est ajouté ;
 * - les prises de phase montrent la fenêtre de temps (`CLAIM_MS`), pas une
 *   vraie course entre deux écritures conditionnées concurrentes (aucun test
 *   n'y entrelace deux préparations entre une lecture et son écriture).
 */
import { randomUUID } from 'node:crypto';

export type Row = Record<string, unknown>;
export type QueryOp = 'select' | 'insert' | 'update' | 'delete';

export interface QueryInfo {
  table: string;
  op: QueryOp;
}

export interface WriteRecord {
  table: string;
  op: Exclude<QueryOp, 'select'>;
  ids: string[];
  payload?: unknown;
}

export interface MemorySupabaseOptions {
  user: () => { id: string; is_anonymous?: boolean } | null;
  rpc?: (fn: string, args: Record<string, unknown>) => { data: unknown; error: unknown } | undefined;
  onQuery?: (q: QueryInfo) => void | Promise<void>;
}

export interface MemorySupabase {
  client: never;
  tables: Record<string, Row[]>;
  writes: WriteRecord[];
  rows: (table: string) => Row[];
}

type Filter = (r: Row) => boolean;

let stampSeq = 0;
/** `updated_at` unique à chaque écriture, même dans la même milliseconde (horloge figée). */
function freshStamp(): string {
  stampSeq = (stampSeq + 1) % 1000;
  return new Date(Date.now()).toISOString().replace('Z', `${String(stampSeq).padStart(3, '0')}+00:00`);
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

export function memorySupabase(options: MemorySupabaseOptions): MemorySupabase {
  const tables: Record<string, Row[]> = {};
  const writes: WriteRecord[] = [];
  const rows = (table: string) => (tables[table] ??= []);

  class Query implements PromiseLike<{ data: unknown; error: unknown; count?: number | null }> {
    private op: QueryOp = 'select';
    private filters: Filter[] = [];
    private payload: unknown;
    private returning = false;
    private head = false;
    private counted = false;
    private one: 'maybe' | 'single' | null = null;
    private orders: Array<[string, boolean]> = [];
    private max: number | null = null;

    constructor(private readonly table: string) {}

    select(_cols?: string, opts?: { count?: string; head?: boolean }) {
      if (this.op === 'select') {
        this.head = opts?.head === true;
        this.counted = opts?.count != null;
      } else this.returning = true;
      return this;
    }
    insert(values: Row | Row[]) {
      this.op = 'insert';
      this.payload = Array.isArray(values) ? values : [values];
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
    neq(col: string, value: unknown) {
      this.filters.push((r) => r[col] !== value);
      return this;
    }
    in(col: string, values: unknown[]) {
      this.filters.push((r) => values.includes(r[col]));
      return this;
    }
    is(col: string, value: unknown) {
      this.filters.push((r) => (value === null ? r[col] == null : r[col] === value));
      return this;
    }
    gte(col: string, value: number) {
      this.filters.push((r) => Number(r[col]) >= value);
      return this;
    }
    lte(col: string, value: number) {
      this.filters.push((r) => Number(r[col]) <= value);
      return this;
    }
    order(col: string, opts?: { ascending?: boolean }) {
      this.orders.push([col, opts?.ascending !== false]);
      return this;
    }
    limit(n: number) {
      this.max = n;
      return this;
    }
    maybeSingle() {
      this.one = 'maybe';
      return this;
    }
    single() {
      this.one = 'single';
      return this;
    }

    then<A = { data: unknown; error: unknown }, B = never>(
      onFulfilled?: ((value: { data: unknown; error: unknown; count?: number | null }) => A | PromiseLike<A>) | null,
      onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null
    ): PromiseLike<A | B> {
      return this.run().then(onFulfilled, onRejected);
    }

    private matching(): Row[] {
      return rows(this.table).filter((r) => this.filters.every((f) => f(r)));
    }

    private async run(): Promise<{ data: unknown; error: unknown; count?: number | null }> {
      await options.onQuery?.({ table: this.table, op: this.op });
      if (this.op === 'insert') {
        const inserted: Row[] = (this.payload as Row[]).map((r) => ({ id: randomUUID(), ...clone(r) }));
        if (this.table === 'trips') for (const r of inserted) r.updated_at = freshStamp();
        rows(this.table).push(...inserted);
        writes.push({ table: this.table, op: 'insert', ids: inserted.map((r) => String(r.id)), payload: clone(this.payload) });
        return this.shape(inserted);
      }
      if (this.op === 'update') {
        const hit = this.matching();
        for (const r of hit) {
          Object.assign(r, clone(this.payload as Row));
          if (this.table === 'trips') r.updated_at = freshStamp();
        }
        writes.push({ table: this.table, op: 'update', ids: hit.map((r) => String(r.id)), payload: clone(this.payload) });
        return this.shape(hit);
      }
      if (this.op === 'delete') {
        const hit = this.matching();
        tables[this.table] = rows(this.table).filter((r) => !hit.includes(r));
        writes.push({ table: this.table, op: 'delete', ids: hit.map((r) => String(r.id)) });
        return this.shape(hit);
      }
      let found = this.matching();
      for (const [col, asc] of [...this.orders].reverse())
        found = [...found].sort((a, b) => (Number(a[col]) - Number(b[col])) * (asc ? 1 : -1));
      if (this.max != null) found = found.slice(0, this.max);
      if (this.head) return { data: null, error: null, count: found.length };
      return { ...this.shape(found), ...(this.counted ? { count: found.length } : {}) };
    }

    private shape(found: Row[]): { data: unknown; error: unknown } {
      if (this.op !== 'select' && !this.returning && this.one == null) return { data: null, error: null };
      const data = clone(found);
      if (this.one === 'maybe') return { data: data[0] ?? null, error: null };
      if (this.one === 'single')
        return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'not one row' } };
      return { data, error: null };
    }
  }

  const client = {
    from: (table: string) => new Query(table),
    rpc: async (fn: string, args: Record<string, unknown> = {}) =>
      options.rpc?.(fn, args) ?? { data: fn === 'can_edit_trip' ? true : null, error: null },
    auth: {
      getUser: async () => ({ data: { user: options.user() }, error: null }),
    },
  };

  return { client: client as never, tables, writes, rows };
}
