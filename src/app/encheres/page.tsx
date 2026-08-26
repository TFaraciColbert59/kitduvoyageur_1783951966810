'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function EncheresPage() {
  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background text-foreground">
          <Header />
          <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon name="ArchiveBoxXMarkIcon" size={28} variant="outline" className="text-muted-foreground" />
            </div>
            <h1 className="font-display font-800 text-2xl mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>Les enchères ne sont plus disponibles</h1>
            <p className="text-muted-foreground mb-6">Nous avons remplacé le système d&apos;enchères par un système d&apos;offres plus simple et plus rapide sur la marketplace occasion.</p>
            <Link href="/occasion" className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all">
              <Icon name="ShoppingBagIcon" size={16} variant="outline" />Voir la marketplace occasion
            </Link>
          </main>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ width: '48px', height: '48px', background: 'rgba(23,64,44,0.06)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(23,64,44,0.5)" strokeWidth="2"><path d="M6 4h12l2 4-2 4h2l-2 4h-2l-4 4-4-4H6l-2-4h2L4 8l2-4z" /></svg>
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#17402C', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>Les enchères ne sont plus disponibles</h1>
            <p style={{ fontSize: '13px', color: 'rgba(23,64,44,0.6)', marginBottom: '24px', lineHeight: '1.6' }}>Nous avons remplacé le système d&apos;enchères par un système d&apos;offres plus simple et plus rapide sur la marketplace occasion.</p>
            <Link href="/occasion" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#17402C', color: 'white', padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
              Voir la marketplace occasion
            </Link>
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
