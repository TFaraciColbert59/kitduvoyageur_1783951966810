'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { EmptyState } from '@/components/ui';

export default function ExpertsPage() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const { user } = useAuth();

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background text-foreground">
          <Header />
          <section className="pt-20 bg-dark-bg">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <p className="font-mono text-xs text-primary tracking-widest uppercase mb-3">RÉSEAU D&apos;EXPERTS TERRAIN</p>
              <h1 className="font-display font-800 text-4xl md:text-5xl text-white tracking-tight mb-3">Consultez des guides<br />certifiés avant de partir</h1>
            </div>
          </section>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div className="p-[var(--space-4)]">
            <h1 className="mb-[var(--space-2)] text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-primary)]">Experts</h1>
            <p className="mb-[var(--space-4)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-primary)]/60">Consultez des guides certifiés.</p>
            <EmptyState title="Contenu à venir" description="Le réseau d'experts sera disponible prochainement." />
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
