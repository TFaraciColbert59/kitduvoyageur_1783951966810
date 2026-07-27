'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';
import Icon from '@/components/ui/AppIcon';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    setSubmitted(true);
    setSubmitting(false);
  };

  const contacts = [
    { icon: 'EnvelopeIcon', title: 'Support client', desc: 'Questions sur vos commandes, retours, garanties', value: 'sav@lekitduvoyageur.fr', href: 'mailto:sav@lekitduvoyageur.fr' },
    { icon: 'ArrowPathIcon', title: 'Retours & remboursements', desc: 'Initier un retour ou suivre un remboursement', value: 'retour@lekitduvoyageur.fr', href: 'mailto:retour@lekitduvoyageur.fr' },
    { icon: 'ShieldCheckIcon', title: 'DPO — Données personnelles', desc: 'Exercer vos droits RGPD, demandes de suppression', value: 'dpo@lekitduvoyageur.fr', href: 'mailto:dpo@lekitduvoyageur.fr' },
    { icon: 'BuildingOfficeIcon', title: 'Partenariats & B2B', desc: 'Offres Pro, revendeurs, agences de voyage', value: 'contact@lekitduvoyageur.fr', href: 'mailto:contact@lekitduvoyageur.fr' },
  ];

  const inputStyle = { background: '#fff', border: '1px solid #C8C3B0', color: '#1C2620' };
  const labelStyle = { color: '#5C6B5E' };

  return (
    <div className="min-h-screen" style={{ background: '#F5F2EC' }}>
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden pt-20" style={{ background: '#1C2620' }}>
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <nav className="flex items-center gap-2 text-xs font-mono mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <span>/</span>
            <span style={{ color: '#E4501C' }}>Contact</span>
          </nav>
          <p className="text-xs font-mono tracking-[0.2em] uppercase mb-4" style={{ color: '#4A6741' }}>Support & Contact</p>
          <h1 className="font-display text-5xl md:text-6xl text-white mb-4 leading-tight" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800 }}>
            Contactez<br /><em>notre équipe.</em>
          </h1>
          <p className="text-white/60 text-lg max-w-xl">
            Réponse garantie sous 48 heures ouvrées. Pour les urgences, utilisez directement l&apos;email du service concerné.
          </p>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact cards */}
          <div className="space-y-4">
            <p className="text-xs font-mono tracking-[0.2em] uppercase mb-6" style={{ color: '#4A6741' }}>Nos équipes</p>
            {contacts.map((c) => (
              <a
                key={c.href}
                href={c.href}
                className="flex items-start gap-4 p-5 rounded-2xl transition-all group"
                style={{ background: '#fff', border: '1px solid #E8E4DA' }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors" style={{ background: 'rgba(74,103,65,0.1)' }}>
                  <Icon name={c.icon} size={18} variant="outline" style={{ color: '#4A6741' } as React.CSSProperties} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm mb-0.5" style={{ color: '#1C2620' }}>{c.title}</p>
                  <p className="text-xs mb-1" style={{ color: '#7A7A6E' }}>{c.desc}</p>
                  <p className="text-xs font-mono truncate" style={{ color: '#4A6741' }}>{c.value}</p>
                </div>
                <Icon name="ArrowTopRightOnSquareIcon" size={14} variant="outline" className="flex-shrink-0 mt-1 transition-colors" style={{ color: '#C8C3B0' } as React.CSSProperties} />
              </a>
            ))}

            <div className="mt-6 p-5 rounded-2xl" style={{ background: 'rgba(74,103,65,0.08)', border: '1px solid rgba(74,103,65,0.2)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon name="ClockIcon" size={14} variant="outline" style={{ color: '#4A6741' } as React.CSSProperties} />
                <span className="text-sm font-semibold" style={{ color: '#1C2620' }}>Délai de réponse</span>
              </div>
              <p className="text-xs" style={{ color: '#5C6B5E' }}>
                Lundi – Vendredi : 9h – 18h (heure de Paris)<br />
                Réponse garantie sous <strong style={{ color: '#1C2620' }}>48 heures ouvrées</strong>
              </p>
            </div>
          </div>

          {/* Contact form */}
          <div>
            <p className="text-xs font-mono tracking-[0.2em] uppercase mb-6" style={{ color: '#4A6741' }}>Envoyer un message</p>
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl" style={{ background: '#fff', border: '1px solid #E8E4DA' }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ background: '#4A6741' }}>
                  <Icon name="CheckCircleIcon" size={28} className="text-white" variant="outline" />
                </div>
                <h3 className="font-display font-700 text-xl mb-2" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: '#1C2620' }}>Message envoyé !</h3>
                <p className="text-sm max-w-xs" style={{ color: '#5C6B5E' }}>
                  Nous avons bien reçu votre message et vous répondrons sous 48 heures ouvrées.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
                  className="mt-6 text-sm font-semibold hover:underline"
                  style={{ color: '#4A6741' }}
                >
                  Envoyer un autre message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 p-7 rounded-2xl" style={{ background: '#fff', border: '1px solid #E8E4DA' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={labelStyle}>Nom complet *</label>
                    <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jean Dupont"
                      className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all" style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={labelStyle}>Email *</label>
                    <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jean@exemple.fr"
                      className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all" style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={labelStyle}>Sujet *</label>
                  <select required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all" style={inputStyle}>
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
                  <label className="block text-xs font-semibold mb-1.5" style={labelStyle}>Message *</label>
                  <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Décrivez votre demande en détail..."
                    className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all resize-none" style={inputStyle} />
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: '#1C2620', color: '#fff' }}>
                  {submitting ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Envoi en cours…</>
                  ) : (
                    <><Icon name="PaperAirplaneIcon" size={16} variant="outline" />Envoyer le message</>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <NewFooterSection />
    </div>
  );
}
