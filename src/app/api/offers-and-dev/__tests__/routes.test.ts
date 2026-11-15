import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => ({
  authorized: true,
  userId: 'user-o02',
  email: 'alex@univ-grenoble.fr',
}));

vi.mock('@/lib/api/requireUser', () => ({
  requireUser: vi.fn(async () =>
    authMock.authorized
      ? {
          ok: true,
          user: { id: authMock.userId, email: authMock.email },
          supabase: {},
        }
      : {
          ok: false,
          response: new Response(JSON.stringify({ error: 'Non connecté.' }), { status: 401 }),
        },
  ),
}));

vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: () => null,
}));

import { resetOffersStore } from '@/features/offers/server/offersStore';
import { resetDeveloperStore } from '@/features/offers/server/developerStore';
import { GET as offersGET, POST as offersPOST } from '@/app/api/compte/offers/route';
import {
  DELETE as devKeysDELETE,
  GET as devKeysGET,
  POST as devKeysPOST,
} from '@/app/api/developer/keys/route';
import {
  DELETE as devHooksDELETE,
  POST as devHooksPOST,
} from '@/app/api/developer/webhooks/route';

function jsonReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('Routes API O02 (/api/compte/offers, /api/developer/keys, /api/developer/webhooks)', () => {
  beforeEach(() => {
    authMock.authorized = true;
    authMock.userId = 'user-o02';
    resetOffersStore();
    resetDeveloperStore();
  });

  it('refuse les appels non authentifiés (401)', async () => {
    authMock.authorized = false;
    const res = await offersGET(new Request('https://lkdv.app/api/compte/offers'));
    expect(res.status).toBe(401);
  });

  it('permet de réclamer 1 seule région gratuite et bloque une seconde réclamation différente', async () => {
    const first = await offersPOST(
      jsonReq('https://lkdv.app/api/compte/offers', 'POST', {
        action: 'claim_free_region',
        regionId: 'fr-chamonix-mont-blanc',
      }),
    );
    expect(first.status).toBe(200);
    const firstJson = (await first.json()) as { coverage: { freeRegionId: string } };
    expect(firstJson.coverage.freeRegionId).toBe('fr-chamonix-mont-blanc');

    const second = await offersPOST(
      jsonReq('https://lkdv.app/api/compte/offers', 'POST', {
        action: 'claim_free_region',
        regionId: 'fr-vercors-hauts-plateaux',
      }),
    );
    expect(second.status).toBe(409);
  });

  it('gère le cycle de vie des clés API et rejette les URL webhook locales', async () => {
    const created = await devKeysPOST(
      jsonReq('https://lkdv.app/api/developer/keys', 'POST', {
        clientName: 'SyncBridge',
        scopes: ['read:activities', 'webhook:events'],
      }),
    );
    expect(created.status).toBe(200);
    const createdJson = (await created.json()) as {
      key: { id: string; prefix: string };
      plaintextSecret: string;
    };
    expect(createdJson.plaintextSecret).toMatch(/^lkdv_live_/);

    // La lecture ultérieure ne réexpose jamais le secret complet
    const listRes = await devKeysGET();
    const listJson = (await listRes.json()) as { keys: Array<Record<string, unknown>> };
    expect(listJson.keys[0].plaintextSecret).toBeUndefined();

    const revoked = await devKeysDELETE(
      jsonReq('https://lkdv.app/api/developer/keys', 'DELETE', { id: createdJson.key.id }),
    );
    expect(revoked.status).toBe(200);
    const revokedJson = (await revoked.json()) as { key: { revokedAtIso: string | null } };
    expect(revokedJson.key.revokedAtIso).toBeTruthy();

    // SSRF guard sur webhook local
    const badHook = await devHooksPOST(
      jsonReq('https://lkdv.app/api/developer/webhooks', 'POST', {
        callbackUrl: 'https://127.0.0.1/hook',
        events: ['activity.created'],
      }),
    );
    expect(badHook.status).toBe(409);

    const goodHook = await devHooksPOST(
      jsonReq('https://lkdv.app/api/developer/webhooks', 'POST', {
        callbackUrl: 'https://hooks.partner.example/lkdv',
        events: ['activity.created'],
      }),
    );
    expect(goodHook.status).toBe(200);
    const goodHookJson = (await goodHook.json()) as {
      subscription: { id: string; active: boolean };
      signingSecret: string;
    };
    expect(goodHookJson.signingSecret).toMatch(/^whsec_/);

    const delHook = await devHooksDELETE(
      jsonReq('https://lkdv.app/api/developer/webhooks', 'DELETE', {
        id: goodHookJson.subscription.id,
      }),
    );
    expect(delHook.status).toBe(200);
  });
});
