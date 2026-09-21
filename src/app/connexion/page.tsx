'use client';

import React, { useState, Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { trackEvent } from '@/lib/analytics';
import { createClient } from '@/lib/supabase/client';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { Button } from '@/components/ui';
import { useTranslation } from '@/lib/i18n/context';

type AuthMode = 'connexion' | 'inscription';

function AuthForm() {
  const searchParams = useSearchParams();
  const initialMode = (searchParams?.get('mode') as AuthMode) || 'connexion';
  const requestedNext = searchParams?.get('next');
  // Only allow internal relative paths (no open redirect via external URL)
  const nextPath = requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : null;
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
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
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/connexion`,
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
        await supabase.from('user_profiles').upsert({ id: userId, email: userEmail, full_name: fullName || userEmail.split('@')[0], trust_score: 50, loyalty_points: 0, loyalty_level: 'Explorateur', xp: 0, level: 1 }, { onConflict: 'id' });
      }
    } catch { /* ignore */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setConfirmationSent(false);
    if (!email || !password) { setError(t('auth.errorMissingFields')); return; }
    if (mode === 'inscription' && !name) { setError(t('auth.errorFirstName')); return; }
    if (password.length < 8) { setError(t('auth.errorPasswordLength')); return; }
    setLoading(true);
    try {
      if (mode === 'connexion') {
        const result = (await signIn(email, password)) as { user?: { id: string; email?: string } };
        if (result?.user) await ensureProfile(result.user.id, result.user.email ?? email, '');
        trackEvent('login', { method: 'email' });
        toast(t('auth.toastWelcome'), 'success');
        // Pas de router.refresh() ici : il déclenchait un second rendu RSC
        // concurrent de la destination (course → page « indisponible »).
        router.push(nextPath ?? '/compte');
      } else {
        const result = (await signUp(email, password, { fullName: name })) as { user?: { id: string; email?: string }; session?: unknown };
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

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-[var(--space-4)] pb-[var(--space-12)] pt-20 sm:pt-24">
      <div className="w-full max-w-[420px]">
        <div className="mb-[var(--space-6)] text-center">
          <h1 className="text-[length:var(--lkv-text-title-sm)] font-bold tracking-tight text-[color:var(--lkv-primary)] sm:text-[length:var(--lkv-text-title-lg)]">
            {t(mode === 'connexion' ? 'auth.signInTitle' : 'auth.signUpTitle')}
          </h1>
          <p className="mt-1 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
            {t(mode === 'connexion' ? 'auth.signInSubtitle' : 'auth.signUpSubtitle')}
          </p>
        </div>

        {/* Segmented Control iOS fluide */}
        <div className="mb-[var(--space-6)] flex rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border-subtle)] bg-black/5 p-1 backdrop-blur-[var(--blur-md)] dark:bg-white/10">
          {(['connexion', 'inscription'] as const).map((m) => {
            const isActive = mode === m && !forgotPasswordOpen;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setMode(m);
                  setError('');
                  setConfirmationSent(false);
                  setForgotPasswordOpen(false);
                }}
                className={`flex-1 rounded-[var(--lkv-radius-control)] py-2.5 text-[length:var(--lkv-text-footnote)] font-semibold transition-colors duration-[var(--motion-control-duration)] ${
                  isActive
                    ? 'bg-[color:var(--lkv-primary)] text-[color:var(--lkv-text-inverted)] shadow-elevation-1'
                    : 'text-[color:var(--lkv-text-muted)] hover:text-[color:var(--lkv-text-primary)]'
                }`}
              >
                {t(m === 'connexion' ? 'auth.signIn' : 'auth.signUp')}
              </button>
            );
          })}
        </div>

        <div className="rounded-[var(--lkv-radius-card)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-6)] shadow-elevation-2 backdrop-blur-[var(--blur-lg)] sm:p-[var(--space-8)]">
          {confirmationSent ? (
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--lkv-success-bg)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--lkv-primary)" strokeWidth="2" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="mb-2 font-bold text-[color:var(--lkv-primary)]">{t('auth.confirmationTitle')}</p>
              <p className="mb-[var(--space-4)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">
                {t('auth.confirmationBodyPrefix')} <strong>{email}</strong>{t('auth.confirmationBodySuffix')}
              </p>
              <Button
                fullWidth
                size="lg"
                onClick={() => {
                  setMode('connexion');
                  setConfirmationSent(false);
                }}
              >
                {t('auth.goToSignIn')}
              </Button>
            </div>
          ) : forgotPasswordOpen ? (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-[14px]">
              <h2 className="text-[length:var(--lkv-text-body-sm)] font-bold text-[color:var(--lkv-primary)]">
                {t('auth.forgotPassword')}
              </h2>
              <p className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">
                {t('auth.forgotPasswordHint')}
              </p>
              {resetSent ? (
                <div className="rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-success)] bg-[color:var(--lkv-success-bg)] p-[var(--space-3)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-primary)]">
                  {t('auth.resetSentBody')}
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="reset-email" className="mb-1 block text-[length:var(--lkv-text-caption-1)] font-semibold text-[color:var(--lkv-text-primary)]">
                      {t('auth.email')}
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('auth.emailPlaceholder')}
                      autoComplete="email"
                      required
                      className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[14px] py-2.5 text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
                    />
                  </div>
                  {error && (
                    <div className="rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-danger)] bg-[color:var(--lkv-danger-bg)] p-[10px] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-danger)]" role="alert">
                      {error}
                    </div>
                  )}
                  <Button type="submit" loading={loading} fullWidth size="lg">
                    {loading ? t('auth.resetSubmitting') : t('auth.resetSubmit')}
                  </Button>
                </>
              )}
              <button
                type="button"
                onClick={() => { setForgotPasswordOpen(false); setError(''); }}
                className="mt-2 min-h-[var(--lkv-touch-min)] cursor-pointer text-center text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)] underline hover:text-[color:var(--lkv-primary)]"
              >
                {t('auth.backToSignIn')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
              {mode === 'inscription' && (
                <div>
                  <label htmlFor="name" className="mb-1 block text-[length:var(--lkv-text-caption-1)] font-semibold text-[color:var(--lkv-text-primary)]">
                    {t('auth.name')}
                  </label>
                  <input id="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('auth.namePlaceholder')} className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[14px] py-2.5 text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]" />
                </div>
              )}
              <div>
                <label htmlFor="email" className="mb-1 block text-[length:var(--lkv-text-caption-1)] font-semibold text-[color:var(--lkv-text-primary)]">
                  {t('auth.email')}
                </label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} autoComplete="email" required className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[14px] py-2.5 text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]" />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="password" className="text-[length:var(--lkv-text-caption-1)] font-semibold text-[color:var(--lkv-text-primary)]">
                    {mode === 'inscription' ? t('auth.passwordWithMin') : t('auth.password')}
                  </label>
                  {mode === 'connexion' && (
                    <button
                      type="button"
                      onClick={() => { setForgotPasswordOpen(true); setError(''); }}
                      className="cursor-pointer text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)] underline hover:text-[color:var(--lkv-primary)]"
                    >
                      {t('auth.forgotPasswordLink')}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'inscription' ? t('auth.passwordMinPlaceholder') : t('auth.passwordPlaceholder')}
                    autoComplete={mode === 'inscription' ? 'new-password' : 'current-password'}
                    required
                    className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] py-2.5 pl-[14px] pr-11 text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent text-[color:var(--lkv-text-muted)]"
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-danger)] bg-[color:var(--lkv-danger-bg)] p-[10px] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-danger)]" role="alert">
                  {error}
                </div>
              )}
              <Button type="submit" loading={loading} fullWidth size="lg">
                {loading ? t(mode === 'connexion' ? 'auth.submittingSignIn' : 'auth.submittingSignUp') : t(mode === 'connexion' ? 'auth.submitSignIn' : 'auth.submitSignUp')}
              </Button>
            </form>
          )}
          <div className="mt-[var(--space-4)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-4)] text-center">
            <p className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">
              {mode === 'connexion' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'connexion' ? 'inscription' : 'connexion');
                  setError('');
                  setConfirmationSent(false);
                  setForgotPasswordOpen(false);
                }}
                className="cursor-pointer px-[var(--space-3)] py-1 text-[length:var(--lkv-text-caption-1)] font-semibold text-[color:var(--lkv-primary)] underline"
              >
                {mode === 'connexion' ? t('auth.registerLink') : t('auth.signIn')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background">
          <Header />
          <Suspense fallback={<div className="min-h-screen" />}><AuthForm /></Suspense>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <Suspense fallback={<div />}><AuthForm /></Suspense>
        </MobilePageShell>
        
      </div>
    </>
  );
}
