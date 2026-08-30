'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/shell';

export default function AmbassadeursPage() {
  const [activeTab, setActiveTab] = useState<'programme' | 'dashboard' | 'codes'>('programme');
  const [applyOpen, setApplyOpen] = useState(false);
  const { user } = useAuth();

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background text-foreground">
          <Header />
          <section className="pt-20 bg-dark-bg overflow-hidden relative">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative">
              <p className="font-mono text-xs text-primary tracking-widest uppercase mb-3">PROGRAMME AMBASSADEURS</p>
              <h1 className="font-display font-800 text-4xl md:text-5xl text-white tracking-tight mb-4">Partagez votre passion,<br />gagnez des commissions</h1>
              <p className="text-white/60 text-lg max-w-xl mb-8">Rejoignez nos ambassadeurs qui monétisent leur audience.</p>
              <div className="flex flex-wrap gap-4"><button onClick={() => setApplyOpen(true)} className="btn-primary"><Icon name="UserPlusIcon" size={16} variant="outline" />Devenir ambassadeur</button></div>
            </div>
          </section>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <AppShell>
          <div style={{ padding: '16px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#17402C', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Ambassadeurs</h1>
            <p style={{ fontSize: '13px', color: 'rgba(23,64,44,0.6)', marginBottom: '16px' }}>Partagez votre passion, gagnez des commissions.</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button onClick={() => setActiveTab('programme')} style={{ padding: '8px 14px', borderRadius: '8px', background: activeTab === 'programme' ? '#17402C' : '#F4F1EA', color: activeTab === 'programme' ? 'white' : 'rgba(23,64,44,0.6)', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Programme</button>
              <button onClick={() => setActiveTab('dashboard')} style={{ padding: '8px 14px', borderRadius: '8px', background: activeTab === 'dashboard' ? '#17402C' : '#F4F1EA', color: activeTab === 'dashboard' ? 'white' : 'rgba(23,64,44,0.6)', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Dashboard</button>
            </div>
            <button onClick={() => setApplyOpen(true)} style={{ width: '100%', padding: '14px', background: '#17402C', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginTop: '12px' }}>Devenir ambassadeur</button>
          </div>
        </AppShell>
        
      </div>
    </>
  );
}
