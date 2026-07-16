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

type AuthMode = 'connexion' | 'inscription';

function AuthForm() {
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get('mode') as AuthMode) || 'connexion';
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const ensureProfile = async (userId: string, userEmail: string, fullName: string) => {
    try {
      const supabase = createClient();
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!existing) {
        await supabase.from('user_profiles').upsert(
          {
            id: userId,
            email: userEmail,
            full_name: fullName || userEmail.split('@')[0],
            trust_score: 50,
            loyalty_points: 0,
            loyalty_level: 'Explorateur',
            xp: 0,
            level: 1,
          },
          { onConflict: 'id' }
        );
      }
    } catch {
      // Silently fail — trigger handles this
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    if (mode === 'inscription' && !name) {
      setError('Veuillez entrer votre prénom.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'connexion') {
        const result = await signIn(email, password) as { user?: { id: string; email?: string } };
        if (result?.user) {
          await ensureProfile(result.user.id, result.user.email ?? email, '');
        }
        trackEvent('login', { method: 'email' });
        toast('Connexion réussie ! Bienvenue.', 'success');
        router.push('/compte');
        router.refresh();
      } else {
        const result = await signUp(email, password, { fullName: name }) as { user?: { id: string; email?: string } };
        if (result?.user) {
          await ensureProfile(result.user.id, result.user.email ?? email, name);
        }
        trackEvent('sign_up', { method: 'email' });
        toast('Compte créé ! Bienvenue sur Le Kit du Voyageur.', 'success');
        router.push('/compte');
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue.';
      const friendlyMsg =
        msg.includes('Invalid login credentials')
          ? 'Email ou mot de passe incorrect.' : msg.includes('User already registered')
          ? 'Un compte existe déjà avec cet email.' : msg.includes('Email not confirmed')
          ? 'Veuillez confirmer votre email avant de vous connecter.' : msg.includes('Password should be at least')
          ? 'Le mot de passe doit contenir au moins 8 caractères.'
          : msg;
      setError(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="main-content" className="pt-20 min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-dark-bg mb-4" aria-hidden="true">
            <Icon name="MapIcon" size={28} variant="outline" className="text-primary" />
          </div>
          <h1 className="font-display font-700 text-2xl text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            {mode === 'connexion' ? 'Bon retour, aventurier' : "Rejoindre l'expédition"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mode === 'connexion' ?'Connectez-vous pour accéder à vos kits et préparations.' : "Créez votre carnet d'expédition numérique."}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex rounded-full border border-border bg-card p-1 mb-6" role="tablist" aria-label="Mode d'authentification">
          {(['connexion', 'inscription'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                mode === m ? 'bg-dark-bg text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'connexion' ? 'Connexion' : 'Inscription'}
            </button>
          ))}
        </div>

        <div className="topo-card p-6">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate aria-label={mode === 'connexion' ? 'Formulaire de connexion' : "Formulaire d'inscription"}>
            {mode === 'inscription' && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
                  Prénom
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre prénom"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  autoComplete="given-name"
                  aria-required="true"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                autoComplete="email"
                aria-required="true"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  Mot de passe
                </label>
                {mode === 'connexion' && (
                  <button type="button" className="text-xs text-info hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded">
                    Mot de passe oublié ?
                  </button>
                )}
              </div>
              <input
                id="password"
                type="password"
                inputMode="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'inscription' ? 'Minimum 8 caractères' : '••••••••'}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'}
                aria-required="true"
                aria-describedby={mode === 'inscription' ? 'password-hint' : undefined}
              />
              {mode === 'inscription' && (
                <p id="password-hint" className="text-xs text-muted-foreground mt-1">Minimum 8 caractères</p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200" role="alert" aria-live="assertive">
                <Icon name="ExclamationCircleIcon" size={16} variant="outline" className="text-red-500 flex-shrink-0" aria-hidden="true" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {mode === 'inscription' && (
              <p className="text-xs text-muted-foreground">
                En créant un compte, vous acceptez nos{' '}
                <Link href="#" className="text-info hover:underline">conditions d&apos;utilisation</Link>
                {' '}et notre{' '}
                <Link href="#" className="text-info hover:underline">politique de confidentialité</Link>.
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3.5 text-base min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                  {mode === 'connexion' ? 'Connexion…' : 'Création…'}
                </>
              ) : (
                <>
                  <Icon name={mode === 'connexion' ? 'ArrowRightOnRectangleIcon' : 'UserPlusIcon'} size={18} variant="outline" aria-hidden="true" />
                  {mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              {mode === 'connexion' ? "Pas encore de compte ? " : "Déjà un compte ? "}
              <button
                type="button"
                onClick={() => { setMode(mode === 'connexion' ? 'inscription' : 'connexion'); setError(''); }}
                className="text-primary font-medium hover:underline"
              >
                {mode === 'connexion' ? "S'inscrire" : 'Se connecter'}
              </button>
            </p>
          </div>
        </div>

        <p className="text-center font-mono text-xs text-muted-foreground mt-6" style={{ fontFamily: 'var(--font-mono)' }}>
          Données chiffrées · Connexion sécurisée SSL
        </p>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Suspense fallback={<div className="min-h-screen" />}>
        <AuthForm />
      </Suspense>
      <Footer />
    </div>
  );
}
