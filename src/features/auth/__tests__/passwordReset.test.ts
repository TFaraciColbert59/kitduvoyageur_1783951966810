import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mot de passe oublié, de bout en bout, avec un Supabase simulé : l'adresse du lien du courriel
 * (`redirectTo`) -> `/auth/callback` (échange du code PKCE) -> `newPasswordAction` (`updateUser`).
 * Le défaut d'origine : `redirectTo` valait `/connexion`, où rien n'échangeait le `code`.
 */
type FakeUser = { id: string; email?: string; is_anonymous?: boolean };
const h = vi.hoisted(() => ({
  session: null as null | { id: string; email?: string; is_anonymous?: boolean },
  validCode: 'code-pkce-valide',
  exchange: vi.fn(),
  updateUser: vi.fn(),
  refuse: null as null | string,
  calls: [] as Array<{ identifier: string; scope: string }>,
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: h.exchange,
      getUser: async () => ({ data: { user: h.session } }),
      updateUser: h.updateUser,
    },
  }),
}));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async (identifier: string, config: { scope: string }) => {
    h.calls.push({ identifier, scope: config.scope });
    return h.refuse === config.scope ? new Response(null, { status: 429 }) : null;
  }),
}));

import { GET } from '@/app/auth/callback/route';
import { newPasswordAction } from '../passwordResetActions';
import {
  isPasswordResetPath,
  newPasswordSchema,
  PASSWORD_RESET_PATH,
  PASSWORD_RESET_TEXT,
  passwordResetFailure,
  passwordResetRedirectTo,
} from '../passwordReset';

const ORIGIN = 'https://lekitduvoyageur.fr';
const MEMBER: FakeUser = { id: '22222222-2222-4222-8222-222222222222', email: 'a@exemple.fr', is_anonymous: false };

beforeEach(() => {
  h.session = null;
  h.refuse = null;
  h.calls = [];
  h.exchange.mockReset().mockImplementation(async (code: string) => {
    if (code === h.validCode) {
      h.session = MEMBER;
      return { data: {}, error: null };
    }
    return { data: {}, error: { message: 'bad_code_verifier' } };
  });
  h.updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

/** Ce que fait Supabase : il ajoute `code` à l'adresse `redirectTo` reçue, requête comprise. */
function emailLink(redirectTo: string, code: string): string {
  const u = new URL(redirectTo);
  u.searchParams.set('code', code);
  return u.toString();
}

describe('adresse du lien du courriel', () => {
  it('passe par /auth/callback (qui échange le code), jamais par /connexion', () => {
    const to = passwordResetRedirectTo(ORIGIN);
    const u = new URL(to);
    expect(u.origin).toBe(ORIGIN);
    expect(u.pathname).toBe('/auth/callback');
    expect(u.searchParams.get('next')).toBe(PASSWORD_RESET_PATH);
    expect(to).not.toMatch(/^https:\/\/lekitduvoyageur\.fr\/connexion/);
  });

  it('suit l’origine de la page (aperçu, production)', () => {
    expect(passwordResetRedirectTo('https://apercu.lekitduvoyageur.fr')).toMatch(
      /^https:\/\/apercu\.lekitduvoyageur\.fr\/auth\/callback\?next=/
    );
  });

  it('reconnaît seulement la page du nouveau mot de passe', () => {
    expect(isPasswordResetPath(PASSWORD_RESET_PATH)).toBe(true);
    expect(isPasswordResetPath(`${PASSWORD_RESET_PATH}?lien=ok`)).toBe(true);
    expect(isPasswordResetPath('/connexion')).toBe(false);
    expect(isPasswordResetPath(`${PASSWORD_RESET_PATH}-autre`)).toBe(false);
  });
});

describe('parcours complet', () => {
  it('lien valide : code échangé, arrivée sur le nouveau mot de passe, mot de passe changé', async () => {
    const link = emailLink(passwordResetRedirectTo(ORIGIN), h.validCode);
    const res = await GET(new Request(link));
    expect(h.exchange).toHaveBeenCalledWith(h.validCode);
    expect(res.headers.get('location')).toBe(`${ORIGIN}${PASSWORD_RESET_PATH}`);

    const done = await newPasswordAction({ password: 'un-bon-mot-de-passe', confirm: 'un-bon-mot-de-passe' });
    expect(done).toEqual({ success: true });
    // Seul le mot de passe part, jamais la confirmation.
    expect(h.updateUser).toHaveBeenCalledWith({ password: 'un-bon-mot-de-passe' });
    expect(h.calls).toEqual([{ identifier: MEMBER.id, scope: 'password-reset' }]);
  });

  it('lien refusé (expiré, déjà servi, autre navigateur) : la page le dit, rien n’est changé', async () => {
    const link = emailLink(passwordResetRedirectTo(ORIGIN), 'code-perime');
    const res = await GET(new Request(link));
    expect(res.headers.get('location')).toBe(`${ORIGIN}${PASSWORD_RESET_PATH}?lien=echec`);

    const done = await newPasswordAction({ password: 'un-bon-mot-de-passe', confirm: 'un-bon-mot-de-passe' });
    expect(done).toEqual({ success: false, error: PASSWORD_RESET_TEXT.signedOut, code: 'signed_out' });
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('erreur renvoyée par Supabase sans code (lien expiré côté Supabase) : même page d’explication', async () => {
    const res = await GET(
      new Request(`${ORIGIN}/auth/callback?next=${encodeURIComponent(PASSWORD_RESET_PATH)}&error=access_denied&error_code=otp_expired`)
    );
    expect(h.exchange).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBe(`${ORIGIN}${PASSWORD_RESET_PATH}?lien=echec`);
  });

  it('next hors du site : jamais suivi, même avec un code valide', async () => {
    for (const next of ['//autre.site', 'https://autre.site', '/\\autre.site']) {
      h.session = null;
      const res = await GET(new Request(`${ORIGIN}/auth/callback?code=${h.validCode}&next=${encodeURIComponent(next)}`));
      expect(res.headers.get('location')).toBe(`${ORIGIN}/compte`);
    }
  });

  it('autre échec que le mot de passe oublié : la connexion en erreur, comme avant', async () => {
    const res = await GET(new Request(`${ORIGIN}/auth/callback?code=mauvais&next=%2Fcompte`));
    expect(res.headers.get('location')).toBe(`${ORIGIN}/connexion?error=callback_failed`);
  });
});

describe('newPasswordSchema', () => {
  it('8 à 72 caractères, deux saisies identiques', () => {
    expect(newPasswordSchema.safeParse({ password: '12345678', confirm: '12345678' }).success).toBe(true);
    expect(newPasswordSchema.safeParse({ password: '1234567', confirm: '1234567' }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: 'a'.repeat(73), confirm: 'a'.repeat(73) }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: '12345678', confirm: '12345679' }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: '12345678' }).success).toBe(false);
    expect(newPasswordSchema.safeParse('12345678').success).toBe(false);
  });
});

describe('newPasswordAction', () => {
  it('entrée invalide : refusée avant tout appel à Supabase', async () => {
    h.session = MEMBER;
    expect(await newPasswordAction({ password: 'court', confirm: 'court' })).toEqual({
      success: false,
      error: PASSWORD_RESET_TEXT.invalid,
      code: 'invalid',
    });
    expect(await newPasswordAction({ password: 'un-bon-mot-de-passe', confirm: 'autre-chose-ici' })).toEqual({
      success: false,
      error: PASSWORD_RESET_TEXT.mismatch,
      code: 'mismatch',
    });
    expect(await newPasswordAction(null)).toMatchObject({ success: false, code: 'invalid' });
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('sans session, ou en essai anonyme : rien à changer', async () => {
    const input = { password: 'un-bon-mot-de-passe', confirm: 'un-bon-mot-de-passe' };
    h.session = null;
    expect(await newPasswordAction(input)).toMatchObject({ success: false, code: 'signed_out' });
    h.session = { id: MEMBER.id, is_anonymous: true };
    expect(await newPasswordAction(input)).toMatchObject({ success: false, code: 'signed_out' });
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('trop d’essais : refusé sans appeler Supabase', async () => {
    h.session = MEMBER;
    h.refuse = 'password-reset';
    expect(await newPasswordAction({ password: 'un-bon-mot-de-passe', confirm: 'un-bon-mot-de-passe' })).toEqual({
      success: false,
      error: PASSWORD_RESET_TEXT.limited,
      code: 'limited',
    });
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('refus de Supabase : dit honnêtement, jamais son texte brut', async () => {
    h.session = MEMBER;
    h.updateUser.mockResolvedValue({ data: {}, error: { code: 'same_password', message: 'a@exemple.fr same password' } });
    const res = await newPasswordAction({ password: 'un-bon-mot-de-passe', confirm: 'un-bon-mot-de-passe' });
    expect(res).toEqual({ success: false, error: PASSWORD_RESET_TEXT.weak, code: 'weak' });
    expect(JSON.stringify(res)).not.toContain('a@exemple.fr');
  });

  it('panne imprévue : message de service, mot de passe inchangé', async () => {
    h.session = MEMBER;
    h.updateUser.mockRejectedValue(new Error('réseau'));
    expect(await newPasswordAction({ password: 'un-bon-mot-de-passe', confirm: 'un-bon-mot-de-passe' })).toEqual({
      success: false,
      error: PASSWORD_RESET_TEXT.unavailable,
      code: 'unavailable',
    });
  });
});

describe('passwordResetFailure', () => {
  it('traduit les codes de Supabase Auth', () => {
    expect(passwordResetFailure({ code: 'weak_password' }).code).toBe('weak');
    expect(passwordResetFailure({ code: 'same_password' }).code).toBe('weak');
    expect(passwordResetFailure({ code: 'reauthentication_needed' }).code).toBe('reauth');
    expect(passwordResetFailure({ code: 'session_not_found' }).code).toBe('signed_out');
    expect(passwordResetFailure({ status: 429 }).code).toBe('limited');
    expect(passwordResetFailure({ code: 'over_request_rate_limit' }).code).toBe('limited');
    expect(passwordResetFailure({ status: 500 }).code).toBe('unavailable');
    expect(passwordResetFailure(undefined).code).toBe('unavailable');
  });
});
