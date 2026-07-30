'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function CommunauteProPage() {
  const [activeTab, setActiveTab] = useState<'forum' | 'qa' | 'fiches'>('forum');

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-dark-bg text-white">
          <Header />
          <main className="pt-20">
            <section className="relative overflow-hidden py-14 px-4">
              <div className="max-w-4xl mx-auto text-center relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono mb-6">PHASE 5 — COMMUNAUTÉ EXPERTE</div>
                <h1 className="font-display font-800 text-4xl sm:text-5xl text-white mb-4 tracking-tight">Le savoir terrain,<br /><span className="text-indigo-400">partagé entre experts</span></h1>
                <p className="text-white/60 text-lg max-w-2xl mx-auto">Forum, Q&amp;A et fiches de retours d&apos;expédition.</p>
              </div>
            </section>
          </main>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1C2620', marginBottom: '8px' }}>Communauté Pro</h1>
            <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.6)', marginBottom: '16px' }}>Forum, Q&amp;A et fiches d&apos;expédition.</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button onClick={() => setActiveTab('forum')} style={{ padding: '8px 14px', borderRadius: '8px', background: activeTab === 'forum' ? '#17402C' : '#F4F1EA', color: activeTab === 'forum' ? 'white' : 'rgba(28,38,32,0.6)', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Forum</button>
              <button onClick={() => setActiveTab('qa')} style={{ padding: '8px 14px', borderRadius: '8px', background: activeTab === 'qa' ? '#17402C' : '#F4F1EA', color: activeTab === 'qa' ? 'white' : 'rgba(28,38,32,0.6)', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Q&A</button>
              <button onClick={() => setActiveTab('fiches')} style={{ padding: '8px 14px', borderRadius: '8px', background: activeTab === 'fiches' ? '#17402C' : '#F4F1EA', color: activeTab === 'fiches' ? 'white' : 'rgba(28,38,32,0.6)', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Fiches</button>
            </div>
            <p style={{ textAlign: 'center', color: 'rgba(28,38,32,0.5)', padding: '20px' }}>Contenu à venir.</p>
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
