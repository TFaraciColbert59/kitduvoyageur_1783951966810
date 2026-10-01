import 'server-only';

import { createHash, createHmac, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { validateBookingSearchRequest } from './bookingSchemas';
import {
  BOOKING_PROVIDER_ERROR_CODES,
  BookingProviderError,
  normalizeBookingProviderError,
} from './bookingProviderErrors';
import {
  resolveProviderCredentials,
  type ResolvedProviderCredentials,
} from './providerCredentials';
import type {
  BookingCandidate,
  BookingProvider,
  BookingProviderEnv,
  BookingSearchRequest,
  BookingSearchResult,
  BookingVertical,
  CheckoutContext,
  CheckoutMode,
  CheckoutResult,
} from './bookingProviderTypes';

const DEFAULT_MCP_URL = 'https://mcp.routestack.ai/sse';
const DEFAULT_LIMIT = 5;
const DEFAULT_DRIVER_AGE = 30;
const PARTNER_TOKEN_TIMEOUT_MS = 10_000;
const MCP_CONNECT_TIMEOUT_MS = 8_000;
const MCP_TOOL_TIMEOUT_MS = 12_000;
const SESSION_TTL_MS = 5 * 60 * 1_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_TRAVERSAL_NODES = 5_000;
const MAX_TRAVERSAL_DEPTH = 24;
const MAX_ARRAY_ITEMS = 1_000;
const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 600;
const MAX_ID_LENGTH = 160;
const ROUTESTACK_MCP_HOSTS = new Set(['mcp.routestack.ai', 'routestack.ai', 'www.routestack.ai']);
// Hôte sandbox officiel, en plus de l'hôte live. Ajout explicite, jamais un
// suffixe large : l'allowlist reste une liste close (D-21).
const ROUTESTACK_SANDBOX_MCP_HOST = 'evolvemcp.routestack.ai';
const ROUTESTACK_LINK_SUFFIX = '.routestack.ai';
const DEFAULT_MCP_PATH = '/sse';
const CHECKOUT_TOOL = 'get-payment-url';

export interface RouteStackToolResult {
  content?: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

export interface RouteStackCallOptions {
  signal?: AbortSignal;
  /** Alias interne conservé pour les appels de test. */
  timeoutMs?: number;
  /** Option officielle du SDK MCP. */
  timeout?: number;
}

export type RouteStackToolCaller = (
  name: string,
  args: Record<string, unknown>,
  options?: RouteStackCallOptions
) => Promise<RouteStackToolResult>;

interface RouteStackProviderOptions {
  env?: BookingProviderEnv;
  callTool?: RouteStackToolCaller;
  now?: () => Date;
}

interface RouteStackSession {
  client: {
    connect(transport: unknown, options?: { signal?: AbortSignal; timeout?: number }): Promise<void>;
    callTool(
      input: { name: string; arguments?: Record<string, unknown> },
      resultSchema?: unknown,
      options?: RouteStackCallOptions
    ): Promise<unknown>;
    close(): Promise<void>;
  };
}

interface RouteStackSessionEntry {
  session: RouteStackSession;
  expiresAt: number;
}

const routeStackSessions = new Map<string, RouteStackSessionEntry>();
const routeStackConnecting = new Map<string, Promise<RouteStackSession>>();

const routeStackRecordSchema = z.record(z.string(), z.unknown());

/**
 * Fail-closed (D-07) : un mode live demandé sans ses identifiants est
 * `disabled`, jamais ramené au sandbox. L'erreur est levée au moment de
 * l'usage pour que la construction d'un fournisseur reste sans effet de bord.
 */
function requireRouteStackCredentials(env: BookingProviderEnv): ResolvedProviderCredentials {
  const resolved = resolveProviderCredentials('routestack', env);
  if (resolved.mode === 'disabled' || !resolved.apiKey) {
    throw new BookingProviderError({
      code: BOOKING_PROVIDER_ERROR_CODES.config,
      provider: 'routestack',
      message: resolved.message,
    });
  }
  return resolved;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === 'ip6-localhost' || host === '0.0.0.0' || host === '::1') return true;
  if (host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.')) return true;
  const rfc1918 = host.match(/^172\.(\d{1,3})\./);
  return Boolean(rfc1918 && Number(rfc1918[1]) >= 16 && Number(rfc1918[1]) <= 31);
}

function isAllowedMcpHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ROUTESTACK_MCP_HOSTS.has(host) || host === ROUTESTACK_SANDBOX_MCP_HOST;
}

function isAllowedDeeplink(value: unknown, env: BookingProviderEnv): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    const configured = (env.ROUTESTACK_ALLOWED_LINK_HOSTS || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const allowed =
      host === 'routestack.ai' ||
      host.endsWith(ROUTESTACK_LINK_SUFFIX) ||
      configured.includes(host);
    return allowed ? url.toString() : null;
  } catch {
    return null;
  }
}

function resolveMcpUrl(env: BookingProviderEnv): URL {
  // La base vient désormais du contrat de credentials : une seule source de
  // vérité pour le choix du slot (sandbox vs live).
  const raw = resolveProviderCredentials('routestack', env).baseUrl?.trim() || DEFAULT_MCP_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch (error) {
    throw new BookingProviderError({
      code: BOOKING_PROVIDER_ERROR_CODES.config,
      provider: 'routestack',
      message: 'La base RouteStack configurée est invalide.',
      cause: error,
    });
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !isAllowedMcpHost(url.hostname) ||
    (url.port !== '' && url.port !== '443') ||
    isPrivateHost(url.hostname)
  ) {
    throw new BookingProviderError({
      code: BOOKING_PROVIDER_ERROR_CODES.config,
      provider: 'routestack',
      message: 'La base RouteStack doit être une URL HTTPS sur un hôte RouteStack autorisé.',
    });
  }
  // Une base réduite à son origine (sandbox) reçoit l'endpoint MCP par défaut.
  if (url.pathname === '/') url.pathname = DEFAULT_MCP_PATH;
  return url;
}

function toolNameForVertical(vertical: BookingVertical): string {
  if (vertical === 'flight') return 'flight_search';
  if (vertical === 'hotel') return 'hotel_search';
  if (vertical === 'car') return 'car_search';
  throw new BookingProviderError({
    code: BOOKING_PROVIDER_ERROR_CODES.validation,
    provider: 'routestack',
    message: 'Les activités ne sont pas exposées par RouteStack.',
  });
}

/**
 * Mode de checkout. Une valeur inconnue retombe sur `deeplink` : c'est le mode
 * qui degrace le moins (un lien ouvrable) plutot qu'un checkout sans sortie.
 */
function resolveCheckoutMode(env: BookingProviderEnv): Exclude<CheckoutMode, 'external'> {
  const requested = (env.ROUTESTACK_CHECKOUT_MODE ?? '').trim().toLowerCase();
  return requested === 'acp' ? 'acp' : 'deeplink';
}

/** Cherche l'URL de paiement sans faire confiance a la forme de la reponse. */
function extractCheckoutUrl(payload: unknown, env: BookingProviderEnv): string | null {
  if (!isRecord(payload)) return null;
  const direct = [
    payload.url,
    payload.paymentUrl,
    payload.payment_url,
    payload.checkoutUrl,
    payload.checkout_url,
    payload.redirectUrl,
    payload.redirect_url,
    isRecord(payload.data) ? payload.data.url : undefined,
  ].find((value) => typeof value === 'string' && value.length > 0);
  return isAllowedDeeplink(direct, env);
}

function readErrorStatus(error: unknown): number | null {
  if (!isRecord(error)) return null;
  for (const key of ['status', 'code']) {
    const value = error[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, MAX_TITLE_LENGTH * 4);
  }
  return null;
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }
  return null;
}

function readNestedNumber(record: Record<string, unknown>, keys: string[]): number | null {
  const direct = readNumber(record, keys);
  if (direct != null) return direct;
  for (const key of ['price_prepaid', 'price_postpaid', 'price', 'display_price', 'total']) {
    const nested = record[key];
    if (isRecord(nested)) {
      const value = readNumber(nested, keys);
      if (value != null) return value;
    }
  }
  return null;
}

function findRecords(value: unknown, preferredKeys: string[]): Record<string, unknown>[] {
  const visited = new Set<unknown>();
  const queue: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let cursor = 0;
  let nodes = 0;

  while (cursor < queue.length && nodes < MAX_TRAVERSAL_NODES) {
    const current = queue[cursor++];
    nodes += 1;
    if (!current || current.depth > MAX_TRAVERSAL_DEPTH || visited.has(current.value)) continue;
    visited.add(current.value);

    if (Array.isArray(current.value)) {
      const records = current.value.slice(0, MAX_ARRAY_ITEMS).filter(isRecord);
      if (records.length > 0) return records;
      for (const item of current.value.slice(0, MAX_ARRAY_ITEMS)) {
        queue.push({ value: item, depth: current.depth + 1 });
      }
      continue;
    }
    if (!isRecord(current.value)) continue;

    for (const key of preferredKeys) {
      const candidate = current.value[key];
      if (Array.isArray(candidate) && candidate.some(isRecord)) {
        return candidate.slice(0, MAX_ARRAY_ITEMS).filter(isRecord);
      }
    }
    for (const item of Object.values(current.value).slice(0, MAX_ARRAY_ITEMS)) {
      queue.push({ value: item, depth: current.depth + 1 });
    }
  }
  return isRecord(value) ? [value] : [];
}

function findString(payload: unknown, keys: string[]): string | null {
  const visited = new Set<unknown>();
  const queue: Array<{ value: unknown; depth: number }> = [{ value: payload, depth: 0 }];
  let cursor = 0;
  let nodes = 0;
  while (cursor < queue.length && nodes < MAX_TRAVERSAL_NODES) {
    const current = queue[cursor++];
    nodes += 1;
    if (!current || current.depth > MAX_TRAVERSAL_DEPTH || visited.has(current.value)) continue;
    visited.add(current.value);
    if (isRecord(current.value)) {
      const direct = readString(current.value, keys);
      if (direct) return direct;
      for (const item of Object.values(current.value).slice(0, MAX_ARRAY_ITEMS)) {
        queue.push({ value: item, depth: current.depth + 1 });
      }
    } else if (Array.isArray(current.value)) {
      for (const item of current.value.slice(0, MAX_ARRAY_ITEMS)) {
        queue.push({ value: item, depth: current.depth + 1 });
      }
    }
  }
  return null;
}

function normalizeCurrency(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function flightTitle(
  record: Record<string, unknown>,
  requestOrigin: string,
  requestDestination: string
): string {
  const segments = Array.isArray(record.flights) ? record.flights.filter(isRecord) : [];
  const first = segments[0];
  const last = segments[segments.length - 1];
  const origin = readString(first ?? {}, ['from', 'origin', 'departure']) ?? requestOrigin;
  const destination = readString(last ?? {}, ['to', 'destination', 'arrival']) ?? requestDestination;
  return `${origin} → ${destination}`;
}

function fallbackTitle(record: Record<string, unknown>, request: BookingSearchRequest): string | null {
  if (request.vertical === 'flight') return flightTitle(record, request.origin, request.destination);
  if (request.vertical === 'hotel') {
    return readString(record, ['city', 'destination', 'name']) ?? `Hôtel · ${request.destination}`;
  }
  if (request.vertical === 'car') {
    return readString(record, ['vehicleName', 'carType', 'model']) ?? `Location de voiture · ${request.destination}`;
  }
  return null;
}

function stableFallbackId(record: Record<string, unknown>): string {
  return `rs_${createHash('sha256').update(JSON.stringify(record)).digest('hex').slice(0, 24)}`;
}

function normalizeOffers(
  payload: unknown,
  request: BookingSearchRequest,
  env: BookingProviderEnv
): BookingCandidate[] {
  const preferredKeys =
    request.vertical === 'flight'
      ? ['result', 'results', 'offers', 'items']
      : request.vertical === 'hotel'
        ? ['result', 'hotels', 'results', 'items', 'properties']
        : ['result', 'cars', 'vehicles', 'results', 'items', 'data'];
  const records = findRecords(payload, preferredKeys);
  const payloadCurrency = findString(payload, ['currency', 'currencyCode']);
  const limit = request.limit ?? DEFAULT_LIMIT;
  const seen = new Set<string>();
  const offers: BookingCandidate[] = [];

  for (const raw of records) {
    const parsed = routeStackRecordSchema.safeParse(raw);
    if (!parsed.success) continue;
    const record = parsed.data;
    const rawId = readString(record, [
      'id',
      'offer_id',
      'offerId',
      'code',
      'productCode',
      'hotelId',
      'fareSourceCode',
      'fareCode',
      'vehicleId',
    ]);
    const id = (rawId ?? stableFallbackId(record)).slice(0, MAX_ID_LENGTH);
    const providerTitle = readString(record, [
      'name',
      'title',
      'hotelName',
      'vehicleName',
      'carType',
      'description',
    ]);
    const title = (providerTitle ?? fallbackTitle(record, request))?.slice(0, MAX_TITLE_LENGTH);
    if (!title || seen.has(id)) continue;

    const rawDeeplink = record.deeplink ?? record.booking_url ?? record.checkoutUrl ?? record.url;
    const deeplink = isAllowedDeeplink(rawDeeplink, env);
    const description = readString(record, ['description', 'summary', 'address']);
    const amount = readNestedNumber(record, [
      'amount',
      'price',
      'ourprice',
      'showOurprice',
      'display_price',
      'show_display_price',
      'convertedCoin',
      'total_price',
      'totalFare',
      'publishedRate',
      'rate',
    ]);
    const currency = normalizeCurrency(readString(record, ['currency', 'currencyCode']) ?? payloadCurrency);

    seen.add(id);
    offers.push({
      id,
      provider: 'routestack',
      vertical: request.vertical,
      title,
      ...(providerTitle ? {} : { untitled: true }),
      description: description?.slice(0, MAX_DESCRIPTION_LENGTH) ?? null,
      amount,
      currency,
      deeplink,
      bookingKind: deeplink ? 'deeplink' : 'revalidation',
      requiresRevalidation: true,
      providerReference: rawId ? rawId.slice(0, MAX_ID_LENGTH) : null,
      metadata: {
        source: 'routestack',
        searchVertical: request.vertical,
        revalidationRequired: true,
      },
    });
    if (offers.length >= limit) break;
  }
  return offers;
}

async function readResponseTextLimited(response: Response): Promise<string> {
  const contentLength = response.headers?.get?.('content-length');
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new BookingProviderError({
      code: BOOKING_PROVIDER_ERROR_CODES.upstream,
      provider: 'routestack',
      message: 'Réponse RouteStack trop volumineuse.',
    });
  }
  if (typeof response.text !== 'function') {
    return JSON.stringify(await response.json());
  }
  const body = response.body;
  if (!body || typeof body.getReader !== 'function') {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new BookingProviderError({
        code: BOOKING_PROVIDER_ERROR_CODES.upstream,
        provider: 'routestack',
        message: 'Réponse RouteStack trop volumineuse.',
      });
    }
    return text;
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (chunk.value) {
        total += chunk.value.byteLength;
        if (total > MAX_RESPONSE_BYTES) {
          await reader.cancel().catch(() => undefined);
          throw new BookingProviderError({
            code: BOOKING_PROVIDER_ERROR_CODES.upstream,
            provider: 'routestack',
            message: 'Réponse RouteStack trop volumineuse.',
          });
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock?.();
  }
}

async function readJsonLimited(response: Response): Promise<unknown> {
  const text = await readResponseTextLimited(response);
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new BookingProviderError({
      code: BOOKING_PROVIDER_ERROR_CODES.upstream,
      provider: 'routestack',
      message: 'Réponse RouteStack non JSON.',
      cause: error,
    });
  }
}

function parseToolPayload(result: RouteStackToolResult): unknown {
  if (result.isError) {
    throw new BookingProviderError({
      code: BOOKING_PROVIDER_ERROR_CODES.upstream,
      provider: 'routestack',
      message: 'RouteStack a renvoyé une erreur.',
      retryable: true,
    });
  }
  for (const item of result.content ?? []) {
    if (item.type !== 'text' || typeof item.text !== 'string') continue;
    if (Buffer.byteLength(item.text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new BookingProviderError({
        code: BOOKING_PROVIDER_ERROR_CODES.upstream,
        provider: 'routestack',
        message: 'Réponse RouteStack trop volumineuse.',
      });
    }
    try {
      return JSON.parse(item.text) as unknown;
    } catch {
      continue;
    }
  }
  throw new BookingProviderError({
    code: BOOKING_PROVIDER_ERROR_CODES.upstream,
    provider: 'routestack',
    message: 'Réponse RouteStack vide ou non JSON.',
  });
}

export function createRouteStackSessionKey(env: BookingProviderEnv): string {
  const resolved = resolveProviderCredentials('routestack', env);
  const url = resolved.baseUrl?.trim() || DEFAULT_MCP_URL;
  const apiKey = resolved.apiKey?.trim() || '';
  return createHash('sha256').update(url).update('\0').update(apiKey).digest('hex');
}

async function getPartnerToken(env: BookingProviderEnv): Promise<string> {
  const resolved = requireRouteStackCredentials(env);
  const apiKey = resolved.apiKey;
  if (!apiKey) {
    throw new BookingProviderError({
      code: BOOKING_PROVIDER_ERROR_CODES.config,
      provider: 'routestack',
      message: resolved.message,
    });
  }
  const secret = resolved.secret?.trim();
  if (!secret) return apiKey;

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = randomUUID();
  const hmac = createHmac('sha256', secret)
    .update(`${apiKey}:${timestamp}:${nonce}`)
    .digest('base64url');
  const mcpUrl = resolveMcpUrl(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PARTNER_TOKEN_TIMEOUT_MS);

  try {
    const response = await fetch(new URL('/mcp/auth/partner-token', mcpUrl.origin), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey, hmac, timestamp, nonce }),
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new BookingProviderError({
        code: BOOKING_PROVIDER_ERROR_CODES.auth,
        provider: 'routestack',
        status: response.status,
        message: 'Authentification RouteStack refusée.',
      });
    }
    const payload = await readJsonLimited(response);
    const record = isRecord(payload) ? payload : {};
    const token = [record.token, record.accessToken, record.partnerToken, record.jwt].find(
      (value): value is string => typeof value === 'string' && value.length > 0
    );
    if (!token) {
      throw new BookingProviderError({
        code: BOOKING_PROVIDER_ERROR_CODES.auth,
        provider: 'routestack',
        message: 'Jeton partenaire RouteStack manquant.',
      });
    }
    return token;
  } catch (error) {
    if (error instanceof BookingProviderError) throw error;
    if (error instanceof Error && (error.name === 'AbortError' || controller.signal.aborted)) {
      throw new BookingProviderError({
        code: BOOKING_PROVIDER_ERROR_CODES.timeout,
        provider: 'routestack',
        message: 'Délai d’authentification RouteStack dépassé.',
        retryable: true,
        cause: error,
      });
    }
    throw normalizeBookingProviderError(error, 'routestack');
  } finally {
    clearTimeout(timeout);
  }
}

async function closeWithDeadline(session: RouteStackSession): Promise<void> {
  await Promise.race([
    session.client.close().catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
  ]);
}

async function connectWithDeadline(
  client: RouteStackSession['client'],
  transport: unknown
): Promise<void> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve(client.connect(transport, {
        signal: controller.signal,
        timeout: MCP_CONNECT_TIMEOUT_MS,
      })),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('RouteStack MCP connection timeout'));
        }, MCP_CONNECT_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new BookingProviderError({
        code: BOOKING_PROVIDER_ERROR_CODES.timeout,
        provider: 'routestack',
        message: 'Délai de connexion RouteStack dépassé.',
        retryable: true,
        cause: error,
      });
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function createConnectedSession(env: BookingProviderEnv): Promise<RouteStackSession> {
  const token = await getPartnerToken(env);
  const url = resolveMcpUrl(env);
  const [{ Client }, { StreamableHTTPClientTransport }, { SSEClientTransport }] = await Promise.all([
    import('@modelcontextprotocol/sdk/client/index.js'),
    import('@modelcontextprotocol/sdk/client/streamableHttp.js'),
    import('@modelcontextprotocol/sdk/client/sse.js'),
  ]);
  const headers = { Authorization: `Bearer ${token}` };
  const client = new Client({ name: 'lkdv-booking', version: '1.0.0' });

  try {
    await connectWithDeadline(client as unknown as RouteStackSession['client'], new StreamableHTTPClientTransport(url, { requestInit: { headers } }));
    return { client: client as unknown as RouteStackSession['client'] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const transportMismatch = /404|405|not found|method not allowed|timed out|timeout/i.test(message);
    await closeWithDeadline({ client: client as unknown as RouteStackSession['client'] });
    if (!transportMismatch) throw normalizeBookingProviderError(error, 'routestack');

    const fallbackClient = new Client({ name: 'lkdv-booking', version: '1.0.0' });
    try {
      await connectWithDeadline(fallbackClient as unknown as RouteStackSession['client'], new SSEClientTransport(url, { requestInit: { headers } }));
      return { client: fallbackClient as unknown as RouteStackSession['client'] };
    } catch (fallbackError) {
      await closeWithDeadline({ client: fallbackClient as unknown as RouteStackSession['client'] });
      throw normalizeBookingProviderError(fallbackError, 'routestack');
    }
  }
}

async function connectRouteStackSession(env: BookingProviderEnv): Promise<RouteStackSession> {
  const key = createRouteStackSessionKey(env);
  const current = routeStackSessions.get(key);
  if (current && current.expiresAt > Date.now()) return current.session;
  if (current) {
    routeStackSessions.delete(key);
    await closeWithDeadline(current.session);
  }

  const pending = routeStackConnecting.get(key);
  if (pending) return pending;

  const connecting = createConnectedSession(env)
    .then((session) => {
      routeStackSessions.set(key, { session, expiresAt: Date.now() + SESSION_TTL_MS });
      return session;
    })
    .finally(() => routeStackConnecting.delete(key));
  routeStackConnecting.set(key, connecting);
  return connecting;
}

async function invalidateRouteStackSession(env: BookingProviderEnv, session: RouteStackSession): Promise<void> {
  const key = createRouteStackSessionKey(env);
  const current = routeStackSessions.get(key);
  if (current?.session === session) routeStackSessions.delete(key);
  await closeWithDeadline(session);
}

function createDefaultToolCaller(env: BookingProviderEnv): RouteStackToolCaller {
  return async (name, args, options) => {
    const session = await connectRouteStackSession(env);
    const timeoutMs = options?.timeoutMs ?? MCP_TOOL_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const forwardAbort = () => controller.abort();
    options?.signal?.addEventListener('abort', forwardAbort, { once: true });
    try {
      const result = await session.client.callTool(
        { name, arguments: args },
        undefined,
        { signal: controller.signal, timeout: options?.timeout ?? timeoutMs }
      );
      return result as RouteStackToolResult;
    } catch (error) {
      await invalidateRouteStackSession(env, session);
      if (error instanceof Error && (error.name === 'AbortError' || controller.signal.aborted)) {
        throw new BookingProviderError({
          code: BOOKING_PROVIDER_ERROR_CODES.timeout,
          provider: 'routestack',
          message: 'Délai RouteStack dépassé.',
          retryable: true,
          cause: error,
        });
      }
      throw error;
    } finally {
      clearTimeout(timer);
      options?.signal?.removeEventListener('abort', forwardAbort);
    }
  };
}

interface ResolvedLocation {
  id: string;
  code: string;
}

async function resolveLocation(
  callTool: RouteStackToolCaller,
  vertical: BookingVertical,
  value: string
): Promise<ResolvedLocation> {
  const trimmed = value.trim();
  if (vertical === 'flight' && /^[A-Z]{3,4}$/i.test(trimmed)) {
    return { id: trimmed.toUpperCase(), code: trimmed.toUpperCase() };
  }
  if (vertical !== 'flight' && /^\d+$/.test(trimmed)) {
    return { id: trimmed, code: trimmed };
  }
  const tool = vertical === 'flight' ? 'flight_locations' : vertical === 'hotel' ? 'hotel_search_destinations' : 'car_locations';
  const payload = parseToolPayload(await callTool(tool, { query: trimmed }));
  const records = findRecords(payload, ['result', 'results', 'locations', 'destinations', 'data']);
  const record = records[0];
  if (!record) {
    throw new BookingProviderError({
      code: BOOKING_PROVIDER_ERROR_CODES.validation,
      provider: 'routestack',
      message: `Destination RouteStack non résolue : ${trimmed}.`,
    });
  }
  const id = readString(record, ['id', 'destinationId', 'destination_id', 'code', 'iata', 'locationId']);
  if (!id) {
    throw new BookingProviderError({
      code: BOOKING_PROVIDER_ERROR_CODES.validation,
      provider: 'routestack',
      message: `Destination RouteStack sans identifiant : ${trimmed}.`,
    });
  }
  return { id, code: readString(record, ['code', 'iata', 'id']) ?? id };
}

async function argumentsForRequest(
  request: BookingSearchRequest,
  callTool: RouteStackToolCaller
): Promise<Record<string, unknown>> {
  const travelers = request.travelers ?? 1;
  const currency = request.currency ?? 'EUR';
  const limit = request.limit ?? DEFAULT_LIMIT;
  if (request.vertical === 'flight') {
    const origin = await resolveLocation(callTool, 'flight', request.origin);
    const destination = await resolveLocation(callTool, 'flight', request.destination);
    return {
      filter: {
        origin: origin.code,
        destination: destination.code,
        departureDate: request.departure,
        ...(request.return ? { returnDate: request.return } : {}),
        adults: travelers,
        cabinClass: 'economy',
        tripType: request.return ? 'round_trip' : 'one_way',
      },
    };
  }
  if (request.vertical === 'hotel') {
    const destination = await resolveLocation(callTool, 'hotel', request.destination);
    return {
      destinationId: destination.id,
      checkIn: request.checkIn,
      checkOut: request.checkOut,
      rooms: [{ adults: travelers, children: 0 }],
      lat: 0,
      long: 0,
      currency,
      page: 1,
      limit,
    };
  }
  if (request.vertical === 'car') {
    const destination = await resolveLocation(callTool, 'car', request.destination);
    return {
      filter: {
        pickup: { type: 'city', code: destination.code },
        dropoff: { type: 'city', code: destination.code },
        pickupDate: request.pickupAt,
        dropoffDate: request.dropoffAt,
        driverAge: DEFAULT_DRIVER_AGE,
      },
    };
  }
  throw new BookingProviderError({
    code: BOOKING_PROVIDER_ERROR_CODES.validation,
    provider: 'routestack',
    message: 'Vertical RouteStack non supportée.',
  });
}

/**
 * Metadata de checkout : valeurs primitives uniquement, cles stables. Un objet
 * metier libre aurait pu contenir une cle sensible transmise a un tiers ; on
 * n'accepte que ces trois champs, construits ici.
 */
function sanitizeCheckoutMetadata(
  input: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> {
  return {
    trip_id: input.trip_id,
    vertical: input.vertical,
    campaign: input.campaign,
  };
}

/**
 * Un 401 signifie « jeton expire », pas « acces refuse » : on retente une
 * seule fois. Un 402 est un etat (credits epuises) : le remonter en quota
 * plutot que boucler, sinon chaque tentative aggrave le blocage.
 */
async function callWithAuthRetry(
  callTool: RouteStackToolCaller,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  try {
    return parseToolPayload(await callTool(name, args));
  } catch (error) {
    const status = readErrorStatus(error);
    if (status === 402) {
      throw new BookingProviderError({
        code: BOOKING_PROVIDER_ERROR_CODES.quota,
        provider: 'routestack',
        status,
        message: 'Quota RouteStack épuisé.',
      });
    }
    if (status === 401 || status === 403) {
      try {
        return parseToolPayload(await callTool(name, args));
      } catch (retryError) {
        throw normalizeBookingProviderError(retryError, 'routestack');
      }
    }
    throw normalizeBookingProviderError(error, 'routestack');
  }
}

/**
 * Reconstruction minimale d'une requete de recherche depuis les metadonnees
 * d'un candidat. Volontairement partielle : si un champ necessaire manque, on
 * renvoie `null` et le candidat reste marque a revalider plutot que d'etre
 * reinterroge avec des hypotheses.
 */
function searchRequestFromCandidate(candidate: BookingCandidate): BookingSearchRequest | null {
  const meta = candidate.metadata;
  const text = (key: string): string | undefined => {
    const value = meta[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };
  const travelers = typeof meta.travelers === 'number' ? meta.travelers : undefined;
  const currency = text('currency');
  const shared = {
    ...(travelers !== undefined ? { travelers } : {}),
    ...(currency ? { currency } : {}),
    limit: DEFAULT_LIMIT,
  };

  if (candidate.vertical === 'flight') {
    const origin = text('origin');
    const destination = text('destination');
    const departure = text('departure');
    const ret = text('return');
    if (!origin || !destination || !departure) return null;
    return { vertical: 'flight', origin, destination, departure, ...(ret ? { return: ret } : {}), ...shared };
  }
  if (candidate.vertical === 'hotel') {
    const destination = text('destination');
    const checkIn = text('checkIn');
    const checkOut = text('checkOut');
    if (!destination || !checkIn || !checkOut) return null;
    return { vertical: 'hotel', destination, checkIn, checkOut, ...shared };
  }
  if (candidate.vertical === 'car') {
    const destination = text('destination');
    const pickupAt = text('pickupAt');
    const dropoffAt = text('dropoffAt');
    if (!destination || !pickupAt || !dropoffAt) return null;
    return { vertical: 'car', destination, pickupAt, dropoffAt, ...shared };
  }
  const destination = text('destination');
  const date = text('date');
  if (!destination || !date) return null;
  return { vertical: 'activity', destination, date, ...shared };
}

export function createRouteStackBookingProvider(
  options: RouteStackProviderOptions = {}
): BookingProvider {
  const env = options.env ?? process.env;
  const callTool = options.callTool ?? createDefaultToolCaller(env);
  const now = options.now ?? (() => new Date());
  const credentials = resolveProviderCredentials('routestack', env);
  const mode = credentials.mode;
  const isConfigured = () => credentials.reason === null && Boolean(credentials.apiKey);
  const supports = (vertical: BookingVertical) =>
    vertical === 'flight' || vertical === 'hotel' || vertical === 'car';

  return {
    id: 'routestack',
    mode,
    supportedVerticals: ['flight', 'hotel', 'car'],
    supports,
    isConfigured,
    async search(request) {
      if (!isConfigured()) {
        throw new BookingProviderError({
          code: BOOKING_PROVIDER_ERROR_CODES.config,
          provider: 'routestack',
          message: credentials.message,
        });
      }
      const validated = validateBookingSearchRequest(request);
      const name = toolNameForVertical(validated.vertical);
      let args: Record<string, unknown>;
      let payload: unknown;
      try {
        args = await argumentsForRequest(validated, callTool);
        payload = parseToolPayload(await callTool(name, args));
      } catch (error) {
        throw normalizeBookingProviderError(error, 'routestack');
      }
      return {
        provider: 'routestack',
        mode: mode === 'live' ? 'live' : 'sandbox',
        offers: normalizeOffers(payload, validated, env),
        fetchedAt: now().toISOString(),
      } satisfies BookingSearchResult;
    },

    /**
     * Un candidat frais est-il encore valable ? RouteStack est republished en
     * temps reel, mais on ne peut pas le prouver : on reconsulte et on ne
     * remplace que par une offre reellement presente dans la reponse.
     */
    async revalidate(candidate) {
      if (!candidate.requiresRevalidation) return candidate;
      if (!isConfigured() || !supports(candidate.vertical)) {
        return { ...candidate, requiresRevalidation: true };
      }
      const request = searchRequestFromCandidate(candidate);
      if (!request) return { ...candidate, requiresRevalidation: true };
      try {
        const name = toolNameForVertical(candidate.vertical);
        const args = await argumentsForRequest(request, callTool);
        const payload = parseToolPayload(await callTool(name, args));
        const offers = normalizeOffers(payload, request, env);
        const fresh = offers.find(
          (offer) => offer.id === candidate.id || offer.providerReference === candidate.providerReference
        );
        return fresh ? { ...fresh, requiresRevalidation: false } : { ...candidate, requiresRevalidation: true };
      } catch {
        // Echec de revalidation != prix change : on le signale, on invente rien.
        return { ...candidate, requiresRevalidation: true };
      }
    },

    async checkoutUrl(candidate, context): Promise<CheckoutResult> {
      if (!isConfigured()) {
        throw new BookingProviderError({
          code: BOOKING_PROVIDER_ERROR_CODES.config,
          provider: 'routestack',
          message: credentials.message,
        });
      }
      if (!supports(candidate.vertical)) {
        throw new BookingProviderError({
          code: BOOKING_PROVIDER_ERROR_CODES.validation,
          provider: 'routestack',
          message: 'Vertical RouteStack non supportée pour ce checkout.',
        });
      }

      const checkoutMode = resolveCheckoutMode(env);
      // Cloisonnement : ces deux champs identifient NOTRE voyage et SON
      // contexte. Ils n'apparaissent QUE sur get-payment-url, jamais sur un
      // outil de recherche, et `routestack_accountid` n'est jamais emis (D-21).
      const args: Record<string, unknown> = {
        routestack_external_userid: context.userId,
        routestack_metadata: sanitizeCheckoutMetadata({
          trip_id: context.tripId,
          vertical: candidate.vertical,
          campaign: context.campaign ?? null,
        }),
        candidate_id: candidate.providerReference ?? candidate.id,
        ...(candidate.amount !== null ? { amount: candidate.amount } : {}),
        ...(candidate.currency !== null ? { currency: candidate.currency } : {}),
      };

      const payload = await callWithAuthRetry(callTool, CHECKOUT_TOOL, args);
      const url = extractCheckoutUrl(payload, env);

      return {
        mode: checkoutMode,
        // ACP : le paiement se poursuit dans le flux agent, aucun lien sortant.
        url: checkoutMode === 'acp' ? null : url,
        bookingId: null,
      };
    },
  };
}
