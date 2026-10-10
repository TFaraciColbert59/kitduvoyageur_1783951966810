import { describe, it, expect } from 'vitest';
import { isCrossSiteMutation } from '@/lib/security/sameOrigin';

describe('isCrossSiteMutation — garde CSRF (F-001)', () => {
  it('laisse passer les méthodes sûres, même cross-site', () => {
    expect(isCrossSiteMutation({ method: 'GET', origin: 'https://evil.example', host: 'app.example' })).toBe(false);
    expect(isCrossSiteMutation({ method: 'HEAD', origin: 'https://evil.example', host: 'app.example' })).toBe(false);
    expect(isCrossSiteMutation({ method: 'OPTIONS', origin: 'https://evil.example', host: 'app.example' })).toBe(false);
  });

  it('laisse passer les appels sans Origin (webhooks signés, crons Bearer)', () => {
    expect(isCrossSiteMutation({ method: 'POST', origin: null, host: 'app.example' })).toBe(false);
  });

  it('laisse passer la même origine (ports ignorés, sémantique same-site)', () => {
    expect(isCrossSiteMutation({ method: 'POST', origin: 'https://app.example', host: 'app.example' })).toBe(false);
    expect(isCrossSiteMutation({ method: 'POST', origin: 'http://localhost:4000', host: 'localhost:4028' })).toBe(false);
    expect(
      isCrossSiteMutation({ method: 'POST', origin: 'https://site.fr', host: 'deploy.vercel.app', allowedHosts: ['site.fr'] })
    ).toBe(false);
  });

  it('refuse une origine étrangère', () => {
    expect(isCrossSiteMutation({ method: 'POST', origin: 'https://evil.example', host: 'app.example' })).toBe(true);
    expect(isCrossSiteMutation({ method: 'DELETE', origin: 'https://sub.app.example', host: 'app.example' })).toBe(true);
    expect(isCrossSiteMutation({ method: 'PATCH', origin: 'null', host: 'app.example' })).toBe(true);
  });

  it('refuse une origine illisible (fail-closed)', () => {
    expect(isCrossSiteMutation({ method: 'POST', origin: 'pas-une-origin', host: 'app.example' })).toBe(true);
  });
});
