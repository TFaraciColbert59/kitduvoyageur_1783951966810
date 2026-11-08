/**
 * tests/e2e/communaute-v2.fixtures.ts
 *
 * Harnais de mock réseau déterministe pour les tiroirs Communauté v2
 * (`tests/e2e/communaute-v2*.spec.ts`, specs taguées `@ui-mock`).
 *
 * Pourquoi : dans ce worktree l'application n'est branchée sur AUCUNE base
 * réelle (`.env.local` = placeholders CI) et les migrations ne sont pas
 * appliquées en prod. Les preuves déterministes des gestes UI (capsule,
 * mini-capsule, tri, Échap, focus, états, formulaires) ne peuvent donc pas
 * dépendre d'un serveur Supabase : ce fichier rejoue la frontière PostgREST et
 * GoTrue dans le navigateur (`page.route`).
 *
 * Convergence avec le harnais de recette des fondations :
 * les DONNÉES viennent de `docs/audit/communaute-v2-2026-11-08/integration/
 * fixtures.mjs` (`buildFixtures()` + `rpcFixtures()`), adaptées ici en TypeScript
 * pour deux besoins propres aux portes CI : dates figées (snapshots stables) et
 * état mutable (adhésion, like, attente) pour les gestes E2E. Le réseau de
 * recette reste `integration/network.mjs` (couche `page.route` du harnais de
 * capture) ; l'adaptation rend le nom du cookie de session dynamique
 * (`NEXT_PUBLIC_SUPABASE_URL` du build) alors que le harnais de capture suppose
 * l'hôte fictif `fixture.supabase.co`. Aucun jeu de données divergent : les
 * identités, titres et états sont ceux des captures de recette.
 *
 * Règles :
 * - aucune requête ne sort du navigateur : tout appel Supabase est intercepté
 *   (PostgREST, storage, GoTrue, API interne) et toute origine externe reçoit
 *   une réponse neutre ;
 * - session synthétique (cookie `sb-<ref>-auth-token`, format `@supabase/ssr`)
 *   pour franchir le middleware `/communaute` sans réseau : `member` = voyageur
 *   connecté, `anonymous` = invité Supabase anonyme (écritures →
 *   `requireAuth`), `signed-out` = aucune session (redirection `/connexion`) ;
 * - horloge figée au 2026-11-08 : les dates relatives des fixtures sont
 *   calculées autour de cette date, donc libellés et captures reproductibles ;
 * - `installCommunityV2Mock()` journalise les appels interceptés et les appels
 *   inattendus pour qu'une spec puisse prouver « rien n'est parti sur le réseau ».
 *
 * Ce module n'est pas une spec (pas de `test()`), il n'est pas sélectionné par
 * `playwright test` (`testMatch` fermé du dépôt) : il est importé par les specs.
 *
 * Prérequis : build Next avec `NEXT_PUBLIC_COMMUNAUTE_V2=true`
 * (`NEXT_PUBLIC_COMMUNAUTE_V2=true npm run build` puis `npm run start`). Sans
 * ce prérequis, les specs se sautent avec une raison explicite — jamais un faux
 * vert.
 */

import { expect, type BrowserContext, type Locator, type Page, type Route } from '@playwright/test';

import type {
  CarnetFeedRow,
  ClubFeedRow,
  EventFeedRow,
} from '../../src/features/community/v2/data/communityFeedRpc';
import {
  SESSION_USER,
  buildFixtures,
  rpcFixtures,
} from '../../docs/audit/communaute-v2-2026-11-08/integration/fixtures.mjs';

// ── Horloge figée et données de recette (adaptées en TS) ───────────────────

/** Horloge figée des specs : libellés relatifs et captures reproductibles. */
export const FIXED_NOW = '2026-11-08T14:00:00+01:00';
const FIXED_EPOCH = Date.parse(FIXED_NOW);

/**
 * Les fixtures de recette calculent leurs dates avec `Date.now()` : on fige
 * l'horloge Node le temps de la construction pour que l'agenda et les sorties
 * restent positionnés autour du 2026-11-08 quelle que soit la date d'exécution.
 */
function buildDeterministicData() {
  const realNow = Date.now;
  Date.now = () => FIXED_EPOCH;
  try {
    const data = buildFixtures();
    return { data, rpc: rpcFixtures(data) as Record<string, unknown> };
  } finally {
    Date.now = realNow;
  }
}

const DETERMINISTIC = buildDeterministicData();
const DATA = DETERMINISTIC.data;
const RPC = DETERMINISTIC.rpc;

type AnyRecord = Record<string, unknown>;

export const MEMBER_ID = SESSION_USER.id as string;
export const MEMBER_NAME = 'Léa Martin';
export const MEMBER_HANDLE = 'recette';
export const FRIEND_ID = '00000000-0000-4000-8000-000000000001';
export const FRIEND_NAME = 'Léa';
export const ORGANIZER_ID = '22222222-2222-4222-8222-222222222222';
export const ORGANIZER_NAME = 'Tom Berger';
export const ANONYMOUS_ID = '99999999-9999-4999-8999-999999999999';

const CARNETS = DATA.carnetRows as CarnetFeedRow[];
const CLUBS = DATA.clubRows as ClubFeedRow[];
const EVENTS = DATA.eventRows as EventFeedRow[];

export const CARNET_ID = CARNETS[0].id;
export const CARNET_ID_POPULAR = CARNETS[1].id;
export const CLUB_ID = CLUBS[0].id;
export const CLUB_ID_CLOSED = CLUBS[1].id;
export const CLUB_SLUG = String(CLUBS[0].slug);
export const CLUB_SLUG_CLOSED = String(CLUBS[1].slug);
export const EVENT_ID = EVENTS[0].id;
export const EVENT_ID_FULL = EVENTS[1].id;
export const EVENT_ID_WAITLIST = EVENTS[2].id;

/** Carnet le plus aimé (tri « Populaires » attendu). */
export const CARNET_ID_MOST_LIKED = [...CARNETS].sort(
  (a, b) => Number(b.likes_count ?? 0) - Number(a.likes_count ?? 0),
)[0].id;
/** Club le plus gros (tri « Taille » attendu). */
export const CLUB_ID_LARGEST = [...CLUBS].sort(
  (a, b) => Number(b.members_count ?? 0) - Number(a.members_count ?? 0),
)[0].id;
/** Jour de la bande agenda qui a au moins une sortie (premier événement). */
export const AGENDA_DAY_WITH_EVENT = String(EVENTS[0].event_date);

export type FixtureRole = 'member' | 'anonymous' | 'signed-out';
export type FixtureState = 'ok' | 'empty' | 'error';

export interface FixtureCall {
  kind: 'rpc' | 'table' | 'auth' | 'storage' | 'api' | 'external';
  /** Nom de la RPC, de la table ou de la route. */
  name: string;
  method: string;
  body?: unknown;
}

export interface CommunityV2MockOptions {
  /** `member` (défaut) : session connectée ; `anonymous` : invité ; `signed-out` : aucune session. */
  role?: FixtureRole;
  /** État global des RPC de lecture. */
  state?: FixtureState;
  /** RPC renvoyant une erreur (ex. `['community_search']`). */
  failRpcs?: string[];
  /** Latence par réponse mockée (ms), pour capturer le skeleton. */
  latencyMs?: number;
  /** Origine de l'app (cookies de session) : défaut `PW_BASE_URL` ou localhost:4028. */
  appOrigin?: string;
}

export interface CommunityV2Mock {
  /** Journal des appels interceptés (ordre chronologique). */
  calls: FixtureCall[];
  /** Erreurs console/pageerror observées depuis l'installation (diagnostic). */
  consoleErrors: string[];
  /** Appels qui ne correspondent à aucune fixture connue. */
  unhandled: FixtureCall[];
  /** Change l'état global entre deux assertions. */
  setState: (state: FixtureState) => void;
  /** Change la latence des réponses mockées (capture du skeleton). */
  setLatency: (latencyMs: number) => void;
  /** Adhésions simulées depuis l'ouverture du tiroir. */
  getJoinedClubs: () => string[];
  /** Inscriptions simulées depuis l'ouverture du tiroir. */
  getJoinedEvents: () => string[];
  /** Carnets aimés pendant le test. */
  getLikedCarnets: () => string[];
  /** Échoue si un appel réseau inattendu est sorti du navigateur. */
  expectNoUnexpected: () => void;
}

// ── Environnement Supabase attendu (identique au build) ────────────────────

/** URL Supabase marquée dans le build : env du process, sinon `.env.local`, sinon placeholder CI. */
export function resolveSupabaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (fromEnv && /^https?:\/\//.test(fromEnv)) return fromEnv;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path') as typeof import('node:path');
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const line = fs
        .readFileSync(envPath, 'utf8')
        .split(/\r?\n/)
        .find((entry) => entry.startsWith('NEXT_PUBLIC_SUPABASE_URL='));
      const value = line?.slice('NEXT_PUBLIC_SUPABASE_URL='.length).trim();
      if (value && /^https?:\/\//.test(value)) return value;
    }
  } catch {
    /* fichier absent en CI : placeholder ci-dessous */
  }
  return 'https://ci-build-placeholder.supabase.co';
}

const SUPABASE_URL = resolveSupabaseUrl();
const SUPABASE_REF = new URL(SUPABASE_URL).hostname.split('.')[0];

/** Origine de l'app testée (cookies de session). */
function resolveAppOrigin(explicit?: string): string {
  if (explicit) return explicit.replace(/\/+$/, '');
  const fromEnv = process.env.PW_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return 'http://localhost:4028';
}

// ── Sessions synthétiques (@supabase/ssr cookie `sb-<ref>-auth-token`) ────

function base64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sessionUser(role: FixtureRole): AnyRecord {
  if (role === 'anonymous') {
    return {
      ...SESSION_USER,
      id: ANONYMOUS_ID,
      email: null,
      is_anonymous: true,
      user_metadata: {},
    };
  }
  return SESSION_USER as AnyRecord;
}

/** Sérialise une session au format des cookies `@supabase/ssr` (non chunkée). */
export function buildSessionCookieValue(role: FixtureRole): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const session = {
    access_token: `fixture.${role}.${String(sessionUser(role).id)}`,
    refresh_token: `fixture-refresh-${role}`,
    token_type: 'bearer',
    expires_in: 86_400,
    expires_at: nowSeconds + 86_400,
    user: sessionUser(role),
  };
  return `base64-${base64url(JSON.stringify(session))}`;
}

/** Pose la session synthétique sur le contexte (aucun appel réseau). */
export async function installSessionCookie(
  context: BrowserContext,
  role: FixtureRole,
  appOrigin?: string,
): Promise<void> {
  if (role === 'signed-out') return;
  const origin = new URL(resolveAppOrigin(appOrigin));
  const domains = new Set<string>([origin.hostname]);
  if (origin.hostname === 'localhost') domains.add('127.0.0.1');
  const cookies = Array.from(domains).map((domain) => ({
    name: `sb-${SUPABASE_REF}-auth-token`,
    value: buildSessionCookieValue(role),
    domain,
    path: '/',
    httpOnly: false,
    secure: origin.protocol === 'https:',
    sameSite: 'Lax' as const,
  }));
  await context.addCookies(cookies);
}

// ── Helpers de réponse ──────────────────────────────────────────────────────

function corsHeaders(route: Route): Record<string, string> {
  const headers = route.request().headers();
  const origin = headers['origin'] ?? resolveAppOrigin();
  const requested = headers['access-control-request-headers'];
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers':
      requested ?? 'authorization, x-client-info, apikey, content-type, accept, prefer',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS,HEAD',
    'access-control-expose-headers': 'content-range, content-profile, accept-profile',
  };
}

function isOptions(route: Route): boolean {
  return route.request().method() === 'OPTIONS';
}

function lastSegment(pathname: string): string {
  const clean = pathname.replace(/\/+$/, '');
  return clean.split('/').at(-1) ?? '';
}

/** Convertit un numeric PostgREST (`number` ou chaîne) en nombre sûr. */
function toNum(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function postBody(route: Route): AnyRecord {
  try {
    const parsed = route.request().postDataJSON();
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as AnyRecord) : {};
  } catch {
    return {};
  }
}

/** Ligne de feed enrichie : la fixture de recette reste indexable (`unknown`). */
type CarnetRow = AnyRecord & {
  id: string;
  author_id?: unknown;
  nb_nuits?: unknown;
  likes_count?: unknown;
  liked_by_me?: unknown;
};
type ClubRow = AnyRecord & {
  id: string;
  activities?: unknown;
  my_status?: unknown;
  members_count?: unknown;
};
type EventRow = AnyRecord & {
  id: string;
  event_date?: unknown;
  my_status?: unknown;
};

interface MutableFixtureState {
  joinedClubs: Set<string>;
  joinedEvents: Set<string>;
  likedCarnets: Set<string>;
}

function cloneRows(rows: readonly unknown[]): AnyRecord[] {
  return rows.map((row) => ({ ...(row as AnyRecord) }));
}

/**
 * Installe la frontière réseau mockée et la session synthétique.
 * À appeler AVANT `page.goto('/communaute')`.
 */
export async function installCommunityV2Mock(
  page: Page,
  options: CommunityV2MockOptions = {},
): Promise<CommunityV2Mock> {
  const role = options.role ?? 'member';
  const appOrigin = resolveAppOrigin(options.appOrigin);
  let state: FixtureState = options.state ?? 'ok';
  let latencyMs = options.latencyMs ?? 0;
  const failRpcs = new Set(options.failRpcs ?? []);

  const mutable: MutableFixtureState = {
    joinedClubs: new Set<string>(),
    joinedEvents: new Set<string>(),
    likedCarnets: new Set<string>(),
  };

  const calls: FixtureCall[] = [];
  const unhandled: FixtureCall[] = [];
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

  const record = (call: FixtureCall): FixtureCall => {
    calls.push(call);
    return call;
  };

  const delay = async (): Promise<void> => {
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
  };

  // 0) Filet de sécurité : aucune origine **externe** ne doit être contactée
  //    pour de vrai (tuiles, polices, CDN…). Le motif exclut explicitement
  //    l'origine de l'app par une lookahead : un `**/*` + `route.fallback()`
  //    empêchait Playwright de charger les scripts Next (page non hydratée,
  //    aucun handler de clic — régression constatée le 2026-11-08).
  const appUrl = new URL(appOrigin);
  const allowedHosts = new Set<string>([appUrl.hostname]);
  if (appUrl.hostname === 'localhost') allowedHosts.add('127.0.0.1');
  if (appUrl.hostname === '127.0.0.1') allowedHosts.add('localhost');
  const escapedHosts = Array.from(allowedHosts)
    .map((host) => host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const externalPattern = new RegExp(`^https?://(?!(${escapedHosts})(?::\\d+)?(?:[/?#]|$)).+`);

  // Les routes explicites (RPC, tables, auth, storage, API), enregistrées
  // APRÈS, ont la priorité (Playwright : dernier enregistré d'abord).
  await page.context().route(externalPattern, async (route) => {
    const request = route.request();
    const url = request.url();
    const name = new URL(url).hostname;
    const call = record({ kind: 'external', name, method: request.method() });
    unhandled.push(call);
    if (isOptions(route)) {
      await route.fulfill({ status: 204, headers: corsHeaders(route) });
      return;
    }
    const pathname = new URL(url).pathname;
    if (/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(pathname)) {
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders(route), 'content-type': 'image/gif' },
        body: Buffer.from(
          'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
          'base64',
        ),
      });
      return;
    }
    await route.fulfill({ status: 200, headers: corsHeaders(route), json: {} });
  });

  // 1) PostgREST — RPC
  await page.context().route('**/rest/v1/rpc/**', async (route) => {
    if (isOptions(route)) {
      await route.fulfill({ status: 204, headers: corsHeaders(route) });
      return;
    }
    const request = route.request();
    const url = new URL(request.url());
    const name = lastSegment(url.pathname);
    const args = postBody(route);
    record({ kind: 'rpc', name, method: request.method(), body: args });
    if (process.env.CV2_DEBUG_MOCK === '1') console.log('[mock] rpc', name, JSON.stringify(args).slice(0, 120));
    await delay();
    if (failRpcs.has(name) || (state === 'error' && READ_RPCS.has(name))) {
      await route.fulfill({
        status: 500,
        headers: corsHeaders(route),
        json: { code: 'PGRST500', message: 'Erreur simulée', details: null, hint: null },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: corsHeaders(route),
      json: rpcPayload(name, args, state, mutable),
    });
  });

  // 2) PostgREST — tables / mutations
  await page.context().route('**/rest/v1/**', async (route) => {
    if (isOptions(route)) {
      await route.fulfill({ status: 204, headers: corsHeaders(route) });
      return;
    }
    const request = route.request();
    const url = new URL(request.url());
    const table = lastSegment(url.pathname);
    const accept = request.headers()['accept'] ?? '';
    record({ kind: 'table', name: table, method: request.method() });
    if (!KNOWN_TABLES.has(table)) {
      unhandled.push({ kind: 'table', name: table, method: request.method() });
    }
    await delay();
    const payload = tablePayload(table, request.method(), accept, url, postBody(route), role, mutable);
    await route.fulfill({
      status: request.method() === 'GET' || request.method() === 'HEAD' ? 200 : 201,
      headers: corsHeaders(route),
      json: payload,
    });
  });

  // 3) GoTrue (auth) — aucune connexion réelle.
  await page.context().route('**/auth/v1/**', async (route) => {
    if (isOptions(route)) {
      await route.fulfill({ status: 204, headers: corsHeaders(route) });
      return;
    }
    const request = route.request();
    const url = new URL(request.url());
    record({ kind: 'auth', name: lastSegment(url.pathname), method: request.method() });
    if (/\/user$/.test(url.pathname)) {
      await route.fulfill({ status: 200, headers: corsHeaders(route), json: sessionUser(role) });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: corsHeaders(route),
      json: {
        access_token: 'fixture-access-token',
        token_type: 'bearer',
        expires_in: 86_400,
        refresh_token: 'fixture-refresh-token',
        user: sessionUser(role),
      },
    });
  });

  // 4) Storage — aucun objet réel (repli visuel des composants).
  await page.context().route('**/storage/v1/**', async (route) => {
    if (isOptions(route)) {
      await route.fulfill({ status: 204, headers: corsHeaders(route) });
      return;
    }
    const request = route.request();
    record({ kind: 'storage', name: lastSegment(new URL(request.url()).pathname), method: request.method() });
    if (request.method() === 'POST' || request.method() === 'PUT') {
      await route.fulfill({
        status: 200,
        headers: corsHeaders(route),
        json: { Key: 'community-v2/fixture.jpg', Id: 'fixture-object-id' },
      });
      return;
    }
    // URL publique : image transparente 1×1 plutôt qu'un 404 (le repli reste
    // visible mais la console ne se remplit pas d'erreurs réseau parasites).
    await route.fulfill({
      status: 200,
      headers: { ...corsHeaders(route), 'content-type': 'image/gif' },
      body: Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64',
      ),
    });
  });

  // 5) Routes API internes du dépôt (non exercées par les mocks UI).
  await page.context().route('**/api/**', async (route) => {
    if (isOptions(route)) {
      await route.fulfill({ status: 204, headers: corsHeaders(route) });
      return;
    }
    const request = route.request();
    record({ kind: 'api', name: lastSegment(new URL(request.url()).pathname), method: request.method() });
    await route.fulfill({ status: 200, headers: corsHeaders(route), json: {} });
  });

  await installSessionCookie(page.context(), role, appOrigin);

  return {
    calls,
    unhandled,
    consoleErrors,
    setState: (next: FixtureState) => {
      state = next;
    },
    setLatency: (next: number) => {
      latencyMs = next;
    },
    getJoinedClubs: () => Array.from(mutable.joinedClubs),
    getJoinedEvents: () => Array.from(mutable.joinedEvents),
    getLikedCarnets: () => Array.from(mutable.likedCarnets),
    expectNoUnexpected: () => {
      if (unhandled.length > 0) {
        const detail = unhandled
          .slice(0, 10)
          .map((call) => `${call.kind}:${call.name} (${call.method})`)
          .join(', ');
        throw new Error(`Appels réseau non mockés (${unhandled.length}) : ${detail}`);
      }
    },
  };
}

const KNOWN_TABLES = new Set([
  ...Object.keys((DATA.tables ?? {}) as Record<string, unknown>),
  'community_posts',
  'community_carnets',
  'community_clubs',
  'community_events',
  'public_profiles',
  'user_profiles',
  'profiles',
  'carnets',
  'carnet_likes',
  'carnet_moments',
  'carnet_media',
  'clubs',
  'club_members',
  'club_join_requests',
  'events',
  'event_participants',
  'post_stories',
  'stories',
  'user_follows',
  'notifications',
  'materiel_kits',
  'products',
]);

// ── Valeurs des RPC (RPC-CONTRACTS § 1-5) ─────────────────────────────────

const READ_RPCS = new Set([
  'community_carnets_feed',
  'community_clubs_feed',
  'community_events_feed',
  'community_events_agenda',
  'community_search',
  'community_search_trending',
]);

/** Réponse d'une RPC : base des fixtures de recette + état mutable des gestes. */
function rpcPayload(
  name: string,
  args: AnyRecord,
  state: FixtureState,
  mutable: MutableFixtureState,
): unknown {
  const empty = state === 'empty';
  const base = RPC[name];
  switch (name) {
    case 'community_carnets_feed': {
      if (empty) return [];
      const filter = String(args.p_filter ?? 'discover');
      const sort = String(args.p_sort ?? 'recent');
      let rows = cloneRows(CARNETS).map(
        (row): CarnetRow => ({
          ...row,
          id: String(row.id ?? ''),
          liked_by_me: mutable.likedCarnets.has(String(row.id)) || Boolean(row.liked_by_me),
          likes_count: toNum(row.likes_count) + (mutable.likedCarnets.has(String(row.id)) ? 1 : 0),
        }),
      );
      if (filter === 'mine') rows = rows.filter((row) => row.author_id === MEMBER_ID);
      if (filter === 'followed') rows = rows.filter((row) => row.author_id !== MEMBER_ID);
      if (sort === 'popular') rows = [...rows].sort((a, b) => toNum(b.likes_count) - toNum(a.likes_count));
      if (sort === 'duration') rows = [...rows].sort((a, b) => toNum(b.nb_nuits) - toNum(a.nb_nuits));
      return rows;
    }
    case 'community_clubs_feed': {
      if (empty) return [];
      const filter = String(args.p_filter ?? 'discover');
      const sort = String(args.p_sort ?? 'activity');
      let rows = cloneRows(CLUBS).map(
        (row): ClubRow => ({
          ...row,
          id: String(row.id ?? ''),
          my_status: mutable.joinedClubs.has(String(row.id)) ? 'member' : row.my_status,
          members_count: toNum(row.members_count) + (mutable.joinedClubs.has(String(row.id)) ? 1 : 0),
        }),
      );
      const activity = normalizeText(args.p_activity);
      if (activity) {
        rows = rows.filter((row) =>
          (Array.isArray(row.activities) ? row.activities : []).some((entry: unknown) =>
            normalizeText(entry).includes(activity),
          ),
        );
      }
      if (filter === 'mine') rows = rows.filter((row) => row.my_status !== 'none');
      if (sort === 'size') rows = [...rows].sort((a, b) => toNum(b.members_count) - toNum(a.members_count));
      return rows;
    }
    case 'community_events_feed': {
      if (empty) return [];
      const filter = String(args.p_filter ?? 'discover');
      const day = typeof args.p_day === 'string' ? args.p_day : null;
      let rows = cloneRows(EVENTS).map(
        (row): EventRow => ({
          ...row,
          id: String(row.id ?? ''),
          my_status:
            row.my_status === 'none' && mutable.joinedEvents.has(String(row.id))
              ? 'registered'
              : row.my_status,
        }),
      );
      if (filter === 'mine') rows = rows.filter((row) => row.my_status !== 'none');
      if (day) rows = rows.filter((row) => row.event_date === day);
      return rows;
    }
    case 'community_events_agenda': {
      // Compteurs recalculés depuis les sorties réelles des fixtures : la bande
      // agenda et la liste filtrée par jour restent cohérentes.
      const rows = (DATA.agendaRows as AnyRecord[]).map((row) => ({
        ...row,
        events_count: EVENTS.filter((event) => event.event_date === row.day).length,
      }));
      return empty ? rows.map((row) => ({ ...row, events_count: 0 })) : rows;
    }
    case 'community_search': {
      if (empty) return [];
      const query = normalizeText(args.p_q);
      if (query.length < 2) return [];
      const scope = String(args.p_scope ?? 'all');
      const scopeKind: Record<string, string> = {
        posts: 'post',
        carnets: 'carnet',
        clubs: 'club',
        sorties: 'sortie',
        membres: 'membre',
      };
      const tokens = query.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
      const rows = cloneRows(DATA.searchRows as unknown[]).filter((row) => {
        if (scope !== 'all' && scopeKind[scope] && row.kind !== scopeKind[scope]) return false;
        if (tokens.length === 0) return true;
        const haystack = normalizeText(`${row.title ?? ''} ${row.subtitle ?? ''} ${row.excerpt ?? ''}`);
        return tokens.some((token) => haystack.includes(token));
      });
      const limit = Math.max(1, Math.min(30, Number(args.p_limit ?? 5) || 5));
      if (process.env.CV2_DEBUG_MOCK === '1') {
        console.log('[mock] search', JSON.stringify({ q: args.p_q, scope, tokens, rows: rows.length, base: Array.isArray(DATA.searchRows) ? DATA.searchRows.length : 'non-array' }));
      }
      return rows.slice(0, limit);
    }
    case 'community_search_trending':
      return empty ? [] : DATA.trendingRows;
    case 'join_club': {
      const clubId = String(args.p_club ?? '');
      const club = CLUBS.find((row) => row.id === clubId);
      if (club?.privacy === 'closed') return 'pending';
      mutable.joinedClubs.add(clubId);
      return 'member';
    }
    case 'leave_club': {
      const clubId = String(args.p_club ?? '');
      return mutable.joinedClubs.delete(clubId) ? 'left' : 'none';
    }
    case 'join_event': {
      const eventId = String(args.p_event_id ?? '');
      mutable.joinedEvents.add(eventId);
      const event = EVENTS.find((row) => row.id === eventId);
      return event?.status === 'full' ? 'waitlist' : 'in';
    }
    case 'leave_event': {
      const eventId = String(args.p_event_id ?? '');
      mutable.joinedEvents.delete(eventId);
      return 'none';
    }
    default:
      return base === undefined ? null : base;
  }
}

// ── Tables PostgREST (lectures RLS directes + mutations) ───────────────────

const TABLES = (DATA.tables ?? {}) as Record<string, unknown[]>;

/** Réponse d'une table : fixtures de recette + extensions e2e documentées. */
function tablePayload(
  table: string,
  method: string,
  accept: string,
  url: URL,
  body: AnyRecord,
  role: FixtureRole,
  mutable: MutableFixtureState,
): unknown {
  const wantsObject = accept.includes('vnd.pgrst.object+json');
  const idFilter = url.searchParams.get('id') ?? url.searchParams.get('user_id') ?? '';
  const wantedId = idFilter.startsWith('eq.') ? idFilter.slice(3) : null;
  const single = (rows: unknown[]) => (wantsObject ? (rows[0] ?? null) : rows);

  if (method !== 'GET' && method !== 'HEAD') {
    // Le like de carnet change l'état des fixtures (l'UI relit ensuite la page,
    // et le compteur doit rester juste) ; les autres écritures directes restent
    // neutres : les RPC atomiques sont, elles, simulées par `rpcPayload`.
    if (table === 'carnet_likes') {
      const carnetId = typeof body.carnet_id === 'string' ? body.carnet_id : null;
      if (carnetId) {
        if (method === 'POST') mutable.likedCarnets.add(carnetId);
        if (method === 'DELETE') mutable.likedCarnets.delete(carnetId);
      }
    }
    return wantsObject ? {} : [];
  }

  switch (table) {
    case 'user_profiles':
    case 'profiles': {
      const rows = TABLES[table] ?? TABLES.user_profiles ?? [];
      return single(rows);
    }
    case 'public_profiles':
      return TABLES.public_profiles ?? [];
    case 'clubs': {
      const rows = TABLES.clubs ?? [];
      if (wantedId) {
        const feedRow = CLUBS.find((row) => row.id === wantedId);
        if (!feedRow) return single(rows);
        const detail = {
          ...(rows[0] as AnyRecord),
          ...(feedRow as unknown as AnyRecord),
          zone_geom: null,
          rules: (rows[0] as AnyRecord)?.rules ?? null,
          join_questions: (rows[0] as AnyRecord)?.join_questions ?? [],
        };
        return single([detail]);
      }
      return single(rows);
    }
    case 'club_members': {
      const userIdFilter = url.searchParams.get('user_id') ?? '';
      if (userIdFilter.startsWith('eq.')) {
        // Vue « mon rôle dans ce club » (`.maybeSingle()`) : le compte connecté
        // est admin du club (pile « Demandes »), l'invité n'a aucun rôle.
        return role === 'member' ? [{ role: 'admin', status: 'active' }] : [];
      }
      return single(TABLES.club_members ?? []);
    }
    case 'club_join_requests':
      // Extension e2e : une demande en attente côté admin, pour recetter
      // « Demandes (1) → Accepter → membre » sans base réelle.
      return role === 'member'
        ? [
            {
              id: 'r0000000-0000-4000-8000-000000000001',
              user_id: FRIEND_ID,
              answers: ['Vercors'],
              message: 'Bonjour, je souhaite rejoindre le club.',
              created_at: '2026-11-07T09:00:00Z',
            },
          ]
        : [];
    case 'events': {
      const rows = TABLES.events ?? [];
      if (wantedId) {
        const feedRow = EVENTS.find((row) => row.id === wantedId);
        if (!feedRow) return single(rows);
        const detail = {
          ...(rows[0] as AnyRecord),
          ...(feedRow as unknown as AnyRecord),
          description: (rows[0] as AnyRecord)?.description ?? null,
          safety_notes: (rows[0] as AnyRecord)?.safety_notes ?? null,
          safety_checklist: (rows[0] as AnyRecord)?.safety_checklist ?? [],
          recurrence: null,
          location_geom: null,
          meeting_geom: null,
        };
        return single([detail]);
      }
      return single(rows);
    }
    case 'event_participants': {
      const eventIdFilter = url.searchParams.get('event_id') ?? '';
      if (eventIdFilter.startsWith('eq.') && (TABLES.event_participants ?? []).length > 0) {
        const wanted = eventIdFilter.slice(3);
        const participants = (TABLES.event_participants as AnyRecord[]).filter(
          (row) => row.event_id === wanted,
        );
        if (participants.length > 0) return single(participants);
      }
      return single(TABLES.event_participants ?? []);
    }
    case 'carnets':
      return single(TABLES.carnets ?? []);
    default:
      return Array.isArray(TABLES[table]) ? TABLES[table] : [];
  }
}

// ── Helpers de parcours (communs aux specs @ui-mock) ───────────────────────

/** Raison de saut explicite quand le build n'a pas le drapeau v2. */
export const SKIP_V2_BUILD =
  'Build sans NEXT_PUBLIC_COMMUNAUTE_V2=true : les tiroirs v2 ne sont pas montés. ' +
  'Relancer `NEXT_PUBLIC_COMMUNAUTE_V2=true npm run build` puis `npm run start`.';

/** Raison de saut explicite quand le serveur Next n'est pas joignable. */
export const SKIP_SERVER =
  'Serveur Next injoignable sur PW_BASE_URL/baseURL : spec sautée (aucun faux vert).';

/** Raison de saut explicite pour les scénarios qui exigent une vraie base de test. */
export const SKIP_REAL_DB =
  'Scénario de données réelles : exige la base de test/aperçu migrée. ' +
  'Activer LKDV_E2E_DB=test (locale ou éphémère CI/aperçu) ; jamais la prod.';

/**
 * Fige l'horloge navigateur (dates relatives stables) **avant toute navigation**.
 *
 * `page.clock.setFixedTime` casse l'hydratation Next/React de cette app (les
 * scripts de la page ne s'exécutent plus et aucun handler de clic n'est posé :
 * régression reproduite le 2026-11-08). `clock.install({ time })` fige les
 * mêmes dates sans casser le démarrage : c'est la variante validée.
 */
export async function freezeClock(page: Page): Promise<void> {
  await page.clock.install({ time: new Date(FIXED_NOW) });
}

/** Vérifie que le serveur répond (avant tout test, dans `beforeAll`). */
export async function isServerReady(request: {
  get: (url: string, options?: { timeout?: number; failOnStatusCode?: boolean }) => Promise<{ status: () => number }>;
}, baseURL: string | undefined): Promise<boolean> {
  if (!baseURL) return false;
  try {
    const response = await request.get(baseURL, { timeout: 8_000, failOnStatusCode: false });
    return response.status() < 500;
  } catch {
    return false;
  }
}

/** Collecte erreurs console + exceptions page (nettoyage assertif en fin de scénario). */
export function installConsoleGuard(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return { errors };
}

/**
 * Va sur /communaute et attend la barre haute du fil (session synthétique déjà
 * posée). Échec explicite si le middleware renvoie vers /connexion : c'est le
 * signe que le nom du cookie ne correspond pas au build (variable
 * `NEXT_PUBLIC_SUPABASE_URL` du process ≠ celle du build).
 */
export async function gotoCommunity(page: Page): Promise<void> {
  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  try {
    await page.getByRole('button', { name: 'Explorer et rechercher' }).waitFor({
      state: 'visible',
      timeout: 30_000,
    });
  } catch (cause) {
    if (page.url().includes('/connexion')) {
      throw new Error(
        `Session synthétique refusée : redirection vers ${page.url()}. ` +
          "Le build et le process Playwright doivent partager la même " +
          `NEXT_PUBLIC_SUPABASE_URL (build : ${resolveSupabaseUrl()}, ` +
          `cookie : sb-${SUPABASE_REF}-auth-token). ` +
          'Relancer les tests avec NEXT_PUBLIC_SUPABASE_URL identique à celui du build.',
      );
    }
    throw cause;
  }
}

/**
 * Ouvre le tiroir Explorer par le déclencheur demandé.
 * Retour `false` si le build n'a pas la v2 (le test appelant se saute alors
 * avec `SKIP_V2_BUILD`) : jamais de faux vert.
 */
export interface OpenSheetOptions {
  /** Délai d'attente du montage (le chargement du chunk dynamique peut être lent sous charge). */
  timeoutMs?: number;
  /** Nombre de tentatives (un clic peut arriver avant l'hydratation complète). */
  attempts?: number;
}

export async function openExplorer(
  page: Page,
  trigger: 'explorer' | 'search' = 'explorer',
  options: OpenSheetOptions = {},
): Promise<boolean> {
  const attempts = options.attempts ?? 3;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const button =
    trigger === 'search'
      ? page.getByRole('button', { name: 'Rechercher dans la communauté' })
      : page.getByRole('button', { name: 'Explorer et rechercher' });
  const root = page.getByTestId('communaute-v2-explore');
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await button.click();
    try {
      await root.waitFor({ state: 'visible', timeout: timeoutMs });
      await page.locator('[data-state="open"]').first().waitFor({ state: 'attached', timeout: 5_000 });
      // Entrée de la coque : .72 s `--ease-out` (00 § 3). Cliquer pendant la
      // translation rend les éléments « instables » : on laisse l'animation finir.
      await page.waitForTimeout(850);
      return true;
    } catch (cause) {
      if (attempt < attempts) {
        await page.waitForTimeout(500);
        continue;
      }
      return reportOpenFailure(page, 'openExplorer', cause);
    }
  }
  return false;
}

/** Diagnostic commun d'un montage impossible (jamais de faux vert). */
async function reportOpenFailure(page: Page, where: string, cause: unknown): Promise<false> {
  const diagnostics = await page
    .evaluate(() => ({
      url: window.location.pathname,
      dialogs: document.querySelectorAll('[role="dialog"]').length,
      v2layer: document.querySelectorAll('.lkdv-cv2-layer').length,
      v1drawer: document.querySelectorAll('.lkdv-drawer, .lkdv-sections-drawer').length,
    }))
    .catch(() => null);
  console.log(`[${where}] montage impossible — diagnostic: ${JSON.stringify(diagnostics)}`);
  console.log(`[${where}] dernière erreur: ${cause instanceof Error ? cause.message : String(cause)}`);
  return false;
}

/**
 * Ouvre le tiroir Création par le `+` de la barre haute (Publication) ou celui
 * des stories (Story). Retour `false` si le build n'est pas v2.
 */
export async function openCreate(
  page: Page,
  kind: 'post' | 'story' = 'post',
  options: OpenSheetOptions = {},
): Promise<boolean> {
  const attempts = options.attempts ?? 3;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const root = page.getByTestId('communaute-v2-create');
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (kind === 'story') {
      await page.getByRole('button', { name: /Publier une story/ }).first().click();
    } else {
      await page.getByRole('button', { name: 'Créer dans l’application' }).click();
    }
    try {
      await root.waitFor({ state: 'visible', timeout: timeoutMs });
      await page.locator('[data-state="open"]').first().waitFor({ state: 'attached', timeout: 5_000 });
      // Entrée de la coque : .72 s `--ease-out` (00 § 3).
      await page.waitForTimeout(850);
      return true;
    } catch (cause) {
      if (attempt < attempts) {
        await page.waitForTimeout(500);
        continue;
      }
      return reportOpenFailure(page, 'openCreate', cause);
    }
  }
  return false;
}

/** Ferme le tiroir par Échap et attend le démontage (sortie .56 s). */
export async function closeByEscape(
  page: Page,
  testId: 'communaute-v2-explore' | 'communaute-v2-create',
): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.getByTestId(testId)).toHaveCount(0, { timeout: 5_000 });
}

/** Appui long Playwright (Peek) sur un élément : 460 ms + marge. */
export async function longPress(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('longPress : élément sans boîte visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
}

/** Glisse le tiroir vers le bas depuis sa poignée (fermeture > 30 % de hauteur). */
export async function dragSheetDown(page: Page, pixels = 260): Promise<void> {
  const grab = page.locator('.lkdv-cv2-grab').first();
  const box = await grab.boundingBox();
  if (!box) throw new Error('dragSheetDown : poignée introuvable');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + pixels, { steps: 12 });
  await page.mouse.up();
}

/** Vérifie l'absence de débordement horizontal (360/390/430). */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - window.innerWidth);
  });
}
