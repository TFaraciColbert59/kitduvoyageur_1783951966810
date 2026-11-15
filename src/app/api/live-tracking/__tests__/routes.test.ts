import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));

vi.mock('@/lib/api/requireUser', () => ({ requireUser: mocks.requireUser }));

import {
  getLiveTrackingRuntime,
  resetLiveTrackingRuntime,
} from '@/features/compte/live-tracking/server/runtime';
import { GET as rootGET } from '../route';
import { GET as statusGET } from '../status/route';
import { GET as sessionsGET, POST as sessionsPOST } from '../sessions/route';
import { DELETE as sessionDELETE, PATCH as sessionPATCH } from '../sessions/[id]/route';
import { POST as positionsPOST } from '../sessions/[id]/positions/route';
import { GET as linksGET, POST as linksPOST } from '../share-links/route';
import { DELETE as linkDELETE } from '../share-links/[id]/route';
import { GET as guestGET } from '../guest/[token]/route';
import { GET as contactsGET, POST as contactsPOST } from '../safety-contacts/route';
import { DELETE as contactDELETE, PATCH as contactPATCH } from '../safety-contacts/[id]/route';
import { POST as watchPOST } from '../watch/route';
import { POST as broadcastPOST } from '../broadcast/route';

function authenticate(userId = 'user-1') {
  mocks.requireUser.mockResolvedValue({
    ok: true,
    supabase: {},
    user: { id: userId },
  });
}

function unauthenticated() {
  mocks.requireUser.mockResolvedValue({
    ok: false,
    response: new Response(null, { status: 401 }),
  });
}

function jsonRequest(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost/api/live-tracking', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function params<T extends Record<string, string>>(value: T) {
  return { params: Promise.resolve(value) };
}

beforeEach(() => {
  mocks.requireUser.mockReset();
  resetLiveTrackingRuntime();
});

describe('API /api/live-tracking — authentification et scoping', () => {
  it('refuse toutes les routes propriétaire sans session', async () => {
    unauthenticated();
    expect((await statusGET(new Request('http://localhost/api/live-tracking/status'))).status).toBe(
      401
    );
    expect((await rootGET(new Request('http://localhost/api/live-tracking'))).status).toBe(401);
    expect((await sessionsGET()).status).toBe(401);
    expect((await sessionsPOST(jsonRequest({}))).status).toBe(401);
    expect(
      (await linksGET(new Request('http://localhost/api/live-tracking/share-links'))).status
    ).toBe(401);
    expect((await contactsGET()).status).toBe(401);
    expect((await watchPOST(jsonRequest({ device: {}, command: {} }))).status).toBe(401);
  });

  it('déroule le parcours propriétaire : séance, position, lien, invité, révocation', async () => {
    authenticate();
    const runtime = getLiveTrackingRuntime();

    const started = await sessionsPOST(jsonRequest({ sessionId: 'sess-api' }));
    expect(started.status).toBe(201);
    expect((await started.json()).session).toMatchObject({
      sessionId: 'sess-api',
      ownerUserId: 'user-1',
      status: 'active',
    });

    const position = await positionsPOST(
      jsonRequest({ lat: 45.188529, lng: 5.724524, accuracyM: 6 }),
      params({ id: 'sess-api' })
    );
    expect(position.status).toBe(201);

    const createdResponse = await linksPOST(
      jsonRequest({ sessionId: 'sess-api', durationMinutes: 60, includeTrail: true })
    );
    expect(createdResponse.status).toBe(201);
    const createdText = await createdResponse.text();
    expect(createdText).not.toContain('tokenHash');
    const created = JSON.parse(createdText) as {
      shareUrl: string;
      link: { id: string; status: string };
      expiresAtIso: string;
    };
    expect(created.link.status).toBe('active');
    const rawToken = created.shareUrl.split('/').pop() ?? '';
    expect(rawToken.length).toBeGreaterThanOrEqual(32);

    const guest = await guestGET(
      new Request(`http://localhost/api/live-tracking/guest/${rawToken}`),
      params({ token: rawToken })
    );
    expect(guest.status).toBe(200);
    expect(guest.headers.get('Cache-Control')).toContain('no-store');
    expect(guest.headers.get('Referrer-Policy')).toBe('no-referrer');
    const guestBody = (await guest.json()) as {
      ok: boolean;
      latestPosition: { lat: number; freshness: string };
    };
    expect(guestBody.ok).toBe(true);
    expect(guestBody.latestPosition).toMatchObject({ lat: 45.188529, freshness: 'live' });

    const listed = await linksGET(
      new Request('http://localhost/api/live-tracking/share-links?sessionId=sess-api')
    );
    expect(listed.status).toBe(200);
    expect((await listed.json()).links).toHaveLength(1);

    const revoked = await linkDELETE(
      new Request(
        `http://localhost/api/live-tracking/share-links/${created.link.id}?sessionId=sess-api`
      ),
      params({ id: created.link.id })
    );
    expect(revoked.status).toBe(200);

    const afterRevoke = await guestGET(
      new Request(`http://localhost/api/live-tracking/guest/${rawToken}`),
      params({ token: rawToken })
    );
    expect(await afterRevoke.json()).toEqual({ ok: false, reason: 'revoked' });

    const ended = await sessionDELETE(
      new Request('http://localhost/api/live-tracking/sessions/sess-api', { method: 'DELETE' }),
      params({ id: 'sess-api' })
    );
    expect(ended.status).toBe(200);
    expect(runtime).toBeDefined();
  });

  it('n’expose ni les séances ni les liens d’un autre propriétaire', async () => {
    authenticate('user-1');
    await sessionsPOST(jsonRequest({ sessionId: 'sess-owner' }));
    const created = await linksPOST(jsonRequest({ sessionId: 'sess-owner', durationMinutes: 30 }));
    const linkId = ((await created.json()) as { link: { id: string } }).link.id;

    authenticate('user-2');
    const status = await statusGET(
      new Request('http://localhost/api/live-tracking/status?sessionId=sess-owner')
    );
    const statusBody = (await status.json()) as {
      activeSessionId: string | null;
      links: unknown[];
    };
    expect(statusBody.activeSessionId).toBeNull();
    expect(statusBody.links).toEqual([]);

    const forbidden = await linksPOST(
      jsonRequest({ sessionId: 'sess-owner', durationMinutes: 30 })
    );
    expect(forbidden.status).toBe(403);

    const revoke = await linkDELETE(
      new Request(`http://localhost/api/live-tracking/share-links/${linkId}`),
      params({ id: linkId })
    );
    expect(revoke.status).toBe(404);
  });

  it('refuse une durée hors bornes et une position invalide', async () => {
    authenticate();
    await sessionsPOST(jsonRequest({ sessionId: 'sess-validation' }));

    const short = await linksPOST(
      jsonRequest({ sessionId: 'sess-validation', durationMinutes: 2 })
    );
    expect(short.status).toBe(409);

    const invalidPosition = await positionsPOST(
      jsonRequest({ lat: 95, lng: 5 }),
      params({ id: 'sess-validation' })
    );
    expect(invalidPosition.status).toBe(409);

    const pause = await sessionPATCH(
      jsonRequest({ status: 'paused' }, 'PATCH'),
      params({ id: 'sess-validation' })
    );
    expect(pause.status).toBe(200);
    expect((await pause.json()).session.status).toBe('paused');
  });

  it('refuse un jeton de partage absent ou forgé sans exposer de coordonnées', async () => {
    const forged = await guestGET(
      new Request('http://localhost/api/live-tracking/guest/forged'),
      params({ token: 'forged' })
    );
    expect(forged.status).toBe(200);
    expect(await forged.json()).toEqual({ ok: false, reason: 'invalid_token' });

    const empty = await guestGET(
      new Request('http://localhost/api/live-tracking/guest/%20'),
      params({ token: '   ' })
    );
    expect(await empty.json()).toEqual({ ok: false, reason: 'invalid_token' });
  });
});

describe('API /api/live-tracking — contacts, notification et montre', () => {
  it('gère les contacts et leur consentement', async () => {
    authenticate();
    await sessionsPOST(jsonRequest({ sessionId: 'sess-safety' }));

    const created = await contactsPOST(
      jsonRequest({
        displayName: 'Camille',
        channel: 'sms',
        destination: '+33612345678',
      })
    );
    expect(created.status).toBe(201);
    const contact = ((await created.json()) as { contact: { id: string } }).contact;
    expect(contact.id).toBeTruthy();

    const consent = await contactPATCH(
      jsonRequest({ consentStatus: 'accepted' }, 'PATCH'),
      params({ id: contact.id })
    );
    expect(consent.status).toBe(200);
    expect((await consent.json()).contact.consentStatus).toBe('accepted');

    const listed = await contactsGET();
    expect((await listed.json()).contacts).toHaveLength(1);

    const duplicate = await contactsPOST(
      jsonRequest({
        displayName: 'Camille bis',
        channel: 'sms',
        destination: '+33612345678',
      })
    );
    expect(duplicate.status).toBe(409);

    const broadcast = await broadcastPOST(
      jsonRequest({ sessionId: 'sess-safety', event: 'safety_ping' })
    );
    expect(broadcast.status).toBe(200);
    expect((await broadcast.json()).notifiedContactIds).toEqual([contact.id]);

    const removed = await contactDELETE(
      new Request(`http://localhost/api/live-tracking/safety-contacts/${contact.id}`, {
        method: 'DELETE',
      }),
      params({ id: contact.id })
    );
    expect(removed.status).toBe(200);
    expect((await contactsGET()).status).toBe(200);
    expect((await (await contactsGET()).json()).contacts).toEqual([]);
  });

  it('refuse une commande montre qui vise un autre propriétaire', async () => {
    authenticate('user-1');
    await sessionsPOST(jsonRequest({ sessionId: 'sess-watch-api' }));

    const response = await watchPOST(
      jsonRequest({
        device: {
          deviceId: 'watch-1',
          platform: 'apple_watch',
          osVersion: '10.4',
          appVersion: '1.0.0',
          isPaired: true,
          hasLocationPermission: true,
          hasBackgroundPermission: true,
        },
        command: {
          type: 'sync_status',
          sessionId: 'sess-watch-api',
          ownerUserId: 'user-2',
        },
      })
    );
    expect(response.status).toBe(403);
  });

  it('accepte une commande montre autorisée et renvoie le snapshot', async () => {
    authenticate('user-1');
    await sessionsPOST(jsonRequest({ sessionId: 'sess-watch-ok' }));

    const response = await watchPOST(
      jsonRequest({
        device: {
          deviceId: 'watch-1',
          platform: 'wear_os',
          osVersion: '4.1',
          appVersion: '1.0.0',
          isPaired: true,
          hasLocationPermission: true,
          hasBackgroundPermission: true,
        },
        command: {
          type: 'start_live_share',
          sessionId: 'sess-watch-ok',
          ownerUserId: 'user-1',
          durationMinutes: 30,
        },
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      shareCreated?: boolean;
      snapshot: { platform: string; activeLinkCount: number };
    };
    expect(body).toMatchObject({
      ok: true,
      shareCreated: true,
      snapshot: { platform: 'wear_os', activeLinkCount: 1 },
    });
  });
});
