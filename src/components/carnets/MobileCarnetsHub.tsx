'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import MobileCarnetCard, { MobileCarnetItem } from '@/components/carnets/MobileCarnetCard';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

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
      alert('Lien du carnet copié dans le presse-papier !');
    }
  };

  return (
    <div className="w-full min-h-screen bg-transparent pb-36 relative font-sans text-[#17402C]">
      {/* Pull to refresh visual indicator */}
      {(pullProgress > 0 || isRefreshing) && (
        <div
          className="w-full flex items-center justify-center py-2 transition-all overflow-hidden"
          style={{ height: isRefreshing ? '44px' : `${Math.min(pullProgress * 44, 44)}px` }}
        >
          <div className="flex items-center gap-2 px-3 py-1 rounded-full glass-pill text-xs font-medium text-[#17402C] shadow-2xs">
            <div
              className={`w-3.5 h-3.5 rounded-full border-2 border-[#17402C] border-t-transparent ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
            <span className="text-[11px] font-mono">
              {isRefreshing ? 'Actualisation...' : 'Tirer pour rafraîchir'}
            </span>
          </div>
        </div>
      )}

      {/* Top Search & Actions Bar */}
      <div className="px-3.5 pt-3 pb-1 space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Search Bar Capsule */}
          <div className="relative flex-1 flex items-center">
            <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3.5 text-[#5A7064] z-10" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un massif, trek, auteur..."
              className="glass w-full pl-9 pr-8 py-2 rounded-full text-xs text-[#17402C] placeholder-[#5A7064] border border-white/80 bg-white/80 focus:outline-none focus:ring-1 focus:ring-[#17402C] shadow-2xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 text-[#5A7064] text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onOpenCreateModal();
            }}
            className="glass-capsule-btn primary !py-1.5 !px-3 !text-xs !font-bold flex items-center gap-1 shrink-0"
          >
            <span>➕</span>
            <span>Écrire</span>
          </button>
        </div>

        {/* Destination filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {DESTINATIONS.map((dest) => {
            const isSelected = selectedDestination === dest;
            return (
              <button
                key={dest}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedDestination(dest);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                    : 'bg-white/80 hover:bg-white text-[#17402C] border-white/70 shadow-2xs'
                }`}
              >
                <span>{dest}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Carnets List */}
      <div className="px-3.5 space-y-3 pt-1">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass p-4 rounded-3xl animate-pulse space-y-3 bg-white/70">
                <div className="w-full h-44 bg-[#17402C]/10 rounded-2xl" />
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#17402C]/10" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-32 h-3.5 bg-[#17402C]/10 rounded" />
                    <div className="w-20 h-2.5 bg-[#17402C]/5 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredCarnets.length === 0 ? (
          <div className="py-12 text-center glass bg-white/80 p-6 rounded-3xl space-y-3 border border-white">
            <span className="text-3xl block">📖</span>
            <h3 className="font-display font-bold text-[#17402C] text-sm">
              {tab === 'mes-carnets' ? 'Vous n’avez publié aucun carnet' : 'Aucun carnet trouvé'}
            </h3>
            <p className="text-xs text-[#5C6B5E] max-w-xs mx-auto leading-relaxed">
              {tab === 'mes-carnets'
                ? 'Partagez votre première aventure et inspirez la communauté.'
                : 'Essayez un autre mot-clé ou filtre de destination.'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="glass-capsule-btn primary !min-h-[38px] !py-2 !px-5 !text-xs !font-bold"
              >
                <span>+ Rédiger un carnet</span>
              </button>
            </div>
          </div>
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
