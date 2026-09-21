'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/shell';
import { Button, Chip } from '@/components/ui';

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
              <div className="flex flex-wrap gap-4"><button onClick={() => setApplyOpen(true)} className="glass-capsule-btn primary"><Icon name="UserPlusIcon" size={16} variant="outline" />Devenir ambassadeur</button></div>
            </div>
          </section>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <AppShell>
          <div className="p-[var(--space-4)]">
            <h1 className="mb-[var(--space-2)] font-display text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-primary)]">Ambassadeurs</h1>
            <p className="mb-[var(--space-4)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-primary)]/60">Partagez votre passion, gagnez des commissions.</p>
            <div className="mb-[var(--space-4)] flex flex-wrap gap-[var(--space-2)]">
              <Chip selected={activeTab === 'programme'} onClick={() => setActiveTab('programme')}>Programme</Chip>
              <Chip selected={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')}>Dashboard</Chip>
            </div>
            <Button
              fullWidth
              className="mt-[var(--space-3)]"
              onClick={() => setApplyOpen(true)}
              icon={<Icon name="UserPlusIcon" size={16} variant="outline" />}
            >
              Devenir ambassadeur
            </Button>
          </div>
        </AppShell>
      </div>
    </>
  );
}
