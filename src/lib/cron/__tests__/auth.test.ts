/**
 * Plan 100, 1.1 (crons) — autorisation d'un appel planifié : l'en-tête
 * `Authorization: Bearer ${CRON_SECRET}` que Vercel envoie tout seul quand la
 * variable existe. Comparaison en temps constant, refus sans secret.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { isCronAuthorized } from '../auth';

function req(authorization?: string): Request {
  return new Request('http://localhost/api/cron/daily', {
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe('isCronAuthorized', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepte le Bearer égal à CRON_SECRET', () => {
    expect(
      isCronAuthorized(req('Bearer secret-de-test-0123456789'), 'secret-de-test-0123456789')
    ).toBe(true);
  });

  it('lit CRON_SECRET dans l’environnement quand aucun secret n’est donné', () => {
    vi.stubEnv('CRON_SECRET', 'depuis-l-environnement-01');
    expect(isCronAuthorized(req('Bearer depuis-l-environnement-01'))).toBe(true);
    expect(isCronAuthorized(req('Bearer autre'))).toBe(false);
  });

  it('refuse sans secret configuré, même avec un en-tête « Bearer undefined » ou vide', () => {
    expect(isCronAuthorized(req('Bearer undefined'), undefined)).toBe(false);
    expect(isCronAuthorized(req('Bearer '), '')).toBe(false);
    expect(isCronAuthorized(req(''), '')).toBe(false);
    vi.stubEnv('CRON_SECRET', '');
    expect(isCronAuthorized(req('Bearer '))).toBe(false);
  });

  it('refuse sans en-tête, avec un autre schéma ou un mauvais secret', () => {
    const secret = 'secret-de-test-0123456789';
    expect(isCronAuthorized(req(), secret)).toBe(false);
    expect(isCronAuthorized(req(secret), secret)).toBe(false);
    expect(isCronAuthorized(req(`Basic ${secret}`), secret)).toBe(false);
    expect(isCronAuthorized(req('Bearer secret-de-test-0123456780'), secret)).toBe(false);
    expect(isCronAuthorized(req(`Bearer  ${secret}`), secret)).toBe(false);
    expect(isCronAuthorized(req(`bearer ${secret}`), secret)).toBe(false);
  });

  it('refuse une valeur plus courte ou plus longue sans lever d’exception (longueurs différentes)', () => {
    const secret = 'secret-de-test-0123456789';
    expect(() => isCronAuthorized(req('Bearer x'), secret)).not.toThrow();
    expect(isCronAuthorized(req('Bearer x'), secret)).toBe(false);
    expect(isCronAuthorized(req(`Bearer ${secret}${secret}`), secret)).toBe(false);
  });
});
