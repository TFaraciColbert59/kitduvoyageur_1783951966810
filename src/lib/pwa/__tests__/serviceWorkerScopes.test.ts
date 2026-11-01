import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APP_SW_PATH,
  EXPLORER_SW_PATH,
  EXPLORER_SW_SCOPE,
  shouldReloadOnControllerChange,
} from '../serviceWorkerScopes';
import { registerOfflineWorker } from '@/features/explorer-v2/offline/zone';

/**
 * Non-régression du 01/11/2026 : /explorer se rechargeait en boucle (12 fois en 15 s en
 * production). Les deux workers partageaient la portée `/`, se remplaçaient l'un l'autre
 * (`skipWaiting` + `clients.claim`) et chaque prise de main déclenchait un rechargement.
 */
describe('portées des service workers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recharge seulement quand le worker de l'app prend la main", () => {
    expect(shouldReloadOnControllerChange('https://koosmoweb.fr/sw.js?v=22')).toBe(true);
    expect(shouldReloadOnControllerChange(`https://koosmoweb.fr${APP_SW_PATH}`)).toBe(true);
    expect(shouldReloadOnControllerChange(`https://koosmoweb.fr${EXPLORER_SW_PATH}`)).toBe(false);
    expect(shouldReloadOnControllerChange('https://koosmoweb.fr/sw-v18.js')).toBe(false);
    expect(shouldReloadOnControllerChange(null)).toBe(false);
    expect(shouldReloadOnControllerChange(undefined)).toBe(false);
    expect(shouldReloadOnControllerChange('')).toBe(false);
  });

  it("l'Explorer s'enregistre sur sa propre portée, jamais sur celle du site", async () => {
    const register = vi.fn().mockResolvedValue({});
    vi.stubGlobal('navigator', { serviceWorker: { register, ready: Promise.resolve({ scope: EXPLORER_SW_SCOPE }) } });

    await registerOfflineWorker();

    expect(register).toHaveBeenCalledTimes(1);
    const [script, options] = register.mock.calls[0] as [string, { scope: string }];
    expect(script).toBe(EXPLORER_SW_PATH);
    expect(options.scope).toBe(EXPLORER_SW_SCOPE);
    expect(options.scope).not.toBe('/');
    // La portée de l'Explorer doit rester plus précise que celle de l'app (`/`) et couvrir /explorer.
    expect('/explorer'.startsWith(options.scope)).toBe(true);
  });
});
