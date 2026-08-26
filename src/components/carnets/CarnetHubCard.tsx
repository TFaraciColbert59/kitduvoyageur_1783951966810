'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import GlassIconButton from '@/components/ui/GlassIconButton';

export interface CarnetItem {
  id: string;
  author_id?: string;
  title: string;
  destination?: string;
  description?: string;
  cover_image?: string;
  cover_image_alt?: string;
  start_date?: string | null;
  end_date?: string | null;
  weather?: string;
  route_rating?: number;
  visibility?: 'public' | 'private' | 'friends';
  tags?: string[];
  likes_count?: number;
  comments_count?: number;
  favorites_count?: number;
  views_count?: number;
  verified?: boolean;
  created_at?: string;
  distance_km?: number;
  elevation_m?: number;
  duration?: string;
  author?: {
    full_name?: string;
    avatar_url?: string;
    trust_score?: number;
  };
  user_liked?: boolean;
  user_favorited?: boolean;
  user_reaction?: string;
}

interface CarnetHubCardProps {
  carnet: CarnetItem | any;
  currentUserId?: string;
  onLike?: (carnet: any, reaction: string) => void;
  onFavorite?: (carnet: any) => void;
  onShare?: (carnet: any) => void;
}

// Heart SVG Icon helper for crisp rendering
function HeartSvg({ filled = false, className = '' }: { filled?: boolean; className?: string }) {
  if (filled) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`w-3.5 h-3.5 text-rose-500 transition-transform duration-200 scale-110 ${className}`}
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-3.5 h-3.5 text-[#17402C] hover:text-rose-600 transition-colors ${className}`}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

export default function CarnetHubCard({
  carnet,
  onLike,
  onFavorite,
  onShare,
}: CarnetHubCardProps) {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(Boolean(carnet.user_liked));
  const [likesCount, setLikesCount] = useState(carnet.likes_count || 18);
  const [isSaved, setIsSaved] = useState(Boolean(carnet.user_favorited));

  const fallbackImage = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000&auto=format&fit=crop';
  const coverUrl = carnet.cover_image && carnet.cover_image.trim() !== '' ? carnet.cover_image : fallbackImage;

  const dateStr = carnet.start_date
    ? new Date(carnet.start_date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    : carnet.created_at
    ? new Date(carnet.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    : 'Automne 2026';

  const destinationStr = carnet.destination || 'Massif Alpin';
  const authorName = carnet.author?.full_name || 'Explorateur';
  const avatarUrl = carnet.author?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200';

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(carnet.author_id ? `/profil/${carnet.author_id}` : '/communaute');
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    setLikesCount((prev: number) => newLiked ? prev + 1 : Math.max(0, prev - 1));
    if (onLike) onLike(carnet, 'heart');
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSaved(!isSaved);
    if (onFavorite) onFavorite(carnet);
  };

  const carnetHref = `/carnets/${carnet.id || encodeURIComponent(carnet.title)}`;

  return (
    <Link
      href={carnetHref}
      className="glass bg-white/90 backdrop-blur-xl rounded-2xl overflow-hidden flex flex-col group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-white relative cursor-pointer"
    >
      {/* Cover Image Container */}
      <div className="w-full aspect-[16/10] relative overflow-hidden bg-[#17402C]">
        <img
          src={coverUrl}
          alt={carnet.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
          <span className="glass-pill px-2.5 py-1 text-[9.5px] font-mono font-bold text-white bg-black/40 backdrop-blur-md border-white/20 flex items-center gap-1">
            📍 {destinationStr}
          </span>
          <span className="glass-pill px-2 py-1 text-[9.5px] font-mono text-white bg-black/40 backdrop-blur-md border-white/20">
            {dateStr}
          </span>
        </div>

        {/* Top Right Save Action with Image 3 GlassIconButton */}
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <GlassIconButton
            size="sm"
            active={isSaved}
            activeClassName="!bg-amber-400 !text-amber-950 !border-amber-300"
            onClick={handleSaveClick}
            title={isSaved ? "Retirer des favoris" : "Enregistrer dans mes favoris"}
            icon={<Icon name={isSaved ? 'BookmarkSolidIcon' : 'BookmarkIcon'} size={13} />}
          />
        </div>

        {/* Metrics overlay on bottom of image */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white text-[10.5px] font-mono">
          <div className="flex items-center gap-2">
            {carnet.distance_km && <span>📏 {carnet.distance_km} km</span>}
            {carnet.elevation_m && <span>⛰️ +{carnet.elevation_m} m</span>}
          </div>
          {carnet.route_rating && (
            <span className="font-bold text-amber-300">★ {carnet.route_rating}/10</span>
          )}
        </div>
      </div>

      {/* Body Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          <h3 className="font-display font-bold text-base text-[#17402C] leading-snug group-hover:text-emerald-800 transition-colors line-clamp-2">
            {carnet.title}
          </h3>

          {carnet.description && (
            <p className="text-xs text-[#5C6B5E] line-clamp-2 leading-relaxed">
              {carnet.description}
            </p>
          )}
        </div>

        {/* Tags */}
        {carnet.tags && Array.isArray(carnet.tags) && carnet.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {carnet.tags.slice(0, 3).map((t: string) => (
              <span key={t} className="text-[9px] font-mono font-bold text-[#17402C] bg-[#17402C]/5 px-2 py-0.5 rounded-md">
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Footer info: Author & Circular Icon Buttons without text */}
        <div className="pt-2.5 border-t border-[#17402C]/10 flex items-center justify-between gap-2 text-xs">
          <div
            onClick={handleAuthorClick}
            className="flex items-center gap-2 min-w-0 group/author cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img
              src={avatarUrl}
              alt={authorName}
              className="w-6 h-6 rounded-full object-cover border border-[#17402C]/15 shrink-0 group-hover/author:scale-105 transition-transform"
            />
            <span className="font-bold text-xs text-[#17402C] truncate group-hover/author:underline">{authorName}</span>
          </div>

          <div className="flex items-center gap-2">
            <GlassIconButton
              size="sm"
              active={isLiked}
              count={likesCount}
              onClick={handleLikeClick}
              title="J'aime ce récit"
              icon={<HeartSvg filled={isLiked} />}
            />

            <GlassIconButton
              size="sm"
              title="Lire le carnet d'expédition"
              icon={<Icon name="ArrowRightIcon" size={13} />}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
