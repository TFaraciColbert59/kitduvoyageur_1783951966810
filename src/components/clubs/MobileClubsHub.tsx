'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import MobileClubCard, { ClubCardItem } from '@/components/clubs/MobileClubCard';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

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
    <div className="w-full min-h-full bg-transparent pb-6 relative font-sans text-[#17402C]">
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
              placeholder="Rechercher un club, massif, pratique..."
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
            <span>Créer</span>
          </button>
        </div>

        {/* Category filter chips in Liquid Glass */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedCategory(cat);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                    : 'bg-white/80 hover:bg-white text-[#17402C] border-white/70 shadow-2xs'
                }`}
              >
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Clubs List */}
      <div className="px-3.5 space-y-3 pt-1">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass p-4 rounded-3xl animate-pulse space-y-3 bg-white/70">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#17402C]/10" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-32 h-3.5 bg-[#17402C]/10 rounded" />
                    <div className="w-20 h-2.5 bg-[#17402C]/5 rounded" />
                  </div>
                </div>
                <div className="w-full h-10 bg-[#17402C]/5 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredClubs.length === 0 ? (
          <div className="py-12 text-center glass bg-white/80 p-6 rounded-3xl space-y-3 border border-white">
            <span className="text-3xl block">🏕️</span>
            <h3 className="font-display font-bold text-[#17402C] text-sm">
              {tab === 'mes-clubs' ? 'Vous n’avez rejoint aucun club' : 'Aucun club trouvé'}
            </h3>
            <p className="text-xs text-[#5C6B5E] max-w-xs mx-auto leading-relaxed">
              {tab === 'mes-clubs'
                ? 'Explorez les clubs disponibles et rejoignez votre premier collectif d’aventuriers.'
                : 'Essayez un autre mot-clé ou créez votre propre club.'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="glass-capsule-btn primary !min-h-[38px] !py-2 !px-5 !text-xs !font-bold"
              >
                <span>+ Créer un club</span>
              </button>
            </div>
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
