import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  PRESENCE_TTL_MS,
  ROUTE_PRESENCE_EVENT,
  ROUTE_VERSION_EVENT,
  dropRevoked,
  openRouteRealtime,
  presenceList,
  pruneBook,
  receivePresence,
  routeChannelName,
  shouldRefetchOnVersion,
  type BroadcastMessageLike,
  type RealtimeChannelLike,
  type RealtimeClientLike,
  type RealtimeStatus,
} from '../realtime';

function fakeClient() {
  const handlers = new Map<string, (m: BroadcastMessageLike) => void>();
  const types: string[] = [];
  const sent: Array<{ event: string; payload: unknown }> = [];
  let statusCb: ((s: string) => void) | undefined;
  const channel: RealtimeChannelLike = {
    on(type, filter, cb) {
      types.push(type);
      handlers.set(filter.event, cb);
      return channel;
    },
    subscribe(cb) {
      statusCb = cb;
      return channel;
    },
    send(msg) {
      sent.push({ event: msg.event, payload: msg.payload });
      return Promise.resolve('ok');
    },
  };
  const opened: Array<{ name: string; opts: unknown }> = [];
  const removed: RealtimeChannelLike[] = [];
  const client: RealtimeClientLike = {
    channel: (name, opts) => {
      opened.push({ name, opts });
      return channel;
    },
    removeChannel: (c) => {
      removed.push(c);
    },
  };
  return { client, handlers, types, sent, opened, removed, status: (s: string) => statusCb?.(s) };
}

const NOW = Date.parse('2026-11-20T10:00:00.000Z');
const member = (ids: string[]) => (id: string) => ids.includes(id);
const presence = (userId: string, extra: Record<string, unknown> = {}) => ({
  userId, displayName: 'Mina', activeStageId: 'st2', selectedEntityId: null, mode: 'editing', ...extra,
});

describe('8.8 Broadcast : canal, présence, version', () => {
  it('canal route:<workspaceId>, Broadcast seulement, sans écho de ses propres messages', () => {
    const f = fakeClient();
    const statuses: RealtimeStatus[] = [];
    openRouteRealtime(f.client, 'ws-1', { onPresence: () => {}, onVersion: () => {}, onStatus: (s) => statuses.push(s) });
    expect(routeChannelName('ws-1')).toBe('route:ws-1');
    expect(f.opened).toEqual([{ name: 'route:ws-1', opts: { config: { private: true, broadcast: { self: false } } } }]);
    // jamais postgres_changes : tous les abonnements sont de type broadcast
    expect(f.types).toEqual(['broadcast', 'broadcast']);
    expect([...f.handlers.keys()].sort()).toEqual([ROUTE_PRESENCE_EVENT, ROUTE_VERSION_EVENT].sort());
    expect(statuses).toEqual(['connecting']);
  });

  it('le code du dépôt n’emploie pas postgres_changes pour la route', () => {
    const root = join(__dirname, '..');
    for (const file of ['realtime.ts', 'components/workspace/useRouteRealtime.ts']) {
      expect(readFileSync(join(root, file), 'utf8')).not.toMatch(/['"]postgres_changes['"]/);
    }
  });

  it('live à l’abonnement, envoi seulement une fois live, fermeture propre', () => {
    const f = fakeClient();
    const statuses: RealtimeStatus[] = [];
    const conn = openRouteRealtime(f.client, 'ws-1', { onPresence: () => {}, onVersion: () => {}, onStatus: (s) => statuses.push(s) });
    conn.announceVersion({ userId: 'u1', headSeq: 4, kind: 'operation' });
    expect(f.sent).toEqual([]);
    f.status('SUBSCRIBED');
    expect(statuses).toEqual(['connecting', 'live']);
    conn.announceVersion({ userId: 'u1', headSeq: 4, kind: 'operation' });
    conn.announcePresence({ userId: 'u1', displayName: 'Alice', activeStageId: 'st1', selectedEntityId: null, mode: 'viewing' });
    expect(f.sent.map((s) => s.event)).toEqual([ROUTE_VERSION_EVENT, ROUTE_PRESENCE_EVENT]);
    conn.close();
    expect(f.removed.length).toBe(1);
    conn.announceVersion({ userId: 'u1', headSeq: 5, kind: 'operation' });
    expect(f.sent.length).toBe(2);
  });

  it('repli : erreur de canal, fermeture ou délai dépassé -> « fallback » (la lecture périodique reprend)', () => {
    for (const bad of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) {
      const f = fakeClient();
      const statuses: RealtimeStatus[] = [];
      openRouteRealtime(f.client, 'ws-1', { onPresence: () => {}, onVersion: () => {}, onStatus: (s) => statuses.push(s) });
      f.status('SUBSCRIBED');
      f.status(bad);
      expect(statuses).toEqual(['connecting', 'live', 'fallback']);
    }
    // jamais ouvert dans le délai
    const f = fakeClient();
    const statuses: RealtimeStatus[] = [];
    let fire: (() => void) | undefined;
    openRouteRealtime(
      f.client,
      'ws-1',
      { onPresence: () => {}, onVersion: () => {}, onStatus: (s) => statuses.push(s) },
      { setTimeout: (fn) => ((fire = fn), 1), clearTimeout: () => {} },
    );
    fire?.();
    expect(statuses).toEqual(['connecting', 'fallback']);
  });

  it('un envoi qui échoue bascule en repli au lieu de planter', async () => {
    const f = fakeClient();
    const statuses: RealtimeStatus[] = [];
    const ch = f.client.channel('x');
    ch.send = () => Promise.reject(new Error('réseau'));
    const conn = openRouteRealtime(f.client, 'ws-1', { onPresence: () => {}, onVersion: () => {}, onStatus: (s) => statuses.push(s) });
    f.status('SUBSCRIBED');
    conn.announceVersion({ userId: 'u1', headSeq: 1, kind: 'operation' });
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses.at(-1)).toBe('fallback');
  });

  it('présence : accepte un membre, refuse soi-même, un inconnu et un message mal formé', () => {
    const ctx = { selfId: 'u1', isMember: member(['u1', 'u2']), nowMs: NOW };
    const book = receivePresence({}, presence('u2'), ctx);
    expect(book.u2).toMatchObject({ userId: 'u2', displayName: 'Mina', activeStageId: 'st2', mode: 'editing' });
    expect(receivePresence(book, presence('u1'), ctx)).toBe(book);
    expect(receivePresence(book, presence('intrus'), ctx)).toBe(book);
    expect(receivePresence(book, { ...presence('u2'), mode: 'god' }, ctx)).toBe(book);
    expect(receivePresence(book, { ...presence('u2'), lat: 45.1 }, ctx)).toBe(book);
    expect(receivePresence(book, 'n’importe quoi', ctx)).toBe(book);
  });

  it('présence : disparaît après le délai, et dès qu’un accès est révoqué', () => {
    const ctx = { selfId: 'u1', isMember: member(['u1', 'u2', 'u3']), nowMs: NOW };
    let book = receivePresence({}, presence('u2'), ctx);
    book = receivePresence(book, presence('u3'), { ...ctx, nowMs: NOW + 25_000 });
    expect(presenceList(book, NOW + PRESENCE_TTL_MS - 1).map((e) => e.userId).sort()).toEqual(['u2', 'u3']);
    expect(presenceList(book, NOW + PRESENCE_TTL_MS + 1).map((e) => e.userId)).toEqual(['u3']);
    expect(Object.keys(pruneBook(book, NOW + PRESENCE_TTL_MS + 1))).toEqual(['u3']);
    expect(Object.keys(dropRevoked(book, member(['u1', 'u3'])))).toEqual(['u3']);
  });

  it('nouvelle version : relire si un autre membre annonce plus récent ; jamais pour soi ni un inconnu', () => {
    const ctx = { selfId: 'u1', localHeadSeq: 5, isMember: member(['u1', 'u2']) };
    expect(shouldRefetchOnVersion({ userId: 'u2', headSeq: 6 }, ctx)).toMatchObject({ headSeq: 6, kind: 'operation' });
    expect(shouldRefetchOnVersion({ userId: 'u2', headSeq: 5 }, ctx)).toBeNull();
    expect(shouldRefetchOnVersion({ userId: 'u1', headSeq: 9 }, ctx)).toBeNull();
    expect(shouldRefetchOnVersion({ userId: 'intrus', headSeq: 9 }, ctx)).toBeNull();
    expect(shouldRefetchOnVersion({ userId: 'u2', headSeq: -1 }, ctx)).toBeNull();
    expect(shouldRefetchOnVersion({ userId: 'u2', headSeq: 9, contenu: 'x' }, ctx)).toBeNull();
    // discussion / équipe : pas de séquence, on relit toujours
    expect(shouldRefetchOnVersion({ userId: 'u2', headSeq: 5, kind: 'discussion' }, ctx)?.kind).toBe('discussion');
    expect(shouldRefetchOnVersion({ userId: 'u2', headSeq: 5, kind: 'team' }, ctx)?.kind).toBe('team');
  });

  it('les messages reçus sont transmis tels quels aux rappels (validation faite par les fonctions pures)', () => {
    const f = fakeClient();
    const onPresence = vi.fn();
    const onVersion = vi.fn();
    openRouteRealtime(f.client, 'ws-1', { onPresence, onVersion, onStatus: () => {} });
    f.handlers.get(ROUTE_PRESENCE_EVENT)?.({ payload: presence('u2') });
    f.handlers.get(ROUTE_VERSION_EVENT)?.({ payload: { userId: 'u2', headSeq: 7 } });
    expect(onPresence).toHaveBeenCalledWith(presence('u2'));
    expect(onVersion).toHaveBeenCalledWith({ userId: 'u2', headSeq: 7 });
  });
});
