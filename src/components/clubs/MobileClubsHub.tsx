'use client';

import React, { useState, useMemo, useEffect } from 'react';
import MobileClubCard, { ClubCardItem } from '@/components/clubs/MobileClubCard';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Button, Card, Chip, EmptyState, SearchField, SkeletonClubCard, Spinner } from '@/components/ui';

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
    <div className="relative min-h-full w-full bg-transparent pb-[var(--space-6)] font-sans text-[color:var(--lkv-text-primary)]">
      {(pullProgress > 0 || isRefreshing) && (
        <div
          className="flex w-full items-center justify-center overflow-hidden py-[var(--space-2)] transition-all motion-reduce:transition-none"
          style={{ height: isRefreshing ? '44px' : `${Math.min(pullProgress * 44, 44)}px` }}
        >
          <div className="flex items-center gap-[var(--space-2)] rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-card)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] shadow-elevation-1">
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

          <Button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onOpenCreateModal();
            }}
            icon={<span aria-hidden>➕</span>}
            className="shrink-0"
          >
            Créer
          </Button>
        </div>

        <div className="flex items-center gap-[var(--space-1)] overflow-x-auto pb-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <Chip
                key={cat}
                selected={isSelected}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedCategory(cat);
                }}
                className="whitespace-nowrap"
              >
                {cat}
              </Chip>
            );
          })}
        </div>
      </div>

      <div className="space-y-[var(--space-3)] px-[var(--space-3)] pt-[var(--space-1)]">
        {loading ? (
          <div className="space-y-[var(--space-3)]">
            {[1, 2, 3].map((i) => (
              <SkeletonClubCard key={i} />
            ))}
          </div>
        ) : filteredClubs.length === 0 ? (
          <Card className="p-[var(--space-6)]">
            <EmptyState
              icon={<span className="text-[length:var(--lkv-text-title-sm)]" aria-hidden>🏕️</span>}
              title={tab === 'mes-clubs' ? 'Vous n’avez rejoint aucun club' : 'Aucun club trouvé'}
              description={
                tab === 'mes-clubs'
                  ? 'Explorez les clubs disponibles et rejoignez votre premier collectif d’aventuriers.'
                  : 'Essayez un autre mot-clé ou créez votre propre club.'
              }
              actionLabel="Créer un club"
              onAction={onOpenCreateModal}
            />
          </Card>
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
