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
        <div className="min-h-screen bg-[#FBFAF6] text-[#17402C]">
          <Header />
          <main className="pt-24 pb-20 max-w-4xl mx-auto px-4 text-center">
            <div className="glass p-8 sm:p-12 rounded-3xl">
              <span className="glass-pill px-3.5 py-1 text-[10px] font-bold tracking-widest uppercase mb-4 inline-block">
                🌲 Communauté Pro & Experts
              </span>
              <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-[#17402C] mb-4 tracking-tight">
                Le savoir terrain,<br />
                <em className="font-serif italic font-normal text-[#365233]">partagé entre aventuriers certifiés.</em>
              </h1>
              <p className="text-[#365233] text-base max-w-xl mx-auto mb-8 font-medium">
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
                      activeTab === t.id ? 'active text-[#17402C]' : 'text-[#365233]'
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
          <div style={{ padding: '16px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#17402C', marginBottom: '8px' }}>Communauté Pro</h1>
            <p style={{ fontSize: '13px', color: 'rgba(23,64,44,0.6)', marginBottom: '16px' }}>Forum, Q&amp;A et fiches d&apos;expédition.</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button onClick={() => setActiveTab('forum')} style={{ padding: '8px 14px', borderRadius: '8px', background: activeTab === 'forum' ? '#17402C' : '#F4F1EA', color: activeTab === 'forum' ? 'white' : 'rgba(23,64,44,0.6)', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Forum</button>
              <button onClick={() => setActiveTab('qa')} style={{ padding: '8px 14px', borderRadius: '8px', background: activeTab === 'qa' ? '#17402C' : '#F4F1EA', color: activeTab === 'qa' ? 'white' : 'rgba(23,64,44,0.6)', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Q&A</button>
              <button onClick={() => setActiveTab('fiches')} style={{ padding: '8px 14px', borderRadius: '8px', background: activeTab === 'fiches' ? '#17402C' : '#F4F1EA', color: activeTab === 'fiches' ? 'white' : 'rgba(23,64,44,0.6)', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Fiches</button>
            </div>
            <p style={{ textAlign: 'center', color: 'rgba(23,64,44,0.5)', padding: '20px' }}>Contenu à venir.</p>
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
