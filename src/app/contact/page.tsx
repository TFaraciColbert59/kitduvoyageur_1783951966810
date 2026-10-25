'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import AppShell from '@/components/shell/AppShell';
import { Button, Card } from '@/components/ui';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import SupportTicketList from '@/features/support/SupportTicketList';

const FIELD_CLASS =
  'min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--glass-bg-medium)] px-[var(--space-3)] py-2.5 text-[length:var(--lkv-text-body-sm)] text-[color:var(--glass-label)] [&_option]:bg-[#16251D] [&_option]:text-white placeholder:text-[color:var(--lkv-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';
const LABEL_CLASS =
  'mb-1.5 block text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.04em] text-[color:var(--lkv-text-secondary)]';

const CONTACTS = [
  {
    icon: 'EnvelopeIcon',
    title: 'Support client',
    desc: 'Questions sur vos commandes, retours, garanties',
    value: 'sav@lekitduvoyageur.fr',
    href: 'mailto:sav@lekitduvoyageur.fr',
  },
  {
    icon: 'ArrowPathIcon',
    title: 'Retours & remboursements',
    desc: 'Initier un retour ou suivre un remboursement',
    value: 'retour@lekitduvoyageur.fr',
    href: 'mailto:retour@lekitduvoyageur.fr',
  },
  {
    icon: 'ShieldCheckIcon',
    title: 'DPO — Données personnelles',
    desc: 'Exercer vos droits RGPD',
    value: 'dpo@lekitduvoyageur.fr',
    href: 'mailto:dpo@lekitduvoyageur.fr',
  },
  {
    icon: 'BuildingOfficeIcon',
    title: 'Partenariats & B2B',
    desc: 'Offres Pro, revendeurs',
    value: 'contact@lekitduvoyageur.fr',
    href: 'mailto:contact@lekitduvoyageur.fr',
  },
];

export default function ContactPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ subject: '', message: '' });
  const [error, setError] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.ticket?.id)
        throw new Error(data.error ?? 'Enregistrement impossible');
      setTicketId(data.ticket.id);
      setSubmitted(true);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSubmitted(false);
    setForm({ subject: '', message: '' });
    setError('');
  };

  const contactsList = (
    <div className="flex flex-col gap-[var(--space-3)]">
      {CONTACTS.map((c) => (
        <a key={c.href} href={c.href} className="block no-underline">
          <Card
            variant="interactive"
            className="flex items-start gap-[var(--space-4)] p-[var(--space-4)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--lkv-radius-sm)] bg-[color:var(--glass-bg-medium)]">
              <Icon
                name={c.icon}
                size={18}
                className="text-[color:var(--lkv-secondary-ink)]"
                variant="outline"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
                {c.title}
              </p>
              <p className="mb-1 text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-secondary)]">
                {c.desc}
              </p>
              <p className="truncate font-mono text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-secondary-ink)]">
                {c.value}
              </p>
            </div>
            <Icon
              name="ArrowTopRightOnSquareIcon"
              size={14}
              className="mt-1 shrink-0 text-[color:var(--lkv-text-secondary)]"
              variant="outline"
            />
          </Card>
        </a>
      ))}
    </div>
  );

  const successCard = (
    <Card
      variant="standard"
      className="flex flex-col items-center px-[var(--space-6)] py-[var(--space-12)] text-center"
    >
      <div className="mb-[var(--space-4)] flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--lkv-secondary)]/15">
        <Icon
          name="CheckCircleIcon"
          size={28}
          className="text-[color:var(--lkv-secondary-ink)]"
          variant="outline"
        />
      </div>
      <h3 className="mb-[var(--space-2)] font-semibold text-[color:var(--lkv-text-primary)]">
        Demande enregistrée
      </h3>
      <p className="max-w-xs text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
        La réponse sera consultable dans vos demandes. Aucun délai de réponse n’est garanti.
      </p>
      <p className="mt-3 break-all text-xs">N° {ticketId}</p>
      <Button variant="secondary" className="mt-[var(--space-6)]" onClick={reset}>
        Envoyer un autre message
      </Button>
    </Card>
  );

  const messageForm = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-4)]">
      {!user && (
        <p>
          Connectez-vous pour enregistrer une demande.{' '}
          <Link className="underline" href="/connexion?next=/contact">
            Se connecter
          </Link>
          . Les contacts par email restent disponibles.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div>
        <label htmlFor="contact-subject" className={LABEL_CLASS}>
          Sujet *
        </label>
        <select
          id="contact-subject"
          required
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          className={FIELD_CLASS}
        >
          <option value="">Sélectionner un sujet</option>
          <option value="commande">Question sur ma commande</option>
          <option value="retour">Retour / Remboursement</option>
          <option value="produit">Question produit</option>
          <option value="compte">Problème de compte</option>
          <option value="partenariat">Partenariat / B2B</option>
          <option value="autre">Autre</option>
        </select>
      </div>
      <div>
        <label htmlFor="contact-message" className={LABEL_CLASS}>
          Message *
        </label>
        <textarea
          id="contact-message"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="Décrivez votre demande en détail..."
          className={`${FIELD_CLASS} min-h-[120px] resize-none`}
        />
      </div>
      <Button
        type="submit"
        loading={submitting}
        disabled={submitting || !user}
        icon={
          !submitting ? <Icon name="PaperAirplaneIcon" size={16} variant="outline" /> : undefined
        }
      >
        {submitting ? 'Envoi en cours…' : 'Envoyer le message'}
      </Button>
    </form>
  );

  const desktopContent = (
    <div data-lkv-material-theme="light" className="h-dvh overflow-hidden bg-transparent">
      <Header />
      <main className="h-full overflow-hidden pt-20">
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-[var(--space-5)] px-[var(--space-6)] pb-[var(--space-6)]">
          <div className="shrink-0">
            <p className="mb-2 font-mono text-[length:var(--lkv-text-caption-1)] uppercase tracking-widest text-[color:var(--sage-100)]">
              Support &amp; Contact
            </p>
            <h1 className="mb-2 font-display text-[length:var(--lkv-text-title-lg)] font-bold tracking-tight text-[color:var(--lkv-text-primary)]">
              Contactez-nous
            </h1>
            <p className="max-w-xl text-[length:var(--lkv-text-footnote)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-forest-100)]">
              Enregistrez une demande et consultez son traitement depuis votre compte.
            </p>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-[var(--space-6)] overflow-y-auto pb-2 pr-1 lg:grid-cols-2">
            <div className="flex flex-col gap-[var(--space-3)]">
              <h2 className="text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
                Nos équipes
              </h2>
              {contactsList}
            </div>
            <div>
              <h2 className="mb-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
                Envoyer un message
              </h2>
              {submitted ? successCard : messageForm}
              <SupportTicketList refreshKey={refreshKey} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );

  const mobileContent = (
    <div className="p-[var(--space-4)]">
      <p className="mb-[var(--space-3)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.14em] text-[color:var(--sage-100)]">
        Support &amp; Contact
      </p>
      <h1 className="mb-[var(--space-2)] font-display text-[24px] font-extrabold text-[color:var(--lkv-text-primary)]">
        Contactez-nous
      </h1>
      <p className="mb-[var(--space-6)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-forest-100)]">
        Enregistrez une demande et consultez son traitement depuis votre compte.
      </p>
      <div className="mb-[var(--space-6)]">{contactsList}</div>
      {submitted ? successCard : messageForm}
      <SupportTicketList refreshKey={refreshKey} />
    </div>
  );

  return (
    <>
      <div className="hidden md:block">{desktopContent}</div>
      <div className="block md:hidden">
        <AppShell>{mobileContent}</AppShell>
      </div>
    </>
  );
}
