'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { hcaptchaSiteKey } from '@/lib/captcha/hcaptcha';
import { useAuthFlow, type AuthMode } from './useAuthFlow';
import './auth-screen.css';

const TABS: AuthMode[] = ['connexion', 'inscription'];

/**
 * Écran mobile de connexion / inscription : une carte de verre, plein écran,
 * sans en-tête ni pied de site (la barre d'onglets est masquée par
 * MobileNavWrapper sur /connexion).
 */
export default function AuthScreen() {
  const f = useAuthFlow();
  const { uid, t, mode, email, password, name, showPassword, loading, error, demoError } = f;
  const [demoLoading, setDemoLoading] = useState(false);

  // Retour arrière (cache de navigation) après un clic démo : on ré-arme le bouton.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => { if (e.persisted) setDemoLoading(false); };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  const errId = `${uid}-err`;
  const demoErrId = `${uid}-demo-err`;
  const isSignup = mode === 'inscription';
  const showForm = !f.confirmationSent && !f.forgotPasswordOpen;

  return (
    <main className="lkdv-auth-screen" aria-labelledby={`${uid}-title`}>
      <section className="lkdv-auth-card">
        <header className="lkdv-auth-brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo local de l'app */}
          <img className="lkdv-auth-mark" src="/assets/images/lkdv-boot-logo.webp" alt="" width={44} height={44} />
          <h1 id={`${uid}-title`} className="lkdv-auth-name">Le Kit du Voyageur</h1>
        </header>

        {showForm && (
          <div
            className="lkdv-auth-seg"
            role="tablist"
            aria-label="Connexion ou inscription"
            data-active={isSignup ? '1' : '0'}
          >
            <span className="lkdv-auth-lens" aria-hidden="true" />
            {TABS.map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                id={`${uid}-tab-${m}`}
                aria-selected={mode === m}
                aria-controls={`${uid}-panel`}
                tabIndex={mode === m ? 0 : -1}
                className="lkdv-auth-tab"
                onClick={() => f.switchMode(m)}
              >
                {t(m === 'connexion' ? 'auth.signIn' : 'auth.signUp')}
              </button>
            ))}
          </div>
        )}

        <div id={`${uid}-panel`} role={showForm ? 'tabpanel' : undefined} aria-labelledby={showForm ? `${uid}-tab-${mode}` : undefined}>
          {f.confirmationSent ? (
            <div className="lkdv-auth-center">
              <p className="lkdv-auth-h2">{t('auth.confirmationTitle')}</p>
              <p className="lkdv-auth-hint">
                {t('auth.confirmationBodyPrefix')} <strong>{email}</strong>{t('auth.confirmationBodySuffix')}
              </p>
              <button type="button" className="lkdv-auth-primary" onClick={() => f.switchMode('connexion')}>
                {t('auth.goToSignIn')}
              </button>
            </div>
          ) : f.forgotPasswordOpen ? (
            <form onSubmit={f.handleResetPassword} className="lkdv-auth-form">
              <p className="lkdv-auth-h2">{t('auth.forgotPassword')}</p>
              <p className="lkdv-auth-hint">{t('auth.forgotPasswordHint')}</p>
              {f.resetSent ? (
                <p className="lkdv-auth-ok" role="status">{t('auth.resetSentBody')}</p>
              ) : (
                <>
                  <div className="lkdv-auth-field">
                    <label htmlFor={`${uid}-reset-email`}>{t('auth.email')}</label>
                    <input
                      id={`${uid}-reset-email`}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      required
                      value={email}
                      onChange={(e) => f.setEmail(e.target.value)}
                      placeholder={t('auth.emailPlaceholder')}
                      aria-describedby={error ? errId : undefined}
                      aria-invalid={error ? true : undefined}
                    />
                  </div>
                  {error && <p id={errId} className="lkdv-auth-error" role="alert">{error}</p>}
                  <button type="submit" className="lkdv-auth-primary" disabled={loading} aria-busy={loading}>
                    {loading && <span className="lkdv-auth-spin" aria-hidden="true" />}
                    {loading ? t('auth.resetSubmitting') : t('auth.resetSubmit')}
                  </button>
                </>
              )}
              <button type="button" className="lkdv-auth-link" onClick={() => { f.setForgotPasswordOpen(false); f.setError(''); }}>
                {t('auth.backToSignIn')}
              </button>
            </form>
          ) : (
            <form method="post" onSubmit={f.handleSubmit} className="lkdv-auth-form">
              {isSignup && (
                <div className="lkdv-auth-field">
                  <label htmlFor={`${uid}-name`}>{t('auth.name')}</label>
                  <input
                    id={`${uid}-name`}
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => f.setName(e.target.value)}
                    placeholder={t('auth.namePlaceholder')}
                    aria-describedby={error ? errId : undefined}
                  />
                </div>
              )}
              <div className="lkdv-auth-field">
                <label htmlFor={`${uid}-email`}>{t('auth.email')}</label>
                <input
                  id={`${uid}-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(e) => f.setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  aria-describedby={error ? errId : undefined}
                />
              </div>
              <div className="lkdv-auth-field">
                <label htmlFor={`${uid}-password`}>{isSignup ? t('auth.passwordWithMin') : t('auth.password')}</label>
                <div className="lkdv-auth-pw">
                  <input
                    id={`${uid}-password`}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    required
                    value={password}
                    onChange={(e) => f.setPassword(e.target.value)}
                    placeholder={isSignup ? t('auth.passwordMinPlaceholder') : t('auth.passwordPlaceholder')}
                    aria-describedby={error ? errId : undefined}
                  />
                  <button
                    type="button"
                    className="lkdv-auth-eye"
                    onClick={() => f.setShowPassword(!showPassword)}
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
              </div>

              {error && <p id={errId} className="lkdv-auth-error" role="alert">{error}</p>}

              <button type="submit" className="lkdv-auth-primary" disabled={loading} aria-busy={loading}>
                {loading && <span className="lkdv-auth-spin" aria-hidden="true" />}
                {loading ? t(isSignup ? 'auth.submittingSignUp' : 'auth.submittingSignIn') : t(isSignup ? 'auth.submitSignUp' : 'auth.submitSignIn')}
              </button>

              {!isSignup && (
                <button type="button" className="lkdv-auth-link" onClick={() => { f.setForgotPasswordOpen(true); f.setError(''); }}>
                  {t('auth.forgotPasswordLink')}
                </button>
              )}
              {hcaptchaSiteKey() && (
                <p className="lkdv-auth-legal">
                  Protégé par hCaptcha :{' '}
                  <a href="https://www.hcaptcha.com/privacy" target="_blank" rel="noopener noreferrer">confidentialité</a>
                  {' · '}
                  <a href="https://www.hcaptcha.com/terms" target="_blank" rel="noopener noreferrer">conditions</a>
                </p>
              )}
            </form>
          )}
        </div>

        {showForm && (
          <>
            <div className="lkdv-auth-or" aria-hidden="true"><span>ou</span></div>

            {demoError && <p id={demoErrId} className="lkdv-auth-error" role="alert">{demoError}</p>}

            {/*
              Navigation pleine page volontaire (pas de router.push) : /api/demo-login
              pose les cookies de session Supabase puis redirige en 303 vers /compte.
              La route ne lit pas `next` : on ne l'invente pas.
            */}
            <a
              href="/api/demo-login"
              className="lkdv-auth-demo"
              aria-busy={demoLoading}
              aria-describedby={demoError ? demoErrId : undefined}
              aria-disabled={demoLoading || undefined}
              onClick={(e) => {
                if (demoLoading) { e.preventDefault(); return; }
                setDemoLoading(true);
              }}
            >
              <span className="lkdv-auth-demo-ico" aria-hidden="true">
                {demoLoading ? (
                  <span className="lkdv-auth-spin lkdv-auth-spin-dark" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></svg>
                )}
              </span>
              <span className="lkdv-auth-demo-txt">
                <span className="lkdv-auth-demo-title">{demoLoading ? 'Ouverture du compte démo…' : 'Découvrir avec le compte démo'}</span>
                <span className="lkdv-auth-demo-sub">Sans inscription, tout le contenu de l’app</span>
              </span>
            </a>

            <nav className="lkdv-auth-foot" aria-label="Autres accès">
              <Link href="/explorer" className="lkdv-auth-link">Continuer sans compte</Link>
              <p className="lkdv-auth-legal">
                <Link href="/cgu">CGU</Link>
                {' · '}
                <Link href="/politique-confidentialite">Confidentialité</Link>
              </p>
            </nav>
          </>
        )}
      </section>
    </main>
  );
}
