'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

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
          <div style={{ padding: '16px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1C2620', marginBottom: '8px' }}>Experts</h1>
            <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.6)', marginBottom: '16px' }}>Consultez des guides certifiés.</p>
            <p style={{ textAlign: 'center', color: 'rgba(28,38,32,0.5)', padding: '20px' }}>Contenu à venir.</p>
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
