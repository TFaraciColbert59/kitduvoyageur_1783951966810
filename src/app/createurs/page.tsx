'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

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
                <div className="flex items-center gap-2 mb-4"><span className="tag-badge bg-secondary/30 text-emerald-300 border border-emerald-500/30 text-[10px]">COMMUNAUTÉ</span><span className="text-white/50 text-xs font-mono-data">ESPACE CRÉATEURS</span></div>
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
          <div style={{ padding: '16px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#17402C', marginBottom: '8px' }}>Espace Créateurs</h1>
            <p style={{ fontSize: '13px', color: 'rgba(23,64,44,0.6)', marginBottom: '16px' }}>Guides, photographes et créateurs vérifiés.</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button onClick={() => setActiveTab('produits')} style={{ padding: '8px 14px', borderRadius: '8px', background: activeTab === 'produits' ? '#17402C' : '#F4F1EA', color: activeTab === 'produits' ? 'white' : 'rgba(23,64,44,0.6)', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Catalogue</button>
              <button onClick={() => setActiveTab('créateurs')} style={{ padding: '8px 14px', borderRadius: '8px', background: activeTab === 'créateurs' ? '#17402C' : '#F4F1EA', color: activeTab === 'créateurs' ? 'white' : 'rgba(23,64,44,0.6)', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Créateurs</button>
            </div>
            <p style={{ textAlign: 'center', color: 'rgba(23,64,44,0.5)', padding: '20px' }}>Contenu à venir.</p>
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
