/**
 * Garde réseau des tests unitaires (plan 100, 2.12) : bibliothèque sans effet
 * de bord. `tests/setup/no-network.ts` (dans `setupFiles`) l'installe avant
 * chaque fichier de test ; `tests/config/no-network.spec.ts` la vérifie.
 *
 * Toute connexion réelle vers un hôte autre que la machine locale (localhost,
 * 127.0.0.0/8, ::1) est refusée avec `Réseau interdit dans les tests
 * unitaires : <hôte>` :
 *
 * - `fetch` global (enveloppe de l'original : un test qui pose son propre
 *   `vi.fn()` ou `vi.stubGlobal('fetch', …)` remplace l'enveloppe comme avant,
 *   et `vi.unstubAllGlobals()` la remet) ;
 * - `http.request`/`http.get`, `https.request`/`https.get`, `net.connect`/
 *   `net.createConnection`, `tls.connect` (axios, clients Node, undici) ;
 * - `net.Socket#connect`, le chemin brut de `pg` et de tout client qui ouvre
 *   sa propre socket (les enveloppes ci-dessus refusent avant d'y arriver :
 *   un appel n'est jamais noté deux fois) ;
 * - `WebSocket` global.
 *
 * Chaque refus est noté : un refus que le code testé rattrape en silence
 * (`.catch(() => null)`) fait quand même échouer le test (`failOnBlocked`).
 */
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import net from 'node:net';
import tls from 'node:tls';
import { expect } from 'vitest';

export const NETWORK_FORBIDDEN_PREFIX = 'Réseau interdit dans les tests unitaires : ';

/** Erreur levée (ou promesse rejetée) pour un appel vers un serveur public. */
export class NetworkForbiddenError extends Error {
  readonly code = 'LKDV_NETWORK_FORBIDDEN';
  constructor(
    readonly host: string,
    detail?: string
  ) {
    super(`${NETWORK_FORBIDDEN_PREFIX}${host}${detail ? ` (${detail})` : ''}`);
    this.name = 'NetworkForbiddenError';
  }
}

interface BlockedCall {
  host: string;
  via: string;
  test: string | undefined;
  file: string | undefined;
}

interface GuardState {
  installed: boolean;
  blocked: BlockedCall[];
}

const STATE_KEY = Symbol.for('lkdv.tests.noNetwork');

function guardState(): GuardState {
  const g = globalThis as unknown as Record<symbol, GuardState | undefined>;
  if (!g[STATE_KEY]) g[STATE_KEY] = { installed: false, blocked: [] };
  return g[STATE_KEY] as GuardState;
}

/** Vrai pour la machine locale : localhost, 127.0.0.0/8, ::1 (et 0.0.0.0). */
export function isLoopbackHost(rawHost: string): boolean {
  const host = rawHost.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === '' || host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '::1' || host === '0:0:0:0:0:0:0:1' || host === '0.0.0.0') return true;
  const v4 = host.startsWith('::ffff:') ? host.slice(7) : host;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v4);
}

/** Lit et vide les refus notés (tests du garde lui-même). */
export function takeBlockedNetworkCalls(): BlockedCall[] {
  const state = guardState();
  const taken = state.blocked;
  state.blocked = [];
  return taken;
}

function currentTest(): { test: string | undefined; file: string | undefined } {
  try {
    const s = expect.getState();
    return { test: s.currentTestName, file: s.testPath };
  } catch {
    return { test: undefined, file: undefined };
  }
}

function refuse(host: string, via: string): NetworkForbiddenError {
  const where = currentTest();
  guardState().blocked.push({ host, via, ...where });
  // Visible même si le code testé avale l'erreur (stderr, hors des espions de console).
  process.stderr.write(
    `[réseau interdit] ${via} → ${host}${where.test ? ` (test : ${where.test})` : ''}${where.file ? ` [${path.relative(process.cwd(), where.file)}]` : ''}\n`
  );
  return new NetworkForbiddenError(host);
}

const GUARDED_SCHEMES = new Set(['http:', 'https:', 'ws:', 'wss:']);

/** Hôte d'une URL réseau ; null si l'URL n'en a pas (relative, data:, blob:…). */
function networkHostOf(target: unknown): string | null {
  let href: string;
  if (typeof target === 'string') href = target;
  else if (target instanceof URL) href = target.href;
  else if (target && typeof target === 'object' && typeof (target as { url?: unknown }).url === 'string')
    href = (target as { url: string }).url;
  else return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  return GUARDED_SCHEMES.has(url.protocol) ? url.host : null;
}

function isForbiddenUrl(target: unknown): string | null {
  const host = networkHostOf(target);
  if (host == null) return null;
  return isLoopbackHost(new URL(`http://${host}`).hostname) ? null : host;
}

type Options = Record<string, unknown>;

function asOptions(value: unknown): Options | null {
  return value && typeof value === 'object' && !(value instanceof URL) ? (value as Options) : null;
}

/** Hôte visé par `http(s).request(url?, options?, cb?)` ; null s'il est local. */
function forbiddenRequestHost(args: unknown[], defaultPort: number): string | null {
  const [first, second] = args;
  let host: string | undefined;
  let port: unknown;
  let opts: Options | null = null;
  if (typeof first === 'string' || first instanceof URL) {
    try {
      const url = new URL(String(first));
      host = url.hostname;
      port = url.port;
    } catch {
      return null;
    }
    opts = asOptions(second);
  } else {
    opts = asOptions(first);
    host = 'localhost';
  }
  if (opts) {
    if (typeof opts.socketPath === 'string') return null;
    const optHost = typeof opts.hostname === 'string' ? opts.hostname : typeof opts.host === 'string' ? opts.host : undefined;
    if (optHost) host = optHost;
    if (opts.port != null) port = opts.port;
  }
  if (!host || isLoopbackHost(host)) return null;
  const shownPort = port != null && String(port) !== '' && Number(port) !== defaultPort ? `:${String(port)}` : '';
  return `${host}${shownPort}`;
}

/**
 * Hôte visé par `net.connect`, `tls.connect` ou `net.Socket#connect` ; null s'il
 * est local ou un socket Unix. Formes : (options), (port, host), (chemin), et
 * le tableau d'arguments déjà normalisés que Node passe à `Socket#connect`.
 */
function forbiddenConnectHost(args: unknown[]): string | null {
  if (Array.isArray(args[0])) return forbiddenConnectHost(args[0] as unknown[]);
  const [first, second] = args;
  if (typeof first === 'string' && !/^\d+$/.test(first)) return null; // chemin de socket Unix
  if (typeof first === 'number' || (typeof first === 'string' && /^\d+$/.test(first))) {
    const host = typeof second === 'string' ? second : 'localhost';
    return isLoopbackHost(host) ? null : `${host}:${String(first)}`;
  }
  const opts = asOptions(first);
  if (!opts || typeof opts.path === 'string') return null;
  const host = typeof opts.host === 'string' ? opts.host : typeof opts.hostname === 'string' ? opts.hostname : 'localhost';
  if (isLoopbackHost(host)) return null;
  return opts.port != null ? `${host}:${String(opts.port)}` : host;
}

type AnyFn = (...args: never[]) => unknown;

function guardFunction<T extends AnyFn>(
  owner: Record<string, unknown>,
  name: string,
  via: string,
  hostOf: (args: unknown[]) => string | null
): void {
  const original = owner[name] as T | undefined;
  if (typeof original !== 'function') return;
  const guarded = function (this: unknown, ...args: unknown[]) {
    const host = hostOf(args);
    if (host != null) throw refuse(host, via);
    return (original as unknown as (...a: unknown[]) => unknown).apply(this, args);
  };
  Object.defineProperty(guarded, 'name', { value: (original as { name?: string }).name ?? name });
  owner[name] = guarded;
}

/** Installe le garde (une seule fois par processus). */
export function installNetworkGuard(): void {
  const state = guardState();
  if (state.installed) return;
  state.installed = true;

  const originalFetch = globalThis.fetch;
  if (typeof originalFetch === 'function') {
    const guardedFetch = function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const host = isForbiddenUrl(input);
      if (host != null) return Promise.reject(refuse(host, 'fetch'));
      return originalFetch(input, init);
    };
    globalThis.fetch = guardedFetch as typeof fetch;
  }

  const OriginalWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket;
  if (typeof OriginalWebSocket === 'function') {
    (globalThis as { WebSocket?: unknown }).WebSocket = new Proxy(OriginalWebSocket, {
      construct(target, args, newTarget) {
        const host = isForbiddenUrl(args[0]);
        if (host != null) throw refuse(host, 'WebSocket');
        return Reflect.construct(target, args, newTarget) as object;
      },
    });
  }

  const httpMod = http as unknown as Record<string, unknown>;
  const httpsMod = https as unknown as Record<string, unknown>;
  guardFunction(httpMod, 'request', 'http.request', (a) => forbiddenRequestHost(a, 80));
  guardFunction(httpMod, 'get', 'http.get', (a) => forbiddenRequestHost(a, 80));
  guardFunction(httpsMod, 'request', 'https.request', (a) => forbiddenRequestHost(a, 443));
  guardFunction(httpsMod, 'get', 'https.get', (a) => forbiddenRequestHost(a, 443));
  const netMod = net as unknown as Record<string, unknown>;
  guardFunction(netMod, 'connect', 'net.connect', forbiddenConnectHost);
  guardFunction(netMod, 'createConnection', 'net.createConnection', forbiddenConnectHost);
  guardFunction(tls as unknown as Record<string, unknown>, 'connect', 'tls.connect', forbiddenConnectHost);
  // Dernier rempart : toute socket TCP (pg, agents http, undici, TLS) passe par là.
  guardFunction(net.Socket.prototype as unknown as Record<string, unknown>, 'connect', 'net.Socket#connect', forbiddenConnectHost);
  // Les imports nommés (`import { request } from 'node:https'`) voient aussi le garde.
  syncBuiltinESMExports();
}

/** Lève si des appels ont été refusés depuis la dernière lecture (et les oublie). */
export function failOnBlocked(when: string): void {
  const blocked = takeBlockedNetworkCalls();
  if (blocked.length === 0) return;
  const hosts = [...new Set(blocked.map((b) => b.host))].join(', ');
  const s = blocked.length > 1 ? 's' : '';
  const calls = blocked.map((b) => `${b.via} → ${b.host}${b.test ? ` dans « ${b.test} »` : ''}`).join(' ; ');
  throw new NetworkForbiddenError(
    hosts,
    `${blocked.length} appel${s} ${when}, refusé${s} puis rattrapé${s} par le code testé : ${calls} ; simuler l'appel à sa frontière`
  );
}

/** Vrai une fois le garde installé dans ce processus. */
export function networkGuardInstalled(): boolean {
  return guardState().installed;
}
