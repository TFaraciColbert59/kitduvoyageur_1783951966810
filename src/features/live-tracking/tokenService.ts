import { randomUUID } from 'node:crypto';
import { generateOpaqueToken, hashTokenSha256, timingSafeEqualHex } from './crypto';
import { applyPositionPrivacy, assertValidCoordinates, evaluateShareAccess } from './privacy';
import type {
  CreatedShareLink,
  CreateShareLinkInput,
  GuestTrackingReadResult,
  LivePositionPoint,
  LiveSessionState,
  LiveTrackingClock,
  LiveTrackingStore,
  P01PrivacyContext,
  PersistedShareTokenRecord,
  ShareLinkStatus,
} from './types';

export const MIN_SHARE_DURATION_MINUTES = 5;
export const MAX_SHARE_DURATION_MINUTES = 72 * 60;
export const MAX_TRAIL_POINTS = 50;

export class SystemClock implements LiveTrackingClock {
  nowMs(): number {
    return Date.now();
  }
}

export class InMemoryLiveTrackingStore implements LiveTrackingStore {
  private readonly sessions = new Map<string, LiveSessionState>();
  private readonly tokensById = new Map<string, PersistedShareTokenRecord>();
  private readonly positionsBySession = new Map<string, LivePositionPoint[]>();

  async getSession(sessionId: string): Promise<LiveSessionState | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async saveSession(session: LiveSessionState): Promise<void> {
    this.sessions.set(session.sessionId, { ...session });
  }

  async saveToken(record: PersistedShareTokenRecord): Promise<void> {
    this.tokensById.set(record.id, { ...record });
  }

  async findTokenByHash(tokenHash: string): Promise<PersistedShareTokenRecord | null> {
    for (const record of this.tokensById.values()) {
      if (timingSafeEqualHex(record.tokenHash, tokenHash)) {
        return { ...record };
      }
    }
    return null;
  }

  async listTokensBySession(sessionId: string): Promise<PersistedShareTokenRecord[]> {
    const out: PersistedShareTokenRecord[] = [];
    for (const record of this.tokensById.values()) {
      if (record.sessionId === sessionId) {
        out.push({ ...record });
      }
    }
    return out;
  }

  async updateToken(record: PersistedShareTokenRecord): Promise<void> {
    this.tokensById.set(record.id, { ...record });
  }

  async appendPosition(point: LivePositionPoint): Promise<void> {
    const existing = this.positionsBySession.get(point.sessionId) ?? [];
    const next = [...existing, { ...point }].slice(-MAX_TRAIL_POINTS);
    this.positionsBySession.set(point.sessionId, next);
  }

  async getPositions(sessionId: string): Promise<LivePositionPoint[]> {
    return [...(this.positionsBySession.get(sessionId) ?? [])];
  }

  async purgePositions(sessionId: string): Promise<void> {
    this.positionsBySession.delete(sessionId);
  }
}

export function resolveShareLinkStatus(
  record: PersistedShareTokenRecord,
  session: LiveSessionState | null,
  nowMs: number,
): ShareLinkStatus {
  if (record.revokedAtMs !== null) {
    return 'revoked';
  }
  if (nowMs >= record.expiresAtMs) {
    return 'expired';
  }
  if (!session || session.status === 'ended') {
    return 'session_ended';
  }
  return 'active';
}

export class LiveTrackingTokenService {
  constructor(
    private readonly store: LiveTrackingStore,
    private readonly clock: LiveTrackingClock = new SystemClock(),
  ) {}

  async createShareLink(
    input: CreateShareLinkInput,
    privacy: P01PrivacyContext = { liveSharingAllowed: true },
  ): Promise<
    | { ok: true; link: CreatedShareLink }
    | {
        ok: false;
        error: 'invalid_duration' | 'session_not_active' | 'unauthorized' | 'privacy_denied';
      }
  > {
    if (
      !Number.isInteger(input.durationMinutes) ||
      input.durationMinutes < MIN_SHARE_DURATION_MINUTES ||
      input.durationMinutes > MAX_SHARE_DURATION_MINUTES
    ) {
      return { ok: false, error: 'invalid_duration' };
    }

    if (!privacy.liveSharingAllowed) {
      return { ok: false, error: 'privacy_denied' };
    }

    const session = await this.store.getSession(input.sessionId);
    if (!session || session.status === 'ended') {
      return { ok: false, error: 'session_not_active' };
    }
    if (session.ownerUserId !== input.ownerUserId) {
      return { ok: false, error: 'unauthorized' };
    }

    const nowMs = this.clock.nowMs();
    const expiresAtMs = nowMs + input.durationMinutes * 60_000;
    const rawToken = generateOpaqueToken(32);
    const tokenHash = hashTokenSha256(rawToken);

    const record: PersistedShareTokenRecord = {
      id: randomUUID(),
      sessionId: input.sessionId,
      ownerUserId: input.ownerUserId,
      tokenHash,
      label: input.label?.trim() || undefined,
      createdAtMs: nowMs,
      expiresAtMs,
      revokedAtMs: null,
      lastAccessedAtMs: null,
      includeTrail: Boolean(input.includeTrail),
    };

    await this.store.saveToken(record);

    return {
      ok: true,
      link: {
        record,
        rawToken,
        expiresAtIso: new Date(expiresAtMs).toISOString(),
      },
    };
  }

  async revokeShareLink(
    tokenId: string,
    ownerUserId: string,
    sessionId: string,
  ): Promise<{ ok: true } | { ok: false; error: 'not_found' | 'unauthorized' }> {
    const tokens = await this.store.listTokensBySession(sessionId);
    const target = tokens.find((t) => t.id === tokenId);
    if (!target) {
      return { ok: false, error: 'not_found' };
    }
    if (target.ownerUserId !== ownerUserId) {
      return { ok: false, error: 'unauthorized' };
    }
    if (target.revokedAtMs === null) {
      await this.store.updateToken({
        ...target,
        revokedAtMs: this.clock.nowMs(),
      });
    }
    return { ok: true };
  }

  /**
   * Termine la séance : révoque tous les jetons actifs et purge immédiatement les positions.
   */
  async endSession(
    sessionId: string,
    ownerUserId: string,
  ): Promise<{ ok: true } | { ok: false; error: 'not_found' | 'unauthorized' }> {
    const session = await this.store.getSession(sessionId);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    if (session.ownerUserId !== ownerUserId) {
      return { ok: false, error: 'unauthorized' };
    }

    const nowMs = this.clock.nowMs();
    await this.store.saveSession({
      ...session,
      status: 'ended',
      endedAtMs: nowMs,
    });

    const tokens = await this.store.listTokensBySession(sessionId);
    for (const token of tokens) {
      if (token.revokedAtMs === null) {
        await this.store.updateToken({
          ...token,
          revokedAtMs: nowMs,
        });
      }
    }

    await this.store.purgePositions(sessionId);
    return { ok: true };
  }

  async publishPosition(
    point: LivePositionPoint,
    ownerUserId: string,
  ): Promise<{ ok: true } | { ok: false; error: 'session_not_active' | 'unauthorized' }> {
    assertValidCoordinates(point.lat, point.lng);
    const session = await this.store.getSession(point.sessionId);
    if (!session || session.status === 'ended') {
      return { ok: false, error: 'session_not_active' };
    }
    if (session.ownerUserId !== ownerUserId) {
      return { ok: false, error: 'unauthorized' };
    }
    await this.store.appendPosition(point);
    return { ok: true };
  }

  /**
   * Lecture invité fail-closed : aucune coordonnée ni historique sans jeton SHA-256 valide,
   * non révoqué, non expiré, sur une séance non terminée et autorisée par P01.
   */
  async readGuestView(
    rawToken: string,
    privacy: P01PrivacyContext = { liveSharingAllowed: true },
  ): Promise<GuestTrackingReadResult> {
    const normalized = rawToken.trim();
    if (!normalized) {
      return { ok: false, reason: 'invalid_token' };
    }

    const tokenHash = hashTokenSha256(normalized);
    const record = await this.store.findTokenByHash(tokenHash);
    if (!record) {
      return { ok: false, reason: 'invalid_token' };
    }

    const session = await this.store.getSession(record.sessionId);
    const nowMs = this.clock.nowMs();
    const access = evaluateShareAccess(record, session, privacy, nowMs);
    if (!access.allowed) {
      return { ok: false, reason: access.reason };
    }

    await this.store.updateToken({
      ...record,
      lastAccessedAtMs: nowMs,
    });

    const points = await this.store.getPositions(record.sessionId);
    const radiusM = privacy.obfuscationRadiusM ?? session?.privacyMaskRadiusM ?? 0;
    const views = points.map((pt) => applyPositionPrivacy(pt, nowMs, radiusM));
    const latestPosition = views.length > 0 ? views[views.length - 1] : null;
    const trail = record.includeTrail ? views : [];

    return {
      ok: true,
      sessionId: record.sessionId,
      status: session!.status === 'paused' ? 'paused' : 'active',
      expiresAtIso: new Date(record.expiresAtMs).toISOString(),
      latestPosition,
      trail,
    };
  }
}
