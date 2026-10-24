'use client';

import React, { useState, useMemo, useEffect } from 'react';
import MobileClubCard, { ClubCardItem } from '@/components/clubs/MobileClubCard';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { SearchField, Spinner } from '@/components/ui';

interface MobileClubsHubProps {
  clubs: ClubCardItem[];
  myClubs: ClubCardItem[];
  loading: boolean;
  user: any;
  onJoinClub: (clubId: string) => Promise<void>;
  onOpenCreateModal: () => void;
  onRefresh?: () => Promise<void> | void;
}

const CATEGORIES = ['Tous', 'Trek & Rando', 'Bivouac', 'Alpinisme', 'Vanlife', 'Cyclotourisme', 'Photographie', 'Survie', 'Pays & Régions'];

export default function MobileClubsHub({
  clubs = [],
  myClubs = [],
  loading = false,
  user,
  onJoinClub,
  onOpenCreateModal,
  onRefresh,
}: MobileClubsHubProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [tab, setTab] = useState<'decouvrir' | 'mes-clubs'>('decouvrir');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        setTab(e.detail);
      }
    };
    window.addEventListener('clubs-tab-change', handler);
    return () => window.removeEventListener('clubs-tab-change', handler);
  }, []);

  const { isRefreshing, pullProgress } = usePullToRefresh(async () => {
    if (onRefresh) {
      triggerHaptic('medium');
      await onRefresh();
    }
  });

  const activeClubs = tab === 'mes-clubs' ? myClubs : clubs;

  const filteredClubs = useMemo(() => {
    return activeClubs.filter((c) => {
      const matchSearch =
        !search.trim() ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.description?.toLowerCase().includes(search.toLowerCase());
      const matchCategory =
        selectedCategory === 'Tous' ||
        c.category?.toLowerCase() === selectedCategory.toLowerCase() ||
        (selectedCategory === 'Pays & Régions' && c.type === 'pays');
      return matchSearch && matchCategory;
    });
  }, [activeClubs, search, selectedCategory]);

  const handleJoin = async (clubId: string) => {
    triggerHaptic('selection');
    setJoiningId(clubId);
    try {
      await onJoinClub(clubId);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="lkc lkc-page lkdv-social-discovery lkdv-social-clubs relative min-h-full w-full pb-[var(--space-6)] font-sans text-[color:var(--lkv-text-primary)]">
      {(pullProgress > 0 || isRefreshing) && (
        <div
          className="flex w-full items-center justify-center overflow-hidden py-[var(--space-2)] transition-all motion-reduce:transition-none"
          style={{ height: isRefreshing ? '44px' : `${Math.min(pullProgress * 44, 44)}px` }}
        >
          <div className="flex items-center gap-[var(--space-2)] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] shadow-elevation-1">
            <Spinner size="xs" label="" className={isRefreshing ? '' : 'opacity-0'} />
            <span className="font-mono text-[length:var(--lkv-text-caption-2)]">
              {isRefreshing ? 'Actualisation...' : 'Tirer pour rafraîchir'}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-[var(--space-2)] px-[var(--space-3)] pb-[var(--space-1)] pt-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <SearchField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Rechercher un club, massif, pratique..."
            aria-label="Rechercher un club"
            containerClassName="flex-1"
          />

          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onOpenCreateModal();
            }}
            className="lkc-btn shrink-0"
          >
            <span aria-hidden>＋</span> Créer
          </button>
        </div>

        {/* P2 — fade iOS en fin de rail catégories + plateau = mécanisme unique
            (écoute `clubs-tab-change` conservée : seul fil de pilotage mobile). */}
        <div className="flex items-center gap-[var(--space-1)] overflow-x-auto pb-[2px] pr-[28px] [scrollbar-width:none] [-webkit-mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={isSelected}
                className={`lkc-chip min-h-[44px] px-4 ${isSelected ? 'lkc-chip--sage' : ''}`}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedCategory(cat);
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-[var(--space-3)] px-[var(--space-3)] pt-[var(--space-1)]">
        {loading ? (
          <div className="space-y-[var(--space-3)]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="lkc-skel h-44" />
            ))}
          </div>
        ) : filteredClubs.length === 0 ? (
          <div className="lkc-card lkc-empty">
            <span className="text-3xl" aria-hidden>🏕️</span>
            <h3>{tab === 'mes-clubs' ? 'Vous n’avez rejoint aucun club' : 'Aucun club trouvé'}</h3>
            <p className="lkc-sub text-sm">
              {tab === 'mes-clubs'
                ? 'Explorez les clubs disponibles et rejoignez votre premier collectif d’aventuriers.'
                : 'Essayez un autre mot-clé ou créez votre propre club.'}
            </p>
            <button type="button" className="lkc-btn" onClick={onOpenCreateModal}>Créer un club</button>
          </div>
        ) : (
          filteredClubs.map((club) => {
            const isMember = tab === 'mes-clubs' || myClubs.some((mc) => mc.id === club.id);
            return (
              <MobileClubCard
                key={club.id}
                club={club}
                isMember={isMember}
                onJoin={handleJoin}
                joining={joiningId === club.id}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
