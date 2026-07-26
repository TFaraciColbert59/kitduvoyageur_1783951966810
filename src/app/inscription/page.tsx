'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';

import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function InscriptionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) router.replace('/compte');
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (form.password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.fullName } },
      });
      if (signUpError) throw signUpError;
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du compte.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#F5F2EC' }}>
      {/* Left photo panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200&q=85')" }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(28,38,32,0.2) 0%, rgba(28,38,32,0.75) 100%)' }} />
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <p className="text-xs font-mono tracking-[0.2em] uppercase text-white/60 mb-3">Le Kit du Voyageur</p>
          <h2 className="font-display text-4xl text-white leading-tight mb-4" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800 }}>
            L&apos;aventure<br />vous attend.
          </h2>
          <p className="text-white/70 text-sm max-w-xs leading-relaxed">
            Rejoignez 12 000 voyageurs qui préparent leurs expéditions avec notre configurateur IA.
          </p>
          <div className="flex items-center gap-6 mt-8 pt-8 border-t border-white/20">
            {[{ v: 'Gratuit', l: 'Pour commencer' }, { v: '3 kits/mois', l: 'Configurateur IA' }, { v: '340+', l: 'Destinations' }].map((s) => (
              <div key={s.l}>
                <p className="font-mono text-base font-700 text-white">{s.v}</p>
                <p className="text-xs text-white/50">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full lg:w-1/2 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-6 py-16 pt-28">
          <div className="w-full max-w-md">
            {success ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: '#4A6741' }}>
                  <Icon name="CheckCircleIcon" size={32} className="text-white" variant="outline" />
                </div>
                <p className="text-xs font-mono tracking-[0.2em] uppercase mb-2" style={{ color: '#4A6741' }}>Compte créé</p>
                <h2 className="font-display text-3xl mb-3" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800, color: '#1C2620' }}>
                  Bienvenue !
                </h2>
                <p className="text-sm mb-8" style={{ color: '#5C6B5E' }}>
                  Un email de confirmation a été envoyé à <strong style={{ color: '#1C2620' }}>{form.email}</strong>.
                </p>
                <Link
                  href="/connexion"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm text-white transition-all"
                  style={{ background: '#1C2620' }}
                >
                  <Icon name="ArrowRightIcon" size={16} variant="outline" />
                  Se connecter
                </Link>
              </div>
            ) : (
              <>
                <p className="text-xs font-mono tracking-[0.2em] uppercase mb-2" style={{ color: '#4A6741' }}>Rejoindre la communauté</p>
                <h1 className="font-display text-3xl mb-1" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800, color: '#1C2620' }}>
                  Créer un compte
                </h1>
                <p className="text-sm mb-8" style={{ color: '#5C6B5E' }}>Configurez vos kits, sauvegardez vos aventures.</p>

                {error && (
                  <div className="mb-4 p-3 rounded-xl flex items-center gap-2" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <Icon name="ExclamationCircleIcon" size={16} className="text-red-500 flex-shrink-0" variant="outline" />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {[
                    { key: 'fullName', label: 'Nom complet', type: 'text', placeholder: 'Jean Dupont', autoComplete: 'name' },
                    { key: 'email', label: 'Email', type: 'email', placeholder: 'jean@exemple.fr', autoComplete: 'email' },
                    { key: 'password', label: 'Mot de passe', type: 'password', placeholder: '8 caractères minimum', autoComplete: 'new-password' },
                    { key: 'confirm', label: 'Confirmer le mot de passe', type: 'password', placeholder: 'Répéter le mot de passe', autoComplete: 'new-password' },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#5C6B5E' }}>{field.label} *</label>
                      <input
                        type={field.type}
                        required
                        value={form[field.key as keyof typeof form]}
                        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        autoComplete={field.autoComplete}
                        className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                        style={{ background: '#fff', border: '1px solid #C8C3B0', color: '#1C2620' }}
                      />
                    </div>
                  ))}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all mt-2"
                    style={{ background: '#1C2620', color: '#fff' }}
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Création en cours…
                      </>
                    ) : (
                      <>
                        <Icon name="UserPlusIcon" size={16} variant="outline" />
                        Créer mon compte
                      </>
                    )}
                  </button>
                </form>

                <p className="text-center text-xs mt-6" style={{ color: '#7A7A6E' }}>
                  Déjà un compte ?{' '}
                  <Link href="/connexion" className="font-semibold hover:underline" style={{ color: '#4A6741' }}>
                    Se connecter
                  </Link>
                </p>
                <p className="text-center text-[10px] mt-3" style={{ color: '#9A9A8E' }}>
                  En créant un compte, vous acceptez nos{' '}
                  <Link href="/cgu" className="hover:underline">CGU</Link>
                  {' '}et notre{' '}
                  <Link href="/politique-confidentialite" className="hover:underline">politique de confidentialité</Link>.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
