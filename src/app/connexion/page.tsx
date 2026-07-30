'use client';

import React, { useState, Suspense } from 'react';


import Icon from '@/components/ui/AppIcon';

import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { trackEvent } from '@/lib/analytics';
import { createClient } from '@/lib/supabase/client';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

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
  const [confirmationSent, setConfirmationSent] = useState(false);
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

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
    if (!email || !password) { setError('Veuillez remplir tous les champs.'); return; }
    if (mode === 'inscription' && !name) { setError('Veuillez entrer votre prénom.'); return; }
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    setLoading(true);
    try {
      if (mode === 'connexion') {
        const result = (await signIn(email, password)) as { user?: { id: string; email?: string } };
        if (result?.user) await ensureProfile(result.user.id, result.user.email ?? email, '');
        trackEvent('login', { method: 'email' });
        toast('Connexion réussie ! Bienvenue.', 'success');
        router.push('/compte');
        router.refresh();
      } else {
        const result = (await signUp(email, password, { fullName: name })) as { user?: { id: string; email?: string }; session?: unknown };
        if (result?.session) {
          if (result?.user) await ensureProfile(result.user.id, result.user.email ?? email, name);
          trackEvent('sign_up', { method: 'email' });
          toast('Compte créé !', 'success');
          router.push('/compte');
          router.refresh();
        } else {
          if (result?.user) await ensureProfile(result.user.id, result.user.email ?? email, name);
          setConfirmationSent(true);
          toast('Un email de confirmation a été envoyé.', 'info');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue.';
      const friendlyMsg = msg.includes('Invalid login credentials') ? 'Email ou mot de passe incorrect.' : msg.includes('User already registered') ? 'Un compte existe déjà avec cet email.' : msg;
      setError(friendlyMsg);
    } finally { setLoading(false); }
  };

  return (
    <main id="main-content" style={{ paddingTop: '80px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 16px 32px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1C2620' }}>{mode === 'connexion' ? 'Bon retour, aventurier' : "Rejoindre l'expédition"}</h1>
          <p style={{ color: 'rgba(28,38,32,0.5)', fontSize: '14px', marginTop: '4px' }}>{mode === 'connexion' ? 'Connectez-vous pour accéder à vos kits.' : "Créez votre carnet d'expédition numérique."}</p>
        </div>

        <div style={{ display: 'flex', borderRadius: '40px', border: '1px solid rgba(11,31,23,0.06)', background: '#FBFAF6', padding: '4px', marginBottom: '20px' }}>
          {(['connexion', 'inscription'] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(''); setConfirmationSent(false); }} style={{ flex: 1, padding: '10px', borderRadius: '40px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', background: mode === m ? '#1C2620' : 'transparent', color: mode === m ? 'white' : 'rgba(28,38,32,0.5)' }}>{m === 'connexion' ? 'Connexion' : 'Inscription'}</button>
          ))}
        </div>

        <div style={{ background: '#FBFAF6', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)', padding: '24px' }}>
          {confirmationSent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg></div>
              <p style={{ fontWeight: 700, color: '#1C2620', marginBottom: '8px' }}>Vérifiez vos emails !</p>
              <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.6)', marginBottom: '16px' }}>Un email a été envoyé à <strong>{email}</strong>.</p>
              <button onClick={() => { setMode('connexion'); setConfirmationSent(false); }} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#1C3829', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>Passer à la connexion →</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {mode === 'inscription' && (
                <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom" style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', background: '#FBFAF6', fontSize: '14px', color: '#1C2620' }} />
              )}
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Adresse email" style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', background: '#FBFAF6', fontSize: '14px', color: '#1C2620' }} />
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'inscription' ? 'Minimum 8 caractères' : 'Mot de passe'} style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', background: '#FBFAF6', fontSize: '14px', color: '#1C2620' }} />
              {error && <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', padding: '10px', borderRadius: '10px', fontSize: '13px', color: '#DC2626' }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ background: '#17402C', color: 'white', border: 'none', padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? (mode === 'connexion' ? 'Connexion…' : 'Création…') : (mode === 'connexion' ? 'Se connecter' : 'Créer mon compte')}
              </button>
            </form>
          )}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(11,31,23,0.06)', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: 'rgba(28,38,32,0.5)' }}>
              {mode === 'connexion' ? "Pas encore de compte ? " : "Déjà un compte ? "}
              <button type="button" onClick={() => { setMode(mode === 'connexion' ? 'inscription' : 'connexion'); setError(''); setConfirmationSent(false); }} style={{ color: '#17402C', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                {mode === 'connexion' ? "S'inscrire" : 'Se connecter'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ConnexionPage() {
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
