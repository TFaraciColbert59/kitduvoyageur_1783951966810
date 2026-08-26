'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function RecommandationsPage() {
  const [activeFilter, setActiveFilter] = useState('Tout');

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-dark-bg text-white">
          <Header />
          <main className="pt-20">
            <section className="relative overflow-hidden py-14 px-4">
              <div className="max-w-4xl mx-auto text-center relative z-10">
                <h1 className="font-display font-800 text-4xl sm:text-5xl text-white mb-4 tracking-tight">L&apos;IA apprend<br /><span className="text-green-400">de chaque expédition</span></h1>
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
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#17402C', marginBottom: '8px' }}>Recommandations</h1>
            <p style={{ fontSize: '13px', color: 'rgba(23,64,44,0.6)', marginBottom: '16px' }}>Suggestions personnalisées.</p>
            <p style={{ textAlign: 'center', color: 'rgba(23,64,44,0.5)', padding: '20px' }}>Contenu à venir.</p>
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
