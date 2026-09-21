'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { Chip, EmptyState } from '@/components/ui';

export default function CreateursPage() {
  const [activeTab, setActiveTab] = useState<'produits' | 'créateurs' | 'devenir'>('produits');

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <main className="min-h-screen bg-background">
          <Header />
          <div className="pt-16 lg:pt-18">
            <section className="bg-dark-bg text-white py-14 px-4 relative overflow-hidden">
              <div className="max-w-7xl mx-auto relative">
                <div className="flex items-center gap-2 mb-4"><span className="tag-badge bg-secondary/30 text-forest-300 border border-forest-500/30 text-[10px]">COMMUNAUTÉ</span><span className="text-white/50 text-xs font-mono-data">ESPACE CRÉATEURS</span></div>
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6"><div><h1 className="text-section-title text-white mb-3">Guides, photographes<br /><span className="text-primary">et créateurs vérifiés</span></h1></div></div>
              </div>
            </section>
          </div>
          <Footer />
        </main>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div className="p-[var(--space-4)]">
            <h1 className="mb-[var(--space-2)] text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-primary)]">Espace Créateurs</h1>
            <p className="mb-[var(--space-4)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-primary)]/60">Guides, photographes et créateurs vérifiés.</p>
            <div className="mb-[var(--space-4)] flex flex-wrap gap-[var(--space-2)]">
              <Chip selected={activeTab === 'produits'} onClick={() => setActiveTab('produits')}>Catalogue</Chip>
              <Chip selected={activeTab === 'créateurs'} onClick={() => setActiveTab('créateurs')}>Créateurs</Chip>
            </div>
            <EmptyState title="Contenu à venir" description="L'espace créateurs sera disponible prochainement." />
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
