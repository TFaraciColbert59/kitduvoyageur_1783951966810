'use client';

import Link from 'next/link';
import React, { useId, useState } from 'react';

import LkvIcon from '@/components/ui/LkvIcon';
import type { OwnerLiveTrackingStatus } from '@/features/compte/live-tracking/types';

import LiveTrackingPanel from './LiveTrackingPanel';
import SafetyContactsPanel from './SafetyContactsPanel';
import WatchLiveStatus from './WatchLiveStatus';
import { liveTrackingApi, type LiveTrackingApi } from './liveTrackingApi';

export interface LiveTrackingScreenProps {
  api?: LiveTrackingApi;
}

type Tab = 'share' | 'contacts' | 'watch';

const TABS: ReadonlyArray<{ id: Tab; label: string; icon: 'map-pin' | 'users' | 'compass' }> = [
  { id: 'share', label: 'Partage', icon: 'map-pin' },
  { id: 'contacts', label: 'Contacts', icon: 'users' },
  { id: 'watch', label: 'Montre', icon: 'compass' },
];

export function LiveTrackingScreen({ api = liveTrackingApi }: LiveTrackingScreenProps) {
  const [tab, setTab] = useState<Tab>('share');
  const [status, setStatus] = useState<OwnerLiveTrackingStatus | null>(null);
  const tablistId = useId();

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = TABS[(index + delta + TABS.length) % TABS.length];
    setTab(next.id);
    const target = document.getElementById(`${tablistId}-${next.id}`);
    target?.focus();
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(96px+var(--bottom-nav-height,72px))] pt-[calc(18px+var(--safe-top))] sm:px-6">
      <div className="mb-5">
        <Link
          href="/compte"
          className="inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-[color:var(--glass-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
        >
          <span aria-hidden>
            <LkvIcon name="chevron-left" size={18} />
          </span>
          Compte
        </Link>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--lkv-action)]">
          Sécurité · Beacon
        </p>
        <h1 className="mt-1 text-[30px] font-semibold leading-tight tracking-[-0.01em] text-[color:var(--lkv-text-primary)]">
          Suivi en direct
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[color:var(--lkv-text-secondary)]">
          Partage ta position le temps d’une sortie, préviens tes proches et garde le contrôle :
          chaque lien se révoque, chaque séance se termine.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Sections du suivi en direct"
        className="mb-5 flex gap-1 rounded-full border border-[color:var(--glass-rim)] bg-[var(--lkv-surface-paper)] p-1"
      >
        {TABS.map((item, index) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              id={`${tablistId}-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${tablistId}-${item.id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] ${
                selected
                  ? 'bg-[color:var(--lkv-action)] text-[color:var(--lkv-text-inverted)]'
                  : 'text-[color:var(--glass-secondary)]'
              }`}
            >
              <span aria-hidden>
                <LkvIcon name={item.icon} size={16} />
              </span>
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'share' ? (
        <div
          id={`${tablistId}-share-panel`}
          role="tabpanel"
          aria-labelledby={`${tablistId}-share`}
          className="space-y-4"
        >
          <LiveTrackingPanel api={api} onStatusChange={setStatus} />
          {status?.activeSessionId ? (
            <div className="rounded-2xl border border-[color:var(--glass-rim)] bg-[var(--lkv-surface-muted)] px-4 py-3 text-[12px] leading-relaxed text-[color:var(--glass-secondary)]">
              Astuce : le proche ouvre le lien sans compte. S’il voit « Lien expiré », crée un
              nouveau lien depuis cette page.
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'contacts' ? (
        <div
          id={`${tablistId}-contacts-panel`}
          role="tabpanel"
          aria-labelledby={`${tablistId}-contacts`}
        >
          <SafetyContactsPanel api={api} initialContacts={status?.contacts} />
        </div>
      ) : null}

      {tab === 'watch' ? (
        <div
          id={`${tablistId}-watch-panel`}
          role="tabpanel"
          aria-labelledby={`${tablistId}-watch`}
          className="space-y-4"
        >
          <WatchLiveStatus snapshot={status?.watch ?? null} nowMs={status?.nowMs} />
          <div className="rounded-2xl border border-[color:var(--glass-rim)] bg-[var(--lkv-surface-paper)] p-4">
            <h2 className="text-[13px] font-semibold text-[color:var(--glass-label)]">
              Comment ça marche
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--glass-secondary)]">
              La montre ne stocke jamais le lien de partage. Elle envoie une commande à l’app, qui
              crée le lien côté serveur et renvoie seulement l’état du partage.
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default LiveTrackingScreen;
