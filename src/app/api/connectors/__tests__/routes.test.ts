import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/requireUser', () => ({
  requireUser: vi.fn(async () => ({
    ok: true,
    user: { id: 'user-route' },
    supabase: {},
  })),
}));

import { resetConnectorStoreForTests } from '@/lib/connectors/serverStore';
import { GET as catalogGET } from '../catalog/route';
import { POST as sendPOST } from '../routes/send/route';
import { POST as revokePOST } from '../[provider]/revoke/route';
import { POST as startPOST } from '../oauth/[provider]/start/route';
import { POST as webhookPOST } from '../webhooks/[provider]/route';

const VALID_ROUTE = {
  routeId: 'gr20-sud',
  revision: 1,
  title: 'GR20 sud',
  sportType: 'hiking',
  totalDistanceMeters: 54_000,
  elevationGainMeters: 3_200,
  elevationLossMeters: 3_400,
  coordinates: [
    [42.1, 9.1],
    [42.11, 9.12],
  ],
  waypoints: [],
};

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetConnectorStoreForTests();
});

describe('Routes API connecteurs', () => {
  it('renvoie le catalogue réel sans exposer de secret', async () => {
    const response = await catalogGET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      connectors: Array<{ id: string; status: string; missingEnvVars: string[] }>;
      summary: { total: number };
    };
    expect(body.summary.total).toBe(15);
    expect(body.connectors).toHaveLength(15);
    expect(body.connectors.find((connector) => connector.id === 'garmin')?.status).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain('client_secret');
  });

  it('refuse un envoi invalide ou un connecteur sans capacité d’envoi', async () => {
    const invalid = await sendPOST(
      jsonRequest('https://lkdv.app/api/connectors/routes/send', { providerId: 'garmin', route: {} })
    );
    expect(invalid.status).toBe(400);

    const unsupported = await sendPOST(
      jsonRequest('https://lkdv.app/api/connectors/routes/send', {
        providerId: 'zwift',
        route: VALID_ROUTE,
      })
    );
    expect(unsupported.status).toBe(400);
  });

  it('prépare un envoi Garmin avec repli GPX même sans credentials', async () => {
    const response = await sendPOST(
      jsonRequest('https://lkdv.app/api/connectors/routes/send', {
        providerId: 'garmin',
        route: VALID_ROUTE,
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      plan: { providerId: string; gpxFallbackXml: string; deliveryMode: string };
    };
    expect(body.plan.providerId).toBe('garmin');
    expect(body.plan.gpxFallbackXml).toContain('<gpx');
    expect(['blocked_consent', 'manual_file_fallback', 'cloud_push_ready']).toContain(
      body.plan.deliveryMode
    );
  });

  it('refuse un fournisseur OAuth inconnu et une révocation inconnue', async () => {
    const start = await startPOST(
      new Request('https://lkdv.app/api/connectors/oauth/nope/start', { method: 'POST' }),
      { params: Promise.resolve({ provider: 'nope' }) }
    );
    expect(start.status).toBe(400);

    const revoke = await revokePOST(
      new Request('https://lkdv.app/api/connectors/nope/revoke', { method: 'POST' }),
      { params: Promise.resolve({ provider: 'nope' }) }
    );
    expect(revoke.status).toBe(404);
  });

  it('rejette un webhook au fournisseur inconnu ou au corps non JSON', async () => {
    const unknown = await webhookPOST(
      new Request('https://lkdv.app/api/connectors/webhooks/nope', {
        method: 'POST',
        body: '{}',
      }),
      { params: Promise.resolve({ provider: 'nope' }) }
    );
    expect(unknown.status).toBe(404);

    const invalid = await webhookPOST(
      new Request('https://lkdv.app/api/connectors/webhooks/garmin', {
        method: 'POST',
        body: 'not-json',
      }),
      { params: Promise.resolve({ provider: 'garmin' }) }
    );
    expect(invalid.status).toBe(400);
  });
});
