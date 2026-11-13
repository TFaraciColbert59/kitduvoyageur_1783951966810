import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/db';
import { apiError, isApiError, logServer } from '../lib/errors';
import { hasServiceRole, serviceDb } from './db';
import { finishJob, startJob } from './jobs';
import { completeRequest } from './stripe';

/**
 * Effets externes `delegated` (EX-COM-04, 02_ARCHITECTURE § 6).
 *
 * La base journalise, autorise et marque `delegated:true` ; cette couche exécute
 * l'effet Auth (bannir, suspendre, révoquer les sessions) avec `service_role`,
 * après `approve_request` quand la commande passe par une demande.
 *
 * Règles :
 *  - clé `service_role` absente → statut explicite `delegated_not_executed`,
 *    jamais un succès silencieux ;
 *  - clé d'idempotence = `request_id` (ou `audit_id`) : un rejeu ne double pas ;
 *  - aucun e-mail vers un membre : les commandes d'envoi sont refusées ici ;
 *  - le remboursement Stripe ne passe jamais par ce module (chemin
 *    `approve_request` → `stripe.refunds.create` → `complete_request`).
 */
export type DelegatedStatus = {
  handled: boolean;
  status: 'none' | 'delegated_executed' | 'delegated_not_executed' | 'delegated_refused';
  command: string;
  message: string;
  request_id: string | null;
  target_user_id: string | null;
};

type AuthEffect = 'ban' | 'suspend' | 'revoke';

const AUTH_EFFECTS: Record<string, AuthEffect> = {
  member_ban: 'ban',
  member_suspend: 'suspend',
  member_revoke_sessions: 'revoke'
};

/** Commandes à e-mail : jamais exécutées depuis le CRM (08_GARDE_FOUS § 1.14). */
const EMAIL_COMMANDS = new Set(['announcement_send', 'ticket_email', 'member_email']);

/** Remboursement : uniquement via une demande validée (jamais en direct). */
const REFUND_COMMANDS = new Set(['order_refund', 'order_cancel']);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickTargetUserId(data: Record<string, unknown>): string | null {
  const direct = data.target_user_id ?? data.user_id ?? data.member_id ?? data.id;
  if (typeof direct === 'string' && direct.length >= 8) return direct;
  const target = asRecord(data.target);
  const nested = target.user_id ?? target.id;
  return typeof nested === 'string' && nested.length >= 8 ? nested : null;
}

function durationSql(input: Record<string, unknown>): string {
  const until = input.until ?? input.suspended_until;
  if (typeof until === 'string' && until.length >= 10) {
    const date = new Date(until);
    if (!Number.isNaN(date.getTime())) {
      const hours = Math.max(1, Math.ceil((date.getTime() - Date.now()) / 3_600_000));
      return `${Math.min(hours, 876_000)}h`;
    }
  }
  const days = Number(input.days ?? 7);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), 3650) : 7;
  return `${safeDays * 24}h`;
}

async function revokeSessions(accessToken: string, userId: string): Promise<'revoked' | 'ban_toggle'> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw apiError('brick_disabled');
  const response = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}/logout`, {
    method: 'POST',
    headers: {
      apikey: accessToken,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: '{}',
    signal: AbortSignal.timeout(15_000)
  });
  if (response.ok) return 'revoked';

  // Repli : bannissement bref puis levée — invalide les sessions sans bloquer le compte.
  const db = serviceDb();
  const { error: banError } = await db.auth.admin.updateUserById(userId, { ban_duration: '1s' });
  if (banError) throw apiError('external_failed');
  const { error: unbanError } = await db.auth.admin.updateUserById(userId, { ban_duration: 'none' });
  if (unbanError) throw apiError('external_failed');
  return 'ban_toggle';
}

/**
 * Exécute l'effet externe d'une commande marquée `delegated`.
 * Ne lève jamais : renvoie un statut lisible et journalise.
 */
export async function executeDelegated(params: {
  client: SupabaseClient<Database>;
  command: string;
  data: Record<string, unknown>;
  requestId: string | null;
  auditId?: string | number | null;
}): Promise<DelegatedStatus> {
  const { command, data, requestId } = params;
  const base: DelegatedStatus = {
    handled: false,
    status: 'none',
    command,
    message: '',
    request_id: requestId,
    target_user_id: null
  };

  if (REFUND_COMMANDS.has(command)) {
    if (requestId) await completeRequest(params.client, requestId, { ok: false, error: 'refund_requires_approval' });
    return {
      ...base,
      status: 'delegated_refused',
      message:
        'Un remboursement ne s’exécute jamais en direct : il passe par une demande validée (approve_request → Stripe → complete_request).'
    };
  }

  if (EMAIL_COMMANDS.has(command)) {
    if (requestId) await completeRequest(params.client, requestId, { ok: false, error: 'member_email_forbidden' });
    return {
      ...base,
      status: 'delegated_refused',
      message: 'Envoi d’e-mail à un membre interdit depuis le CRM (alertes d’équipe uniquement).'
    };
  }

  const effect = AUTH_EFFECTS[command];
  if (!effect) {
    return { ...base, handled: false, status: 'none', message: 'Aucun effet externe connu pour cette commande.' };
  }

  const targetUserId = pickTargetUserId(data);
  if (!targetUserId) {
    return {
      ...base,
      status: 'delegated_not_executed',
      message: 'Effet Auth non exécuté : identifiant de compte absent de la réponse de la base.'
    };
  }
  const withTarget: DelegatedStatus = { ...base, target_user_id: targetUserId };

  if (!hasServiceRole()) {
    logServer({
      level: 'warn',
      scope: 'crm',
      event: 'delegated_service_role_missing',
      message: `${command} : service_role absente, effet Auth non exécuté`
    });
    if (requestId) await completeRequest(params.client, requestId, { ok: false, error: 'service_role_absente' });
    return {
      ...withTarget,
      status: 'delegated_not_executed',
      message:
        'Effet Auth non exécuté : la clé service_role est absente. L’action reste à faire par une personne dans Supabase.'
    };
  }

  const db = serviceDb();
  const key = `external:${command}:${requestId ?? params.auditId ?? targetUserId}`;
  const handle = await startJob(db, 'external:delegated', key, { command, request_id: requestId });

  try {
    if (effect === 'revoke') {
      const accessToken = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      const mode = await revokeSessions(accessToken, targetUserId);
      await finishJob(db, handle, 'ok', { command, mode, target_user_id: targetUserId });
      if (requestId) {
        await completeRequest(params.client, requestId, { ok: true, provider: 'auth', mode, command });
      }
      return {
        ...withTarget,
        handled: true,
        status: 'delegated_executed',
        message:
          mode === 'revoked'
            ? 'Sessions révoquées pour ce compte.'
            : 'Sessions invalidées (bannissement bref puis levée).'
      };
    }

    const banDuration = effect === 'ban' ? '876000h' : durationSql(data);
    const { error } = await db.auth.admin.updateUserById(targetUserId, { ban_duration: banDuration });
    if (error) throw apiError('external_failed');

    await finishJob(db, handle, 'ok', { command, ban_duration: banDuration, target_user_id: targetUserId });
    if (requestId) {
      await completeRequest(params.client, requestId, {
        ok: true,
        provider: 'auth',
        command,
        ban_duration: banDuration
      });
    }
    return {
      ...withTarget,
      handled: true,
      status: 'delegated_executed',
      message: effect === 'ban' ? 'Compte banni (connexion refusée).' : 'Compte suspendu jusqu’à la date prévue.'
    };
  } catch (error) {
    const apiErr = isApiError(error) ? error : apiError('external_failed');
    await finishJob(db, handle, 'error', undefined, apiErr.code);
    if (requestId) {
      await completeRequest(params.client, requestId, { ok: false, error: apiErr.code });
    }
    logServer({
      level: 'error',
      scope: 'crm',
      event: 'delegated_failed',
      message: `${command} : ${apiErr.code}`
    });
    return { ...withTarget, handled: true, status: 'delegated_refused', message: apiErr.message };
  }
}
