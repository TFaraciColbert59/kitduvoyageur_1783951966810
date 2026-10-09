import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  })),
}));

vi.mock('@/features/trips/server/prepareActivityFromTrail', () => ({
  PrepareActivityAuthError: class PrepareActivityAuthError extends Error {},
  prepareActivityFromTrail: vi.fn(async () => ({ status: 'unavailable' })),
}));

import { POST as rejoindrePOST } from '@/app/rejoindre/[slug]/accepter/route';
import { GET as activerGET } from '@/app/preparer-sentier/[id]/activer/route';

function rejoindreRequest(headers: Record<string, string>) {
  const body = new FormData();
  body.set('consent', 'true');
  return new NextRequest('https://app.example/rejoindre/slug-x/accepter', {
    method: 'POST',
    body,
    headers,
  });
}

describe('routes hors /api — garde CSRF (F-001 résidus)', () => {
  it('rejoindre/accepter : POST cross-site → 403', async () => {
    const res = await rejoindrePOST(rejoindreRequest({ origin: 'https://evil.example' }), {
      params: Promise.resolve({ slug: 'slug-x' }),
    });
    expect(res.status).toBe(403);
  });

  it('rejoindre/accepter : POST same-site → traité (303 vers connexion, utilisateur absent)', async () => {
    const res = await rejoindrePOST(rejoindreRequest({ origin: 'https://app.example' }), {
      params: Promise.resolve({ slug: 'slug-x' }),
    });
    expect(res.status).toBe(303);
  });

  it('preparer-sentier/activer : GET sans signal d origine → 403', async () => {
    const req = new NextRequest('https://app.example/preparer-sentier/abc/activer');
    const res = await activerGET(req, { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(403);
  });

  it('preparer-sentier/activer : GET cross-site (Referer étranger) → 403', async () => {
    const req = new NextRequest('https://app.example/preparer-sentier/abc/activer', {
      headers: { referer: 'https://evil.example/page' },
    });
    const res = await activerGET(req, { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(403);
  });

  it('preparer-sentier/activer : GET same-site (Referer) → traité (redirection)', async () => {
    const req = new NextRequest('https://app.example/preparer-sentier/abc/activer', {
      headers: { referer: 'https://app.example/preparer-sentier/abc' },
    });
    const res = await activerGET(req, { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(307);
  });
});
