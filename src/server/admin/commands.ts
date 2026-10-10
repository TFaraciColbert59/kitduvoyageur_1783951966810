import 'server-only';

import { createHash } from 'node:crypto';

import { createCommandSchema } from '@/features/admin-os/commands/schemas';
import { PERMISSION_REGISTRY } from '@/server/admin/permissions';

/**
 * Command Engine — SERVEUR UNIQUEMENT.
 * Toute action sensible passe par un enregistrement `admin_commands`
 * idempotent (idempotency_key UNIQUE), avec version optimiste
 * (expected_version → 409 explicite) et correlation_id traçable.
 * P0 : registre + statuts + clé déterministe. Exécution branchée en P1/P2
 * par handlers de domaine (refund, role.grant, flag.update...).
 */

export const COMMAND_STATUS = [
  'drafted',
  'validated',
  'awaiting_approval',
  'approved',
  'executing',
  'succeeded',
  'partially_succeeded',
  'failed',
  'unknown',
  'cancelled',
  'rolled_back',
] as const;

export type CommandStatus = (typeof COMMAND_STATUS)[number];

export interface CommandFingerprint {
  command_key: string;
  resource_type: string;
  resource_id: string;
  reason: string;
}

/** JSON canonique (clés triées) pour clés d'idempotence stables. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(',')}}`;
}

/**
 * Clé d'idempotence déterministe (sha256 hex). Le `payload` métier fait
 * partie de la clé : même motif + montant/statut différent = commandes
 * distinctes ; rejou exact = dédupliqué.
 */
export function buildCommandIdempotencyKey(
  fp: CommandFingerprint,
  payload?: Record<string, unknown>
): string {
  const h = createHash('sha256');
  h.update(
    [
      fp.command_key.trim(),
      fp.resource_type.trim(),
      fp.resource_id.trim(),
      fp.reason.trim(),
      canonicalJson(payload ?? {}),
    ].join('|')
  );
  return h.digest('hex');
}

export interface CreateCommandInput extends CommandFingerprint {
  environment?: 'dev' | 'staging' | 'production';
  risk_tier: 0 | 1 | 2 | 3 | 4;
  idempotency_key?: string;
  expected_version?: number;
  ticket_id?: string;
  correlation_id?: string;
  /** Données métier versionnées (ex. montant) — auditées, jamais de secret. */
  payload?: Record<string, unknown>;
}

export async function createCommand(_input: CreateCommandInput): Promise<{
  command_id: string;
  status: CommandStatus;
}> {
  // /** @internal P1 — stub intentionnel : utiliser persistCommand() + handlers de domaine. */
  throw new Error('not_wired_yet: brancher le handler de domaine en P1/P2');
}

/** Client Supabase minimal requis par `persistCommand` (RLS de l'appelant). */
export interface CommandDb {
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: string): {
        maybeSingle(): Promise<{ data: CommandRow | null; error: { code: string } | null }>;
      };
    };
    insert(row: Record<string, unknown>): {
      select(): {
        single(): Promise<{ data: CommandRow | null; error: { code: string } | null }>;
      };
    };
  };
}

export interface CommandRow {
  id: string;
  status: CommandStatus;
}

/**
 * Persiste une commande (idempotent) : si `idempotency_key` existe déjà,
 * retourne la commande existante sans réécrire (rejeu sûr).
 * Valide contre le registre (clé connue, tier cohérent, reason ≥ 10).
 */
export async function persistCommand(
  db: CommandDb,
  actorId: string,
  input: CreateCommandInput
): Promise<{ command_id: string; status: CommandStatus; deduplicated: boolean }> {
  const parsed = createCommandSchema.safeParse(input);
  if (!parsed.success) throw new Error('invalid_command');
  const def = PERMISSION_REGISTRY[parsed.data.command_key];
  if (!def) throw new Error('unknown_command_key');
  // Source de vérité serveur : le tier du registre, jamais celui du client
  // (un tier client incohérent est ignoré, pas une erreur — deny by default).
  const riskTier = def.tier;

  const lookup = async (): Promise<CommandRow | null> => {
    const existing = await db
      .from('admin_commands')
      .select('id, status')
      .eq('idempotency_key', parsed.data.idempotency_key)
      .maybeSingle();
    if (existing.error) throw new Error('command_lookup_failed');
    return existing.data;
  };

  const found = await lookup();
  if (found) {
    return { command_id: found.id, status: found.status, deduplicated: true };
  }

  const status: CommandStatus = def.requiresApproval ? 'awaiting_approval' : 'validated';
  const { data, error } = await db
    .from('admin_commands')
    .insert({
      command_key: parsed.data.command_key,
      actor_id: actorId,
      resource_type: parsed.data.resource_type,
      resource_id: parsed.data.resource_id,
      environment: parsed.data.environment,
      reason: parsed.data.reason,
      ticket_id: input.ticket_id ?? null,
      risk_tier: riskTier,
      idempotency_key: parsed.data.idempotency_key,
      expected_version: parsed.data.expected_version ?? null,
      requires_approval: def.requiresApproval,
      status,
      payload: input.payload ?? {},
      correlation_id: input.correlation_id ?? null,
    })
    .select()
    .single();
  if (error) {
    // Course check-then-insert : un concurrent a inséré la même clé
    // (UNIQUE idempotency_key, 23505) → relecture = rejouable sans 500.
    if ((error as { code?: string }).code === '23505') {
      const raced = await lookup();
      if (raced) {
        return { command_id: raced.id, status: raced.status, deduplicated: true };
      }
    }
    throw new Error('command_insert_failed');
  }
  if (!data) throw new Error('command_insert_failed');
  return { command_id: data.id, status: data.status, deduplicated: false };
}

export async function previewCommand(
  _commandId: string
): Promise<{ scope: string; count: number }> {
  return { scope: 'empty', count: 0 };
}
