import { describe, expect, it } from 'vitest';
import { appUserAgent, SITE_CONTACT_URL } from '../../src/lib/userAgent';

describe('User-Agent du site (plan 1.8)', () => {
  it('nomme l’application et le site en production comme contact', () => {
    expect(appUserAgent()).toBe('kitduvoyageur/1.0 (+https://koosmoweb.fr)');
    expect(appUserAgent('Compas, meteo')).toBe('kitduvoyageur/1.0 (Compas, meteo; +https://koosmoweb.fr)');
    expect(SITE_CONTACT_URL).toBe('https://koosmoweb.fr');
  });

  it('reste en ASCII : un en-tête HTTP n’accepte pas n’importe quel caractère', () => {
    expect(appUserAgent('Compas, preparation de voyage')).toMatch(/^[\x20-\x7e]+$/);
  });
});
