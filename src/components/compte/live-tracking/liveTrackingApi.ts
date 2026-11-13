import type {
  GuestTrackingReadResult,
  LiveSessionState,
  SafetyBroadcastResult,
  SafetyContact,
  SafetyContactChannel,
  SafetyNotificationEvent,
  WatchCommand,
  WatchCommandResult,
  WatchDeviceInfo,
} from '@/features/live-tracking';

import type {
  CreatedShareLinkView,
  OwnerLiveTrackingStatus,
  ShareLinkView,
} from '@/features/compte/live-tracking/types';

export class LiveTrackingApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'LiveTrackingApiError';
  }
}

export interface LiveTrackingApi {
  getStatus(sessionId?: string): Promise<OwnerLiveTrackingStatus>;
  startSession(sessionId?: string): Promise<LiveSessionState>;
  updateSession(
    sessionId: string,
    status: 'active' | 'paused' | 'ended'
  ): Promise<LiveSessionState>;
  endSession(sessionId: string): Promise<void>;
  listLinks(sessionId?: string): Promise<ShareLinkView[]>;
  createShareLink(input: {
    sessionId: string;
    durationMinutes: number;
    label?: string;
    includeTrail?: boolean;
  }): Promise<CreatedShareLinkView>;
  revokeShareLink(tokenId: string, sessionId?: string): Promise<void>;
  listContacts(): Promise<SafetyContact[]>;
  addContact(input: {
    displayName: string;
    channel: SafetyContactChannel;
    destination: string;
  }): Promise<SafetyContact>;
  setContactConsent(
    contactId: string,
    consentStatus: 'accepted' | 'revoked'
  ): Promise<SafetyContact>;
  removeContact(contactId: string): Promise<void>;
  fetchGuestView(token: string): Promise<GuestTrackingReadResult>;
  broadcast(input: {
    sessionId: string;
    event: SafetyNotificationEvent;
    shareUrl?: string;
    targetContactIds?: string[];
  }): Promise<SafetyBroadcastResult>;
  watchCommand(input: {
    device: WatchDeviceInfo;
    command: WatchCommand;
  }): Promise<WatchCommandResult>;
}

type Fetcher = typeof fetch;

async function parseJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && typeof payload.error === 'string'
        ? payload.error
        : 'Une erreur est survenue.';
    throw new LiveTrackingApiError(message, response.status);
  }
  return payload as T;
}

export function createLiveTrackingApi(fetcher: Fetcher = fetch): LiveTrackingApi {
  const base = '/api/live-tracking';

  return {
    async getStatus(sessionId) {
      const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
      return parseJson<OwnerLiveTrackingStatus>(await fetcher(`${base}/status${query}`));
    },

    async startSession(sessionId) {
      const payload = await parseJson<{ session: LiveSessionState }>(
        await fetcher(`${base}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionId ? { sessionId } : {}),
        })
      );
      return payload.session;
    },

    async updateSession(sessionId, status) {
      const payload = await parseJson<{ session: LiveSessionState }>(
        await fetcher(`${base}/sessions/${encodeURIComponent(sessionId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
      );
      return payload.session;
    },

    async endSession(sessionId) {
      await parseJson<{ status: string }>(
        await fetcher(`${base}/sessions/${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
        })
      );
    },

    async listLinks(sessionId) {
      const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
      const payload = await parseJson<{ links: ShareLinkView[] }>(
        await fetcher(`${base}/share-links${query}`)
      );
      return payload.links;
    },

    async createShareLink(input) {
      return parseJson<CreatedShareLinkView>(
        await fetcher(`${base}/share-links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
      );
    },

    async revokeShareLink(tokenId, sessionId) {
      const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
      await parseJson<{ status: string }>(
        await fetcher(`${base}/share-links/${encodeURIComponent(tokenId)}${query}`, {
          method: 'DELETE',
        })
      );
    },

    async listContacts() {
      const payload = await parseJson<{ contacts: SafetyContact[] }>(
        await fetcher(`${base}/safety-contacts`)
      );
      return payload.contacts;
    },

    async addContact(input) {
      const payload = await parseJson<{ contact: SafetyContact }>(
        await fetcher(`${base}/safety-contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
      );
      return payload.contact;
    },

    async setContactConsent(contactId, consentStatus) {
      const payload = await parseJson<{ contact: SafetyContact }>(
        await fetcher(`${base}/safety-contacts/${encodeURIComponent(contactId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consentStatus }),
        })
      );
      return payload.contact;
    },

    async removeContact(contactId) {
      await parseJson<{ status: string }>(
        await fetcher(`${base}/safety-contacts/${encodeURIComponent(contactId)}`, {
          method: 'DELETE',
        })
      );
    },

    async fetchGuestView(token) {
      const response = await fetcher(`${base}/guest/${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as GuestTrackingReadResult | null;
      if (!payload || typeof payload !== 'object' || !('ok' in payload)) {
        return { ok: false, reason: 'invalid_token' };
      }
      return payload;
    },

    async broadcast(input) {
      return parseJson<SafetyBroadcastResult>(
        await fetcher(`${base}/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
      );
    },

    async watchCommand(input) {
      return parseJson<WatchCommandResult>(
        await fetcher(`${base}/watch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
      );
    },
  };
}

export const liveTrackingApi = createLiveTrackingApi();
