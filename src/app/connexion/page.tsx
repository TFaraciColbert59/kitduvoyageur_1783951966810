'use client';

import React, { useState, Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { trackEvent } from '@/lib/analytics';
import { createClient } from '@/lib/supabase/client';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
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
    <div className="pt-20 sm:pt-24 min-h-[100dvh] flex items-center justify-center px-4 pb-24">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--lkv-primary)]">
            {t(mode === 'connexion' ? 'auth.signInTitle' : 'auth.signUpTitle')}
          </h1>
          <p className="text-[var(--lkv-text-muted)] text-sm mt-1">
            {t(mode === 'connexion' ? 'auth.signInSubtitle' : 'auth.signUpSubtitle')}
          </p>
        </div>

        {/* Segmented Control iOS fluide */}
        <div className="flex p-1 bg-black/5 dark:bg-white/10 backdrop-blur-md rounded-2xl mb-6 border border-black/5 dark:border-white/10">
          {(['connexion', 'inscription'] as const).map((m) => {
            const isActive = mode === m && !forgotPasswordOpen;
            return (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError('');
                  setConfirmationSent(false);
                  setForgotPasswordOpen(false);
                }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-[#17402C] text-white shadow-sm'
                    : 'text-[var(--lkv-text-muted)] hover:text-[var(--lkv-text-primary)]'
                }`}
              >
                {t(m === 'connexion' ? 'auth.signIn' : 'auth.signUp')}
              </button>
            );
          })}
        </div>

        <div className="glass rounded-3xl p-6 sm:p-8 border border-white/60 shadow-lg">
          {confirmationSent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--lkv-primary)" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg></div>
              <p style={{ fontWeight: 700, color: 'var(--lkv-primary)', marginBottom: '8px' }}>{t('auth.confirmationTitle')}</p>
              <p style={{ fontSize: '13px', color: 'var(--lkv-text-muted)', marginBottom: '16px' }}>{t('auth.confirmationBodyPrefix')} <strong>{email}</strong>{t('auth.confirmationBodySuffix')}</p>
              <button onClick={() => { setMode('connexion'); setConfirmationSent(false); }} className="glass-capsule-btn primary w-full !py-3 !text-sm !font-semibold">{t('auth.goToSignIn')}</button>
            </div>
          ) : forgotPasswordOpen ? (
            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--lkv-primary)' }}>{t('auth.forgotPassword')}</h2>
              <p style={{ fontSize: '13px', color: 'var(--lkv-text-muted)' }}>
                {t('auth.forgotPasswordHint')}
              </p>
              {resetSent ? (
                <div style={{ background: 'var(--lkv-success-bg, rgba(16,185,129,0.1))', border: '1px solid var(--lkv-success)', padding: '12px', borderRadius: '10px', fontSize: '13px', color: 'var(--lkv-primary)' }}>
                  {t('auth.resetSentBody')}
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="reset-email" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--lkv-text-primary)', marginBottom: '4px' }}>
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
                      style={{ width: '100%', padding: '10px 14px', minHeight: '44px', borderRadius: '10px', border: '1px solid rgba(23,64,44,0.1)', background: 'var(--lkv-surface)', fontSize: '14px', color: 'var(--lkv-primary)' }}
                    />
                  </div>
                  {error && <div style={{ background: 'var(--lkv-danger-bg)', border: '1px solid var(--lkv-danger)', padding: '10px', borderRadius: '10px', fontSize: '13px', color: 'var(--lkv-danger)' }}>{error}</div>}
                  <button type="submit" disabled={loading} className="glass-capsule-btn primary w-full !min-h-[44px] !py-3 !text-[15px] !font-semibold">
                    {loading ? t('auth.resetSubmitting') : t('auth.resetSubmit')}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => { setForgotPasswordOpen(false); setError(''); }}
                className="text-xs text-[var(--lkv-text-muted)] hover:text-[var(--lkv-primary)] underline text-center cursor-pointer mt-2"
              >
                {t('auth.backToSignIn')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {mode === 'inscription' && (
                <div>
                  <label htmlFor="name" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--lkv-text-primary)', marginBottom: '4px' }}>
                    {t('auth.name')}
                  </label>
                  <input id="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('auth.namePlaceholder')} style={{ width: '100%', padding: '10px 14px', minHeight: '44px', borderRadius: '10px', border: '1px solid rgba(23,64,44,0.1)', background: 'var(--lkv-surface)', fontSize: '14px', color: 'var(--lkv-primary)' }} />
                </div>
              )}
              <div>
                <label htmlFor="email" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--lkv-text-primary)', marginBottom: '4px' }}>
                  {t('auth.email')}
                </label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} autoComplete="email" required style={{ width: '100%', padding: '10px 14px', minHeight: '44px', borderRadius: '10px', border: '1px solid rgba(23,64,44,0.1)', background: 'var(--lkv-surface)', fontSize: '14px', color: 'var(--lkv-primary)' }} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label htmlFor="password" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--lkv-text-primary)' }}>
                    {mode === 'inscription' ? t('auth.passwordWithMin') : t('auth.password')}
                  </label>
                  {mode === 'connexion' && (
                    <button
                      type="button"
                      onClick={() => { setForgotPasswordOpen(true); setError(''); }}
                      className="text-[11px] text-[var(--lkv-text-muted)] hover:text-[var(--lkv-primary)] underline cursor-pointer"
                    >
                      {t('auth.forgotPasswordLink')}
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'inscription' ? t('auth.passwordMinPlaceholder') : t('auth.passwordPlaceholder')}
                    autoComplete={mode === 'inscription' ? 'new-password' : 'current-password'}
                    required
                    style={{ width: '100%', padding: '10px 44px 10px 14px', minHeight: '44px', borderRadius: '10px', border: '1px solid rgba(23,64,44,0.1)', background: 'var(--lkv-surface)', fontSize: '14px', color: 'var(--lkv-primary)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--lkv-text-muted)' }}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
              </div>

              {error && <div style={{ background: 'var(--lkv-danger-bg)', border: '1px solid var(--lkv-danger)', padding: '10px', borderRadius: '10px', fontSize: '13px', color: 'var(--lkv-danger)' }}>{error}</div>}
              <button type="submit" disabled={loading} className="glass-capsule-btn primary w-full !min-h-[44px] !py-3.5 !text-[15px] !font-semibold">
                {loading ? t(mode === 'connexion' ? 'auth.submittingSignIn' : 'auth.submittingSignUp') : t(mode === 'connexion' ? 'auth.submitSignIn' : 'auth.submitSignUp')}
              </button>
            </form>
          )}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(23,64,44,0.06)', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: 'rgba(23,64,44,0.5)' }}>
              {mode === 'connexion' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
              <button type="button" onClick={() => { setMode(mode === 'connexion' ? 'inscription' : 'connexion'); setError(''); setConfirmationSent(false); setForgotPasswordOpen(false); }} className="glass-capsule-btn !min-h-0 !py-1 !px-3 !text-xs !font-semibold">
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
