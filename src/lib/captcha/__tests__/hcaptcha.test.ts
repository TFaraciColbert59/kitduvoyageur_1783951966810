// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCaptchaToken, resetCaptchaForTests } from '../hcaptcha';

/**
 * hCaptcha invisible (plan 2.2) : un jeton à usage unique par geste
 * d'authentification ; sans clé, ou hCaptcha injoignable, aucun jeton et
 * aucune erreur (Supabase dit lui-même s'il en exigeait un).
 */
describe('jeton hCaptcha', () => {
  beforeEach(() => {
    resetCaptchaForTests();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    delete window.hcaptcha;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('sans clé de site : aucun jeton, aucun script chargé', async () => {
    expect(await getCaptchaToken(null)).toBeUndefined();
    expect(document.querySelector('script[src*="hcaptcha"]')).toBeNull();
  });

  it('avec la clé : widget invisible rendu une fois, nouveau jeton à chaque geste', async () => {
    let n = 0;
    const api = {
      render: vi.fn(() => 'w1'),
      execute: vi.fn(async () => ({ response: `jeton-${++n}` })),
      reset: vi.fn(),
    };
    window.hcaptcha = api;
    expect(await getCaptchaToken('cle-site')).toBe('jeton-1');
    expect(await getCaptchaToken('cle-site')).toBe('jeton-2');
    expect(api.render).toHaveBeenCalledTimes(1);
    expect(api.render).toHaveBeenCalledWith(expect.any(HTMLElement), { sitekey: 'cle-site', size: 'invisible' });
    // Un jeton ne sert qu'une fois : le widget est remis à zéro avant le suivant.
    expect(api.reset).toHaveBeenCalledWith('w1');
  });

  it('défi fermé ou hCaptcha en panne : aucun jeton, jamais d’exception', async () => {
    window.hcaptcha = {
      render: () => 'w1',
      execute: async () => {
        throw new Error('challenge-closed');
      },
      reset: () => undefined,
    };
    await expect(getCaptchaToken('cle-site')).resolves.toBeUndefined();
  });
});
