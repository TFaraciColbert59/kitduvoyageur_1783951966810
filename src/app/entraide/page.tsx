'use client';

import React, { useState } from 'react';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { Button, Tabs } from '@/components/ui';

const FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'open', label: 'En attente' },
  { id: 'nearby', label: 'À proximité' },
] as const;

type FilterKey = (typeof FILTERS)[number]['id'];

function FilterBar({ filter, onChange }: { filter: FilterKey; onChange: (f: FilterKey) => void }) {
  return (
    <Tabs
      options={FILTERS}
      value={filter}
      onChange={(id) => onChange(id as FilterKey)}
      ariaLabel="Filtrer les demandes d'entraide"
      className="w-full max-w-[420px]"
    />
  );
}

export default function EntraidePage() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [showNewRequest, setShowNewRequest] = useState(false);

  const callButton = (
    <Button
      onClick={() => setShowNewRequest(true)}
      icon={<Icon name="PlusIcon" size={15} variant="outline" />}
      size="lg"
    >
      Lancer un appel
    </Button>
  );

  return (
    <>
      {/* DESKTOP — fullscreen sans scroll */}
      <div className="hidden md:block">
        <div data-lkv-material-theme="light" className="h-dvh overflow-hidden bg-transparent">
          <Header />
          <main className="flex h-full items-center justify-center overflow-hidden px-[var(--space-6)] pb-[var(--space-10)] pt-20">
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-[var(--space-5)] text-center">
              <div className="flex items-center gap-[var(--space-3)]">
                <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-3)] py-1.5 text-[10px] font-bold uppercase tracking-widest text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--blur-md)]">Communauté</span>
                <span className="font-mono text-[length:var(--lkv-text-caption-1)] uppercase tracking-widest text-[color:var(--sage-100)]">Entraide SOS</span>
              </div>
              <h1 className="font-display text-[length:var(--lkv-text-title-xl)] font-bold leading-[var(--leading-tight)] tracking-tight text-[color:var(--lkv-forest-50)]">
                Réseau d&apos;entraide <span className="text-[color:var(--lkv-forest-200)]">géolocalisé</span>
              </h1>
              <p className="max-w-md text-[length:var(--lkv-text-footnote)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-forest-100)]">
                Trouvez du soutien, partagez des conseils et demandez de l&apos;aide autour de vous, où que vous soyez.
              </p>
              <FilterBar filter={filter} onChange={setFilter} />
              {callButton}
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
          <div className="p-[var(--space-4)]">
            <h1 className="mb-[var(--space-2)] font-display text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-forest-50)]">Entraide</h1>
            <p className="mb-[var(--space-4)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-forest-100)]">Réseau d&apos;entraide géolocalisé.</p>
            <div className="mb-[var(--space-4)]">
              <FilterBar filter={filter} onChange={setFilter} />
            </div>
            <Button
              fullWidth
              onClick={() => setShowNewRequest(true)}
              icon={<Icon name="PlusIcon" size={15} variant="outline" />}
            >
              Lancer un appel
            </Button>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
