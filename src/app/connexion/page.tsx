'use client';

import React, { useState, Suspense } from 'react';
import Header from '@/components/Header';

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
          { id: userId, email: userEmail, full_name: fullName || userEmail.split('@')[0], trust_score: 50, loyalty_points: 0, loyalty_level: 'Explorateur', xp: 0, level: 1 },
          { onConflict: 'id' }
        );
      }
    } catch { /* Silently fail */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Veuillez remplir tous les champs.'); return; }
    if (mode === 'inscription' && !name) { setError('Veuillez entrer votre prénom.'); return; }
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    setLoading(true);
    try {
      if (mode === 'connexion') {
        const result = await signIn(email, password) as { user?: { id: string; email?: string } };
        if (result?.user) await ensureProfile(result.user.id, result.user.email ?? email, '');
        trackEvent('login', { method: 'email' });
        toast('Connexion réussie ! Bienvenue.', 'success');
        router.push('/compte');
        router.refresh();
      } else {
        const result = await signUp(email, password, { fullName: name }) as { user?: { id: string; email?: string } };
        if (result?.user) await ensureProfile(result.user.id, result.user.email ?? email, name);
        trackEvent('sign_up', { method: 'email' });
        toast('Compte créé ! Bienvenue sur Le Kit du Voyageur.', 'success');
        router.push('/compte');
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue.';
      const friendlyMsg =
        msg.includes('Invalid login credentials') ? 'Email ou mot de passe incorrect.'
        : msg.includes('User already registered') ? 'Un compte existe déjà avec cet email.'
        : msg.includes('Email not confirmed') ? 'Veuillez confirmer votre email avant de vous connecter.'
        : msg.includes('Password should be at least') ? 'Le mot de passe doit contenir au moins 8 caractères.'
        : msg;
      setError(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#F5F2EC' }}>
      {/* Left — photo panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=85')" }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(28,38,32,0.3) 0%, rgba(28,38,32,0.7) 100%)' }} />
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <p className="text-xs font-mono tracking-[0.2em] uppercase text-white/60 mb-3">Le Kit du Voyageur</p>
          <h2 className="font-display text-4xl text-white leading-tight mb-4" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800 }}>
            Chaque sommet<br />commence ici.
          </h2>
          <p className="text-white/70 text-sm max-w-xs leading-relaxed">
            Configurez votre kit, planifiez vos aventures, rejoignez une communauté de voyageurs passionnés.
          </p>
          <div className="flex items-center gap-6 mt-8 pt-8 border-t border-white/20">
            {[{ v: '12 000+', l: 'Voyageurs' }, { v: '4,9★', l: 'Note moyenne' }, { v: '340+', l: 'Destinations' }].map((s) => (
              <div key={s.l}>
                <p className="font-mono text-lg font-700 text-white">{s.v}</p>
                <p className="text-xs text-white/50">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="w-full lg:w-1/2 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-6 py-16 pt-28">
          <div className="w-full max-w-md">
            {/* Eyebrow */}
            <p className="text-xs font-mono tracking-[0.2em] uppercase mb-2" style={{ color: '#4A6741' }}>
              {mode === 'connexion' ? 'Bon retour' : 'Rejoindre l\'expédition'}
            </p>
            <h1 className="font-display text-3xl mb-1" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800, color: '#1C2620' }}>
              {mode === 'connexion' ? 'Se connecter' : 'Créer un compte'}
            </h1>
            <p className="text-sm mb-8" style={{ color: '#5C6B5E' }}>
              {mode === 'connexion' ? 'Accédez à vos kits et préparations.' : 'Votre carnet d\'expédition numérique.'}
            </p>

            {/* Mode toggle */}
            <div className="flex rounded-2xl border p-1 mb-8" style={{ borderColor: '#C8C3B0', background: '#EDE9DF' }}>
              {(['connexion', 'inscription'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(''); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={mode === m ? { background: '#1C2620', color: '#fff' } : { color: '#5C6B5E' }}
                >
                  {m === 'connexion' ? 'Connexion' : 'Inscription'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {mode === 'inscription' && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#5C6B5E' }}>Prénom</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Votre prénom"
                    className="w-full px-4 py-3 rounded-xl text-sm transition-all focus:outline-none focus:ring-2"
                    style={{ background: '#fff', border: '1px solid #C8C3B0', color: '#1C2620', focusRingColor: '#4A6741' }}
                    autoComplete="given-name"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#5C6B5E' }}>Adresse email</label>
                <input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all focus:outline-none focus:ring-2"
                  style={{ background: '#fff', border: '1px solid #C8C3B0', color: '#1C2620' }}
                  autoComplete="email"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#5C6B5E' }}>Mot de passe</label>
                  {mode === 'connexion' && (
                    <button type="button" className="text-xs hover:underline" style={{ color: '#4A6741' }}>
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'inscription' ? 'Minimum 8 caractères' : '••••••••'}
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all focus:outline-none focus:ring-2"
                  style={{ background: '#fff', border: '1px solid #C8C3B0', color: '#1C2620' }}
                  autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <Icon name="ExclamationCircleIcon" size={16} variant="outline" className="text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {mode === 'inscription' && (
                <p className="text-xs" style={{ color: '#7A7A6E' }}>
                  En créant un compte, vous acceptez nos{' '}
                  <Link href="/cgu" className="hover:underline" style={{ color: '#4A6741' }}>conditions d&apos;utilisation</Link>
                  {' '}et notre{' '}
                  <Link href="/politique-confidentialite" className="hover:underline" style={{ color: '#4A6741' }}>politique de confidentialité</Link>.
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all mt-2"
                style={{ background: '#1C2620', color: '#fff' }}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {mode === 'connexion' ? 'Connexion…' : 'Création…'}
                  </>
                ) : (
                  <>
                    <Icon name={mode === 'connexion' ? 'ArrowRightOnRectangleIcon' : 'UserPlusIcon'} size={18} variant="outline" />
                    {mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-xs mt-6" style={{ color: '#7A7A6E' }}>
              {mode === 'connexion' ? "Pas encore de compte ? " : "Déjà un compte ? "}
              <button
                type="button"
                onClick={() => { setMode(mode === 'connexion' ? 'inscription' : 'connexion'); setError(''); }}
                className="font-semibold hover:underline"
                style={{ color: '#4A6741' }}
              >
                {mode === 'connexion' ? "S'inscrire" : 'Se connecter'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConnexionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F2EC' }}>
        <div className="w-8 h-8 border-2 border-[#4A6741]/30 border-t-[#4A6741] rounded-full animate-spin" />
      </div>
    }>
      <AuthForm />
    </Suspense>
  );
}
