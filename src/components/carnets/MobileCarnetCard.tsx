'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import GlassIconButton from '@/components/ui/GlassIconButton';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface MobileCarnetItem {
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
  author?: { full_name: string; avatar_url?: string; trust_score?: number };
  user_liked?: boolean;
  user_favorited?: boolean;
}

interface MobileCarnetCardProps {
  carnet: MobileCarnetItem;
  onLike?: (id: string, liked: boolean) => Promise<void> | void;
  onFavorite?: (id: string, favorited: boolean) => Promise<void> | void;
  onShare?: (carnet: MobileCarnetItem) => void;
}

export default function MobileCarnetCard({
  carnet,
  onLike,
  onFavorite,
  onShare,
}: MobileCarnetCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const carnetHref = `/carnets/${carnet.id}`;

  const dateRangeStr = useMemoDateRange(carnet.start_date, carnet.end_date);

  return (
    <div className="glass rounded-3xl p-4 border border-white/60 shadow-xs flex flex-col justify-between space-y-3 relative transition-all active:scale-[0.99]">
      {/* Cover Image & Destination Tag */}
      <Link
        href={carnetHref}
        onClick={() => triggerHaptic('light')}
        className="relative w-full h-44 rounded-2xl overflow-hidden bg-[#17402C] block group"
      >
        <img
          src={carnet.cover_image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80'}
          alt={carnet.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#17402C]/80 via-transparent to-black/30" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
          <span className="glass-pill text-white border-white/30 font-mono text-[9.5px] bg-black/40 backdrop-blur-md">
            📍 {carnet.destination || 'Massif & Randonnée'}
          </span>

          {carnet.route_rating !== undefined && (
            <span className="glass-pill text-amber-200 border-amber-300/30 font-mono font-bold text-[9.5px] bg-black/40 backdrop-blur-md">
              ★ {carnet.route_rating}/10
            </span>
          )}
        </div>

        {/* Bottom Title on Image */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10">
          {dateRangeStr && (
            <span className="text-[9.5px] font-mono text-emerald-200 uppercase tracking-widest block mb-0.5 font-bold">
              {dateRangeStr}
            </span>
          )}
          <h3 className="font-display font-bold text-base text-white leading-snug line-clamp-2">
            {carnet.title}
          </h3>
        </div>
      </Link>

      {/* Author & Description */}
      <div className="space-y-2">
        <Link
          href={carnet.author_id ? `/profil/${carnet.author_id}` : '/communaute'}
          onClick={() => triggerHaptic('light')}
          className="flex items-center gap-2.5 group/author cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-[#17402C] text-white flex items-center justify-center font-serif italic text-xs font-bold shadow-2xs overflow-hidden shrink-0 group-hover/author:scale-105 transition-transform">
            {carnet.author?.avatar_url ? (
              <img src={carnet.author.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              carnet.author?.full_name?.charAt(0) || '👤'
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-xs text-[#17402C] truncate group-hover/author:underline">
              {carnet.author?.full_name || 'Voyageur passionné'}
            </h4>
            <p className="text-[9.5px] font-mono text-[#5C6B5E]">Récit de terrain vérifié</p>
          </div>
        </Link>

        {carnet.description && (
          <p className="text-xs text-[#5C6B5E] line-clamp-2 leading-relaxed pl-1">
            {carnet.description}
          </p>
        )}
      </div>

      {/* Footer: Stats & Liquid Glass Buttons */}
      <div className="pt-2.5 border-t border-[#17402C]/10 flex items-center justify-between">
        {/* Left: Like & Bookmark Image 3 buttons */}
        <div className="flex items-center gap-1.5">
          <GlassIconButton
            size="sm"
            onClick={() => {
              triggerHaptic('selection');
              if (onLike) onLike(carnet.id, !carnet.user_liked);
            }}
            title="Aimer ce carnet"
            count={carnet.likes_count || 0}
            active={carnet.user_liked}
            activeClassName="!bg-rose-50 !border-rose-200 !text-rose-600"
            icon={
              <Icon
                name="HeartIcon"
                size={13}
                className={carnet.user_liked ? 'text-rose-600 fill-rose-600' : ''}
              />
            }
          />

          <GlassIconButton
            size="sm"
            onClick={() => {
              triggerHaptic('selection');
              if (onFavorite) onFavorite(carnet.id, !carnet.user_favorited);
            }}
            title="Enregistrer dans ma collection"
            active={carnet.user_favorited}
            activeClassName="!bg-amber-50 !border-amber-200 !text-amber-700"
            icon={
              <Icon
                name="BookmarkIcon"
                size={13}
                className={carnet.user_favorited ? 'text-amber-700 fill-amber-700' : ''}
              />
            }
          />

          <GlassIconButton
            size="sm"
            onClick={() => {
              triggerHaptic('light');
              if (onShare) onShare(carnet);
            }}
            title="Partager"
            icon={<Icon name="ShareIcon" size={13} />}
          />
        </div>

        {/* Right: Open Carnet Liquid Glass button */}
        <Link
          href={carnetHref}
          onClick={() => triggerHaptic('light')}
          className="glass-capsule-btn !min-h-[34px] !py-1 !px-3.5 !text-xs !gap-1.5 !font-bold"
        >
          <span>Lire le récit</span>
          <Icon name="ArrowRightIcon" size={12} />
        </Link>
      </div>
    </div>
  );
}

function useMemoDateRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const d1 = new Date(start);
  const d1Str = d1.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  if (!end) return d1Str;
  const d2 = new Date(end);
  const d2Str = d2.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `${d1Str} – ${d2Str}`;
}
