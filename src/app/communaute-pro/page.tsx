'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function CommunauteProPage() {
  const [activeTab, setActiveTab] = useState<'forum' | 'qa' | 'fiches'>('forum');

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-transparent text-[color:var(--lkv-primary)]">
          <Header />
          <main className="pt-24 pb-20 max-w-4xl mx-auto px-4 text-center">
            <div className="glass p-8 sm:p-12 rounded-3xl">
              <span className="glass-pill px-3.5 py-1 text-[10px] font-bold tracking-widest uppercase mb-4 inline-block">
                🌲 Communauté Pro & Experts
              </span>
              <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-[color:var(--lkv-primary)] mb-4 tracking-tight">
                Le savoir terrain,<br />
                <em className="font-serif italic font-normal text-[color:var(--lkv-primary-soft)]">partagé entre aventuriers certifiés.</em>
              </h1>
              <p className="text-[color:var(--lkv-primary-soft)] text-base max-w-xl mx-auto mb-8 font-medium">
                Forum dédié, Q&amp;A pointus et retours d&apos;expérience sur les conditions réelles d&apos;expédition.
              </p>

              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                {[
                  { id: 'forum', label: '💬 Forum' },
                  { id: 'qa', label: '💡 Q&A' },
                  { id: 'fiches', label: '📖 Fiches' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`glass-capsule-btn py-2.5 px-4 text-xs font-bold ${
                      activeTab === t.id ? 'primary' : ''
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </main>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div className="p-[var(--space-4)]">
            <h1 className="mb-[var(--space-2)] text-[20px] font-extrabold text-[color:var(--lkv-primary)]">Communauté Pro</h1>
            <p className="mb-[var(--space-4)] text-[13px] text-[color:var(--lkv-text-secondary)]">Forum, Q&amp;A et fiches d&apos;expédition.</p>
            <div className="mb-[var(--space-4)] flex gap-[var(--space-2)]">
              <button onClick={() => setActiveTab('forum')} className={`glass-capsule-btn ${activeTab === 'forum' ? 'primary' : ''}`}>Forum</button>
              <button onClick={() => setActiveTab('qa')} className={`glass-capsule-btn ${activeTab === 'qa' ? 'primary' : ''}`}>Q&A</button>
              <button onClick={() => setActiveTab('fiches')} className={`glass-capsule-btn ${activeTab === 'fiches' ? 'primary' : ''}`}>Fiches</button>
            </div>
            <p className="p-[var(--space-5)] text-center text-[color:var(--lkv-text-muted)]">Contenu à venir.</p>
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
