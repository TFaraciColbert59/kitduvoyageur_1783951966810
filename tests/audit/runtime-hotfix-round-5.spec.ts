import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyCompteSession } from '../../scripts/audit/create_test_session.mjs';

type Listener = (...args: any[]) => void;

const baseUrl = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function createPage(prefetch = false, authenticated = true) {
  const listeners = new Map<string, Listener>();
  let currentUrl = `${baseUrl}/compte`;
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
       return currentUrl;
     },
     async goto(url: string) {
       currentUrl = String(url).includes('/admin')
         ? `${baseUrl}/${authenticated ? '' : 'connexion'}`
         : `${baseUrl}/compte`;
       if (String(url).includes('/admin')) {
         listeners.get('response')?.({
           status: () => 200,
             url: () => 'https://project.supabase.co/auth/v1/user',
             json: async () => ({ email: 'audit@example.test' }),
             request: () => ({
             method: () => 'GET',
             url: () => 'https://project.supabase.co/auth/v1/user',
             resourceType: () => 'fetch',
             headers: () => ({}),
           }),
         });
       }
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
    await expect(verifyCompteSession(createPage(true), baseUrl, { sessionMode: true, expectedEmail: 'audit@example.test' })).resolves.toMatchObject({
      finalPath: '/compte',
      status: 200,
    });
  });

  it('rejette une session sans attestation serveur positiva', async () => {
    await expect(verifyCompteSession(createPage(false, false), baseUrl, { sessionMode: true, expectedEmail: 'audit@example.test' }))
      .rejects.toThrow(/Attestation serveur/i);
  });

  it('active sessionMode sur les trois preflights et jamais sur les routes', () => {
    const preflights = [
      ['scripts/audit/measure_contrast_v2.mjs', 'await verifyCompteSession(authPage, baseUrl, { sessionMode: true, expectedEmail: process.env.AUDIT_EMAIL });'],
      ['scripts/audit/measure_key_screens_matrix.mjs', 'await verifyCompteSession(authPage, baseUrl, { sessionMode: true, expectedEmail: process.env.AUDIT_EMAIL });'],
      ['scripts/audit/run_audit_campaign.mjs', 'await verifyCompteSession(authPage, BASE_URL, { sessionMode: true, expectedEmail: process.env.AUDIT_EMAIL });'],
    ];
    for (const [file, call] of preflights) {
      const content = source(file);
      expect(content).toContain(call);
      expect(content.match(/sessionMode:\s*true/g)).toHaveLength(1);
      expect(content).not.toMatch(/attachPageDiagnostics\([^)]*sessionMode/);
    }
  });
});
