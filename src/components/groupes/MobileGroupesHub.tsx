'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import CommunityHubNav from '@/components/social/CommunityHubNav';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface TravelGroup {
  id: string;
  name: string;
  description: string;
  destination: string;
  theme: string;
  visibility: string;
  invite_code?: string;
  max_members: number;
  departure_date?: string | null;
  return_date?: string | null;
  budget_target?: number;
  member_count?: number;
  my_role?: string;
  owner?: { full_name: string; avatar_url?: string } | null;
}

interface MobileGroupesHubProps {
  myGroups: TravelGroup[];
  publicGroups: TravelGroup[];
  loading: boolean;
  user: any;
  onJoinGroup: (groupId: string) => Promise<void>;
  onOpenCreateModal: () => void;
  onOpenJoinByCode: () => void;
}

const THEMES = ['Tout', 'Trek', 'Van Life', 'Randonnée', 'Bivouac', 'Photo', 'Expédition', 'Ski', 'Vélo'];
const THEME_EMOJI: Record<string, string> = {
  Tout: '🏕️', Trek: '🏔️', 'Van Life': '🚐', Randonnée: '🥾', Bivouac: '⛺', Photo: '📷',
  Expédition: '🧭', Ski: '⛷️', Vélo: '🚴',
};

export default function MobileGroupesHub({
  myGroups,
  publicGroups,
  loading,
  user,
  onJoinGroup,
  onOpenCreateModal,
  onOpenJoinByCode,
}: MobileGroupesHubProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [tab, setTab] = useState<'mes-groupes' | 'decouvrir'>('mes-groupes');
  const [search, setSearch] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('Tout');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const activeGroups = tab === 'mes-groupes' ? myGroups : publicGroups;

  const filteredGroups = useMemo(() => {
    return activeGroups.filter(g => {
      const matchSearch = !search.trim() || 
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

  return (
    <div className="w-full min-h-screen bg-[#FBFAF6] pb-28 text-[#1C2620]">
      {/* ── TOP HEADER (Dark Forest Minimalist) ── */}
      <div className="bg-gradient-to-b from-[#143224] via-[#10271C] to-[#0A1A13] text-white pt-4 pb-5 px-4 rounded-b-[28px] shadow-[0_8px_24px_rgba(11,31,23,0.12)]">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#85DDA2] animate-pulse" />
            <span className="text-[11px] font-mono tracking-wider uppercase text-[#A8C4A2] font-semibold">
              Expéditions ({publicGroups.length + myGroups.length})
            </span>
          </div>

          <button
            onClick={() => {
              triggerHaptic('light');
              onOpenJoinByCode();
            }}
            className="text-[11px] font-medium text-[#A8C4A2] hover:text-white transition-colors flex items-center gap-1 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full"
          >
            <span>🔑</span>
            <span>Code secret</span>
          </button>
        </div>

        {/* Title */}
        <div className="mb-3.5">
          <h1 className="font-display font-bold text-2xl tracking-tight leading-tight">
            Partir ensemble,<br />
            <em className="font-serif italic font-normal text-[#A8C4A2]">partager l'aventure.</em>
          </h1>
          <p className="text-[11.5px] text-white/70 mt-1 leading-relaxed">
            Organisation du matériel, budget partagé et cockpit en temps réel.
          </p>
        </div>

        {/* Search Bar + Create Action */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative flex items-center bg-white/10 backdrop-blur-md border border-white/12 rounded-2xl px-3 py-2">
            <Icon name="MagnifyingGlassIcon" size={14} className="text-white/60 mr-2 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une expédition, un massif..."
              className="w-full bg-transparent border-none text-xs text-white placeholder-white/40 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-white/60 text-xs px-1">✕</button>
            )}
          </div>

          <button
            onClick={() => {
              triggerHaptic('selection');
              onOpenCreateModal();
            }}
            className="px-3.5 py-2 bg-[#85DDA2] text-[#0A1A13] rounded-2xl text-xs font-bold shrink-0 shadow-sm hover:bg-white transition-all flex items-center gap-1 active:scale-95"
          >
            <span className="text-sm">+</span>
            <span>Créer</span>
          </button>
        </div>
      </div>

      {/* ── SEGMENTED TAB SWITCHER ── */}
      <div className="px-4 pt-3.5">
        <div className="flex items-center bg-[#EFECE3] p-1 rounded-2xl border border-[#1C2620]/6">
          <button
            onClick={() => {
              triggerHaptic('selection');
              setTab('mes-groupes');
            }}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tab === 'mes-groupes'
                ? 'bg-white text-[#143224] shadow-sm'
                : 'text-[#5C6B5E] hover:text-[#1C2620]'
            }`}
          >
            Mes groupes ({myGroups.length})
          </button>
          <button
            onClick={() => {
              triggerHaptic('selection');
              setTab('decouvrir');
            }}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tab === 'decouvrir'
                ? 'bg-white text-[#143224] shadow-sm'
                : 'text-[#5C6B5E] hover:text-[#1C2620]'
            }`}
          >
            Explorer ({publicGroups.length})
          </button>
        </div>
      </div>

      {/* ── THEME FILTER PILLS ── */}
      <div
        className="px-4 pt-2.5 overflow-x-auto flex items-center gap-1.5"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {THEMES.map((th) => {
          const isSelected = selectedTheme === th;
          return (
            <button
              key={th}
              onClick={() => {
                triggerHaptic('light');
                setSelectedTheme(th);
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all flex items-center gap-1 shrink-0 ${
                isSelected
                  ? 'bg-[#143224] text-white shadow-sm font-bold'
                  : 'bg-white text-[#5C6B5E] border border-[#1C2620]/8 hover:bg-[#F5F2E8]'
              }`}
            >
              <span>{THEME_EMOJI[th] || '🎒'}</span>
              <span>{th}</span>
            </button>
          );
        })}
      </div>

      {/* ── GROUPS FEED (Instagram / LKDV Style) ── */}
      <div className="px-4 pt-3.5 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-[#1C2620]/6 animate-pulse space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gray-200" />
                  <div className="space-y-1 flex-1">
                    <div className="w-32 h-3.5 bg-gray-200 rounded" />
                    <div className="w-20 h-2.5 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="w-full h-8 bg-gray-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-2xl p-6 border border-[#1C2620]/6">
            <span className="text-3xl block mb-1">🏕️</span>
            <h3 className="font-bold text-[#1C2620] text-xs">
              {tab === 'mes-groupes' ? 'Aucune expédition en cours' : 'Aucun groupe trouvé'}
            </h3>
            <p className="text-[11px] text-[#5C6B5E] mt-0.5 max-w-xs mx-auto">
              {tab === 'mes-groupes'
                ? 'Créez votre première expédition entre amis ou rejoignez un groupe public.'
                : 'Essayez un autre mot-clé ou lancez votre projet.'}
            </p>
            <button
              onClick={onOpenCreateModal}
              className="mt-3 px-4 py-2 bg-[#143224] text-white rounded-xl text-xs font-bold shadow-sm"
            >
              + Créer un groupe
            </button>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isMember = tab === 'mes-groupes' || myGroups.some((mg) => mg.id === group.id);

            return (
              <div
                key={group.id}
                className="bg-white rounded-[20px] p-3.5 border border-[#1C2620]/6 shadow-[0_1px_6px_rgba(11,31,23,0.03)] hover:border-[#143224]/20 transition-all flex flex-col gap-2.5"
              >
                {/* Top Row: Avatar + Title + Badge */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#FAF9F5] border border-[#1C2620]/10 flex items-center justify-center text-xl shrink-0 shadow-sm">
                      {THEME_EMOJI[group.theme] || '🎒'}
                    </div>

                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-[#1C2620] truncate">
                        {group.name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#5C6B5E] font-mono mt-0.5">
                        {group.destination && (
                          <span className="text-[#143224] font-semibold truncate">
                            📍 {group.destination}
                          </span>
                        )}
                        {group.destination && <span>·</span>}
                        <span>{group.theme || 'Voyage'}</span>
                      </div>
                    </div>
                  </div>

                  {group.my_role ? (
                    <span className="px-2 py-0.5 bg-[#FAF9F5] text-[#143224] border border-[#143224]/10 rounded-full text-[9px] font-mono font-bold shrink-0">
                      {group.my_role === 'organizer' ? '👑 Leader' : 'Membre'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-[#F5F2E8] text-[#5C6B5E] rounded-full text-[9px] font-mono font-semibold shrink-0">
                      Public
                    </span>
                  )}
                </div>

                {/* Description */}
                {group.description && (
                  <p className="text-[11.5px] text-[#1C2620]/80 line-clamp-2 leading-relaxed pl-1">
                    {group.description}
                  </p>
                )}

                {/* Bottom Bar: Members + CTA */}
                <div className="flex items-center justify-between pt-2 border-t border-[#1C2620]/6">
                  <div className="flex items-center gap-1 text-[11px] text-[#5C6B5E] font-mono">
                    <span>👥</span>
                    <span className="font-bold text-[#1C2620]">{group.member_count || 1}</span>
                    <span className="text-[10px] text-[#5C6B5E]">/ {group.max_members || 12}</span>
                  </div>

                  {isMember ? (
                    <Link
                      href={`/groupes/${group.id}`}
                      className="px-3.5 py-1.5 bg-[#143224] text-white rounded-xl text-xs font-bold hover:bg-[#0A1A13] transition-colors shadow-sm active:scale-95"
                    >
                      Cockpit →
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleJoin(group.id)}
                      disabled={joiningId === group.id}
                      className="px-3.5 py-1.5 bg-[#143224] text-white rounded-xl text-xs font-bold hover:bg-[#0A1A13] transition-colors shadow-sm disabled:opacity-50 active:scale-95"
                    >
                      {joiningId === group.id ? 'Inscription...' : 'Rejoindre'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sticky Bottom Community Navigation */}
      <CommunityHubNav activeTab="groupes" />
    </div>
  );
}

