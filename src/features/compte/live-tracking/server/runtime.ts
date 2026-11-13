import { randomUUID } from 'node:crypto';

import {
  InMemoryLiveTrackingStore,
  InMemorySafetyContactStore,
  LiveTrackingTokenService,
  SafetyContactService,
  SystemClock,
  WatchLiveTrackingAdapter,
  computePositionFreshness,
  resolveShareLinkStatus,
  type CreateShareLinkInput,
  type CreatedShareLink,
  type GuestTrackingReadResult,
  type LivePositionPoint,
  type LiveSessionState,
  type LiveTrackingClock,
  type SafetyBroadcastResult,
  type SafetyContact,
  type SafetyNotificationEvent,
  type SafetyNotificationPayload,
  type SafetyNotifier,
  type WatchCommand,
  type WatchCommandResult,
  type WatchDeviceInfo,
  type WatchSnapshot,
} from '@/features/live-tracking';

import type { CreatedShareLinkView, OwnerLiveTrackingStatus, ShareLinkView } from '../types';

export const DEFAULT_SHARE_DURATION_MINUTES = 60;
export const MAX_NOTIFICATION_LOG = 20;

function readShareBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    'https://lkdv.app';
  return `${explicit.replace(/\/+$/, '')}/live/`;
}

/**
 * Notifier de développement : il n'envoie aucun e-mail/SMS réel, il garde une
 * trace consultable par l'écran propriétaire. Le branchement d'un fournisseur
 * passe par ce même port `SafetyNotifier`, sans toucher aux routes.
 */
export class RecordingSafetyNotifier implements SafetyNotifier {
  constructor(private readonly log: SafetyNotificationPayload[] = []) {}

  get sent(): SafetyNotificationPayload[] {
    return this.log;
  }

  async send(payload: SafetyNotificationPayload): Promise<{ ok: boolean }> {
    this.log.push({ ...payload });
    if (this.log.length > MAX_NOTIFICATION_LOG) this.log.shift();
    return { ok: true };
  }
}

export type StartSessionResult =
  | { ok: true; session: LiveSessionState }
  | { ok: false; error: 'invalid_session' | 'unauthorized' | 'session_ended' };

export type OwnerResult<T> =
  { ok: true; value: T } | { ok: false; error: 'not_found' | 'unauthorized' | 'conflict' };

/**
 * Orchestration serveur du lot P02.
 *
 * Le contrat `src/features/live-tracking` reste la seule autorité pour les
 * jetons, le consentement et le fail-closed. Cette classe ajoute ce que le
 * contrat ne porte pas : l'index propriétaire → séances (pour lister ce qui
 * appartient à l'appelant) et les vues sans secret.
 *
 * En l'absence de table dédiée à ce lot, le store est un singleton mémoire
 * borné au processus. Il est injectable pour les tests et remplaçable par un
 * store persistant sans changer les routes.
 */
export class LiveTrackingRuntime {
  readonly store: InMemoryLiveTrackingStore;
  readonly contactStore: InMemorySafetyContactStore;
  readonly tokens: LiveTrackingTokenService;
  readonly safety: SafetyContactService;
  readonly watch: WatchLiveTrackingAdapter;
  readonly clock: LiveTrackingClock;
  readonly shareBaseUrl: string;
  readonly notifications: SafetyNotificationPayload[];

  private readonly sessionIdsByOwner = new Map<string, Set<string>>();
  private readonly watchPlatformBySession = new Map<string, WatchDeviceInfo['platform']>();

  constructor(
    options: {
      clock?: LiveTrackingClock;
      shareBaseUrl?: string;
      notifier?: SafetyNotifier;
    } = {}
  ) {
    this.clock = options.clock ?? new SystemClock();
    this.shareBaseUrl = (options.shareBaseUrl ?? readShareBaseUrl()).replace(/\/?$/, '/');
    this.store = new InMemoryLiveTrackingStore();
    this.contactStore = new InMemorySafetyContactStore();
    this.tokens = new LiveTrackingTokenService(this.store, this.clock);

    this.notifications = [];
    const downstream = options.notifier;
    const notifier: SafetyNotifier = {
      send: async (payload) => {
        this.notifications.push({ ...payload });
        if (this.notifications.length > MAX_NOTIFICATION_LOG) this.notifications.shift();
        return downstream ? downstream.send(payload) : { ok: true };
      },
    };
    this.safety = new SafetyContactService(this.contactStore, notifier, this.clock);
    this.watch = new WatchLiveTrackingAdapter(
      this.store,
      this.tokens,
      this.safety,
      this.clock,
      this.shareBaseUrl
    );
  }

  private rememberSession(ownerUserId: string, sessionId: string): void {
    const existing = this.sessionIdsByOwner.get(ownerUserId) ?? new Set<string>();
    existing.add(sessionId);
    this.sessionIdsByOwner.set(ownerUserId, existing);
  }

  private ownerOwns(ownerUserId: string, sessionId: string): boolean {
    return this.sessionIdsByOwner.get(ownerUserId)?.has(sessionId) ?? false;
  }

  private async ownedSession(
    ownerUserId: string,
    sessionId: string
  ): Promise<LiveSessionState | null> {
    const session = await this.store.getSession(sessionId);
    if (!session || session.ownerUserId !== ownerUserId) return null;
    this.rememberSession(ownerUserId, sessionId);
    return session;
  }

  async startSession(
    ownerUserId: string,
    options: { sessionId?: string; startedAtMs?: number; status?: 'active' | 'paused' } = {}
  ): Promise<StartSessionResult> {
    const sessionId = options.sessionId?.trim() || randomUUID();
    if (!sessionId || sessionId.length > 128) {
      return { ok: false, error: 'invalid_session' };
    }

    const existing = await this.store.getSession(sessionId);
    if (existing) {
      if (existing.ownerUserId !== ownerUserId) return { ok: false, error: 'unauthorized' };
      if (existing.status === 'ended') return { ok: false, error: 'session_ended' };
      this.rememberSession(ownerUserId, sessionId);
      return { ok: true, session: existing };
    }

    const session: LiveSessionState = {
      sessionId,
      ownerUserId,
      status: options.status ?? 'active',
      startedAtMs: options.startedAtMs ?? this.clock.nowMs(),
      endedAtMs: null,
    };
    await this.store.saveSession(session);
    this.rememberSession(ownerUserId, sessionId);
    return { ok: true, session };
  }

  async listSessions(ownerUserId: string): Promise<LiveSessionState[]> {
    const ids = this.sessionIdsByOwner.get(ownerUserId);
    if (!ids || ids.size === 0) return [];
    const sessions = await Promise.all([...ids].map((id) => this.store.getSession(id)));
    return sessions
      .filter((session): session is LiveSessionState => Boolean(session))
      .sort((a, b) => b.startedAtMs - a.startedAtMs);
  }

  async listLinks(ownerUserId: string, sessionId?: string): Promise<ShareLinkView[]> {
    const sessions = sessionId
      ? [await this.ownedSession(ownerUserId, sessionId)].filter(
          (session): session is LiveSessionState => Boolean(session)
        )
      : await this.listSessions(ownerUserId);

    const nowMs = this.clock.nowMs();
    const links: ShareLinkView[] = [];
    for (const session of sessions) {
      const records = await this.store.listTokensBySession(session.sessionId);
      for (const record of records) {
        links.push(toShareLinkView(record, session, nowMs));
      }
    }
    return links.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
  }

  async createShareLink(
    ownerUserId: string,
    input: Omit<CreateShareLinkInput, 'ownerUserId'>
  ): Promise<
    | { ok: true; link: CreatedShareLinkView; record: CreatedShareLink['record'] }
    | {
        ok: false;
        error: 'invalid_duration' | 'session_not_active' | 'unauthorized' | 'privacy_denied';
      }
  > {
    const session = await this.store.getSession(input.sessionId);
    if (!session) return { ok: false, error: 'session_not_active' };
    if (session.ownerUserId !== ownerUserId) return { ok: false, error: 'unauthorized' };

    const created = await this.tokens.createShareLink({ ...input, ownerUserId });
    if (!created.ok) return created;

    this.rememberSession(ownerUserId, session.sessionId);
    return {
      ok: true,
      record: created.link.record,
      link: {
        link: toShareLinkView(created.link.record, session, this.clock.nowMs()),
        shareUrl: `${this.shareBaseUrl}${created.link.rawToken}`,
        expiresAtIso: created.link.expiresAtIso,
      },
    };
  }

  async revokeShareLink(
    ownerUserId: string,
    tokenId: string,
    sessionId?: string
  ): Promise<{ ok: true } | { ok: false; error: 'not_found' | 'unauthorized' }> {
    const sessions = sessionId
      ? [await this.ownedSession(ownerUserId, sessionId)].filter(
          (session): session is LiveSessionState => Boolean(session)
        )
      : await this.listSessions(ownerUserId);

    for (const session of sessions) {
      const records = await this.store.listTokensBySession(session.sessionId);
      const record = records.find((candidate) => candidate.id === tokenId);
      if (!record) continue;
      if (record.ownerUserId !== ownerUserId) return { ok: false, error: 'unauthorized' };
      return this.tokens.revokeShareLink(tokenId, ownerUserId, session.sessionId);
    }
    return { ok: false, error: 'not_found' };
  }

  async endSession(
    ownerUserId: string,
    sessionId: string
  ): Promise<{ ok: true } | { ok: false; error: 'not_found' | 'unauthorized' }> {
    const session = await this.store.getSession(sessionId);
    if (!session) return { ok: false, error: 'not_found' };
    if (session.ownerUserId !== ownerUserId) return { ok: false, error: 'unauthorized' };
    this.rememberSession(ownerUserId, sessionId);
    return this.tokens.endSession(sessionId, ownerUserId);
  }

  async setSessionStatus(
    ownerUserId: string,
    sessionId: string,
    status: 'active' | 'paused' | 'ended'
  ): Promise<
    { ok: true; session: LiveSessionState } | { ok: false; error: 'not_found' | 'unauthorized' }
  > {
    if (status === 'ended') {
      const ended = await this.endSession(ownerUserId, sessionId);
      if (!ended.ok) return ended;
      const session = await this.store.getSession(sessionId);
      if (!session) return { ok: false, error: 'not_found' };
      return { ok: true, session };
    }

    const session = await this.store.getSession(sessionId);
    if (!session) return { ok: false, error: 'not_found' };
    if (session.ownerUserId !== ownerUserId) return { ok: false, error: 'unauthorized' };
    if (session.status === 'ended') return { ok: false, error: 'not_found' };

    const updated: LiveSessionState = { ...session, status, endedAtMs: null };
    await this.store.saveSession(updated);
    this.rememberSession(ownerUserId, sessionId);
    return { ok: true, session: updated };
  }

  async publishPosition(
    ownerUserId: string,
    point: LivePositionPoint
  ): Promise<
    | { ok: true; point: LivePositionPoint }
    | { ok: false; error: 'session_not_active' | 'unauthorized' | 'invalid_position' }
  > {
    try {
      const result = await this.tokens.publishPosition(point, ownerUserId);
      if (!result.ok) return result;
      this.rememberSession(ownerUserId, point.sessionId);
      return { ok: true, point };
    } catch (error) {
      if (error instanceof Error && /coordonn|invalide/i.test(error.message)) {
        return { ok: false, error: 'invalid_position' };
      }
      throw error;
    }
  }

  async listPositions(
    ownerUserId: string,
    sessionId: string
  ): Promise<
    { ok: true; points: LivePositionPoint[] } | { ok: false; error: 'not_found' | 'unauthorized' }
  > {
    const session = await this.ownedSession(ownerUserId, sessionId);
    if (!session) return { ok: false, error: 'not_found' };
    return { ok: true, points: await this.store.getPositions(sessionId) };
  }

  async readGuestView(
    rawToken: string,
    options: { viewerId?: string | null; obfuscationRadiusM?: number } = {}
  ): Promise<GuestTrackingReadResult> {
    return this.tokens.readGuestView(rawToken, {
      liveSharingAllowed: true,
      viewerId: options.viewerId ?? null,
      obfuscationRadiusM: options.obfuscationRadiusM,
    });
  }

  async listContacts(ownerUserId: string): Promise<SafetyContact[]> {
    return this.contactStore.listByOwner(ownerUserId);
  }

  async addContact(
    ownerUserId: string,
    input: { displayName: string; channel: SafetyContact['channel']; destination: string }
  ) {
    return this.safety.addContact({ ...input, ownerUserId });
  }

  async setContactConsent(
    ownerUserId: string,
    contactId: string,
    consentStatus: 'accepted' | 'revoked'
  ) {
    return this.safety.setConsent(contactId, ownerUserId, consentStatus);
  }

  async removeContact(ownerUserId: string, contactId: string) {
    return this.safety.removeContact(contactId, ownerUserId);
  }

  async broadcast(
    ownerUserId: string,
    input: {
      sessionId: string;
      event: SafetyNotificationEvent;
      shareUrl?: string;
      targetContactIds?: string[];
    }
  ): Promise<
    { ok: true; result: SafetyBroadcastResult } | { ok: false; error: 'not_found' | 'unauthorized' }
  > {
    const session = await this.ownedSession(ownerUserId, input.sessionId);
    if (!session) return { ok: false, error: 'not_found' };
    const result = await this.safety.broadcastEvent({
      ownerUserId,
      sessionId: input.sessionId,
      event: input.event,
      shareUrl: input.shareUrl,
      targetContactIds: input.targetContactIds,
    });
    return { ok: true, result };
  }

  async handleWatchCommand(
    ownerUserId: string,
    device: WatchDeviceInfo,
    command: WatchCommand
  ): Promise<WatchCommandResult> {
    if (command.ownerUserId !== ownerUserId) {
      return {
        ok: false,
        error: 'unauthorized',
        message: 'Accès non autorisé à cette séance.',
      };
    }
    const result = await this.watch.handleCommand(device, command);
    if (result.ok) {
      this.rememberSession(ownerUserId, command.sessionId);
      this.watchPlatformBySession.set(command.sessionId, device.platform);
    }
    return result;
  }

  async getStatus(ownerUserId: string, sessionId?: string): Promise<OwnerLiveTrackingStatus> {
    const allSessions = await this.listSessions(ownerUserId);
    const sessions = sessionId
      ? allSessions.filter((session) => session.sessionId === sessionId)
      : allSessions;
    const links = await this.listLinks(ownerUserId, sessionId);
    const contacts = await this.listContacts(ownerUserId);
    const activeSession =
      (sessionId ? sessions.find((session) => session.sessionId === sessionId) : undefined) ??
      sessions.find((session) => session.status === 'active') ??
      sessions.find((session) => session.status === 'paused') ??
      null;

    return {
      sessions,
      links,
      contacts,
      activeSessionId: activeSession?.sessionId ?? null,
      shareBaseUrl: this.shareBaseUrl,
      watch: activeSession ? await this.buildWatchSnapshot(activeSession) : null,
      notifications: [...this.notifications],
      nowMs: this.clock.nowMs(),
    };
  }

  private async buildWatchSnapshot(session: LiveSessionState): Promise<WatchSnapshot> {
    const nowMs = this.clock.nowMs();
    const records = await this.store.listTokensBySession(session.sessionId);
    const active = records.filter(
      (record) => resolveShareLinkStatus(record, session, nowMs) === 'active'
    );
    const expiresAtMs = active.reduce((max, record) => Math.max(max, record.expiresAtMs), 0);
    const positions = await this.store.getPositions(session.sessionId);
    const latest = positions.length > 0 ? positions[positions.length - 1] : null;

    return {
      platform: this.watchPlatformBySession.get(session.sessionId) ?? 'apple_watch',
      sessionId: session.sessionId,
      isSharingActive: active.length > 0 && session.status !== 'ended',
      activeLinkCount: active.length,
      expiresAtIso: expiresAtMs > 0 ? new Date(expiresAtMs).toISOString() : null,
      lastPositionAgeSeconds: latest
        ? computePositionFreshness(latest.recordedAtMs, nowMs).ageSeconds
        : null,
    };
  }
}

function toShareLinkView(
  record: CreatedShareLink['record'],
  session: LiveSessionState,
  nowMs: number
): ShareLinkView {
  return {
    id: record.id,
    sessionId: record.sessionId,
    label: record.label,
    createdAtIso: new Date(record.createdAtMs).toISOString(),
    expiresAtIso: new Date(record.expiresAtMs).toISOString(),
    revokedAtIso: record.revokedAtMs === null ? null : new Date(record.revokedAtMs).toISOString(),
    lastAccessedAtIso:
      record.lastAccessedAtMs === null ? null : new Date(record.lastAccessedAtMs).toISOString(),
    includeTrail: record.includeTrail,
    status: resolveShareLinkStatus(record, session, nowMs),
  };
}

type RuntimeGlobal = typeof globalThis & {
  __lkdvP02LiveTrackingRuntime?: LiveTrackingRuntime;
};

/** Singleton par processus, réinitialisable depuis les tests. */
export function getLiveTrackingRuntime(): LiveTrackingRuntime {
  const globalRuntime = globalThis as RuntimeGlobal;
  if (!globalRuntime.__lkdvP02LiveTrackingRuntime) {
    globalRuntime.__lkdvP02LiveTrackingRuntime = new LiveTrackingRuntime();
  }
  return globalRuntime.__lkdvP02LiveTrackingRuntime;
}

export function resetLiveTrackingRuntime(): void {
  const globalRuntime = globalThis as RuntimeGlobal;
  delete globalRuntime.__lkdvP02LiveTrackingRuntime;
}
