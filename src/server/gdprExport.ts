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
export const GDPR_EXPORT_SCHEMA_VERSION = 'a14-v1';

/** Une table du domaine et la colonne qui identifie le sujet. */
export interface GdprUserTable {
  table: string;
  userColumn: string;
}

/**
 * Registre des tables du domaine liées à un utilisateur (audité sur la base
 * locale le 2026-09-11). Toute table ajoutée au domaine doit être ajoutée ici
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
] as const;

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

function assertNoError(error: { message: string } | null, scope: string): void {
  if (error) throw new Error(`export RGPD ${scope}: ${error.message}`);
}

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
  if (planIds.length > 0) {
    const [versions, decisions, engineRuns] = await Promise.all(
      GDPR_PLAN_CHILD_TABLES.map((table) => client.selectByColumn(table, 'plan_id', planIds))
    );
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
  supabase: SupabaseClient
): GdprExportClient {
  return {
    async selectProfile(userId) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      assertNoError(error, 'user_profiles');
      return (data as Record<string, unknown> | null) ?? null;
    },

    async selectByUser(table, userColumn, userId) {
      const { data, error } = await supabase.from(table).select('*').eq(userColumn, userId);
      assertNoError(error, table);
      return (data ?? []) as Record<string, unknown>[];
    },

    async selectByColumn(table, column, values) {
      const { data, error } = await supabase.from(table).select('*').in(column, values);
      assertNoError(error, table);
      return (data ?? []) as Record<string, unknown>[];
    },
  };
}
