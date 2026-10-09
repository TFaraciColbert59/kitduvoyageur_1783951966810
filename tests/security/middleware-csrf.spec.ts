import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

function build(path: string, method: string, origin?: string) {
  return new NextRequest(`https://app.example${path}`, {
    method,
    headers: {
      host: 'app.example',
      ...(origin ? { origin } : {}),
    },
  });
}

describe('middleware — garde CSRF sur /api (F-001)', () => {
  it('refuse une mutation API cross-site avec 403', async () => {
    const res = await middleware(build('/api/checkout', 'POST', 'https://evil.example'));
    expect(res.status).toBe(403);
  });

  it('laisse passer une mutation API de même origine', async () => {
    const res = await middleware(build('/api/checkout', 'POST', 'https://app.example'));
    expect(res.status).not.toBe(403);
  });

  it('laisse passer une mutation API sans Origin (serveur à serveur)', async () => {
    const res = await middleware(build('/api/stripe/webhook', 'POST'));
    expect(res.status).not.toBe(403);
  });

  it('ne bloque pas les GET cross-site (lectures publiques)', async () => {
    const res = await middleware(build('/api/weather?lat=1&lon=2', 'GET', 'https://evil.example'));
    expect(res.status).not.toBe(403);
  });
});
