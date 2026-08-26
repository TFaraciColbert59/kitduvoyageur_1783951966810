'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
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

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#5A7064', marginBottom: '6px' };

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label style={labelStyle}>{children}</label>
  );

  const desktopContent = (
    <div data-lkv-material-theme="light" className="h-dvh overflow-hidden bg-[#FAF8F5]">
      <Header />
      <main className="h-full overflow-hidden pt-20">
        <div className="w-full max-w-5xl mx-auto px-6 pb-6 h-full flex flex-col gap-5">
          <div className="flex-shrink-0">
            <p className="glass-eyebrow mb-2">Support &amp; Contact</p>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-[#17402C] mb-2">Contactez-nous</h1>
            <p className="text-[#365233] text-sm max-w-xl leading-relaxed">Notre équipe répond sous 48 heures ouvrées.</p>
          </div>

          {/* Contenu riche — scroll interne uniquement */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-2 grid grid-cols-1 lg:grid-cols-2 gap-6 content-start">
            <div className="flex flex-col gap-3">
              <h2 className="font-semibold text-[#17402C] text-base">Nos équipes</h2>
              {contacts.map((c) => (
                <a key={c.href} href={c.href} className="glass-sub-card group flex items-start gap-4 p-4" style={{ textDecoration: 'none' }}>
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/40 flex items-center justify-center flex-shrink-0">
                    <Icon name={c.icon} size={18} className="text-[#5B7F55]" variant="outline" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#17402C] text-sm">{c.title}</p>
                    <p className="text-xs text-[#5A7064] mb-1">{c.desc}</p>
                    <p className="text-xs text-[#5B7F55] font-mono truncate" style={{ fontFamily: 'var(--font-mono)' }}>{c.value}</p>
                  </div>
                  <Icon name="ArrowTopRightOnSquareIcon" size={14} className="text-[#5A7064] group-hover:text-[#5B7F55] transition-colors flex-shrink-0 mt-1" variant="outline" />
                </a>
              ))}
            </div>
            <div>
              <h2 className="font-semibold text-[#17402C] text-base mb-3">Envoyer un message</h2>
              {submitted ? (
                <div className="glass flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-[#5B7F55]/15 flex items-center justify-center mb-4">
                    <Icon name="CheckCircleIcon" size={28} className="text-[#5B7F55]" variant="outline" />
                  </div>
                  <h3 className="font-semibold text-[#17402C] mb-2">Message envoyé !</h3>
                  <p className="text-sm text-[#5A7064] max-w-xs">Nous vous répondrons sous 48 heures ouvrées.</p>
                  <button onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }); }} className="mt-6 text-sm text-[#5B7F55] hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    Envoyer un autre message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="glass p-6 flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Nom complet *</Label>
                      <input type="text" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jean Dupont" className="glass-input w-full" />
                    </div>
                    <div>
                      <Label>Email *</Label>
                      <input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jean@exemple.fr" className="glass-input w-full" />
                    </div>
                  </div>
                  <div>
                    <Label>Sujet *</Label>
                    <select required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="glass-input w-full">
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
                    <Label>Message *</Label>
                    <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Décrivez votre demande en détail..." className="glass-input w-full resize-none" style={{ minHeight: '120px' }} />
                  </div>
                  <button type="submit" disabled={submitting} className="glass-capsule-btn">
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid rgba(54,82,51,0.25)', borderTopColor: '#365233' }} />
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
        </div>
      </main>
    </div>
  );

  const mobileContent = (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#17402C', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px' }}>Support &amp; Contact</p>
      <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#17402C', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Contactez-nous</h1>
      <p style={{ fontSize: '13px', color: '#5A7064', marginBottom: '24px' }}>Notre équipe répond sous 48 heures ouvrées.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {contacts.map((c) => (
          <a key={c.href} href={c.href} className="glass-sub-card" style={{ display: 'flex', gap: '12px', padding: '14px', textDecoration: 'none' }}>
            <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17402C" strokeWidth="2"><path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#17402C', marginBottom: '2px' }}>{c.title}</p>
              <p style={{ fontSize: '12px', color: '#5A7064', marginBottom: '2px' }}>{c.desc}</p>
              <p style={{ fontSize: '12px', color: '#17402C', fontFamily: 'var(--font-mono)' }}>{c.value}</p>
            </div>
          </a>
        ))}
      </div>

      {submitted ? (
        <div className="glass-sub-card" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <p style={{ fontSize: '24px', marginBottom: '12px' }}>✓</p>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#17402C', marginBottom: '8px' }}>Message envoyé !</h3>
          <p style={{ fontSize: '13px', color: '#5A7064', marginBottom: '16px' }}>Nous vous répondrons sous 48 heures ouvrées.</p>
          <button onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }); }} style={{ color: '#17402C', textDecoration: 'underline', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer' }}>Envoyer un autre message</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="glass-sub-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
            <input type="text" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom complet *" aria-label="Nom complet" className="glass-input" style={{ width: '100%' }} />
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email *" aria-label="Email" autoComplete="email" className="glass-input" style={{ width: '100%' }} />
            <select required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} aria-label="Sujet" className="glass-input" style={{ width: '100%' }}>
              <option value="">Sujet *</option>
              <option value="commande">Question sur ma commande</option>
              <option value="retour">Retour / Remboursement</option>
              <option value="produit">Question produit</option>
              <option value="compte">Problème de compte</option>
              <option value="partenariat">Partenariat / B2B</option>
              <option value="autre">Autre</option>
            </select>
            <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Message *" aria-label="Message" className="glass-input" style={{ width: '100%', minHeight: '100px', resize: 'none' }} />
            <button type="submit" disabled={submitting} className="glass-capsule-btn" style={{ width: '100%' }}>
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
