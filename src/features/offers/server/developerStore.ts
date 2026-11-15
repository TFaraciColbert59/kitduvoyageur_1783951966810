import 'server-only';
import { randomBytes } from 'node:crypto';
import {
  createDeveloperKeyRecord,
  isAllowedWebhookCallbackUrl,
  processWebhookDelivery,
  revokeDeveloperKeyRecord,
  type DeveloperApiScope,
  type DeveloperKeyRecord,
  type DeveloperWebhookEventType,
  type DeveloperWebhookSubscription,
  type WebhookOrderingState,
} from '../domain/developerApi';

/**
 * Registre serveur O02 S6.24 (clés API scopées & abonnements webhook).
 */

interface UserDeveloperState {
  keys: DeveloperKeyRecord[];
  webhooks: DeveloperWebhookSubscription[];
  ordering: WebhookOrderingState;
}

const DEV_STORE_KEY = Symbol.for('lkdv.o02.developer.registry');

type DevRegistry = Map<string, UserDeveloperState>;

function registry(): DevRegistry {
  const holder = globalThis as typeof globalThis & { [DEV_STORE_KEY]?: DevRegistry };
  if (!holder[DEV_STORE_KEY]) {
    holder[DEV_STORE_KEY] = new Map<string, UserDeveloperState>();
  }
  return holder[DEV_STORE_KEY];
}

export function resetDeveloperStore(): void {
  registry().clear();
}

function getOrCreateDevState(userId: string): UserDeveloperState {
  const existing = registry().get(userId);
  if (existing) return existing;
  const created: UserDeveloperState = {
    keys: [],
    webhooks: [],
    ordering: {
      processedDeliveryIds: new Set<string>(),
      lastOccurredMsByEntity: new Map<string, number>(),
    },
  };
  registry().set(userId, created);
  return created;
}

export interface SanitizedDeveloperKey {
  id: string;
  clientName: string;
  prefix: string;
  scopes: DeveloperApiScope[];
  rateLimitPerMin: number;
  createdAtIso: string;
  expiresAtIso: string | null;
  revokedAtIso: string | null;
}

function sanitizeKey(record: DeveloperKeyRecord): SanitizedDeveloperKey {
  return {
    id: record.id,
    clientName: record.clientName,
    prefix: record.prefix,
    scopes: record.scopes,
    rateLimitPerMin: record.rateLimitPerMin,
    createdAtIso: record.createdAtIso,
    expiresAtIso: record.expiresAtIso,
    revokedAtIso: record.revokedAtIso,
  };
}

export function listDeveloperKeys(userId: string): SanitizedDeveloperKey[] {
  return getOrCreateDevState(userId).keys.map(sanitizeKey);
}

export function getRawDeveloperKeysForAuth(userId: string): readonly DeveloperKeyRecord[] {
  return getOrCreateDevState(userId).keys;
}

export function issueDeveloperKey(params: {
  userId: string;
  clientName: string;
  scopes: readonly DeveloperApiScope[];
  expiresAtIso?: string | null;
  rateLimitPerMin?: number;
}): { key: SanitizedDeveloperKey; plaintextSecret: string } {
  const state = getOrCreateDevState(params.userId);
  const id = `cli_${randomBytes(6).toString('hex')}`;
  const created = createDeveloperKeyRecord({
    id,
    ownerUserId: params.userId,
    clientName: params.clientName,
    scopes: params.scopes,
    expiresAtIso: params.expiresAtIso ?? null,
    rateLimitPerMin: params.rateLimitPerMin,
  });
  state.keys.push(created.record);
  return {
    key: sanitizeKey(created.record),
    plaintextSecret: created.plaintextSecret,
  };
}

export function revokeDeveloperKey(
  userId: string,
  keyId: string,
): SanitizedDeveloperKey | null {
  const state = getOrCreateDevState(userId);
  const idx = state.keys.findIndex((k) => k.id === keyId);
  if (idx < 0) return null;
  state.keys[idx] = revokeDeveloperKeyRecord(state.keys[idx]);
  return sanitizeKey(state.keys[idx]);
}

export interface SanitizedWebhookSubscription {
  id: string;
  callbackUrl: string;
  events: DeveloperWebhookEventType[];
  active: boolean;
  createdAtIso: string;
  revokedAtIso: string | null;
}

function sanitizeWebhook(sub: DeveloperWebhookSubscription): SanitizedWebhookSubscription {
  return {
    id: sub.id,
    callbackUrl: sub.callbackUrl,
    events: sub.events,
    active: sub.active,
    createdAtIso: sub.createdAtIso,
    revokedAtIso: sub.revokedAtIso,
  };
}

export function listDeveloperWebhooks(userId: string): SanitizedWebhookSubscription[] {
  return getOrCreateDevState(userId).webhooks.map(sanitizeWebhook);
}

export function createDeveloperWebhook(params: {
  userId: string;
  callbackUrl: string;
  events: readonly DeveloperWebhookEventType[];
}): { ok: true; subscription: SanitizedWebhookSubscription; signingSecret: string } | { ok: false; code: string; message: string } {
  if (!isAllowedWebhookCallbackUrl(params.callbackUrl)) {
    return {
      ok: false,
      code: 'invalid_callback_url',
      message: 'URL de callback HTTPS publique requise (adresses locales interdites).',
    };
  }
  const uniqueEvents = Array.from(new Set(params.events));
  if (uniqueEvents.length === 0) {
    return {
      ok: false,
      code: 'empty_events',
      message: 'Sélectionnez au moins un type d’événement.',
    };
  }
  const state = getOrCreateDevState(params.userId);
  const signingSecret = `whsec_${randomBytes(24).toString('hex')}`;
  const sub: DeveloperWebhookSubscription = {
    id: `wh_${randomBytes(6).toString('hex')}`,
    ownerUserId: params.userId,
    callbackUrl: params.callbackUrl.trim(),
    events: uniqueEvents,
    signingSecret,
    active: true,
    createdAtIso: new Date().toISOString(),
    revokedAtIso: null,
  };
  state.webhooks.push(sub);
  return { ok: true, subscription: sanitizeWebhook(sub), signingSecret };
}

export function revokeDeveloperWebhook(
  userId: string,
  webhookId: string,
): SanitizedWebhookSubscription | null {
  const state = getOrCreateDevState(userId);
  const target = state.webhooks.find((w) => w.id === webhookId);
  if (!target) return null;
  target.active = false;
  target.revokedAtIso = target.revokedAtIso ?? new Date().toISOString();
  return sanitizeWebhook(target);
}

export function recordIncomingWebhookForUser(
  userId: string,
  envelope: Parameters<typeof processWebhookDelivery>[1],
) {
  const state = getOrCreateDevState(userId);
  return processWebhookDelivery(state.ordering, envelope);
}
