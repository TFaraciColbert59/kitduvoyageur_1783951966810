import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Essai sans compte (plan 2.3) : il remplace le compte démo partagé dès que
 * Supabase ouvre les connexions anonymes, et chaque essai est compté.
 */
const h = vi.hoisted(() => ({
  anonymousOn: false,
  signIn: vi.fn(async () => ({ error: null as null | { message: string } })),
  password: vi.fn(async () => ({ error: null })),
  refuse: null as null | string,
  calls: [] as Array<{ identifier: string; scope: string }>,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signInAnonymously: h.signIn, signInWithPassword: h.password } }),
}));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async (identifier: string, config: { scope: string }) => {
    h.calls.push({ identifier, scope: config.scope });
    return h.refuse === config.scope ? new Response(null, { status: 429 }) : null;
  }),
}));
vi.mock('../anonymousSettings', () => ({ anonymousSignInsEnabled: async () => h.anonymousOn }));

import { trialLoginAction, trialLoginAvailableAction } from '../trialSession';
import { demoLoginAction, demoLoginAvailableAction } from '../demoLogin';

describe('essai sans compte', () => {
  beforeEach(() => {
    h.anonymousOn = false;
    h.refuse = null;
    h.calls = [];
    h.signIn.mockClear();
    h.password.mockClear();
    vi.stubEnv('DEMO_LOGIN_EMAIL', 'demo@example.test');
    vi.stubEnv('DEMO_LOGIN_PASSWORD', 'x');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('connexions anonymes éteintes : pas d’essai, la connexion démo reste', async () => {
    expect(await trialLoginAvailableAction()).toBe(false);
    expect(await demoLoginAvailableAction()).toBe(true);
    expect(await trialLoginAction()).toEqual({ success: false, error: 'Essai sans compte indisponible pour le moment.' });
    expect(h.signIn).not.toHaveBeenCalled();
  });

  it('connexions anonymes allumées : l’essai ouvre un espace à soi, la démo partagée se ferme', async () => {
    h.anonymousOn = true;
    expect(await trialLoginAvailableAction()).toBe(true);
    expect(await demoLoginAvailableAction()).toBe(false);
    expect(await demoLoginAction()).toEqual({ success: false, error: 'Compte de démonstration indisponible.' });
    expect(h.password).not.toHaveBeenCalled();

    expect(await trialLoginAction()).toEqual({ success: true });
    expect(h.signIn).toHaveBeenCalledTimes(1);
    // Compté par adresse (première IP de x-forwarded-for) et pour tout le site.
    expect(h.calls).toEqual([
      { identifier: '203.0.113.9', scope: 'trial-login' },
      { identifier: 'site', scope: 'trial-login-global' },
    ]);
  });

  it('trop d’essais depuis une adresse : refus dit, aucun compte créé', async () => {
    h.anonymousOn = true;
    h.refuse = 'trial-login';
    const res = await trialLoginAction();
    expect(res).toEqual({
      success: false,
      error: 'Beaucoup d’essais depuis cette connexion : réessaie dans une heure, ou crée un compte.',
    });
    expect(h.signIn).not.toHaveBeenCalled();
  });

  it('plafond du site : refus propre au site', async () => {
    h.anonymousOn = true;
    h.refuse = 'trial-login-global';
    expect(await trialLoginAction()).toEqual({
      success: false,
      error: 'Beaucoup d’essais aujourd’hui : crée un compte pour commencer tout de suite.',
    });
    expect(h.signIn).not.toHaveBeenCalled();
  });

  it('refus de Supabase : message neutre, jamais le détail technique', async () => {
    h.anonymousOn = true;
    h.signIn.mockResolvedValueOnce({ error: { message: 'Anonymous sign-ins are disabled' } });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await trialLoginAction()).toEqual({ success: false, error: 'Essai sans compte impossible pour le moment.' });
  });
});
