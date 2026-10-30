/**
 * A14 — Export RGPD (portabilité, article 20) des données du domaine Adventure
 * Intelligence + profil + consentements.
 *
 * Conçu sans dépendance Supabase dans le cœur : le client est injecté
 * (`GdprExportClient`) et l'adaptateur `createSupabaseGdprExportClient` vit en
 * bas de fichier. Les routes l'utilisent avec le client service_role APRÈS
 * authentification ; l'identifiant vient toujours de la session, jamais du
 * corps de requête.
 *
 * Aucune donnée de santé n'est présente dans ce schéma (décision AIPD a14).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Version du schéma d'export — incrémenter à toute évolution de forme. */
export const GDPR_EXPORT_SCHEMA_VERSION = 'a14-v2';

/** Une table du domaine et la colonne qui identifie le sujet. */
export interface GdprUserTable {
  table: string;
  userColumn: string;
}

/**
 * Registre des tables du domaine liées à un utilisateur (audité sur la base
 * locale le 2026-09-11, étendu le 2026-09-21 aux tables progression/territoire).
 * Toute table ajoutée au domaine doit être ajoutée ici
 * (le test TEST-A14-GDPR-EXPORT-01 verrouille cette liste).
 */
export const GDPR_USER_TABLES: readonly GdprUserTable[] = [
  { table: 'adventure_data_consents', userColumn: 'user_id' },
  { table: 'adventure_generation_requests', userColumn: 'user_id' },
  { table: 'adventure_shadow_runs', userColumn: 'user_id' },
  { table: 'performance_observations', userColumn: 'user_id' },
  { table: 'route_predictions', userColumn: 'user_id' },
  { table: 'segment_predictions', userColumn: 'user_id' },
  { table: 'user_performance_profiles', userColumn: 'user_id' },
  { table: 'user_performance_profile_versions', userColumn: 'user_id' },
  { table: 'hike_sessions', userColumn: 'user_id' },
  { table: 'session_segment_passages', userColumn: 'user_id' },
  { table: 'terrain_reports', userColumn: 'reporter_id' },
  { table: 'terrain_report_confirmations', userColumn: 'user_id' },
  { table: 'terrain_report_contributors', userColumn: 'user_id' },
  { table: 'offline_sync_operations', userColumn: 'user_id' },
  { table: 'user_entitlements', userColumn: 'user_id' },
  { table: 'saved_adventures', userColumn: 'user_id' },
  { table: 'saved_trails', userColumn: 'user_id' },
  { table: 'adventure_domain_events', userColumn: 'actor_id' },
  // Progression/classement/territoire (migration 20260921100000 — FK CASCADE
  // vers auth.users) : exportés au même titre que le reste du domaine.
  { table: 'user_season_progress', userColumn: 'user_id' },
  { table: 'progression_outbox', userColumn: 'user_id' },
  { table: 'progression_decisions', userColumn: 'user_id' },
  { table: 'progression_legacy_snapshot', userColumn: 'user_id' },
  { table: 'progression_legacy_mapping', userColumn: 'user_id' },
  { table: 'progression_leaderboard_agg', userColumn: 'user_id' },
  { table: 'leaderboard_refresh_queue', userColumn: 'user_id' },
  { table: 'leaderboard_access_log', userColumn: 'user_id' },
  { table: 'territory_change_log', userColumn: 'user_id' },
  { table: 'user_territory', userColumn: 'user_id' },
  { table: 'user_territory_private', userColumn: 'user_id' },
  // Profil voyageur du Compas (migration 20261010100000, PLAN-100 4.1) : nationalité,
  // résidence, domicile arrondi — données de la personne, rendues à elle seule.
  { table: 'user_traveller', userColumn: 'user_id' },
] as const;

/**
 * Tables dont la migration peut ne pas être encore appliquée quand le code est
 * déployé (la base se migre à la main) : absentes, elles sont vides. Sans cela,
 * l'export plante et, pire, la suppression de compte échoue au recomptage APRÈS
 * avoir supprimé l'utilisateur.
 */
export const GDPR_OPTIONAL_TABLES: ReadonlySet<string> = new Set(['user_traveller']);

/**
 * Relation absente : Postgres 42P01, PostgREST PGRST205. Le message ne sert que s'il
 * nomme une table ou une relation absente : « schema cache » seul est aussi la panne de
 * connexion PGRST002, qui doit rester une erreur.
 */
export function isMissingRelation(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /could not find the table|relation "[^"]*" does not exist/i.test(error.message ?? '');
}

/** Tables enfants d'un AdventurePlan (liées par `plan_id`). */
export const GDPR_PLAN_CHILD_TABLES = [
  'adventure_plan_versions',
  'adventure_plan_decisions',
  'adventure_engine_runs',
] as const;

export interface GdprExportClient {
  selectProfile(userId: string): Promise<Record<string, unknown> | null>;
  selectByUser(
    table: string,
    userColumn: string,
    userId: string
  ): Promise<Record<string, unknown>[]>;
  selectByColumn(
    table: string,
    column: string,
    values: string[]
  ): Promise<Record<string, unknown>[]>;
}

export interface GdprPlanExport {
  plan: Record<string, unknown>;
  versions: Record<string, unknown>[];
  decisions: Record<string, unknown>[];
  engineRuns: Record<string, unknown>[];
}

export interface GdprExportBundle {
  schemaVersion: string;
  exportedAt: string;
  subject: { userId: string };
  profile: Record<string, unknown> | null;
  consents: Record<string, unknown>[];
  tables: Record<string, Record<string, unknown>[]>;
  plans: GdprPlanExport[];
  counts: Record<string, number>;
}

/** A partial export must never be served as a successful portability archive. */
export class GdprExportIncompleteError extends Error {
  constructor() {
    super('Export incomplet : les données n’ont pas pu être réunies intégralement.');
    this.name = 'GdprExportIncompleteError';
  }
}

export interface GdprExportLimits {
  maxRows: number;
  maxBytes: number;
  maxRequests: number;
  timeoutMs: number;
}

// Shared by all table reads and the three concurrent child-table reads.
const DEFAULT_EXPORT_LIMITS: GdprExportLimits = {
  maxRows: 50_000,
  maxBytes: 10 * 1024 * 1024,
  maxRequests: 500,
  timeoutMs: 20_000,
};
const EXPORT_PAGE_SIZE = 250;
const PLAN_ID_BATCH_SIZE = 100;

// These tables have no `id`. Include the complete primary key so ordering stays
// deterministic even when several rows share a season, report or scope.
const EXPORT_ORDER_EXCEPTIONS: Readonly<Record<string, readonly string[]>> = {
  terrain_report_contributors: ['report_id', 'user_id'],
  offline_sync_operations: ['user_id', 'idempotency_key'],
  user_entitlements: ['user_id'],
  user_season_progress: ['user_id', 'season_id'],
  progression_decisions: ['idempotency_key'],
  progression_leaderboard_agg: ['season_id', 'scope_type', 'scope_id', 'user_id'],
  user_territory: ['user_id'],
  user_territory_private: ['user_id'],
  user_traveller: ['user_id'],
};

/**
 * Construit l'export complet d'un utilisateur. Lecture seule, aucun effet de
 * bord. Les tables vides restent présentes (structure stable pour le sujet).
 */
export async function buildGdprExport(
  client: GdprExportClient,
  userId: string,
  options: { now?: string } = {}
): Promise<GdprExportBundle> {
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    throw new Error('export RGPD : identifiant utilisateur requis');
  }

  const exportedAt = options.now ?? new Date().toISOString();
  const profile = await client.selectProfile(userId);

  const tables: Record<string, Record<string, unknown>[]> = {};
  const counts: Record<string, number> = {};
  for (const { table, userColumn } of GDPR_USER_TABLES) {
    const rows = await client.selectByUser(table, userColumn, userId);
    tables[table] = rows;
    counts[table] = rows.length;
  }

  const planRows = await client.selectByUser('adventure_plans', 'owner_id', userId);
  const planIds = planRows
    .map((row) => (typeof row.id === 'string' ? row.id : null))
    .filter((id): id is string => id !== null);

  const plans: GdprPlanExport[] = [];
  for (const table of GDPR_PLAN_CHILD_TABLES) counts[table] = 0;
  if (planIds.length > 0) {
    const [versions, decisions, engineRuns] = await Promise.all(
      GDPR_PLAN_CHILD_TABLES.map((table) => client.selectByColumn(table, 'plan_id', planIds))
    );
    counts.adventure_plan_versions = versions.length;
    counts.adventure_plan_decisions = decisions.length;
    counts.adventure_engine_runs = engineRuns.length;
    for (const plan of planRows) {
      const planId = String(plan.id);
      const pick = (rows: Record<string, unknown>[]) =>
        rows.filter((row) => String(row.plan_id) === planId);
      plans.push({
        plan,
        versions: pick(versions),
        decisions: pick(decisions),
        engineRuns: pick(engineRuns),
      });
    }
  }
  counts.adventure_plans = planRows.length;
  tables.adventure_plans = planRows;

  const consents = tables.adventure_data_consents ?? [];
  const totalRows = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return {
    schemaVersion: GDPR_EXPORT_SCHEMA_VERSION,
    exportedAt,
    subject: { userId },
    profile,
    consents,
    tables,
    plans,
    counts: { ...counts, total: totalRows },
  };
}

/** Noms de fichier d'export — identifiant opaque + date, jamais d'email. */
export function gdprExportFileName(now = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `lkdv-export-donnees-${stamp}.json`;
}

/** Adaptateur service_role (routes uniquement, après authentification). */
export function createSupabaseGdprExportClient(
  supabase: SupabaseClient,
  overrides: Partial<GdprExportLimits> = {}
): GdprExportClient {
  const limits = { ...DEFAULT_EXPORT_LIMITS, ...overrides };
  if (Object.values(limits).some((value) => !Number.isSafeInteger(value) || value < 1)) {
    throw new GdprExportIncompleteError();
  }
  const signal = AbortSignal.timeout(limits.timeoutMs);
  let rowCount = 0;
  let bytes = 0;
  let requests = 0;
  const check = () => {
    if (signal.aborted) throw new GdprExportIncompleteError();
  };
  const startRequest = () => {
    check();
    requests += 1;
    if (requests > limits.maxRequests) throw new GdprExportIncompleteError();
  };
  const retain = (rows: Record<string, unknown>[]) => {
    check();
    rowCount += rows.length;
    bytes += Buffer.byteLength(JSON.stringify(rows), 'utf8');
    if (rowCount > limits.maxRows || bytes > limits.maxBytes) {
      throw new GdprExportIncompleteError();
    }
  };
  const readAll = async (
    table: string,
    column: string,
    value: string | string[],
    optional: boolean
  ): Promise<Record<string, unknown>[]> => {
    const order = EXPORT_ORDER_EXCEPTIONS[table] ?? ['id'];
    const rows: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    let expected: number | null = null;
    do {
      startRequest();
      let query = supabase.from(table).select('*', { count: 'exact' });
      query = Array.isArray(value) ? query.in(column, value) : query.eq(column, value);
      for (const key of order) query = query.order(key, { ascending: true });
      const { data, error, count } = await query
        .range(rows.length, rows.length + EXPORT_PAGE_SIZE - 1)
        .abortSignal(signal);
      check();
      if (error) {
        if (optional && rows.length === 0 && isMissingRelation(error)) return [];
        throw new GdprExportIncompleteError();
      }
      if (count == null || !Number.isSafeInteger(count) || count < 0 || !Array.isArray(data)) {
        throw new GdprExportIncompleteError();
      }
      if (expected !== null && count !== expected) throw new GdprExportIncompleteError();
      expected = count;
      if (count - rows.length > limits.maxRows - rowCount ||
        data.length > EXPORT_PAGE_SIZE || data.length > count - rows.length ||
        (data.length === 0 && rows.length < count)) {
        throw new GdprExportIncompleteError();
      }
      for (const row of data as Record<string, unknown>[]) {
        const keys = order.map((key) => row[key]);
        if (keys.some((key) => typeof key !== 'string' && typeof key !== 'number')) {
          throw new GdprExportIncompleteError();
        }
        const identity = JSON.stringify(keys);
        if (seen.has(identity)) throw new GdprExportIncompleteError();
        seen.add(identity);
      }
      retain(data);
      rows.push(...data);
      // Advance by the actual response length: the hosted API may enforce a
      // lower row cap than our requested range. Its exact total remains binding.
    } while (rows.length < expected);
    return rows;
  };
  return {
    async selectProfile(userId) {
      startRequest();
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .abortSignal(signal)
        .maybeSingle();
      check();
      if (error) throw new GdprExportIncompleteError();
      if (data) retain([data as Record<string, unknown>]);
      return (data as Record<string, unknown> | null) ?? null;
    },

    async selectByUser(table, userColumn, userId) {
      return readAll(table, userColumn, userId, GDPR_OPTIONAL_TABLES.has(table));
    },

    async selectByColumn(table, column, values) {
      const rows: Record<string, unknown>[] = [];
      const uniqueValues = [...new Set(values)];
      for (let offset = 0; offset < uniqueValues.length; offset += PLAN_ID_BATCH_SIZE) {
        rows.push(...await readAll(table, column,
          uniqueValues.slice(offset, offset + PLAN_ID_BATCH_SIZE), false));
      }
      return rows;
    },
  };
}
