'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import CommunityHubNav from '@/components/social/CommunityHubNav';
import SocialActions from '@/components/social/SocialActions';
import MoreMenuSheet from '@/components/social/MoreMenuSheet';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface CarnetItem {
  id: string;
  author_id: string;
  title: string;
  destination: string;
  description: string;
  cover_image: string;
  start_date: string | null;
  end_date: string | null;
  route_rating?: number;
  visibility: string;
  likes_count: number;
  comments_count: number;
  favorites_count?: number;
  author?: { full_name: string; avatar_url?: string };
  user_liked?: boolean;
  user_favorited?: boolean;
}

interface MobileCarnetsHubProps {
  carnets: CarnetItem[];
  myCarnets: CarnetItem[];
  loading: boolean;
  user: any;
  onLikeCarnet: (carnetId: string, liked: boolean) => Promise<void>;
  onSaveCarnet: (carnetId: string, saved: boolean) => Promise<void>;
  onOpenCreateModal: () => void;
}

export default function MobileCarnetsHub({
  carnets,
  myCarnets,
  loading,
  user,
  onLikeCarnet,
  onSaveCarnet,
  onOpenCreateModal,
}: MobileCarnetsHubProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [tab, setTab] = useState<'explorer' | 'mes-carnets'>('explorer');
  const [search, setSearch] = useState('');
  const [selectedCarnet, setSelectedCarnet] = useState<CarnetItem | null>(null);

  const activeCarnets = tab === 'explorer' ? carnets : myCarnets;

  const filteredCarnets = useMemo(() => {
    return activeCarnets.filter(c => {
      return !search.trim() || 
        c.title.toLowerCase().includes(search.toLowerCase()) || 
        c.destination.toLowerCase().includes(search.toLowerCase());
    });
  }, [activeCarnets, search]);

  return (
    <div className="w-full min-h-screen bg-[#FBFAF6] pb-24">
      {/* Hero Header */}
      <div className="relative px-4 pt-5 pb-4 bg-gradient-to-b from-[#17402C] to-[#122E20] text-white rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-bold tracking-wider uppercase text-[#A8C4A2] border border-white/10">
            📖 Carnets de Terrain
          </span>
          <span className="text-[11px] font-mono text-white/70">
            {carnets.length} récits vérifiés
          </span>
        </div>

        <h1 className="font-display font-bold text-2xl leading-tight">
          L'expérience vécue,<br />
          <em className="font-serif italic font-normal text-[#A8C4A2]">écrite par les marcheurs.</em>
        </h1>

        {/* Create Carnet Quick CTA */}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => {
              triggerHaptic('selection');
              onOpenCreateModal();
            }}
            className="flex-1 py-3 px-4 bg-[#A8C4A2] hover:bg-[#96b88f] text-[#17402C] rounded-2xl text-xs font-bold shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <span>+</span>
            <span>Rédiger un carnet d'expédition</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Switch */}
      <div className="p-4 pb-2">
        <div className="flex bg-black/5 p-1 rounded-2xl">
          <button
            onClick={() => {
              triggerHaptic('selection');
              setTab('explorer');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'explorer' ? 'bg-white text-[#17402C] shadow-sm' : 'text-[#5C6B5E]'
            }`}
          >
            Explorer ({carnets.length})
          </button>
          <button
            onClick={() => {
              triggerHaptic('selection');
              setTab('mes-carnets');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'mes-carnets' ? 'bg-white text-[#17402C] shadow-sm' : 'text-[#5C6B5E]'
            }`}
          >
            Mes carnets ({myCarnets.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par massif, lieu, itinéraire..."
            className="w-full bg-white border border-[#1C2620]/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#1C2620] focus:ring-2 focus:ring-[#17402C]"
          />
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5C6B5E]">
            <Icon name="MagnifyingGlassIcon" size={16} />
          </div>
        </div>
      </div>

      {/* Carnet Cards Grid */}
      <div className="px-3 space-y-3 mt-2">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-3xl p-4 border border-[#1C2620]/5 animate-pulse space-y-3">
                <div className="w-full h-40 bg-gray-200 rounded-2xl" />
                <div className="w-3/4 h-4 bg-gray-200 rounded" />
                <div className="w-1/2 h-3 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : filteredCarnets.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl p-6 border border-[#1C2620]/5">
            <span className="text-3xl">📖</span>
            <h3 className="font-bold text-[#1C2620] text-sm mt-2">
              {tab === 'mes-carnets' ? 'Vous n’avez encore rédigé aucun carnet' : 'Aucun carnet trouvé'}
            </h3>
            <p className="text-xs text-[#5C6B5E] mt-1">
              Partagez vos anecdotes, topos et conseils pour aider les prochains aventuriers.
            </p>
            <button
              onClick={onOpenCreateModal}
              className="mt-4 px-5 py-2 bg-[#17402C] text-white rounded-xl text-xs font-bold shadow-md"
            >
              + Rédiger mon premier carnet
            </button>
          </div>
        ) : (
          filteredCarnets.map(carnet => (
            <article
              key={carnet.id}
              className="bg-white rounded-3xl overflow-hidden border border-[#1C2620]/6 shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              {/* Cover image & location badge */}
              <Link href={`/carnets/${carnet.id}`} className="relative w-full h-44 bg-black/10 overflow-hidden block">
                {carnet.cover_image ? (
                  <img
                    src={carnet.cover_image}
                    alt={carnet.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-[#17402C]/10 flex items-center justify-center text-4xl">
                    🏔️
                  </div>
                )}
                <div className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-bold text-[#1C2620] shadow-sm flex items-center gap-1">
                  <span>📍</span>
                  <span className="truncate max-w-[150px]">{carnet.destination || 'Massif inconnu'}</span>
                </div>
                {carnet.route_rating && (
                  <div className="absolute top-3 right-3 px-2 py-1 bg-[#17402C] text-white rounded-full text-[10px] font-bold shadow-sm">
                    ★ {carnet.route_rating}/10
                  </div>
                )}
              </Link>

              {/* Card Details */}
              <div className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[#17402C]/10 text-[#17402C] flex items-center justify-center font-bold text-[10px] shrink-0">
                      {carnet.author?.full_name?.charAt(0) || '👤'}
                    </div>
                    <span className="text-xs font-semibold text-[#5C6B5E] truncate">
                      {carnet.author?.full_name || 'Voyageur LKDV'}
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedCarnet(carnet)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[#5C6B5E] hover:bg-[#F5F2E8]"
                  >
                    <Icon name="EllipsisHorizontalIcon" size={16} />
                  </button>
                </div>

                <Link href={`/carnets/${carnet.id}`} className="block">
                  <h3 className="font-bold text-sm sm:text-base text-[#1C2620] leading-snug line-clamp-1 hover:text-[#17402C]">
                    {carnet.title}
                  </h3>
                  {carnet.description && (
                    <p className="text-xs text-[#1C2620]/75 line-clamp-2 mt-1 leading-relaxed">
                      {carnet.description}
                    </p>
                  )}
                </Link>

                {/* Standardized Social Actions */}
                <SocialActions
                  contentId={carnet.id}
                  contentType="carnet"
                  likesCount={carnet.likes_count}
                  commentsCount={carnet.comments_count}
                  isLiked={carnet.user_liked}
                  isSaved={carnet.user_favorited}
                  onLike={(liked) => onLikeCarnet(carnet.id, liked)}
                  onSave={(saved) => onSaveCarnet(carnet.id, saved)}
                  onShare={() => {
                    if (typeof navigator !== 'undefined' && navigator.share) {
                      navigator.share({
                        title: carnet.title,
                        text: carnet.description,
                        url: `${window.location.origin}/carnets/${carnet.id}`,
                      });
                    }
                  }}
                  onMore={() => setSelectedCarnet(carnet)}
                />
              </div>
            </article>
          ))
        )}
      </div>

      {/* Menu sheet */}
      <MoreMenuSheet
        isOpen={!!selectedCarnet}
        onClose={() => setSelectedCarnet(null)}
        title={selectedCarnet?.title}
        onCopyLink={() => {
          if (typeof window !== 'undefined' && selectedCarnet) {
            navigator.clipboard.writeText(`${window.location.origin}/carnets/${selectedCarnet.id}`);
          }
        }}
        onShare={() => {
          if (typeof navigator !== 'undefined' && navigator.share && selectedCarnet) {
            navigator.share({
              title: selectedCarnet.title,
              text: selectedCarnet.description,
              url: `${window.location.origin}/carnets/${selectedCarnet.id}`,
            });
          }
        }}
      />
    </div>
  );
}
