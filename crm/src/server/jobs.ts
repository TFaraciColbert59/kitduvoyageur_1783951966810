import 'server-only';
import { logServer } from '../lib/errors';
import type { ServiceDb } from './db';

/**
 * Journal des tâches : `ops.job_runs` via `ops.job_run_start` /
 * `ops.job_run_finish` (M11). Clé d’idempotence obligatoire pour les crons :
 * un run déjà terminé avec la même clé n’est pas rejoué.
 */
export type JobStatus = 'running' | 'ok' | 'error' | 'skipped';

export type JobHandle = {
  id: string | number | null;
  job: string;
  key: string | null;
  alreadyDone: boolean;
  available: boolean;
};

type OpsRow = { id?: unknown; status?: unknown };

function isMissing(error: { code?: string | null; message?: string | null }): boolean {
  const code = error.code ?? '';
  return code === 'PGRST202' || code === '42P01' || code === 'PGRST205';
}

export async function startJob(
  db: ServiceDb,
  job: string,
  key: string | null,
  payload?: Record<string, unknown>
): Promise<JobHandle> {
  const handle: JobHandle = { id: null, job, key, alreadyDone: false, available: true };

  if (key) {
    const { data, error } = await db
      .schema('ops')
      .from('job_runs')
      .select('id,status')
      .eq('job', job)
      .eq('idempotency_key', key)
      .eq('status', 'ok')
      .limit(1)
      .maybeSingle();
    if (!error) {
      const row = (data ?? null) as OpsRow | null;
      if (row && row.status === 'ok') {
        return { ...handle, id: typeof row.id === 'number' || typeof row.id === 'string' ? row.id : null, alreadyDone: true };
      }
    } else if (isMissing(error)) {
      handle.available = false;
    }
  }

  const { data, error } = await db.schema('ops').rpc('job_run_start', {
    p_job: job,
    p_key: key,
    p_payload: payload ?? null
  });
  if (error) {
    if (!isMissing(error)) {
      logServer({ level: 'warn', scope: 'crm', event: 'job_start_failed', pg_code: error.code ?? null });
    }
    return { ...handle, available: false };
  }
  return { ...handle, id: typeof data === 'number' || typeof data === 'string' ? data : null };
}

export async function finishJob(
  db: ServiceDb,
  handle: JobHandle,
  status: JobStatus,
  result?: Record<string, unknown>,
  error?: string
): Promise<void> {
  if (handle.alreadyDone || handle.id === null) return;
  const { error: finishError } = await db.schema('ops').rpc('job_run_finish', {
    p_id: handle.id,
    p_status: status,
    p_result: result ?? null,
    p_error: error ?? null
  });
  if (finishError) {
    logServer({ level: 'warn', scope: 'crm', event: 'job_finish_failed', pg_code: finishError.code ?? null });
  }
}

/** Somme des coûts estimés du mois pour un agent (lecture tolérante). */
export async function monthSpendCents(db: ServiceDb, agentId: string): Promise<{ cents: number; known: boolean }> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data, error } = await db
    .schema('ops')
    .from('job_runs')
    .select('result')
    .like('job', 'agent:%')
    .gte('started_at', start.toISOString())
    .limit(5000);
  if (error) return { cents: 0, known: false };
  let cents = 0;
  for (const row of Array.isArray(data) ? data : []) {
    const result = (row as { result?: unknown }).result;
    if (!result || typeof result !== 'object') continue;
    const record = result as Record<string, unknown>;
    if (record.agent_id !== agentId) continue;
    const value = Number(record.cost_cents ?? 0);
    if (Number.isFinite(value) && value > 0) cents += value;
  }
  return { cents, known: true };
}
