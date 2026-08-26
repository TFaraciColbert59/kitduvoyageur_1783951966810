'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

const FILTERS: { key: 'all' | 'open' | 'nearby'; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'open', label: 'En attente' },
  { key: 'nearby', label: 'À proximité' },
];

function FilterBar({ filter, onChange }: { filter: 'all' | 'open' | 'nearby'; onChange: (f: 'all' | 'open' | 'nearby') => void }) {
  return (
    <div className="glass-capsule-bar" style={{ display: 'flex', width: '100%', maxWidth: '420px' }}>
      {FILTERS.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`glass-capsule-segment ${filter === f.key ? 'active' : ''}`}
          style={{ flex: '1 1 auto' }}
          aria-pressed={filter === f.key}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

export default function EntraidePage() {
  const [filter, setFilter] = useState<'all' | 'open' | 'nearby'>('all');
  const [showNewRequest, setShowNewRequest] = useState(false);

  return (
    <>
      {/* DESKTOP — fullscreen sans scroll */}
      <div className="hidden md:block">
        <div data-lkv-material-theme="light" className="h-dvh overflow-hidden bg-[#FAF8F5]">
          <Header />
          <main className="h-full overflow-hidden pt-20 flex items-center justify-center px-6 pb-10">
            <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center gap-5">
              <div className="flex items-center gap-3">
                <span className="glass-pill px-3.5 py-1.5 text-[10px] font-bold tracking-widest uppercase">Communauté</span>
                <span className="glass-eyebrow">Entraide SOS</span>
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-[#17402C] leading-tight">
                Réseau d&apos;entraide <span className="text-[#5B7F55]">géolocalisé</span>
              </h1>
              <p className="text-[#365233] text-sm max-w-md leading-relaxed">
                Trouvez du soutien, partagez des conseils et demandez de l&apos;aide autour de vous, où que vous soyez.
              </p>
              <FilterBar filter={filter} onChange={setFilter} />
              <button onClick={() => setShowNewRequest(true)} className="glass-capsule-btn mt-1" style={{ paddingLeft: 28, paddingRight: 28 }}>
                <Icon name="PlusIcon" size={15} variant="outline" />
                Lancer un appel
              </button>
            </div>
          </main>
        </div>
        {/* Footer : masqué en desktop fullscreen (pas de scroll), visible sous md */}
        <div className="md:hidden">
          <Footer />
        </div>
      </div>

      {/* MOBILE — scroll natif */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#17402C', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Entraide</h1>
            <p style={{ fontSize: '13px', color: '#5A7064', marginBottom: '16px' }}>Réseau d&apos;entraide géolocalisé.</p>
            <div style={{ marginBottom: '16px' }}>
              <FilterBar filter={filter} onChange={setFilter} />
            </div>
            <button onClick={() => setShowNewRequest(true)} className="glass-capsule-btn" style={{ width: '100%' }}>
              <Icon name="PlusIcon" size={15} variant="outline" />
              Lancer un appel
            </button>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
