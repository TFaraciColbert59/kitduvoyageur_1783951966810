// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Les deux écrans du mot de passe oublié : la demande du lien (page de connexion, avec le bon
 * `redirectTo`) et le choix du nouveau mot de passe (formulaire, `useRouter()` pour repartir).
 */
const nav = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  params: new URLSearchParams(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, refresh: nav.refresh }),
  useSearchParams: () => nav.params,
}));

const auth = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(async (..._a: unknown[]) => ({ data: {}, error: null as null | { message: string } })),
  captcha: null as null | string,
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { resetPasswordForEmail: auth.resetPasswordForEmail, refreshSession: vi.fn() } }),
}));
vi.mock('@/lib/captcha/hcaptcha', () => ({
  getCaptchaToken: async () => auth.captcha,
  hcaptchaSiteKey: () => null,
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ signIn: vi.fn(), signUp: vi.fn() }) }));
const toastSpy = vi.hoisted(() => vi.fn());
vi.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ toast: toastSpy }) }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/features/demo/demoLogin', () => ({ demoLoginAction: vi.fn(), demoLoginAvailableAction: async () => false }));
vi.mock('@/features/demo/trialSession', () => ({ trialLoginAction: vi.fn(), trialLoginAvailableAction: async () => false }));
vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/components/Footer', () => ({ default: () => null }));
vi.mock('@/components/shell/AppShell', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const action = vi.hoisted(() => ({
  newPasswordAction: vi.fn(async (..._a: unknown[]) => ({ success: true }) as { success: true } | { success: false; error: string; code: string }),
}));
vi.mock('../passwordResetActions', () => action);

import AuthPage from '@/app/connexion/page';
import { NewPasswordForm } from '../NewPasswordForm';
import { PASSWORD_RESET_PATH, PASSWORD_RESET_TEXT } from '../passwordReset';

beforeEach(() => {
  nav.params = new URLSearchParams();
  auth.captcha = null;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('page de connexion : demande du lien', () => {
  it('le lien du courriel passe par /auth/callback puis la page du nouveau mot de passe', async () => {
    render(<AuthPage />);
    fireEvent.click(screen.getAllByText('auth.forgotPasswordLink')[0]);
    fireEvent.change(screen.getAllByLabelText('auth.email')[0], { target: { value: 'a@exemple.fr' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'auth.resetSubmit' })[0]);
    await waitFor(() => expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(1));
    const [email, opts] = auth.resetPasswordForEmail.mock.calls[0] as [string, { redirectTo: string; captchaToken?: string }];
    expect(email).toBe('a@exemple.fr');
    const u = new URL(opts.redirectTo);
    expect(u.pathname).toBe('/auth/callback');
    expect(u.searchParams.get('next')).toBe(PASSWORD_RESET_PATH);
    expect(opts.captchaToken).toBeUndefined();
  });

  it('captcha allumé : le jeton accompagne la demande', async () => {
    auth.captcha = 'jeton-hcaptcha';
    render(<AuthPage />);
    fireEvent.click(screen.getAllByText('auth.forgotPasswordLink')[0]);
    fireEvent.change(screen.getAllByLabelText('auth.email')[0], { target: { value: 'a@exemple.fr' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'auth.resetSubmit' })[0]);
    await waitFor(() => expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(1));
    expect((auth.resetPasswordForEmail.mock.calls[0][1] as { captchaToken?: string }).captchaToken).toBe('jeton-hcaptcha');
  });

  it('?oubli=1 (lien périmé) ouvre directement le formulaire de demande', () => {
    nav.params = new URLSearchParams('oubli=1');
    render(<AuthPage />);
    expect(screen.getAllByText('auth.forgotPasswordHint').length).toBeGreaterThan(0);
  });
});

describe('NewPasswordForm', () => {
  const fill = (a: string, b: string) => {
    fireEvent.change(screen.getByLabelText(/Nouveau mot de passe/), { target: { value: a } });
    fireEvent.change(screen.getByLabelText(/une seconde fois/), { target: { value: b } });
    fireEvent.click(screen.getByRole('button', { name: 'Changer mon mot de passe' }));
  };

  it('deux saisies différentes : dit pourquoi, sans appeler le serveur', async () => {
    render(<NewPasswordForm email="a@exemple.fr" />);
    fill('un-bon-mot-de-passe', 'une-autre-saisie-ici');
    expect((await screen.findByRole('alert')).textContent).toBe(PASSWORD_RESET_TEXT.mismatch);
    expect(action.newPasswordAction).not.toHaveBeenCalled();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('trop court : dit pourquoi', async () => {
    render(<NewPasswordForm email={null} />);
    fill('court', 'court');
    expect((await screen.findByRole('alert')).textContent).toBe(PASSWORD_RESET_TEXT.invalid);
    expect(action.newPasswordAction).not.toHaveBeenCalled();
  });

  it('refus du serveur : le message reste sous le champ, on ne repart pas', async () => {
    action.newPasswordAction.mockResolvedValueOnce({ success: false, error: PASSWORD_RESET_TEXT.signedOut, code: 'signed_out' });
    render(<NewPasswordForm email="a@exemple.fr" />);
    fill('un-bon-mot-de-passe', 'un-bon-mot-de-passe');
    expect((await screen.findByRole('alert')).textContent).toBe(PASSWORD_RESET_TEXT.signedOut);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('réussite : message, puis retour au compte par useRouter()', async () => {
    render(<NewPasswordForm email="a@exemple.fr" />);
    fill('un-bon-mot-de-passe', 'un-bon-mot-de-passe');
    await waitFor(() =>
      expect(action.newPasswordAction).toHaveBeenCalledWith({ password: 'un-bon-mot-de-passe', confirm: 'un-bon-mot-de-passe' })
    );
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/compte'));
    expect(nav.refresh).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith(PASSWORD_RESET_TEXT.done, 'success');
  });
});
