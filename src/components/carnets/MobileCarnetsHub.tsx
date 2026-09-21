'use client';
import { lkvAlert } from '@/components/ui/dialogs';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MobileCarnetCard, { MobileCarnetItem } from '@/components/carnets/MobileCarnetCard';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Button, Card, Chip, EmptyState, SearchField, SkeletonCarnetCard, Spinner } from '@/components/ui';

interface MobileCarnetsHubProps {
  carnets: MobileCarnetItem[];
  myCarnets: MobileCarnetItem[];
  loading: boolean;
  user: any;
  onLikeCarnet: (carnetId: string, liked: boolean) => Promise<void>;
  onSaveCarnet: (carnetId: string, saved: boolean) => Promise<void>;
  onOpenCreateModal: () => void;
  onRefresh?: () => Promise<void> | void;
}

const DESTINATIONS = ['Tous', 'Alpes', 'Pyrénées', 'Corse (GR20)', 'Massif Central', 'Vosges', 'Jura', 'International'];

export default function MobileCarnetsHub({
  carnets = [],
  myCarnets = [],
  loading = false,
  user,
  onLikeCarnet,
  onSaveCarnet,
  onOpenCreateModal,
  onRefresh,
}: MobileCarnetsHubProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [tab, setTab] = useState<'explorer' | 'mes-carnets'>('explorer');
  const [search, setSearch] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('Tous');

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        setTab(e.detail);
      }
    };
    window.addEventListener('carnets-tab-change', handler);
    return () => window.removeEventListener('carnets-tab-change', handler);
  }, []);

  const { isRefreshing, pullProgress } = usePullToRefresh(async () => {
    if (onRefresh) {
      triggerHaptic('medium');
      await onRefresh();
    }
  });

  const activeCarnets = tab === 'mes-carnets' ? myCarnets : carnets;

  const filteredCarnets = useMemo(() => {
    return activeCarnets.filter((c) => {
      const matchSearch =
        !search.trim() ||
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.destination.toLowerCase().includes(search.toLowerCase()) ||
        c.description?.toLowerCase().includes(search.toLowerCase());
      const matchDest =
        selectedDestination === 'Tous' ||
        c.destination?.toLowerCase().includes(selectedDestination.toLowerCase()) ||
        (selectedDestination === 'Alpes' && (c.destination?.includes('Mont-Blanc') || c.destination?.includes('Vercors') || c.destination?.includes('Chartreuse')));
      return matchSearch && matchDest;
    });
  }, [activeCarnets, search, selectedDestination]);

  const handleShare = async (carnet: MobileCarnetItem) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: carnet.title,
          text: `Découvrez ce carnet d'expédition : ${carnet.title}`,
          url: `${window.location.origin}/carnets/${carnet.id}`,
        });
      } catch {}
    } else {
      navigator.clipboard?.writeText(`${window.location.origin}/carnets/${carnet.id}`);
      lkvAlert('Lien du carnet copié dans le presse-papier !');
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
            placeholder="Rechercher un massif, trek, auteur..."
            aria-label="Rechercher un carnet"
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
            Écrire
          </Button>
        </div>

        <div className="flex snap-x snap-mandatory items-center gap-[var(--space-1)] overflow-x-auto pb-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {DESTINATIONS.map((dest) => {
            const isSelected = selectedDestination === dest;
            return (
              <Chip
                key={dest}
                selected={isSelected}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedDestination(dest);
                }}
                className="shrink-0 snap-start whitespace-nowrap"
              >
                {dest}
              </Chip>
            );
          })}
          <div className="pointer-events-none h-1 w-3 shrink-0" aria-hidden="true" />
        </div>
      </div>

      <div className="space-y-[var(--space-3)] px-[var(--space-3)] pt-[var(--space-1)]">
        {loading ? (
          <div className="space-y-[var(--space-3)]">
            {[1, 2, 3].map((i) => (
              <SkeletonCarnetCard key={i} />
            ))}
          </div>
        ) : filteredCarnets.length === 0 ? (
          <Card className="p-[var(--space-6)]">
            <EmptyState
              icon={<span className="text-[length:var(--lkv-text-title-sm)]" aria-hidden>📖</span>}
              title={tab === 'mes-carnets' ? 'Vous n’avez publié aucun carnet' : 'Aucun carnet trouvé'}
              description={
                tab === 'mes-carnets'
                  ? 'Partagez votre première aventure et inspirez la communauté.'
                  : 'Essayez un autre mot-clé ou filtre de destination.'
              }
              actionLabel="Rédiger un carnet"
              onAction={onOpenCreateModal}
            />
          </Card>
        ) : (
          filteredCarnets.map((carnet) => (
            <MobileCarnetCard
              key={carnet.id}
              carnet={carnet}
              onLike={onLikeCarnet}
              onFavorite={onSaveCarnet}
              onShare={handleShare}
            />
          ))
        )}
      </div>
    </div>
  );
}
