'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';

import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function InscriptionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => { if (user) router.replace('/compte'); }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (form.password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { full_name: form.fullName } } });
      if (signUpError) throw signUpError;
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du compte.');
    } finally { setLoading(false); }
  };

  const desktopContent = (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex items-center justify-center min-h-screen px-4 pt-16 pb-16">
        <div className="w-full max-w-md">
          {success ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Icon name="CheckCircleIcon" size={32} className="text-emerald-500" variant="outline" />
              </div>
              <h2 className="font-display text-xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>Compte créé !</h2>
              <p className="text-sm text-foreground/60 mb-6">Un email de confirmation a été envoyé à <strong className="text-foreground">{form.email}</strong>.</p>
              <Link href="/connexion" className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all"><Icon name="ArrowRightIcon" size={14} variant="outline" />Se connecter</Link>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-8">
              <div className="text-center mb-8">
                <p className="text-xs font-mono text-primary tracking-widest uppercase mb-2" style={{ fontFamily: 'var(--font-mono)' }}>Rejoindre la communauté</p>
                <h1 className="font-display text-2xl text-foreground" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>Créer un compte</h1>
                <p className="text-sm text-foreground/50 mt-2">Configurez vos kits, sauvegardez vos aventures</p>
              </div>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2"><Icon name="ExclamationCircleIcon" size={16} className="text-red-500 flex-shrink-0" variant="outline" />{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-xs font-medium text-foreground/70 mb-1.5">Nom complet *</label><input type="text" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Jean Dupont" className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/60 transition-colors" /></div>
                <div><label className="block text-xs font-medium text-foreground/70 mb-1.5">Email *</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jean@exemple.fr" className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/60 transition-colors" /></div>
                <div><label className="block text-xs font-medium text-foreground/70 mb-1.5">Mot de passe *</label><input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8 caractères minimum" className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/60 transition-colors" /></div>
                <div><label className="block text-xs font-medium text-foreground/70 mb-1.5">Confirmer le mot de passe *</label><input type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="Répéter le mot de passe" className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/60 transition-colors" /></div>
                <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all mt-2">
                  {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Création en cours…</> : <><Icon name="UserPlusIcon" size={16} variant="outline" />Créer mon compte</>}
                </button>
              </form>
              <p className="text-center text-xs text-foreground/50 mt-6">Déjà un compte ? <Link href="/connexion" className="text-primary hover:underline font-medium">Se connecter</Link></p>
              <p className="text-center text-[10px] text-foreground/30 mt-3">En créant un compte, vous acceptez nos <Link href="/cgu" className="hover:underline">CGU</Link> et notre <Link href="/politique-confidentialite" className="hover:underline">politique de confidentialité</Link>.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );

  const mobileContent = (
    <div style={{ padding: '16px' }}>
      {success ? (
        <div style={{ textAlign: 'center', padding: '24px 16px', background: '#FBFAF6', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
          <p style={{ fontSize: '32px', marginBottom: '12px', color: '#10b981' }}>✓</p>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1C2620', marginBottom: '8px' }}>Compte créé !</h2>
          <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.6)', marginBottom: '16px' }}>Un email de confirmation a été envoyé à <strong>{form.email}</strong>.</p>
          <Link href="/connexion" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#17402C', color: 'white', padding: '10px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>Se connecter</Link>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#17402C', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center' }}>Rejoindre la communauté</p>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1C2620', textAlign: 'center', marginBottom: '4px' }}>Créer un compte</h1>
          <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.5)', textAlign: 'center', marginBottom: '24px' }}>Configurez vos kits, sauvegardez vos aventures</p>
          {error && <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#DC2626' }}>{error}</div>}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#FBFAF6', padding: '20px', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
            <input type="text" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Nom complet *" style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', background: '#FBFAF6', fontSize: '14px', color: '#1C2620' }} />
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email *" style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', background: '#FBFAF6', fontSize: '14px', color: '#1C2620' }} />
            <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mot de passe *" style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', background: '#FBFAF6', fontSize: '14px', color: '#1C2620' }} />
            <input type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="Confirmer le mot de passe *" style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', background: '#FBFAF6', fontSize: '14px', color: '#1C2620' }} />
            <button type="submit" disabled={loading} style={{ background: '#17402C', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, marginTop: '4px' }}>
              {loading ? 'Création en cours…' : 'Créer mon compte'}
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(28,38,32,0.5)', marginTop: '16px' }}>Déjà un compte ? <Link href="/connexion" style={{ color: '#17402C' }}>Se connecter</Link></p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="hidden md:block">{desktopContent}</div>
      <div className="block md:hidden">
        <MobilePageShell>{mobileContent}</MobilePageShell>
        
      </div>
    </>
  );
}
