import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Garder son essai (plan 2.3) : lier un e-mail à la session anonyme. Client Supabase simulé,
 * interrupteur d'environnement éteint par défaut, refus de Supabase dits honnêtement.
 */
const h = vi.hoisted(() => ({
  user: null as null | { id: string; is_anonymous?: boolean; email?: string },
  updateUser: vi.fn(async (..._a: unknown[]) => ({ data: {}, error: null as null | Record<string, unknown> })),
  refuse: null as null | string,
  calls: [] as Array<{ identifier: string; scope: string }>,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ origin: 'https://apercu.lekitduvoyageur.fr', host: 'ignore.example' }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }), updateUser: h.updateUser },
  }),
}));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async (identifier: string, config: { scope: string }) => {
    h.calls.push({ identifier, scope: config.scope });
    return h.refuse === config.scope ? new Response(null, { status: 429 }) : null;
  }),
}));

import { keepTrialEmailAction, keepTrialPasswordAction } from '../keepTrialActions';
import {
  KEEP_TRIAL_RETURN,
  KEEP_TRIAL_TEXT,
  keepTrialEnabled,
  keepTrialFailure,
} from '../keepTrial';

const TRIAL = { id: '11111111-1111-4111-8111-111111111111', is_anonymous: true };
const MEMBER = { id: '22222222-2222-4222-8222-222222222222', is_anonymous: false, email: 'a@exemple.fr' };

beforeEach(() => {
  h.user = TRIAL;
  h.refuse = null;
  h.calls = [];
  h.updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
  vi.stubEnv('NEXT_PUBLIC_KEEP_TRIAL', 'on');
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('interrupteur', () => {
  it('éteint par défaut : seule la valeur « on » allume', () => {
    expect(keepTrialEnabled({})).toBe(false);
    expect(keepTrialEnabled({ NEXT_PUBLIC_KEEP_TRIAL: '' })).toBe(false);
    expect(keepTrialEnabled({ NEXT_PUBLIC_KEEP_TRIAL: 'true' })).toBe(false);
    expect(keepTrialEnabled({ NEXT_PUBLIC_KEEP_TRIAL: '1' })).toBe(false);
    expect(keepTrialEnabled({ NEXT_PUBLIC_KEEP_TRIAL: ' ON ' })).toBe(true);
  });

  it('éteint : rien n’est demandé à Supabase, le refus est dit', async () => {
    vi.stubEnv('NEXT_PUBLIC_KEEP_TRIAL', '');
    const res = await keepTrialEmailAction({ email: 'moi@exemple.fr' });
    expect(res).toEqual({ success: false, error: KEEP_TRIAL_TEXT.disabled, code: 'disabled' });
    expect(h.updateUser).not.toHaveBeenCalled();
    expect(h.calls).toEqual([]);
  });
});

describe('lier un e-mail à la session d’essai', () => {
  it('appelle updateUser({ email }) sur la session anonyme, retour par /auth/callback vers la page', async () => {
    const res = await keepTrialEmailAction({ email: '  Moi@Exemple.FR ' });
    expect(res).toEqual({ success: true });
    expect(h.updateUser).toHaveBeenCalledTimes(1);
    expect(h.updateUser).toHaveBeenCalledWith(
      { email: 'moi@exemple.fr' },
      { emailRedirectTo: `https://apercu.lekitduvoyageur.fr/auth/callback?next=${encodeURIComponent(KEEP_TRIAL_RETURN)}` }
    );
    // Compté par essai, puis pour le site.
    expect(h.calls).toEqual([
      { identifier: TRIAL.id, scope: 'keep-trial' },
      { identifier: 'site', scope: 'keep-trial-global' },
    ]);
  });

  it('adresse invalide ou champ absent : refus, rien d’appelé', async () => {
    for (const bad of [{ email: 'pas-un-mail' }, { email: '' }, {}, null, 'x', { email: 'a'.repeat(300) + '@b.fr' }]) {
      const res = await keepTrialEmailAction(bad);
      expect(res).toMatchObject({ success: false, code: 'invalid' });
    }
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('sans session : refus ; avec un compte (pas un essai) : refus, rien d’appelé', async () => {
    h.user = null;
    expect(await keepTrialEmailAction({ email: 'moi@exemple.fr' })).toMatchObject({ success: false, code: 'signed_out' });
    h.user = MEMBER;
    expect(await keepTrialEmailAction({ email: 'moi@exemple.fr' })).toMatchObject({ success: false, code: 'not_trial' });
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('trop d’envois pour cet essai, ou pour le site : refus, aucun e-mail', async () => {
    h.refuse = 'keep-trial';
    expect(await keepTrialEmailAction({ email: 'moi@exemple.fr' })).toMatchObject({ success: false, code: 'limited' });
    h.refuse = 'keep-trial-global';
    expect(await keepTrialEmailAction({ email: 'moi@exemple.fr' })).toMatchObject({ success: false, code: 'limited' });
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('« Allow manual linking » éteint chez Supabase : message honnête, essai intact', async () => {
    h.updateUser.mockResolvedValue({
      data: {},
      error: { name: 'AuthApiError', code: 'manual_linking_disabled', status: 422, message: 'Manual linking is disabled' },
    });
    const res = await keepTrialEmailAction({ email: 'moi@exemple.fr' });
    expect(res).toEqual({ success: false, error: KEEP_TRIAL_TEXT.linkingOff, code: 'disabled' });
    expect(res.success === false && res.error).toMatch(/7 jours/);
  });

  it('adresse déjà utilisée : dit de se connecter, sans promettre une fusion', async () => {
    h.updateUser.mockResolvedValue({ data: {}, error: { name: 'AuthApiError', code: 'email_exists', status: 422, message: 'x@y.fr exists' } });
    const res = await keepTrialEmailAction({ email: 'moi@exemple.fr' });
    expect(res).toMatchObject({ success: false, code: 'exists' });
    expect(res.success === false && res.error).toContain('ne se déplace pas tout seul');
  });

  it('un message de Supabase qui cite l’adresse n’est jamais renvoyé tel quel', async () => {
    h.updateUser.mockResolvedValue({ data: {}, error: { name: 'AuthApiError', status: 400, message: 'secret@exemple.fr bloquée' } });
    const res = await keepTrialEmailAction({ email: 'moi@exemple.fr' });
    expect(JSON.stringify(res)).not.toContain('secret@exemple.fr');
    expect(res).toMatchObject({ success: false, code: 'refused' });
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('@');
  });

  it('exception inattendue : message générique, essai non touché', async () => {
    h.updateUser.mockRejectedValue(new Error('réseau coupé'));
    expect(await keepTrialEmailAction({ email: 'moi@exemple.fr' })).toEqual({
      success: false,
      error: KEEP_TRIAL_TEXT.unavailable,
      code: 'unavailable',
    });
  });

  it('correspondance des codes documentés de Supabase Auth', () => {
    const code = (c: string, status?: number) => keepTrialFailure({ code: c, status }).code;
    expect(code('over_email_send_rate_limit', 429)).toBe('limited');
    expect(code('over_request_rate_limit', 429)).toBe('limited');
    expect(code('email_address_invalid')).toBe('invalid');
    expect(code('email_address_not_authorized')).toBe('refused');
    expect(code('weak_password')).toBe('invalid');
    expect(code('anonymous_provider_disabled')).toBe('refused');
    expect(code('unexpected_failure', 500)).toBe('unavailable');
  });
});

describe('mot de passe, une fois l’e-mail confirmé', () => {
  beforeEach(() => {
    h.user = MEMBER;
  });

  it('appelle updateUser({ password }) pour la personne connectée', async () => {
    expect(await keepTrialPasswordAction({ password: 'un mot de passe long' })).toEqual({ success: true });
    expect(h.updateUser).toHaveBeenCalledWith({ password: 'un mot de passe long' });
    expect(h.calls).toEqual([{ identifier: MEMBER.id, scope: 'keep-trial-password' }]);
  });

  it('court, trop long ou absent : refus', async () => {
    for (const bad of [{ password: 'court' }, { password: 'x'.repeat(73) }, {}, null]) {
      expect(await keepTrialPasswordAction(bad)).toMatchObject({ success: false, code: 'invalid' });
    }
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('session encore anonyme (e-mail pas confirmé) : Supabase l’exige, on le dit sans l’appeler', async () => {
    h.user = TRIAL;
    expect(await keepTrialPasswordAction({ password: 'un mot de passe long' })).toEqual({
      success: false,
      error: KEEP_TRIAL_TEXT.confirmFirst,
      code: 'unconfirmed',
    });
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('sans session : refus ; limite atteinte : refus ; mot de passe identique : dit', async () => {
    h.user = null;
    expect(await keepTrialPasswordAction({ password: 'un mot de passe long' })).toMatchObject({ code: 'signed_out' });
    h.user = MEMBER;
    h.refuse = 'keep-trial-password';
    expect(await keepTrialPasswordAction({ password: 'un mot de passe long' })).toMatchObject({ code: 'limited' });
    h.refuse = null;
    h.updateUser.mockResolvedValue({ data: {}, error: { code: 'same_password', status: 422, message: 'x' } });
    expect(await keepTrialPasswordAction({ password: 'un mot de passe long' })).toMatchObject({ code: 'invalid' });
  });
});
