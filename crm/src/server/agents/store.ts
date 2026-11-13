import 'server-only';
import { apiError, translateDbError } from '../../lib/errors';
import type { ServiceDb } from '../db';

/** Statut d'agent, tel que la base le publie (M03). */
export type AgentStatus = 'active' | 'paused' | 'stopped';

export type AgentRecord = {
  id: string;
  auth_user_id: string;
  pole: string;
  name: string;
  tools: string[];
  hourly_cap: number;
  status: AgentStatus;
};

function asToolList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function toAgentRecord(row: Record<string, unknown>): AgentRecord | null {
  const id = typeof row.id === 'string' ? row.id : null;
  const authUserId = typeof row.auth_user_id === 'string' ? row.auth_user_id : null;
  const name = typeof row.name === 'string' ? row.name : null;
  if (!id || !authUserId || !name) return null;
  const pole = typeof row.pole_code === 'string' ? row.pole_code : typeof row.pole === 'string' ? row.pole : 'TECH';
  const status = row.status === 'paused' || row.status === 'stopped' ? row.status : 'active';
  return {
    id,
    auth_user_id: authUserId,
    pole,
    name,
    tools: asToolList(row.tools),
    hourly_cap: typeof row.hourly_cap === 'number' ? row.hourly_cap : 60,
    status
  };
}

/**
 * Lecture du compte de service d'un agent avec `service_role`.
 * Usage autorisé : amorçage et authentification des agents (02_ARCHITECTURE § 3).
 */
export async function loadAgentByAuthUserId(db: ServiceDb, authUserId: string): Promise<AgentRecord> {
  const { data, error } = await db
    .schema('admin')
    .from('agents')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw translateDbError(error);
  const record = data ? toAgentRecord(data as Record<string, unknown>) : null;
  if (!record) throw apiError('agent_unknown');
  return record;
}

export async function loadAgentById(db: ServiceDb, agentId: string): Promise<AgentRecord | null> {
  const { data, error } = await db.schema('admin').from('agents').select('*').eq('id', agentId).maybeSingle();
  if (error) throw translateDbError(error);
  return data ? toAgentRecord(data as Record<string, unknown>) : null;
}

/** Agents actifs, pour `/api/cron/agents`. */
export async function listActiveAgents(db: ServiceDb): Promise<AgentRecord[]> {
  const { data, error } = await db.schema('admin').from('agents').select('*').eq('status', 'active');
  if (error) throw translateDbError(error);
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => toAgentRecord(row as Record<string, unknown>))
    .filter((row): row is AgentRecord => row !== null);
}

/** Refus immédiat si l'agent n'est pas actif (vérifié aussi en base à chaque outil). */
export function assertAgentActive(agent: AgentRecord): void {
  if (agent.status === 'stopped') throw apiError('agent_stopped');
  if (agent.status !== 'active') throw apiError('agent_paused');
}
