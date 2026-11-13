import 'server-only';
import { logServer, translateDbError } from '../lib/errors';
import type { ServiceDb } from './db';
import { finishJob, startJob } from './jobs';
import { sendTeamAlert } from './resend';

/**
 * SOS — alerte haute, « Je prends », escalade à 5 minutes.
 *
 * La notification navigateur est émise par le déclencheur temps réel de la base
 * (canal `admin:sos`) ; cette couche ajoute l’e-mail d’astreinte et le journal.
 * Aucune coordonnée GPS ne sort d’ici.
 */
export type SosOverdueItem = {
  id: string;
  user_id: string | null;
  created_at: string;
  minutes_open: number;
  status: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** SOS ouverts sans « Je prends » depuis plus de `minutes` (RPC dédiée, sans GPS). */
export async function listOverdueSos(
  db: ServiceDb,
  minutes = 5
): Promise<{ items: SosOverdueItem[]; count: number; available: boolean }> {
  const { data, error } = await db.schema('admin').rpc('sos_overdue', { p_minutes: minutes });
  if (error) {
    if (error.code !== 'PGRST202') throw translateDbError(error);
    return { items: [], count: 0, available: false };
  }
  const payload = asRecord(data);
  const rows = Array.isArray(payload.items) ? payload.items : [];
  const items: SosOverdueItem[] = [];
  for (const row of rows) {
    const raw = asRecord(row);
    if (typeof raw.id !== 'string') continue;
    items.push({
      id: raw.id,
      user_id: typeof raw.user_id === 'string' ? raw.user_id : null,
      created_at: typeof raw.created_at === 'string' ? raw.created_at : '',
      minutes_open: typeof raw.minutes_open === 'number' ? raw.minutes_open : 0,
      status: typeof raw.status === 'string' ? raw.status : 'active'
    });
  }
  return { items, count: items.length, available: true };
}

/**
 * Escalade d’un SOS : e-mail d’astreinte + journal, une seule fois par SOS.
 * Idempotent grâce à `ops.job_runs` (clé = identifiant du SOS).
 */
export async function escalateSos(db: ServiceDb, item: SosOverdueItem): Promise<{ escalated: boolean; emailed: boolean }> {
  const job = `sos:escalate:${item.id}`;
  const handle = await startJob(db, job, item.id, { sos_id: item.id, minutes_open: item.minutes_open });
  if (handle.alreadyDone) return { escalated: false, emailed: false };

  const email = await sendTeamAlert({
    subject: `[LKDV Control] SOS sans prise en charge depuis ${item.minutes_open} min`,
    text: [
      `Un SOS est ouvert depuis ${item.minutes_open} minutes sans « Je prends ».`,
      `Identifiant : ${item.id}`,
      item.created_at ? `Créé le : ${item.created_at}` : '',
      'Ouvrez le CRM, écran SOS, et prenez-le en charge.'
    ]
      .filter(Boolean)
      .join('\n'),
    idempotencyKey: `sos-escalate-${item.id}`
  });

  await finishJob(db, handle, 'ok', {
    sos_id: item.id,
    minutes_open: item.minutes_open,
    emailed: email.sent,
    email_skipped: email.skipped ?? null
  });
  logServer({
    level: 'warn',
    scope: 'crm',
    event: 'sos_escalated',
    message: `sos=${item.id} minutes=${item.minutes_open} email=${email.sent ? 'oui' : 'non'}`
  });
  return { escalated: true, emailed: email.sent };
}

/** Boucle d’escalade du cron `/api/cron/sla`. */
export async function escalateOverdueSos(
  db: ServiceDb,
  minutes = 5
): Promise<{ checked: number; escalated: number; emailed: number; available: boolean }> {
  const overdue = await listOverdueSos(db, minutes);
  let escalated = 0;
  let emailed = 0;
  for (const item of overdue.items) {
    const outcome = await escalateSos(db, item);
    if (outcome.escalated) escalated += 1;
    if (outcome.emailed) emailed += 1;
  }
  return { checked: overdue.count, escalated, emailed, available: overdue.available };
}

/** Alerte haute immédiate (événement critique : paiement, auth, illégal). */
export async function raiseHighAlert(
  db: ServiceDb,
  input: { kind: string; title: string; targetId?: string; summary?: string }
): Promise<{ logged: boolean; emailed: boolean }> {
  const key = `${input.kind}:${input.targetId ?? input.title.slice(0, 40)}:${new Date().toISOString().slice(0, 13)}`;
  const handle = await startJob(db, `alert:${input.kind}`, key, {
    kind: input.kind,
    target_id: input.targetId ?? null
  });

  const email = await sendTeamAlert({
    subject: `[LKDV Control] Alerte haute — ${input.title}`.slice(0, 140),
    text: [
      input.title,
      input.summary ?? '',
      input.targetId ? `Cible : ${input.targetId}` : '',
      'Ouvrez le CRM, écran À traiter.'
    ]
      .filter(Boolean)
      .join('\n'),
    idempotencyKey: key
  });

  await finishJob(db, handle, 'ok', { kind: input.kind, emailed: email.sent });
  return { logged: true, emailed: email.sent };
}

/** « Je prends » / clôture : toujours via la commande enregistrée, avec le jeton humain. */
export function sosAction(sosId: string, action: 'ack' | 'close', note?: string): { command: string; params: Record<string, unknown> } {
  return { command: 'sos_ack_close', params: { sos_id: sosId, action, ...(note ? { note } : {}) } };
}
