'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

const PRO_PLANS = [
  { id: 'guide', name: 'Guide Indépendant', price: 29, period: 'mois', description: 'Pour les guides de montagne et accompagnateurs indépendants', features: ['Tarifs pro -15%', 'Commandes groupées jusqu\'à 10', 'Facturation professionnelle', 'Support prioritaire'], highlighted: false },
  { id: 'agence', name: 'Agence & Opérateur', price: 89, period: 'mois', description: 'Pour les agences de voyage aventure', features: ['Tarifs pro -25%', 'Commandes groupées illimitées', 'Gestionnaire de compte dédié', 'API d\'intégration'], highlighted: true, badge: 'Populaire' },
  { id: 'revendeur', name: 'Revendeur B2B', price: 149, period: 'mois', description: 'Pour les boutiques outdoor', features: ['Tarifs grossiste -35%', 'Dropshipping disponible', 'Intégration ERP', 'Responsable dédié'], highlighted: false },
];

export default function B2BPage() {
  const [activeTab, setActiveTab] = useState<'plans' | 'catalogue' | 'dashboard'>('plans');
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactSent, setContactSent] = useState(false);

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <main className="min-h-screen bg-background">
          <Header />
          <div className="pt-16 lg:pt-18">
            <section className="bg-dark-bg text-white py-20 px-4 relative overflow-hidden">
              <div className="absolute inset-0"><div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl" /></div>
              <div className="max-w-7xl mx-auto relative">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 mb-5"><span className="tag-badge bg-primary/20 text-primary border border-primary/30 text-[10px]">PHASE 2</span><span className="text-white/50 text-xs font-mono-data">ESPACE PROFESSIONNEL B2B</span></div>
                  <h1 className="text-hero text-white mb-4">L&apos;équipement outdoor<br />pour les pros</h1>
                  <p className="text-white/60 text-lg max-w-xl mb-8">Tarifs préférentiels, commandes groupées et outils dédiés.</p>
                  <div className="flex gap-4"><button onClick={() => setShowContactModal(true)} className="glass-capsule-btn primary py-3.5 px-7"><Icon name="BuildingOfficeIcon" size={18} />Demander un accès pro</button><button onClick={() => setActiveTab('catalogue')} className="glass-capsule-btn py-3.5 px-7">Voir le catalogue pro</button></div>
                </div>
              </div>
            </section>
            <section className="sticky top-16 z-30 bg-background/95 backdrop-blur-md border-b border-border"><div className="max-w-7xl mx-auto px-4">
              <div className="flex gap-0">{[{ id: 'plans', label: 'Offres pro', icon: 'SparklesIcon' }, { id: 'catalogue', label: 'Catalogue B2B', icon: 'TagIcon' }, { id: 'dashboard', label: 'Dashboard pro', icon: 'ChartBarIcon' }].map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)} className={`glass-capsule-btn flex items-center gap-2 px-5 py-4 text-sm font-600 ${activeTab === tab.id ? 'primary' : ''}`}>
                  <Icon name={tab.icon} size={16} />{tab.label}</button>
              ))}</div></div></section>
            <div className="max-w-7xl mx-auto px-4 py-10">
              {activeTab === 'plans' && <div className="text-center mb-10"><h2 className="font-display font-700 text-foreground text-2xl mb-2">Choisissez votre offre professionnelle</h2></div>}
            </div>
          </div>
          <Footer />
        </main>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div className="p-[var(--space-4)]">
            <h1 className="mb-[var(--space-4)] text-[20px] font-extrabold text-[color:var(--lkv-primary)]">Espace Pro B2B</h1>
            <p className="mb-[var(--space-5)] text-[13px] text-[color:var(--lkv-text-secondary)]">Tarifs préférentiels pour les professionnels.</p>
            <div className="mb-[var(--space-5)] flex gap-[var(--space-2)]">
              <button onClick={() => setActiveTab('plans')} className={`glass-capsule-btn ${activeTab === 'plans' ? 'primary' : ''}`}>Offres</button>
              <button onClick={() => setActiveTab('catalogue')} className={`glass-capsule-btn ${activeTab === 'catalogue' ? 'primary' : ''}`}>Catalogue</button>
            </div>
            {activeTab === 'plans' && PRO_PLANS.map((plan) => (
              <div key={plan.id} className="glass mb-[var(--space-3)] rounded-[var(--lkv-radius-sm)] p-[var(--space-4)]">
                <h3 className="mb-1 text-[16px] font-bold text-[color:var(--lkv-primary)]">{plan.name}</h3>
                <p className="mb-[var(--space-2)] text-[13px] text-[color:var(--lkv-text-muted)]">{plan.description}</p>
                <p className="mb-[var(--space-3)] text-[28px] font-extrabold text-[color:var(--lkv-primary)]">{plan.price}€<span className="text-[13px] font-normal">/{plan.period}</span></p>
                <ul className="mb-[var(--space-3)]">{plan.features.map((f) => <li key={f} className="py-0.5 text-[13px] text-[color:var(--lkv-text-secondary)]">✓ {f}</li>)}</ul>
                <button onClick={() => setShowContactModal(true)} className="glass-capsule-btn primary w-full">Choisir cette offre</button>
              </div>
            ))}
            <button onClick={() => setShowContactModal(true)} className="glass-capsule-btn primary w-full">Demander un accès pro</button>
          </div>
        </MobilePageShell>
        

        {showContactModal && (
          <div className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowContactModal(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Demande d'accès professionnel"
              className="bg-card rounded-2xl border border-border p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {!contactSent ? <>
                <h3 className="font-display font-700 text-foreground text-lg mb-4">Demande d&apos;accès professionnel</h3>
                <button onClick={() => setContactSent(true)} className="glass-capsule-btn primary w-full justify-center py-3">Envoyer la demande</button>
              </> : <div className="text-center py-8"><h3 className="font-display font-700 text-foreground text-lg mb-2">Demande envoyée !</h3><button onClick={() => { setShowContactModal(false); setContactSent(false); }} className="glass-capsule-btn primary justify-center px-8 py-3">Fermer</button></div>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
