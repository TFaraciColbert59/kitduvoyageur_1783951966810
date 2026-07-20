'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate submission
    await new Promise((r) => setTimeout(r, 800));
    setSubmitted(true);
    setSubmitting(false);
  };

  const contacts = [
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
      desc: 'Exercer vos droits RGPD, demandes de suppression',
      value: 'dpo@lekitduvoyageur.fr',
      href: 'mailto:dpo@lekitduvoyageur.fr',
    },
    {
      icon: 'BuildingOfficeIcon',
      title: 'Partenariats & B2B',
      desc: 'Offres Pro, revendeurs, agences de voyage',
      value: 'contact@lekitduvoyageur.fr',
      href: 'mailto:contact@lekitduvoyageur.fr',
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
          Support & Contact
        </p>
        <h1 className="font-display text-3xl md:text-4xl text-foreground mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          Contactez-nous
        </h1>
        <p className="text-foreground/60 mb-10 max-w-xl">
          Notre équipe répond sous 48 heures ouvrées. Pour les urgences, utilisez directement l&apos;email du service concerné.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Contact cards */}
          <div className="space-y-4">
            <h2 className="font-semibold text-foreground text-base mb-4">Nos équipes</h2>
            {contacts.map((c) => (
              <a
                key={c.href}
                href={c.href}
                className="flex items-start gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/40 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Icon name={c.icon} size={18} className="text-primary" variant="outline" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{c.title}</p>
                  <p className="text-xs text-foreground/50 mb-1">{c.desc}</p>
                  <p className="text-xs text-primary font-mono truncate" style={{ fontFamily: 'var(--font-mono)' }}>{c.value}</p>
                </div>
                <Icon name="ArrowTopRightOnSquareIcon" size={14} className="text-foreground/30 group-hover:text-primary transition-colors flex-shrink-0 mt-1" variant="outline" />
              </a>
            ))}

            <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="ClockIcon" size={14} className="text-primary" variant="outline" />
                <span className="text-sm font-semibold text-foreground">Délai de réponse</span>
              </div>
              <p className="text-xs text-foreground/60">
                Lundi – Vendredi : 9h – 18h (heure de Paris)<br />
                Réponse garantie sous <strong className="text-foreground">48 heures ouvrées</strong>
              </p>
            </div>
          </div>

          {/* Contact form */}
          <div>
            <h2 className="font-semibold text-foreground text-base mb-4">Envoyer un message</h2>
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-card border border-border rounded-xl">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                  <Icon name="CheckCircleIcon" size={28} className="text-emerald-500" variant="outline" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Message envoyé !</h3>
                <p className="text-sm text-foreground/60 max-w-xs">
                  Nous avons bien reçu votre message et vous répondrons sous 48 heures ouvrées.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
                  className="mt-6 text-sm text-primary hover:underline"
                >
                  Envoyer un autre message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground/70 mb-1.5">Nom complet *</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Jean Dupont"
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/60 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground/70 mb-1.5">Email *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="jean@exemple.fr"
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/60 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground/70 mb-1.5">Sujet *</label>
                  <select
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors"
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
                  <label className="block text-xs font-medium text-foreground/70 mb-1.5">Message *</label>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Décrivez votre demande en détail..."
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/60 transition-colors resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Envoi en cours…
                    </>
                  ) : (
                    <>
                      <Icon name="PaperAirplaneIcon" size={16} variant="outline" />
                      Envoyer le message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
