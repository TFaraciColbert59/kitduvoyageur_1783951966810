import { describe, it, expect } from 'vitest';
import nextConfig from '../../next.config.mjs';

describe('Equipages Routing & Redirection Compatibility (Phase 4.3)', () => {
  it('TEST-ROUTE-01: next.config.mjs contains permanent 308 redirect from /groupes to /equipages', async () => {
    expect(nextConfig.redirects).toBeDefined();
    if (typeof nextConfig.redirects === 'function') {
      const redirects = await nextConfig.redirects();
      const groupesRedirect = redirects.find((r: any) => r.source === '/groupes');

      expect(groupesRedirect).toBeDefined();
      expect(groupesRedirect?.destination).toBe('/equipages');
      expect(groupesRedirect?.permanent).toBe(true);
    }
  });
});
