import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/errors';

/**
 * Client `service_role`. Trois usages seulement (02_ARCHITECTURE § 3) :
 * API admin d'Auth, tâches planifiées (crons, agents), amorçage des comptes d'agents.
 *
 * Ce fichier n'est importable que depuis `crm/src/server/**`. Aucune route ne
 * renvoie de donnée brute lue avec cette clé : les RPC `admin.*` restent les
 * portes d'entrée contrôlées, et `run_command_as` porte l'identité de l'agent.
 */
export type ServiceDb = SupabaseClient;

export function hasServiceRole(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Client `service_role` brut (sans générique) : les schémas `ops` et `admin`
 * sont appelés par RPC nommée. Créé ici et nulle part ailleurs hors périmètre.
 */
export function serviceDb(): ServiceDb {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw apiError('brick_disabled');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'lkdv-control-server' } }
  });
}

/** Schéma `ops` (journal des tâches) : absent des types générés publics. */
export function opsRpc(db: ServiceDb, fn: 'job_run_start' | 'job_run_finish', args: Record<string, unknown>) {
  return db.schema('ops').rpc(fn, args);
}
