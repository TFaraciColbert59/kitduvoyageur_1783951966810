import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyCompteSession } from '../../scripts/audit/create_test_session.mjs';

type Listener = (...args: any[]) => void;

const baseUrl = 'http://localhost:3000';

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function createPage(prefetch = false) {
  const listeners = new Map<string, Listener>();
  const locator = {
    first() {
      return this;
    },
    async waitFor() {},
    async isVisible() {
      return true;
    },
  };
  const page = {
    on(event: string, listener: Listener) {
      listeners.set(event, listener);
    },
    off(event: string) {
      listeners.delete(event);
    },
    url() {
      return `${baseUrl}/compte`;
    },
    async goto() {
      listeners.get('requestfailed')?.({
        method: () => 'GET',
        url: () => `${baseUrl}/prefetch${prefetch ? '?_rsc=cache-key' : ''}`,
        failure: () => ({ errorText: 'net::ERR_ABORTED' }),
        resourceType: () => 'fetch',
        headers: () => (prefetch ? {
          rsc: '1',
          'next-router-state-tree': 'state',
          'next-url': '/prefetch',
          referer: `${baseUrl}/prefetch`,
        } : {}),
      });
      return { status: () => 200 };
    },
    locator() {
      return locator;
    },
  };
  return page;
}

describe('audit runtime — preflight opt-in', () => {
  it('conserve l’aborted générique et accepte le preflight session exact', async () => {
    await expect(verifyCompteSession(createPage(), baseUrl)).resolves.toMatchObject({
      finalPath: '/compte',
      status: 200,
    });
    await expect(verifyCompteSession(createPage(true), baseUrl, { sessionMode: true })).resolves.toMatchObject({
      finalPath: '/compte',
      status: 200,
    });
  });

  it('active sessionMode sur les trois preflights et jamais sur les routes', () => {
    const preflights = [
      ['scripts/audit/measure_contrast_v2.mjs', 'await verifyCompteSession(authPage, baseUrl, { sessionMode: true });'],
      ['scripts/audit/measure_key_screens_matrix.mjs', 'await verifyCompteSession(authPage, baseUrl, { sessionMode: true });'],
      ['scripts/audit/run_audit_campaign.mjs', 'await verifyCompteSession(authPage, BASE_URL, { sessionMode: true });'],
    ];
    for (const [file, call] of preflights) {
      const content = source(file);
      expect(content).toContain(call);
      expect(content.match(/sessionMode:\s*true/g)).toHaveLength(1);
      expect(content).not.toMatch(/attachPageDiagnostics\([^)]*sessionMode/);
    }
  });
});
