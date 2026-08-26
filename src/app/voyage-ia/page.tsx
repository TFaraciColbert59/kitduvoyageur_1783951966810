'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function VoyageIAPage() {
  const [phase, setPhase] = useState<'intro' | 'interview' | 'generating' | 'result'>('intro');
  const [destination, setDestination] = useState('');

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-[#17402C] text-white">
          <Header />
          <section className="pt-24 pb-10 px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">Transformez votre envie<br /><span className="text-[#17402C]">en aventure complète</span></h1>
              <p className="text-white/60 text-lg max-w-2xl mx-auto">Donnez une idée, un rêve ou une destination.</p>
            </div>
          </section>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#17402C', marginBottom: '8px' }}>Créateur de Voyage IA</h1>
            <p style={{ fontSize: '13px', color: 'rgba(23,64,44,0.6)', marginBottom: '16px' }}>Transformez votre envie en aventure complète.</p>
            {phase === 'intro' && (
              <div>
                <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ex: Je veux faire le GR20…" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(23,64,44,0.06)', fontSize: '14px', marginBottom: '12px' }} />
                <button onClick={() => { if (destination.trim().length > 2) setPhase('interview'); }} disabled={destination.trim().length < 3} style={{ width: '100%', padding: '14px', background: '#17402C', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: destination.trim().length < 3 ? 0.6 : 1 }}>Commencer</button>
              </div>
            )}
            {phase === 'interview' && <p style={{ color: 'rgba(23,64,44,0.5)' }}>Formulaire à venir.</p>}
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
