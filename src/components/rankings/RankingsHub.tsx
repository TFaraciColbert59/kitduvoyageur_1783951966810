'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/contexts/AuthContext';
import LeaderboardPanel from './LeaderboardPanel';
import LocalLegendsPanel from './LocalLegendsPanel';
import PeakBaggingPanel from './PeakBaggingPanel';
import ChallengesPanel from './ChallengesPanel';
import TrophiesPanel from './TrophiesPanel';
import PeersPanel from './PeersPanel';
import { RANKINGS_TABS, type RankingsTabId } from './tabs';
import { InlineNotice, RankingsCard, RankingsEmpty } from './ui';

const PERSONAL_TABS = new Set<RankingsTabId>(['peaks', 'trophies', 'peers']);

function PanelFor({ tab }: { tab: RankingsTabId }) {
  switch (tab) {
    case 'leaderboard':
      return <LeaderboardPanel />;
    case 'local-legends':
      return <LocalLegendsPanel />;
    case 'peaks':
      return <PeakBaggingPanel />;
    case 'challenges':
      return <ChallengesPanel />;
    case 'trophies':
      return <TrophiesPanel />;
    case 'peers':
      return <PeersPanel />;
  }
}

export function RankingsHub({ initialTab = 'leaderboard' }: { initialTab?: RankingsTabId }) {
  const [active, setActive] = useState<RankingsTabId>(initialTab);
  const { user, loading: authLoading } = useAuth();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (next: RankingsTabId) => setActive(next);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const currentIndex = RANKINGS_TABS.findIndex((tab) => tab.id === active);
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + RANKINGS_TABS.length) % RANKINGS_TABS.length;
    const next = RANKINGS_TABS[nextIndex];
    select(next.id);
    buttons.current[nextIndex]?.focus();
  };

  return (
    <div className="mx-auto w-full max-w-[980px] px-[var(--space-3)] pb-[var(--space-6)] pt-[var(--space-3)]">
      <div
        role="tablist"
        aria-label="Classements, légendes, sommets, défis, trophées et pairs"
        onKeyDown={onKeyDown}
        className="mb-[var(--space-4)] flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {RANKINGS_TABS.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`rankings-tab-${tab.id}`}
              aria-selected={selected}
              aria-label={tab.label}
              aria-controls={`rankings-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(tab.id)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-[length:var(--lkv-text-caption)] font-semibold transition-[transform,background-color] duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] ${
                selected
                  ? 'border-[color:var(--glass-rim)] bg-[color:var(--g3-bg)] text-[color:var(--g3-text)]'
                  : 'border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] text-[color:var(--glass-label-secondary)] hover:bg-[color:var(--lkv-hover-surface)]'
              }`}
            >
              <Icon name={tab.icon} size={16} />
              <span className="md:hidden">{tab.shortLabel}</span>
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`rankings-panel-${active}`}
        aria-labelledby={`rankings-tab-${active}`}
        tabIndex={0}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
      >
        {authLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" label="Vérification de la session" />
          </div>
        ) : PERSONAL_TABS.has(active) && !user ? (
          <RankingsCard>
            <RankingsEmpty
              icon="lock"
              title="Connectez-vous pour cette preuve"
              description="Vos sommets, vos trophées et vos comparaisons sont personnels. Sans session, nous ne pouvons ni les vérifier ni les afficher."
              actionLabel="Se connecter"
              actionHref="/connexion"
            />
          </RankingsCard>
        ) : (
          <PanelFor tab={active} />
        )}
      </div>

      <div className="mt-[var(--space-4)]">
        <InlineNotice tone="privacy">
          Classements, Local Legends et comparaisons appliquent le même filtre : activité
          publique, validée, compte non bloqué et non opposé. Les données absentes restent
          absentes.{' '}
          <Link href="/politique-confidentialite" className="underline underline-offset-2">
            Politique de confidentialité
          </Link>
        </InlineNotice>
      </div>
    </div>
  );
}

export default RankingsHub;
