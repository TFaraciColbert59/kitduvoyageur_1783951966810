'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function EntraidePage() {
  const [filter, setFilter] = useState<'all' | 'open' | 'nearby'>('all');
  const [showNewRequest, setShowNewRequest] = useState(false);

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <main className="min-h-screen bg-background">
          <Header />
          <div className="pt-16 lg:pt-18">
            <section className="bg-dark-bg text-white py-14 px-4 relative overflow-hidden">
              <div className="max-w-7xl mx-auto relative">
                <div className="flex items-center gap-2 mb-4"><span className="tag-badge bg-secondary/30 text-emerald-300 border border-emerald-500/30 text-[10px]">COMMUNAUTÉ</span><span className="text-white/50 text-xs font-mono-data">ENTRAIDE SOS</span></div>
                <div><h1 className="text-section-title text-white mb-3">Réseau d&apos;entraide<br /><span className="text-primary">géolocalisé</span></h1></div>
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
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1C2620', marginBottom: '8px' }}>Entraide</h1>
            <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.6)', marginBottom: '16px' }}>Réseau d&apos;entraide géolocalisé.</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button onClick={() => setFilter('all')} style={{ padding: '8px 14px', borderRadius: '8px', background: filter === 'all' ? '#17402C' : '#F4F1EA', color: filter === 'all' ? 'white' : 'rgba(28,38,32,0.6)', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Tous</button>
              <button onClick={() => setFilter('open')} style={{ padding: '8px 14px', borderRadius: '8px', background: filter === 'open' ? '#17402C' : '#F4F1EA', color: filter === 'open' ? 'white' : 'rgba(28,38,32,0.6)', border: 'none', fontSize: '12px', cursor: 'pointer' }}>En attente</button>
            </div>
            <button onClick={() => setShowNewRequest(true)} style={{ width: '100%', padding: '14px', background: '#17402C', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Lancer un appel</button>
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
