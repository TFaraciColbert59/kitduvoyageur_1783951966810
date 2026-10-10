import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { isBlockedRequestTarget } from '@/lib/security/urlSafety';
import { POST as ogPreviewPOST } from '@/app/api/og-preview/route';

function buildRequest(url: string) {
  return new NextRequest('http://localhost:4028/api/og-preview', {
    method: 'POST',
    body: JSON.stringify({ url }),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('urlSafety — destinations interdites (F-010)', () => {
  it('bloque les IP privées/loopback/link-local IPv4', () => {
    expect(isBlockedRequestTarget('http://127.0.0.1/')).toBe(true);
    expect(isBlockedRequestTarget('http://127.0.0.2/')).toBe(true);
    expect(isBlockedRequestTarget('http://0.0.0.0/')).toBe(true);
    expect(isBlockedRequestTarget('http://10.0.0.5/')).toBe(true);
    expect(isBlockedRequestTarget('http://172.16.1.1/')).toBe(true);
    expect(isBlockedRequestTarget('http://192.168.1.1/')).toBe(true);
    expect(isBlockedRequestTarget('http://169.254.169.254/')).toBe(true);
    expect(isBlockedRequestTarget('http://100.64.0.1/')).toBe(true);
    expect(isBlockedRequestTarget('http://224.0.0.1/')).toBe(true);
  });

  it('bloque les IP IPv6 privées/loopback (hostname entre crochets)', () => {
    expect(isBlockedRequestTarget('http://[::1]/')).toBe(true);
    expect(isBlockedRequestTarget('http://[::]/')).toBe(true);
    expect(isBlockedRequestTarget('http://[fc00::1]/')).toBe(true);
    expect(isBlockedRequestTarget('http://[fd12:3456::1]/')).toBe(true);
    expect(isBlockedRequestTarget('http://[fe80::1]/')).toBe(true);
    expect(isBlockedRequestTarget('http://[::ffff:127.0.0.1]/')).toBe(true);
  });

  it('bloque les hôtes locaux et les schémas non http(s)', () => {
    expect(isBlockedRequestTarget('http://localhost/')).toBe(true);
    expect(isBlockedRequestTarget('http://foo.local/')).toBe(true);
    expect(isBlockedRequestTarget('http://service.internal/')).toBe(true);
    expect(isBlockedRequestTarget('ftp://example.com/')).toBe(true);
    expect(isBlockedRequestTarget('file:///etc/passwd')).toBe(true);
    expect(isBlockedRequestTarget('pas-une-url')).toBe(true);
  });

  it('bloque les FQDN à point final et les IPv6 de transition (2002::/16, 2001::/32)', () => {
    expect(isBlockedRequestTarget('http://localhost./')).toBe(true);
    expect(isBlockedRequestTarget('http://x.local./')).toBe(true);
    expect(isBlockedRequestTarget('http://[2002:7f00:1::]/')).toBe(true);
    expect(isBlockedRequestTarget('http://[2001:0000:4136:e378:8000:63bf:3fff:fdd2]/')).toBe(true);
  });

  it('autorise les destinations publiques', () => {
    expect(isBlockedRequestTarget('https://example.com/')).toBe(false);
    expect(isBlockedRequestTarget('http://93.184.216.34/')).toBe(false);
    expect(isBlockedRequestTarget('https://sub.example.org/page?a=1')).toBe(false);
  });
});

describe('POST /api/og-preview — garde SSRF effective (F-010)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuse une IP loopback non couverte avant (127.0.0.2) sans appeler fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await ogPreviewPOST(buildRequest('http://127.0.0.2/'));
    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuse IPv6 loopback et ULA sans appeler fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect((await ogPreviewPOST(buildRequest('http://[::1]/'))).status).toBe(403);
    expect((await ogPreviewPOST(buildRequest('http://[fc00::1]/'))).status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('interdit le suivi automatique des redirections (redirect manual) et revalide la cible', async () => {
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.redirect).toBe('manual');
      return new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data/' },
      });
    });
    vi.stubGlobal('fetch', fetchSpy);
    const res = await ogPreviewPOST(buildRequest('https://example.com/redirect'));
    expect(res.status).toBe(403);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('suit une redirection légitime revalidée et renvoie les métadonnées', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      if (url === 'https://example.com/start') {
        return new Response(null, { status: 301, headers: { location: 'https://example.com/final' } });
      }
      return new Response(
        '<html><head><meta property="og:title" content="Titre final" /><meta property="og:description" content="Desc" /></head></html>',
        { status: 200, headers: { 'content-type': 'text/html' } }
      );
    });
    vi.stubGlobal('fetch', fetchSpy);
    const res = await ogPreviewPOST(buildRequest('https://example.com/start'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Titre final');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('suit une chaîne de 3 redirections revalidées (cap 4)', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      if (url === 'https://example.com/a') {
        return new Response(null, { status: 302, headers: { location: '/b' } });
      }
      if (url === 'https://example.com/b') {
        return new Response(null, { status: 303, headers: { location: 'https://example.com/c' } });
      }
      if (url === 'https://example.com/c') {
        return new Response(null, { status: 301, headers: { location: 'https://example.com/final' } });
      }
      return new Response(
        '<html><head><meta property="og:title" content="Bout" /></head></html>',
        { status: 200, headers: { 'content-type': 'text/html' } }
      );
    });
    vi.stubGlobal('fetch', fetchSpy);
    const res = await ogPreviewPOST(buildRequest('https://example.com/a'));
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe('Bout');
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it('bloque localhost. (point final) sans fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await ogPreviewPOST(buildRequest('http://localhost./'));
    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('cas autorisé direct : 200 avec métadonnées', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(
        '<html><head><meta property="og:title" content="Direct" /></head></html>',
        { status: 200, headers: { 'content-type': 'text/html' } }
      )
    );
    vi.stubGlobal('fetch', fetchSpy);
    const res = await ogPreviewPOST(buildRequest('https://example.com/page'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Direct');
  });

  it('limite les appels par IP (429 après 20 requêtes dans la fenêtre)', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(
        '<html><head><meta property="og:title" content="Limite" /></head></html>',
        { status: 200, headers: { 'content-type': 'text/html' } }
      )
    );
    vi.stubGlobal('fetch', fetchSpy);
    const request = () => {
      const req = buildRequest('https://example.com/page');
      req.headers.set('x-forwarded-for', '203.0.113.77');
      return req;
    };
    for (let i = 0; i < 20; i += 1) {
      const res = await ogPreviewPOST(request());
      expect(res.status).toBe(200);
    }
    const limited = await ogPreviewPOST(request());
    expect(limited.status).toBe(429);
  });
});
