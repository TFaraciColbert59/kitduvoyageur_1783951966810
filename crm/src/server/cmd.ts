import type { SupabaseClient } from '@supabase/supabase-js';
import { apiError, translateDbError } from '@/lib/errors';
import { parseCommandParams } from '@/lib/cmd';
import type { CommandResult } from '@/lib/rpc';
import type { Database, Json } from '@/types/db';
import type { ServiceDb } from '@/server/db';

/**
 * Passage obligé de toute écriture : `admin.run_command` en base, avec le jeton
 * de la personne (routes humaines) ou `run_command_as` avec service_role et
 * l'identité de l'agent (MCP, crons). Aucun `insert`/`update` direct.
 */

type AdminClient = SupabaseClient<Database>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeResult(raw: unknown, command: string): CommandResult {
  const row = asRecord(raw);
  if (Object.keys(row).length === 0) {
    throw apiError('server_error');
  }
  const ok = row.ok !== false;
  return {
    ok,
    data: row.data ?? null,
    request_id: typeof row.request_id === 'string' ? row.request_id : null,
    audit_id:
      typeof row.audit_id === 'string' || typeof row.audit_id === 'number' ? (row.audit_id as string | number) : null,
    message: typeof row.message === 'string' ? row.message : null,
    ...(ok ? {} : { error: 'command_failed' }),
    command
  } as CommandResult;
}

/** Valide la forme puis exécute une commande avec le jeton de la personne. */
export async function runCommand(
  client: AdminClient,
  command: string,
  params: unknown
): Promise<CommandResult> {
  const parsed = parseCommandParams(command, params);
  const { data, error } = await client.schema('admin').rpc('run_command', {
    p_command: command,
    p_params: parsed as Json
  });
  if (error) throw translateDbError(error);
  return normalizeResult(data, command);
}

/** Même chose, exécutée « en tant qu'agent » depuis le serveur (service_role). */
export async function runCommandAs(
  db: ServiceDb,
  authUserId: string,
  command: string,
  params: unknown
): Promise<CommandResult> {
  const parsed = parseCommandParams(command, params);
  const { data, error } = await db.schema('admin').rpc('run_command_as', {
    p_auth_user_id: authUserId,
    p_command: command,
    p_params: parsed
  });
  if (error) throw translateDbError(error);
  return normalizeResult(data, command);
}

/**
 * Vérifie le statut de l'agent, son allowlist et consomme une unité de
 * `admin.agent_rate` — avant chaque appel d'outil (arrêt effectif immédiat).
 */
export async function authorizeAgent(
  db: ServiceDb,
  authUserId: string,
  command: string
): Promise<{ ok: boolean; agent_id: string | null; pole: string | null; status: string | null; used: number | null; cap: number | null }> {
  const { data, error } = await db.schema('admin').rpc('agent_authorize', {
    p_command: command,
    p_auth_user_id: authUserId
  });
  if (error) throw translateDbError(error);
  const row = asRecord(data);
  return {
    ok: row.ok !== false,
    agent_id: typeof row.agent_id === 'string' ? row.agent_id : null,
    pole: typeof row.pole === 'string' ? row.pole : null,
    status: typeof row.status === 'string' ? row.status : null,
    used: typeof row.used === 'number' ? row.used : null,
    cap: typeof row.cap === 'number' ? row.cap : null
  };
}

export type ApproveResult = {
  ok: boolean;
  status: string;
  message: string | null;
  request_id: string | null;
  audit_id: string | number | null;
};

/** Validation d'une demande par une personne (code de confirmation à 8 caractères). */
export async function approveRequest(
  client: AdminClient,
  requestId: string,
  confirmation: string
): Promise<ApproveResult> {
  const { data, error } = await client.schema('admin').rpc('approve_request', {
    p_request: requestId,
    p_confirmation: confirmation
  });
  if (error) throw translateDbError(error);
  const row = asRecord(data);
  return {
    ok: row.ok !== false,
    status: typeof row.status === 'string' ? row.status : 'unknown',
    message: typeof row.message === 'string' ? row.message : null,
    request_id: typeof row.request_id === 'string' ? row.request_id : requestId,
    audit_id:
      typeof row.audit_id === 'string' || typeof row.audit_id === 'number' ? (row.audit_id as string | number) : null
  };
}

/** Refus d'une demande : motif obligatoire, tracé en base. */
export async function rejectRequest(
  client: AdminClient,
  requestId: string,
  reason: string
): Promise<{ ok: boolean; status: string; message: string | null }> {
  const { data, error } = await client.schema('admin').rpc('reject_request', {
    p_request: requestId,
    p_reason: reason
  });
  if (error) throw translateDbError(error);
  const row = asRecord(data);
  return {
    ok: row.ok !== false,
    status: typeof row.status === 'string' ? row.status : 'rejected',
    message: typeof row.message === 'string' ? row.message : null
  };
}

/** Annulation 10 s : uniquement les commandes `undoable`, par leur auteur. */
export async function undoAction(
  client: AdminClient,
  auditId: string | number
): Promise<{ ok: boolean; message: string | null; undo_id: string | number | null }> {
  const numericAuditId = typeof auditId === 'string' ? Number(auditId) : auditId;
  if (!Number.isFinite(numericAuditId)) throw apiError('invalid_params');
  const { data, error } = await client.schema('admin').rpc('undo', { p_audit_id: numericAuditId });
  if (error) throw translateDbError(error);
  const row = asRecord(data);
  return {
    ok: row.ok !== false,
    message: typeof row.message === 'string' ? row.message : null,
    undo_id:
      typeof row.undo_id === 'string' || typeof row.undo_id === 'number' ? (row.undo_id as string | number) : null
  };
}
