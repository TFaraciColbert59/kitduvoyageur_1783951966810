'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { Button, Card } from '@/components/ui';

const FIELD_CLASS =
  'min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-2.5 text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';
const LABEL_CLASS =
  'mb-1.5 block text-[length:var(--lkv-text-caption-1)] font-medium text-[color:var(--lkv-text-secondary)]';

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

  const content = success ? (
    <Card variant="featured" className="p-[var(--space-8)] text-center">
      <div className="mx-auto mb-[var(--space-4)] flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--lkv-secondary)]/15">
        <Icon name="CheckCircleIcon" size={32} className="text-[color:var(--lkv-secondary)]" variant="outline" />
      </div>
      <h2 className="mb-2 font-display text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-text-primary)]">
        Compte créé !
      </h2>
      <p className="mb-[var(--space-6)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
        Un email de confirmation a été envoyé à <strong className="text-[color:var(--lkv-text-primary)]">{form.email}</strong>.
      </p>
      <Link href="/connexion">
        <Button icon={<Icon name="ArrowRightIcon" size={14} variant="outline" />}>
          Se connecter
        </Button>
      </Link>
    </Card>
  ) : (
    <Card variant="featured" className="p-[var(--space-8)]">
      <div className="mb-[var(--space-8)] text-center">
        <p className="mb-2 font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-widest text-[color:var(--lkv-secondary)]">
          Rejoindre la communauté
        </p>
        <h1 className="font-display text-[length:var(--lkv-text-title-lg)] font-extrabold text-[color:var(--lkv-text-primary)]">
          Créer un compte
        </h1>
        <p className="mt-2 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
          Configurez vos kits, sauvegardez vos aventures
        </p>
      </div>
      {error && (
        <div role="alert" className="mb-[var(--space-4)] flex items-center gap-[var(--space-2)] rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-danger)]/25 bg-[color:var(--lkv-danger-bg)] p-[var(--space-3)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger)]">
          <Icon name="ExclamationCircleIcon" size={16} className="shrink-0 text-[color:var(--lkv-danger)]" variant="outline" />
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-[var(--space-4)]">
        <div>
          <label htmlFor="signup-name" className={LABEL_CLASS}>Nom complet *</label>
          <input id="signup-name" type="text" required autoComplete="name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Jean Dupont" className={FIELD_CLASS} />
        </div>
        <div>
          <label htmlFor="signup-email" className={LABEL_CLASS}>Email *</label>
          <input id="signup-email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jean@exemple.fr" className={FIELD_CLASS} />
        </div>
        <div>
          <label htmlFor="signup-password" className={LABEL_CLASS}>Mot de passe *</label>
          <input id="signup-password" type="password" required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8 caractères minimum" className={FIELD_CLASS} />
        </div>
        <div>
          <label htmlFor="signup-confirm" className={LABEL_CLASS}>Confirmer le mot de passe *</label>
          <input id="signup-confirm" type="password" required autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="Répéter le mot de passe" className={FIELD_CLASS} />
        </div>
        <Button
          type="submit"
          loading={loading}
          fullWidth
          icon={!loading ? <Icon name="UserPlusIcon" size={16} variant="outline" /> : undefined}
        >
          {loading ? 'Création en cours…' : 'Créer mon compte'}
        </Button>
      </form>
      <p className="mt-[var(--space-6)] text-center text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">
        Déjà un compte ?{' '}
        <Link href="/connexion" className="font-medium text-[color:var(--lkv-primary)] hover:underline">
          Se connecter
        </Link>
      </p>
      <p className="mt-[var(--space-3)] text-center text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
        En créant un compte, vous acceptez nos <Link href="/cgu" className="hover:underline">CGU</Link> et notre{' '}
        <Link href="/politique-confidentialite" className="hover:underline">politique de confidentialité</Link>.
      </p>
    </Card>
  );

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background text-foreground">
          <Header />
          <main className="flex min-h-screen items-center justify-center px-[var(--space-4)] py-[var(--space-16)]">
            <div className="w-full max-w-md">{content}</div>
          </main>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div className="p-[var(--space-4)]">{content}</div>
        </MobilePageShell>
      </div>
    </>
  );
}
