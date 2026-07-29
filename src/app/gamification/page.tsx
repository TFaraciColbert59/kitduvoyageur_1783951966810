'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function GamificationPage() {
  const [activeTab, setActiveTab] = useState<'defis' | 'badges' | 'classement'>('defis');
  const { user } = useAuth();

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-dark-bg text-white">
          <Header />
          <main className="pt-20">
            <section className="relative overflow-hidden py-14 px-4">
              <div className="max-w-4xl mx-auto text-center relative z-10">
                <h1 className="font-display font-800 text-4xl sm:text-5xl text-white mb-4">Chaque expédition<br /><span className="text-purple-400">mérite sa récompense</span></h1>
                <p className="text-white/60 text-lg max-w-2xl mx-auto">Défis, badges exclusifs et classements communautaires.</p>
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
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1C2620', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Gamification</h1>
            <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.6)', marginBottom: '16px' }}>Défis, badges et classements.</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button onClick={() => setActiveTab('defis')} style={{ padding: '8px 16px', borderRadius: '8px', background: activeTab === 'defis' ? '#17402C' : '#F4F1EA', color: activeTab === 'defis' ? 'white' : 'rgba(28,38,32,0.6)', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Défis</button>
              <button onClick={() => setActiveTab('badges')} style={{ padding: '8px 16px', borderRadius: '8px', background: activeTab === 'badges' ? '#17402C' : '#F4F1EA', color: activeTab === 'badges' ? 'white' : 'rgba(28,38,32,0.6)', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Badges</button>
              <button onClick={() => setActiveTab('classement')} style={{ padding: '8px 16px', borderRadius: '8px', background: activeTab === 'classement' ? '#17402C' : '#F4F1EA', color: activeTab === 'classement' ? 'white' : 'rgba(28,38,32,0.6)', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Classement</button>
            </div>
            {activeTab === 'defis' && <p style={{ color: 'rgba(28,38,32,0.5)', textAlign: 'center', padding: '20px' }}>Connectez-vous pour voir les défis.</p>}
            {activeTab === 'badges' && <p style={{ color: 'rgba(28,38,32,0.5)', textAlign: 'center', padding: '20px' }}>Badges à venir.</p>}
            {activeTab === 'classement' && <p style={{ color: 'rgba(28,38,32,0.5)', textAlign: 'center', padding: '20px' }}>Classement à venir.</p>}
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
