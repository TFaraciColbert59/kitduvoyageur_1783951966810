import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Contrat O02 S6.24 — API développeurs, clients scopés, expiration, révocation,
 * quotas et webhooks signés (HMAC-SHA256, anti-rejeu, gestion des événements en retard).
 *
 * Ce module vit hors de la navigation grand public LKDV : les jetons bruts ne
 * sont jamais conservés côté serveur (seul leur hash SHA-256 est stocké).
 */

export const DEVELOPER_API_SCOPES = [
  'read:activities',
  'read:routes',
  'write:activities',
  'webhook:events',
] as const;

export type DeveloperApiScope = (typeof DEVELOPER_API_SCOPES)[number];

export interface DeveloperKeyRecord {
  id: string;
  ownerUserId: string;
  clientName: string;
  prefix: string;
  secretHash: string;
  scopes: DeveloperApiScope[];
  rateLimitPerMin: number;
  createdAtIso: string;
  expiresAtIso: string | null;
  revokedAtIso: string | null;
}

export interface CreatedDeveloperKey {
  record: DeveloperKeyRecord;
  /** Affiché une seule fois à la création ; jamais stocké en clair côté serveur. */
  plaintextSecret: string;
}

export function hashDeveloperSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function createDeveloperKeyRecord(params: {
  id: string;
  ownerUserId: string;
  clientName: string;
  scopes: readonly DeveloperApiScope[];
  rateLimitPerMin?: number;
  expiresAtIso?: string | null;
  nowIso?: string;
}): CreatedDeveloperKey {
  const cleanName = params.clientName.trim().slice(0, 60);
  if (!cleanName) {
    throw new Error('invalid_client_name');
  }
  const uniqueScopes = Array.from(new Set(params.scopes)).filter((s): s is DeveloperApiScope =>
    (DEVELOPER_API_SCOPES as readonly string[]).includes(s),
  );
  if (uniqueScopes.length === 0) {
    throw new Error('empty_scopes');
  }

  const rawSecret = `lkdv_live_${randomBytes(24).toString('hex')}`;
  const record: DeveloperKeyRecord = {
    id: params.id,
    ownerUserId: params.ownerUserId,
    clientName: cleanName,
    prefix: rawSecret.slice(0, 16),
    secretHash: hashDeveloperSecret(rawSecret),
    scopes: uniqueScopes,
    rateLimitPerMin: Math.max(10, Math.min(600, params.rateLimitPerMin ?? 60)),
    createdAtIso: params.nowIso ?? new Date().toISOString(),
    expiresAtIso: params.expiresAtIso ?? null,
    revokedAtIso: null,
  };

  return { record, plaintextSecret: rawSecret };
}

export function revokeDeveloperKeyRecord(
  record: DeveloperKeyRecord,
  nowIso: string = new Date().toISOString(),
): DeveloperKeyRecord {
  return {
    ...record,
    revokedAtIso: record.revokedAtIso ?? nowIso,
  };
}

export type DeveloperAuthFailureReason =
  | 'invalid_token'
  | 'revoked'
  | 'expired'
  | 'insufficient_scope'
  | 'rate_limited';

export type DeveloperAuthResult =
  | {
      ok: true;
      clientId: string;
      ownerUserId: string;
      scopes: DeveloperApiScope[];
      remainingQuota: number;
    }
  | {
      ok: false;
      reason: DeveloperAuthFailureReason;
      message: string;
    };

export function authorizeDeveloperRequest(params: {
  presentedSecret: string;
  records: readonly DeveloperKeyRecord[];
  requiredScope: DeveloperApiScope;
  requestsInCurrentWindow?: number;
  nowIso?: string;
}): DeveloperAuthResult {
  const presented = params.presentedSecret.trim();
  if (!presented.startsWith('lkdv_live_')) {
    return { ok: false, reason: 'invalid_token', message: 'Format de clé API invalide.' };
  }

  const presentedHash = hashDeveloperSecret(presented);
  const matched = params.records.find((r) => {
    const a = Buffer.from(r.secretHash, 'hex');
    const b = Buffer.from(presentedHash, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  });

  if (!matched) {
    return { ok: false, reason: 'invalid_token', message: 'Clé API inconnue.' };
  }

  if (matched.revokedAtIso) {
    return { ok: false, reason: 'revoked', message: 'Clé API révoquée.' };
  }

  const nowMs = Date.parse(params.nowIso ?? new Date().toISOString());
  if (matched.expiresAtIso) {
    const expMs = Date.parse(matched.expiresAtIso);
    if (Number.isFinite(expMs) && expMs <= nowMs) {
      return { ok: false, reason: 'expired', message: 'Clé API expirée.' };
    }
  }

  if (!matched.scopes.includes(params.requiredScope)) {
    return {
      ok: false,
      reason: 'insufficient_scope',
      message: `Portée requise manquante : ${params.requiredScope}.`,
    };
  }

  const used = params.requestsInCurrentWindow ?? 0;
  if (used >= matched.rateLimitPerMin) {
    return {
      ok: false,
      reason: 'rate_limited',
      message: 'Quota horaire / minute atteint pour ce client.',
    };
  }

  return {
    ok: true,
    clientId: matched.id,
    ownerUserId: matched.ownerUserId,
    scopes: matched.scopes,
    remainingQuota: Math.max(0, matched.rateLimitPerMin - used - 1),
  };
}

export type DeveloperWebhookEventType =
  | 'activity.created'
  | 'activity.updated'
  | 'activity.deleted'
  | 'route.updated'
  | 'consent.revoked';

export interface DeveloperWebhookSubscription {
  id: string;
  ownerUserId: string;
  callbackUrl: string;
  events: DeveloperWebhookEventType[];
  signingSecret: string;
  active: boolean;
  createdAtIso: string;
  revokedAtIso: string | null;
}

export function isAllowedWebhookCallbackUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      /^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function signWebhookPayload(
  payloadJson: string,
  secret: string,
  timestampSec: number,
): string {
  const mac = createHmac('sha256', secret)
    .update(`${timestampSec}.${payloadJson}`, 'utf8')
    .digest('hex');
  return `t=${timestampSec},v1=${mac}`;
}

export function verifyWebhookSignature(params: {
  payloadJson: string;
  signatureHeader: string;
  secret: string;
  nowSec?: number;
  toleranceSec?: number;
}): { valid: boolean; reason?: 'malformed_header' | 'replay_window_exceeded' | 'signature_mismatch' } {
  const parts = params.signatureHeader.split(',').map((p) => p.trim());
  const tPart = parts.find((p) => p.startsWith('t='));
  const v1Part = parts.find((p) => p.startsWith('v1='));
  if (!tPart || !v1Part) {
    return { valid: false, reason: 'malformed_header' };
  }

  const ts = Number(tPart.slice(2));
  const sigHex = v1Part.slice(3);
  if (!Number.isFinite(ts) || !/^[0-9a-f]{64}$/i.test(sigHex)) {
    return { valid: false, reason: 'malformed_header' };
  }

  const nowSec = params.nowSec ?? Math.floor(Date.now() / 1000);
  const tolerance = params.toleranceSec ?? 300;
  if (Math.abs(nowSec - ts) > tolerance) {
    return { valid: false, reason: 'replay_window_exceeded' };
  }

  const expectedHex = createHmac('sha256', params.secret)
    .update(`${ts}.${params.payloadJson}`, 'utf8')
    .digest('hex');

  const actualBuf = Buffer.from(sigHex, 'hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    return { valid: false, reason: 'signature_mismatch' };
  }

  return { valid: true };
}

export interface IncomingWebhookEnvelope {
  deliveryId: string;
  entityId: string;
  eventType: DeveloperWebhookEventType;
  occurredAtMs: number;
}

export interface WebhookOrderingState {
  processedDeliveryIds: Set<string>;
  lastOccurredMsByEntity: Map<string, number>;
}

/**
 * Traite un événement webhook de façon idempotente en rejetant les doublons (rejeu)
 * et en signalant les événements arrivés en retard (hors ordre chronologique).
 */
export function processWebhookDelivery(
  state: WebhookOrderingState,
  envelope: IncomingWebhookEnvelope,
): { status: 'applied' | 'duplicate_replayed' | 'stale_out_of_order' } {
  if (state.processedDeliveryIds.has(envelope.deliveryId)) {
    return { status: 'duplicate_replayed' };
  }
  state.processedDeliveryIds.add(envelope.deliveryId);

  const lastMs = state.lastOccurredMsByEntity.get(envelope.entityId);
  if (lastMs !== undefined && envelope.occurredAtMs < lastMs) {
    return { status: 'stale_out_of_order' };
  }

  state.lastOccurredMsByEntity.set(envelope.entityId, envelope.occurredAtMs);
  return { status: 'applied' };
}
