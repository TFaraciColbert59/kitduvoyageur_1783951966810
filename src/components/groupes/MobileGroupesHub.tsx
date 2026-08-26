'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import GlassIconButton from '@/components/ui/GlassIconButton';
import MobileGroupCard, { TravelGroupItem } from '@/components/groupes/MobileGroupCard';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface MobileGroupesHubProps {
  myGroups: TravelGroupItem[];
  publicGroups: TravelGroupItem[];
  loading: boolean;
  user: any;
  onJoinGroup: (groupId: string) => Promise<void>;
  onOpenCreateModal: () => void;
  onOpenJoinByCode: () => void;
  onRefresh?: () => Promise<void> | void;
}

const THEMES = ['Tout', 'Trek', 'Van Life', 'Randonnée', 'Bivouac', 'Photo', 'Expédition', 'Ski', 'Vélo'];
const THEME_EMOJI: Record<string, string> = {
  Tout: '🏕️', Trek: '🏔️', 'Van Life': '🚐', Randonnée: '🥾', Bivouac: '⛺', Photo: '📷',
  Expédition: '🧭', Ski: '⛷️', Vélo: '🚴',
};

export default function MobileGroupesHub({
  myGroups = [],
  publicGroups = [],
  loading = false,
  user,
  onJoinGroup,
  onOpenCreateModal,
  onOpenJoinByCode,
  onRefresh,
}: MobileGroupesHubProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [tab, setTab] = useState<'mes-groupes' | 'decouvrir'>('mes-groupes');
  const [search, setSearch] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('Tout');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [codeDrawerOpen, setCodeDrawerOpen] = useState(false);
  const [secretCodeInput, setSecretCodeInput] = useState('');

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        setTab(e.detail);
      }
    };
    window.addEventListener('groupes-tab-change', handler);
    return () => window.removeEventListener('groupes-tab-change', handler);
  }, []);

  const { isRefreshing, pullProgress } = usePullToRefresh(async () => {
    if (onRefresh) {
      triggerHaptic('medium');
      await onRefresh();
    }
  });

  const activeGroups = tab === 'mes-groupes' ? myGroups : publicGroups;

  const filteredGroups = useMemo(() => {
    return activeGroups.filter((g) => {
      const matchSearch =
        !search.trim() ||
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        (g.destination && g.destination.toLowerCase().includes(search.toLowerCase()));
      const matchTheme = selectedTheme === 'Tout' || g.theme === selectedTheme;
      return matchSearch && matchTheme;
    });
  }, [activeGroups, search, selectedTheme]);

  const handleJoin = async (groupId: string) => {
    triggerHaptic('selection');
    setJoiningId(groupId);
    try {
      await onJoinGroup(groupId);
    } finally {
      setJoiningId(null);
    }
  };

  const handleSecretCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretCodeInput.trim()) return;
    triggerHaptic('selection');
    setCodeDrawerOpen(false);
    onOpenJoinByCode();
  };

  return (
    <div className="w-full min-h-screen bg-transparent pb-36 relative font-sans text-[#17402C]">
      {/* Pull to refresh visual feedback indicator */}
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
              placeholder="Rechercher une expédition, massif..."
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

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setCodeDrawerOpen(true);
            }}
            className="glass-capsule-btn !py-1.5 !px-2.5 !text-xs !font-bold flex items-center gap-1 shrink-0"
            title="Rejoindre par code secret"
          >
            <span>🔑</span>
          </button>
        </div>

        {/* Theme filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {THEMES.map((th) => {
            const isSelected = selectedTheme === th;
            return (
              <button
                key={th}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedTheme(th);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 border ${
                  isSelected
                    ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                    : 'bg-white/80 hover:bg-white text-[#17402C] border-white/70 shadow-2xs'
                }`}
              >
                <span>{THEME_EMOJI[th] || '🎒'}</span>
                <span>{th}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Groups List */}
      <div className="px-3.5 space-y-3 pt-1">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass p-4 rounded-2xl animate-pulse space-y-3 bg-white/70">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#17402C]/10" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-32 h-3.5 bg-[#17402C]/10 rounded" />
                    <div className="w-20 h-2.5 bg-[#17402C]/5 rounded" />
                  </div>
                </div>
                <div className="w-full h-10 bg-[#17402C]/5 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="py-12 text-center glass bg-white/80 p-6 rounded-3xl space-y-2.5 border border-white">
            <span className="text-3xl block">🏕️</span>
            <h3 className="font-display font-bold text-[#17402C] text-sm">
              {tab === 'mes-groupes' ? 'Aucune expédition en cours' : 'Aucun projet trouvé'}
            </h3>
            <p className="text-xs text-[#5C6B5E] max-w-xs mx-auto leading-relaxed">
              {tab === 'mes-groupes'
                ? 'Lancez votre première aventure avec vos coéquipiers ou rejoignez un départ public.'
                : 'Essayez un autre filtre ou créez votre propre expédition.'}
            </p>
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="inline-block mt-2 glass-circle-btn px-4 py-1.5 text-xs font-bold !bg-[#17402C] !text-white"
            >
              + Créer un groupe
            </button>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isMember = tab === 'mes-groupes' || myGroups.some((mg) => mg.id === group.id);
            return (
              <MobileGroupCard
                key={group.id}
                group={group}
                isMember={isMember}
                onJoin={handleJoin}
                joining={joiningId === group.id}
              />
            );
          })
        )}
      </div>

      {/* ── SECRET CODE MODAL DRAWER (Liquid Glass) ── */}
      <AnimatePresence>
        {codeDrawerOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCodeDrawerOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            {/* Bottom Drawer */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 400 }}
              className="relative w-full max-w-lg glass bg-white/95 backdrop-blur-2xl rounded-t-[32px] p-6 border-t border-white shadow-2xl space-y-4 z-10 text-[#17402C]"
            >
              <div className="w-10 h-1 rounded-full bg-[#17402C]/20 mx-auto" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔑</span>
                  <h3 className="font-display font-bold text-base text-[#17402C]">
                    Rejoindre par Code Secret
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCodeDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-[#5C6B5E] leading-relaxed">
                Entrez le code d'invitation à 6 caractères transmis par l'organisateur de l'expédition.
              </p>

              <form onSubmit={handleSecretCodeSubmit} className="space-y-3">
                <input
                  type="text"
                  required
                  autoFocus
                  value={secretCodeInput}
                  onChange={(e) => setSecretCodeInput(e.target.value.toUpperCase())}
                  placeholder="EX: ALPES-26"
                  className="glass w-full text-center text-lg font-mono font-bold tracking-widest uppercase py-3 rounded-2xl border border-white/80 bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#17402C]"
                />

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-[#17402C] text-white font-bold text-xs shadow-md active:scale-98 transition-transform"
                >
                  Valider et rejoindre l'expédition
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
