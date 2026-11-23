import { z } from 'zod';
import type { PresenceEntry } from './types';

/**
 * 8.8 — Temps réel de /compas/itineraire par Supabase Realtime **Broadcast** (jamais `postgres_changes`, premier poste
 * de dépense de la base). Deux messages, sur le canal `route:<workspaceId>` :
 *  - `presence` : qui est sur quelle étape (légère, sans curseur ni coordonnées) ;
 *  - `version`  : « une nouvelle version est disponible » (le numéro de séquence seulement).
 *
 * Un message Broadcast ne transporte jamais le contenu de l'itinéraire : à réception d'un `version`, le client relit
 * par l'API authentifiée (RLS), exactement comme avec la lecture périodique, qui reste le repli si Realtime est
 * indisponible. Ce module est pur : le client Supabase est injecté (`RealtimeClientLike`), donc testable sans réseau.
 *
 * Limite assumée : un canal Broadcast public est écoutable par qui connaît son nom (`route:` + l'UUID de l'espace).
 * Les messages ne contiennent que le prénom affiché, l'étape active et un numéro de séquence ; les canaux privés
 * (autorisation sur `realtime.messages`) demandent une migration, hors périmètre ici.
 */

export const ROUTE_PRESENCE_EVENT = 'presence';
export const ROUTE_VERSION_EVENT = 'version';
/** Une présence non rafraîchie depuis ce délai disparaît (comme `prunePresence` côté serveur). */
export const PRESENCE_TTL_MS = 30_000;
/** Rafraîchissement de sa propre présence : plus court que le TTL, pour qu'un arrivant voie tout le monde vite. */
export const PRESENCE_HEARTBEAT_MS = 10_000;
/** Délai avant de se déclarer en repli si le canal ne s'ouvre pas. */
export const REALTIME_OPEN_TIMEOUT_MS = 8_000;

export function routeChannelName(workspaceId: string): string {
  return `route:${workspaceId}`;
}

const IdText = z.string().min(1).max(120);

export const PresencePayloadSchema = z
  .object({
    userId: IdText,
    displayName: z.string().max(120),
    activeStageId: z.string().max(80).nullable(),
    selectedEntityId: z.string().max(80).nullable(),
    mode: z.enum(['viewing', 'editing', 'reviewing']),
  })
  .strict();

export const VersionPayloadSchema = z
  .object({
    userId: IdText,
    headSeq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    /** `operation` : le tracé a changé (numéro de séquence) ; `discussion` : commentaire ou proposition ; `team` : membres. */
    kind: z.enum(['operation', 'discussion', 'team']).default('operation'),
  })
  .strict();

export type PresencePayload = z.infer<typeof PresencePayloadSchema>;
export type VersionPayload = z.infer<typeof VersionPayloadSchema>;
export type VersionKind = VersionPayload['kind'];

export type RealtimeStatus = 'off' | 'connecting' | 'live' | 'fallback';

/* ---------- Présence ---------- */

export type PresenceBook = Record<string, PresenceEntry>;

/** Intègre un message de présence reçu. Ignore tout ce qui n'est pas valide, n'est pas d'un membre, ou est de soi. */
export function receivePresence(
  book: PresenceBook,
  raw: unknown,
  ctx: { readonly selfId: string; readonly isMember: (userId: string) => boolean; readonly nowMs: number },
): PresenceBook {
  const parsed = PresencePayloadSchema.safeParse(raw);
  if (!parsed.success) return book;
  const p = parsed.data;
  if (p.userId === ctx.selfId || !ctx.isMember(p.userId)) return book;
  return {
    ...book,
    [p.userId]: {
      userId: p.userId,
      displayName: p.displayName,
      activeStageId: p.activeStageId,
      selectedEntityId: p.selectedEntityId,
      softLockEntityId: null,
      softLockExpiresAt: null,
      mode: p.mode,
      lastSeenAt: new Date(ctx.nowMs).toISOString(),
    },
  };
}

export function presenceList(book: PresenceBook, nowMs: number): PresenceEntry[] {
  return Object.values(book).filter((e) => {
    const seen = Date.parse(e.lastSeenAt);
    return Number.isFinite(seen) && nowMs - seen <= PRESENCE_TTL_MS;
  });
}

export function pruneBook(book: PresenceBook, nowMs: number): PresenceBook {
  const kept = presenceList(book, nowMs);
  if (kept.length === Object.keys(book).length) return book;
  return Object.fromEntries(kept.map((e) => [e.userId, e]));
}

/** Retire de la présence ceux qui ont perdu leur accès. */
export function dropRevoked(book: PresenceBook, isMember: (userId: string) => boolean): PresenceBook {
  const keys = Object.keys(book);
  if (keys.every((k) => isMember(k))) return book;
  return Object.fromEntries(Object.entries(book).filter(([k]) => isMember(k)));
}

/* ---------- Version ---------- */

/**
 * Faut-il relire ? Oui si un autre membre annonce une séquence plus récente que la nôtre ; un message de discussion
 * ou d'équipe n'a pas de séquence (ces parties ne la font pas avancer) : il déclenche toujours une relecture.
 */
export function shouldRefetchOnVersion(
  raw: unknown,
  ctx: { readonly selfId: string; readonly localHeadSeq: number; readonly isMember: (userId: string) => boolean },
): VersionPayload | null {
  const parsed = VersionPayloadSchema.safeParse(raw);
  if (!parsed.success) return null;
  const v = parsed.data;
  if (v.userId === ctx.selfId || !ctx.isMember(v.userId)) return null;
  return v.kind !== 'operation' || v.headSeq > ctx.localHeadSeq ? v : null;
}

/* ---------- Canal ---------- */

export interface BroadcastMessageLike {
  readonly payload?: unknown;
}

export interface RealtimeChannelLike {
  on(
    type: 'broadcast',
    filter: { event: string },
    callback: (message: BroadcastMessageLike) => void,
  ): RealtimeChannelLike;
  subscribe(callback?: (status: string, err?: unknown) => void): RealtimeChannelLike;
  send(message: { type: 'broadcast'; event: string; payload: unknown }): Promise<unknown> | unknown;
}

export interface RealtimeClientLike {
  channel(name: string, opts?: { config?: { broadcast?: { self?: boolean; ack?: boolean } } }): RealtimeChannelLike;
  removeChannel(channel: RealtimeChannelLike): Promise<unknown> | unknown;
}

export interface RouteRealtimeHandlers {
  readonly onPresence: (raw: unknown) => void;
  readonly onVersion: (raw: unknown) => void;
  readonly onStatus: (status: RealtimeStatus) => void;
}

export interface RouteRealtimeConnection {
  announcePresence(payload: PresencePayload): void;
  announceVersion(payload: VersionPayload): void;
  close(): void;
}

/**
 * Ouvre le canal `route:<id>` (Broadcast, `self: false` : on ne reçoit pas ses propres messages).
 * Statut `live` quand le canal est abonné ; `fallback` s'il échoue, se ferme ou ne s'ouvre pas à temps :
 * l'appelant reprend alors la lecture périodique, y compris pour la présence.
 */
export function openRouteRealtime(
  client: RealtimeClientLike,
  workspaceId: string,
  handlers: RouteRealtimeHandlers,
  timers: {
    readonly setTimeout: (fn: () => void, ms: number) => unknown;
    readonly clearTimeout: (h: unknown) => void;
  } = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
): RouteRealtimeConnection {
  let status: RealtimeStatus = 'connecting';
  let closed = false;
  const setStatus = (next: RealtimeStatus) => {
    if (closed || next === status) return;
    status = next;
    handlers.onStatus(next);
  };
  handlers.onStatus('connecting');

  const channel = client.channel(routeChannelName(workspaceId), { config: { broadcast: { self: false } } });
  const openTimer = timers.setTimeout(() => {
    if (status === 'connecting') setStatus('fallback');
  }, REALTIME_OPEN_TIMEOUT_MS);

  channel
    .on('broadcast', { event: ROUTE_PRESENCE_EVENT }, (m) => handlers.onPresence(m.payload))
    .on('broadcast', { event: ROUTE_VERSION_EVENT }, (m) => handlers.onVersion(m.payload))
    .subscribe((s) => {
      if (s === 'SUBSCRIBED') {
        timers.clearTimeout(openTimer);
        setStatus('live');
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        timers.clearTimeout(openTimer);
        setStatus('fallback');
      }
    });

  const send = (event: string, payload: unknown) => {
    if (closed || status !== 'live') return;
    try {
      const out = channel.send({ type: 'broadcast', event, payload });
      if (out && typeof (out as Promise<unknown>).catch === 'function') {
        (out as Promise<unknown>).catch(() => setStatus('fallback'));
      }
    } catch {
      setStatus('fallback');
    }
  };

  return {
    announcePresence: (payload) => send(ROUTE_PRESENCE_EVENT, payload),
    announceVersion: (payload) => send(ROUTE_VERSION_EVENT, payload),
    close: () => {
      if (closed) return;
      timers.clearTimeout(openTimer);
      closed = true;
      try {
        void client.removeChannel(channel);
      } catch {
        /* canal déjà fermé */
      }
    },
  };
}
