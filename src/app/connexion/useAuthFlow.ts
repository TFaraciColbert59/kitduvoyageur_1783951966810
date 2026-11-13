'use client';

import React, { useId, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { trackEvent } from '@/lib/analytics';
import { createClient } from '@/lib/supabase/client';
import { useTranslation } from '@/lib/i18n/context';
import { getCaptchaToken } from '@/lib/captcha/hcaptcha';
import { passwordResetRedirectTo } from '@/features/auth/passwordReset';
import { safeNextPath } from '@/lib/supabase/safeNext';

export type AuthMode = 'connexion' | 'inscription';

const DEMO_MESSAGES: Record<string, string> = {
  disabled: 'Le compte démo est désactivé pour le moment.',
  unavailable: 'Le compte démo est momentanément indisponible.',
  failed: "La connexion au compte démo n'a pas abouti. Réessayez dans un instant.",
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Logique unique de la page /connexion (connexion, inscription, mot de passe
 * oublié). Partagée par la vue ordinateur et la vue mobile : seul le rendu diffère.
 */
export function useAuthFlow() {
  // Le formulaire est rendu deux fois (vue ordinateur et vue mobile) : des
  // identifiants propres à chaque rendu gardent chaque label sur son champ.
  const uid = useId();
  const searchParams = useSearchParams();
  const initialMode: AuthMode = searchParams?.get('mode') === 'inscription' ? 'inscription' : 'connexion';
  const requestedNext = searchParams?.get('next');
  // Garde unique et testée : refuse `//`, le backslash et les caractères de
  // contrôle (une garde locale laissait passer `/\evil.com` → open redirect).
  const nextPath = requestedNext ? safeNextPath(requestedNext, '') || null : null;
  // Motif d'échec renvoyé par /api/demo-login (`?demo=<motif>`), affiché tel quel (texte).
  // Jamais de texte libre venu de l'URL : un code connu → message fixe, sinon message générique.
  const demoCode = searchParams?.get('demo');
  const demoError = demoCode ? (DEMO_MESSAGES[demoCode] ?? DEMO_MESSAGES.failed) : '';
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [errorField, setErrorField] = useState<'name' | 'email' | 'password' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // `?oubli=1` : la page « nouveau mot de passe » renvoie ici quand le lien n'est plus valable.
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(searchParams?.get('oubli') === '1');
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError(t('auth.errorMissingEmail'));
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const captchaToken = await getCaptchaToken();
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        // Le lien du courriel passe par /auth/callback (échange du code), puis la page du nouveau mot de passe.
        redirectTo: passwordResetRedirectTo(window.location.origin),
        ...(captchaToken ? { captchaToken } : {}),
      });
      if (resetErr) throw resetErr;
      setResetSent(true);
      toast(t('auth.toastResetSent'), 'info');
    } catch (err: any) {
      setError(err?.message || t('auth.errorResetEmail'));
    } finally {
      setLoading(false);
    }
  };

  const ensureProfile = async (userId: string, userEmail: string, fullName: string) => {
    try {
      const supabase = createClient();
      const { data: existing } = await supabase.from('user_profiles').select('id').eq('id', userId).maybeSingle();
      if (!existing) {
        await supabase.from('user_profiles').upsert({ id: userId, email: userEmail, full_name: fullName || userEmail.split('@')[0] }, { onConflict: 'id' });
      }
    } catch { /* ignore */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setConfirmationSent(false);
    const fail = (field: 'name' | 'email' | 'password', msg: string) => {
      setError(msg);
      setErrorField(field);
      // Le champ fautif reçoit le focus (id construit comme dans les vues).
      document.getElementById(`${uid}-${field}`)?.focus();
    };
    setErrorField(null);
    if (!email.trim()) { fail('email', t('auth.errorMissingFields')); return; }
    if (!password) { fail('password', t('auth.errorMissingFields')); return; }
    if (mode === 'inscription' && !name) { fail('name', t('auth.errorFirstName')); return; }
    if (!EMAIL_RE.test(email.trim())) { fail('email', 'Saisissez une adresse e-mail valide (nom@exemple.fr).'); return; }
    if (password.length < 8) { fail('password', t('auth.errorPasswordLength')); return; }
    setLoading(true);
    try {
      if (mode === 'connexion') {
        const result = (await signIn(email, password, await getCaptchaToken())) as { user?: { id: string; email?: string } };
        if (result?.user) await ensureProfile(result.user.id, result.user.email ?? email, '');
        trackEvent('login', { method: 'email' });
        toast(t('auth.toastWelcome'), 'success');
        // Pas de router.refresh() ici : il déclenchait un second rendu RSC
        // concurrent de la destination (course → page « indisponible »).
        router.push(nextPath ?? '/compte');
      } else {
        const result = (await signUp(email, password, { fullName: name }, await getCaptchaToken())) as { user?: { id: string; email?: string }; session?: unknown };
        if (result?.session) {
          if (result?.user) await ensureProfile(result.user.id, result.user.email ?? email, name);
          trackEvent('sign_up', { method: 'email' });
          toast(t('auth.toastAccountCreated'), 'success');
          router.push(nextPath ?? '/compte');
        } else {
          if (result?.user) await ensureProfile(result.user.id, result.user.email ?? email, name);
          setConfirmationSent(true);
          toast(t('auth.toastConfirmationSent'), 'info');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.errorGeneric');
      const friendlyMsg = msg.includes('Invalid login credentials') ? t('auth.errorInvalidCredentials') : msg.includes('User already registered') ? t('auth.errorAlreadyRegistered') : msg;
      setError(friendlyMsg);
    } finally { setLoading(false); }
  };

  /** Change d'onglet (ou bascule) en remettant l'écran à zéro. */
  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setErrorField(null);
    setConfirmationSent(false);
    setForgotPasswordOpen(false);
  };

  return {
    uid, t, mode, switchMode, setMode, email, setEmail, password, setPassword, name, setName,
    showPassword, setShowPassword, forgotPasswordOpen, setForgotPasswordOpen, resetSent,
    loading, error, errorField, setError, confirmationSent, setConfirmationSent, demoError,
    handleSubmit, handleResetPassword,
  };
}

export type AuthFlow = ReturnType<typeof useAuthFlow>;
