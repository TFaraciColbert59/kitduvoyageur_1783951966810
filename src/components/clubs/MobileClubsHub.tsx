'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import MoreMenuSheet from '@/components/social/MoreMenuSheet';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface ClubItem {
  id: string;
  slug?: string;
  name: string;
  type?: string;
  emoji?: string;
  description: string;
  cover_image?: string;
  category?: string;
  members_count: number;
  active_this_month?: number;
  is_verified?: boolean;
  is_member?: boolean;
}

interface MobileClubsHubProps {
  clubs: ClubItem[];
  myClubs: ClubItem[];
  loading: boolean;
  user: any;
  onJoinClub: (clubId: string) => Promise<void>;
  onOpenCreateModal: () => void;
}

export default function MobileClubsHub({
  clubs,
  myClubs,
  loading,
  user,
  onJoinClub,
  onOpenCreateModal,
}: MobileClubsHubProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [tab, setTab] = useState<'decouvrir' | 'mes-clubs'>('decouvrir');
  const [search, setSearch] = useState('');
  const [selectedClub, setSelectedClub] = useState<ClubItem | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const activeClubs = tab === 'mes-clubs' ? myClubs : clubs;

  const filteredClubs = useMemo(() => {
    return activeClubs.filter(c => {
      return (
        !search.trim() ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.description?.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [activeClubs, search]);

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
    <div className="w-full min-h-screen bg-[#FBFAF6] pb-28">
      {/* Instagram-grade Hero Glass Header */}
      <div className="relative px-5 pt-6 pb-6 bg-gradient-to-b from-[#17402C] via-[#1E5238] to-[#122E20] text-white rounded-b-[36px] shadow-[0_12px_40px_rgba(23,64,44,0.25)] border-b border-white/10 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#A8C4A2]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between gap-3 mb-3 relative z-10">
          <span className="px-3.5 py-1 bg-white/15 backdrop-blur-xl rounded-full text-[10px] font-bold tracking-widest uppercase text-[#A8C4A2] border border-white/20 shadow-sm">
            🏕️ Clubs & Collectifs
          </span>
          <span className="text-[11px] font-mono font-medium text-white/80 bg-black/20 px-2.5 py-0.5 rounded-full backdrop-blur-md">
            {clubs.length} clubs
          </span>
        </div>

        <h1 className="font-display font-bold text-2xl sm:text-3xl leading-tight tracking-tight relative z-10 text-white drop-shadow-sm">
          Partager l'aventure,<br />
          <em className="font-serif italic font-normal text-[#A8C4A2]">en communauté active.</em>
        </h1>

        {/* Create Club Action Button */}
        <div className="mt-5 relative z-10">
          <button
            onClick={() => {
              triggerHaptic('selection');
              onOpenCreateModal();
            }}
            className="w-full relative overflow-hidden group py-3 px-4 bg-white/20 hover:bg-white/30 active:scale-[0.98] backdrop-blur-xl text-white rounded-2xl text-xs font-bold shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-white/40 flex items-center justify-center gap-2 transition-all"
          >
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
            <span className="text-base font-bold">＋</span>
            <span className="tracking-wide">Créer mon propre club</span>
          </button>
        </div>
      </div>

      {/* Segment Switch (Découvrir / Mes Clubs) */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex bg-[#EAE6DF]/70 p-1.5 rounded-2xl border border-[#1C2620]/5 backdrop-blur-md">
          <button
            onClick={() => {
              triggerHaptic('selection');
              setTab('decouvrir');
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              tab === 'decouvrir'
                ? 'bg-white text-[#17402C] shadow-[0_2px_8px_rgba(23,64,44,0.1)]'
                : 'text-[#5C6B5E] hover:text-[#1C2620]'
            }`}
          >
            Découvrir ({clubs.length})
          </button>
          <button
            onClick={() => {
              triggerHaptic('selection');
              setTab('mes-clubs');
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              tab === 'mes-clubs'
                ? 'bg-white text-[#17402C] shadow-[0_2px_8px_rgba(23,64,44,0.1)]'
                : 'text-[#5C6B5E] hover:text-[#1C2620]'
            }`}
          >
            Mes clubs ({myClubs.length})
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="relative mt-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par massif, région, sport..."
            className="w-full bg-white border border-[#1C2620]/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#1C2620] placeholder-[#5C6B5E]/60 focus:ring-2 focus:ring-[#17402C] focus:outline-none shadow-sm font-medium"
          />
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5C6B5E]">
            <Icon name="MagnifyingGlassIcon" size={16} />
          </div>
        </div>
      </div>

      {/* Clubs Cards Grid */}
      <div className="px-4 space-y-3.5 mt-2">
        {loading ? (
          <div className="space-y-3.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-3xl p-4 border border-[#1C2620]/5 animate-pulse space-y-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gray-200" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-36 h-4 bg-gray-200 rounded" />
                    <div className="w-24 h-3 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="w-full h-9 bg-gray-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredClubs.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl p-6 border border-[#1C2620]/8 shadow-sm">
            <span className="text-4xl block mb-2">🏕️</span>
            <h3 className="font-bold text-[#1C2620] text-sm">
              {tab === 'mes-clubs' ? 'Vous n’avez pas encore rejoint de club' : 'Aucun club trouvé'}
            </h3>
            <p className="text-xs text-[#5C6B5E] mt-1.5 max-w-xs mx-auto leading-relaxed">
              Participez à des sorties en groupe, partagez des topos et échangez avec les passionnés.
            </p>
            <button
              onClick={onOpenCreateModal}
              className="mt-4 px-5 py-2.5 bg-[#17402C] text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-transform"
            >
              + Fonder mon club
            </button>
          </div>
        ) : (
          filteredClubs.map(club => {
            const isMember = tab === 'mes-clubs' || club.is_member;

            return (
              <article
                key={club.id}
                className="bg-white rounded-[26px] p-4 border border-[#1C2620]/8 shadow-[0_2px_12px_rgba(11,31,23,0.04)] hover:shadow-md transition-all flex flex-col gap-3 relative overflow-hidden"
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Club Story/Emoji Icon */}
                    <div className="w-13 h-13 min-w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-[#17402C]/10 to-[#A8C4A2]/20 border border-[#17402C]/15 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                      {club.emoji || '🏔️'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-display font-bold text-sm sm:text-base text-[#1C2620] truncate">
                          {club.name}
                        </h3>
                        {club.is_verified && (
                          <span className="text-xs text-emerald-600 font-bold" title="Club vérifié">✓</span>
                        )}
                      </div>
                      <p className="text-xs text-[#5C6B5E] font-mono mt-0.5 font-medium flex items-center gap-1">
                        <span>👥 {club.members_count || 1} membres</span>
                        {club.active_this_month ? <span className="text-emerald-700 font-bold">· 🔥 {club.active_this_month} actifs</span> : null}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedClub(club)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#5C6B5E] hover:bg-[#F5F2E8] transition-colors shrink-0"
                    aria-label="Options du club"
                  >
                    <Icon name="EllipsisHorizontalIcon" size={18} />
                  </button>
                </div>

                {club.description && (
                  <p className="text-xs text-[#1C2620]/85 line-clamp-2 leading-relaxed font-normal">
                    {club.description}
                  </p>
                )}

                {/* Footer action button */}
                <div className="flex items-center justify-between pt-2.5 border-t border-[#1C2620]/5">
                  <span className="text-[11px] font-mono text-[#5C6B5E] font-medium bg-[#F5F2E8] px-2.5 py-0.5 rounded-md">
                    {club.category || 'Outdoor & Randonnée'}
                  </span>

                  {isMember ? (
                    <Link
                      href={`/clubs/${club.id}`}
                      className="py-2 px-4 bg-gradient-to-r from-[#17402C] to-[#1E5238] text-white rounded-xl text-xs font-bold shadow-[0_2px_8px_rgba(23,64,44,0.25)] hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <span>Espace Club</span>
                      <span className="text-xs">➔</span>
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleJoin(club.id)}
                      disabled={joiningId === club.id}
                      className="py-2 px-4 bg-[#F5F2E8] hover:bg-[#17402C] hover:text-white text-[#17402C] rounded-xl text-xs font-bold border border-[#17402C]/10 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {joiningId === club.id ? 'Adhésion...' : 'Rejoindre +'}
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Menu sheet */}
      <MoreMenuSheet
        isOpen={!!selectedClub}
        onClose={() => setSelectedClub(null)}
        title={selectedClub?.name}
        onCopyLink={() => {
          if (typeof window !== 'undefined' && selectedClub) {
            navigator.clipboard.writeText(`${window.location.origin}/clubs/${selectedClub.id}`);
          }
        }}
        onShare={() => {
          if (typeof navigator !== 'undefined' && navigator.share && selectedClub) {
            navigator.share({
              title: selectedClub.name,
              text: selectedClub.description,
              url: `${window.location.origin}/clubs/${selectedClub.id}`,
            });
          }
        }}
      />
    </div>
  );
}
