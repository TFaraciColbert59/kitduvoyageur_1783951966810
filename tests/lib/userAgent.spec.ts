import { afterEach, describe, expect, it, vi } from 'vitest';
import { appUserAgent, SITE_CONTACT_HOST, SITE_CONTACT_URL } from '../../src/lib/userAgent';

const PROD = 'https://kitduvoyageur-1783951966810-ruddy.vercel.app';

describe('User-Agent du site (plan 1.8)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('nomme l’application et une adresse de production qui répond comme contact', () => {
    expect(appUserAgent()).toBe(`kitduvoyageur/1.0 (+${PROD})`);
    expect(appUserAgent('Compas, meteo')).toBe(`kitduvoyageur/1.0 (Compas, meteo; +${PROD})`);
    expect(SITE_CONTACT_URL).toBe(PROD);
    expect(SITE_CONTACT_HOST).toBe('kitduvoyageur-1783951966810-ruddy.vercel.app');
  });

  it('jamais koosmoweb.fr : le domaine n’existe plus depuis le 13 octobre', () => {
    expect(appUserAgent()).not.toContain('koosmoweb');
  });

  it('APP_CONTACT_URL (le domaine définitif) remplace le contact, réduit à son origine https', async () => {
    vi.stubEnv('APP_CONTACT_URL', 'https://exemple-voyage.fr/chemin?x=1');
    const mod = await import('../../src/lib/userAgent');
    expect(mod.SITE_CONTACT_URL).toBe('https://exemple-voyage.fr');
    expect(mod.SITE_CONTACT_HOST).toBe('exemple-voyage.fr');
  });

  it('une valeur illisible ou non https garde l’adresse de production', async () => {
    vi.stubEnv('APP_CONTACT_URL', 'http://pas-sur.fr');
    expect((await import('../../src/lib/userAgent')).SITE_CONTACT_URL).toBe(PROD);
    vi.resetModules();
    vi.stubEnv('APP_CONTACT_URL', 'pas une adresse');
    expect((await import('../../src/lib/userAgent')).SITE_CONTACT_URL).toBe(PROD);
  });

  it('reste en ASCII : un en-tête HTTP n’accepte pas n’importe quel caractère', () => {
    expect(appUserAgent('Compas, preparation de voyage')).toMatch(/^[\x20-\x7e]+$/);
  });
});
