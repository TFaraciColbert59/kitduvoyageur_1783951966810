'use client';

import React, { useState } from 'react';

import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

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
    { icon: 'ShieldCheckIcon', title: 'DPO — Données personnelles', desc: 'Exercer vos droits RGPD', value: 'dpo@lekitduvoyageur.fr', href: 'mailto:dpo@lekitduvoyageur.fr' },
    { icon: 'BuildingOfficeIcon', title: 'Partenariats & B2B', desc: 'Offres Pro, revendeurs', value: 'contact@lekitduvoyageur.fr', href: 'mailto:contact@lekitduvoyageur.fr' },
  ];

  const desktopContent = (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Support & Contact</p>
        <h1 className="font-display text-3xl md:text-4xl text-foreground mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>Contactez-nous</h1>
        <p className="text-foreground/60 mb-10 max-w-xl">Notre équipe répond sous 48 heures ouvrées.</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-4">
            <p className="text-xs font-mono tracking-[0.2em] uppercase mb-6" style={{ color: '#4A6741' }}>Nos équipes</p>
            {contacts.map((c) => (
              <a key={c.href} href={c.href} className="flex items-start gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/40 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Icon name={c.icon} size={18} className="text-primary" variant="outline" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm mb-0.5" style={{ color: '#1C2620' }}>{c.title}</p>
                  <p className="text-xs mb-1" style={{ color: '#7A7A6E' }}>{c.desc}</p>
                  <p className="text-xs font-mono truncate" style={{ color: '#4A6741' }}>{c.value}</p>
                </div>
                <Icon name="ArrowTopRightOnSquareIcon" size={14} variant="outline" className="flex-shrink-0 mt-1 transition-colors" style={{ color: '#C8C3B0' } as React.CSSProperties} />
              </a>
            ))}
          </div>
          <div>
            <p className="text-xs font-mono tracking-[0.2em] uppercase mb-6" style={{ color: '#4A6741' }}>Envoyer un message</p>
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl" style={{ background: '#fff', border: '1px solid #E8E4DA' }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ background: '#4A6741' }}>
                  <Icon name="CheckCircleIcon" size={28} className="text-white" variant="outline" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Message envoyé !</h3>
                <p className="text-sm text-foreground/60 max-w-xs">Nous vous répondrons sous 48 heures ouvrées.</p>
                <button onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }); }} className="mt-6 text-sm text-primary hover:underline">Envoyer un autre message</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 p-7 rounded-2xl" style={{ background: '#fff', border: '1px solid #E8E4DA' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-foreground/70 mb-1.5">Nom complet *</label>
                    <input type="text" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jean Dupont" className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/60 transition-colors" /></div>
                  <div><label className="block text-xs font-medium text-foreground/70 mb-1.5">Email *</label>
                    <input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jean@exemple.fr" className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/60 transition-colors" /></div>
                </div>
                <div><label className="block text-xs font-medium text-foreground/70 mb-1.5">Sujet *</label>
                  <select required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors">
                    <option value="">Sélectionner un sujet</option>
                    <option value="commande">Question sur ma commande</option>
                    <option value="retour">Retour / Remboursement</option>
                    <option value="produit">Question produit</option>
                    <option value="compte">Problème de compte</option>
                    <option value="partenariat">Partenariat / B2B</option>
                    <option value="autre">Autre</option>
                  </select></div>
                <div><label className="block text-xs font-medium text-foreground/70 mb-1.5">Message *</label>
                  <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Décrivez votre demande en détail..." className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/60 transition-colors resize-none" /></div>
                <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all">
                  {submitting ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Envoi en cours…</>) : (<><Icon name="PaperAirplaneIcon" size={16} variant="outline" />Envoyer le message</>)}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <NewFooterSection />
    </div>
  );

  const mobileContent = (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#17402C', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px' }}>Support & Contact</p>
      <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1C2620', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Contactez-nous</h1>
      <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.6)', marginBottom: '24px' }}>Notre équipe répond sous 48 heures ouvrées.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {contacts.map((c) => (
          <a key={c.href} href={c.href} style={{ display: 'flex', gap: '12px', padding: '14px', background: '#F4F1EA', borderRadius: '12px', textDecoration: 'none', border: '1px solid rgba(11,31,23,0.06)' }}>
            <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17402C" strokeWidth="2"><path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#1C2620', marginBottom: '2px' }}>{c.title}</p>
              <p style={{ fontSize: '12px', color: 'rgba(28,38,32,0.5)', marginBottom: '2px' }}>{c.desc}</p>
              <p style={{ fontSize: '12px', color: '#17402C', fontFamily: 'var(--font-mono)' }}>{c.value}</p>
            </div>
          </a>
        ))}
      </div>

      {submitted ? (
        <div style={{ textAlign: 'center', padding: '24px 16px', background: '#F4F1EA', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
          <p style={{ fontSize: '24px', marginBottom: '12px' }}>✓</p>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1C2620', marginBottom: '8px' }}>Message envoyé !</h3>
          <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.6)', marginBottom: '16px' }}>Nous vous répondrons sous 48 heures ouvrées.</p>
          <button onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }); }} style={{ color: '#17402C', textDecoration: 'underline', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer' }}>Envoyer un autre message</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#F4F1EA', padding: '16px', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
            <input type="text" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom complet *" aria-label="Nom complet" style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', background: '#FBFAF6', fontSize: '13px', color: '#1C2620' }} />
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email *" aria-label="Email" autoComplete="email" style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', background: '#FBFAF6', fontSize: '13px', color: '#1C2620' }} />
            <select required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} aria-label="Sujet" style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', background: '#FBFAF6', fontSize: '13px', color: '#1C2620' }}>
              <option value="">Sujet *</option>
              <option value="commande">Question sur ma commande</option>
              <option value="retour">Retour / Remboursement</option>
              <option value="produit">Question produit</option>
              <option value="compte">Problème de compte</option>
              <option value="partenariat">Partenariat / B2B</option>
              <option value="autre">Autre</option>
            </select>
            <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Message *" aria-label="Message" style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', background: '#FBFAF6', fontSize: '13px', color: '#1C2620', resize: 'none' }} />
            <button type="submit" disabled={submitting} style={{ background: '#17402C', color: 'white', border: 'none', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Envoi en cours…' : 'Envoyer le message'}
            </button>
          </div>
        </form>
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
