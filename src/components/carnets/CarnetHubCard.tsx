'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Card, IconButton } from '@/components/ui';
import SmartImage from '@/components/ui/SmartImage';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

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

function HeartSvg({ filled = false, className = '' }: { filled?: boolean; className?: string }) {
  if (filled) {
    return (
      <LKDVIcon name="favoris" size={14} className={`h-3.5 w-3.5 scale-125 transition-transform duration-200 motion-reduce:transition-none ${className}`} aria-hidden="true" />
    );
  }
  return (
    <LKDVIcon name="favoris" size={14} className={`h-3.5 w-3.5 opacity-60 transition-opacity hover:opacity-100 ${className}`} aria-hidden="true" />
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
  const [likesCount, setLikesCount] = useState(carnet.likes_count ?? 0);
  const [isSaved, setIsSaved] = useState(Boolean(carnet.user_favorited));

  const coverUrl = carnet.cover_image && carnet.cover_image.trim() !== '' ? carnet.cover_image : null;

  const dateStr = carnet.start_date
    ? new Date(carnet.start_date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    : carnet.created_at
    ? new Date(carnet.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    : '';

  const destinationStr = carnet.destination || '';
  const authorName = carnet.author?.full_name || 'Auteur non renseigné';
  const avatarUrl = carnet.author?.avatar_url || null;

  const handleAuthorClick = (e: React.MouseEvent | React.KeyboardEvent) => {
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
      className="group relative block h-full"
    >
      <Card className="flex h-full flex-col overflow-hidden p-0 transition-transform [transition-duration:var(--motion-control-duration)] group-hover:-translate-y-1 group-hover:shadow-elevation-3 motion-reduce:transition-none">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[color:var(--btn-tint)]">
          {coverUrl ? (
            <SmartImage
              src={coverUrl}
              alt={carnet.title}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[length:var(--lkv-text-title-lg)] text-[color:var(--lkv-text-inverted)]/70" aria-hidden>📖</div>
          )}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

          <div className="pointer-events-none absolute left-[var(--space-3)] top-[var(--space-3)] flex flex-wrap items-center gap-[var(--space-1)]">
            {destinationStr && (
              <Badge className="border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] border saturate-[var(--btn-saturate)] lkv-rim-btn font-mono font-bold text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--btn-blur)]">
                📍 {destinationStr}
              </Badge>
            )}
            {dateStr && (
              <Badge className="border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] border saturate-[var(--btn-saturate)] lkv-rim-btn font-mono text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--btn-blur)]">
                {dateStr}
              </Badge>
            )}
          </div>

          <div className="absolute right-[var(--space-3)] top-[var(--space-3)] flex items-center gap-[var(--space-1)]">
            <IconButton
              size="sm"
              onClick={handleSaveClick}
              aria-label={isSaved ? "Retirer des favoris" : "Enregistrer dans mes favoris"}
              variant={isSaved ? 'solid' : 'glass'}
              aria-pressed={isSaved || undefined}
              className={isSaved ? 'bg-[color:var(--lkv-warning)] text-[color:var(--lkv-warning-dark)]' : undefined}
            >
              <LKDVIcon name={isSaved ? 'signet' : 'signet'} size={13} aria-hidden="true" />
            </IconButton>
          </div>

          <div className="pointer-events-none absolute bottom-[var(--space-2)] left-[var(--space-3)] right-[var(--space-3)] flex items-center justify-between font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-inverted)]">
            <div className="flex items-center gap-[var(--space-2)]">
              {carnet.distance_km && <span>📏 {carnet.distance_km} km</span>}
              {carnet.elevation_m && <span>⛰️ +{carnet.elevation_m} m</span>}
            </div>
            {Number(carnet.route_rating) > 0 ? (
              <span className="font-bold text-[color:var(--sand-300)]">★ {carnet.route_rating}/10</span>
            ) : (
              <Badge className="border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] border saturate-[var(--btn-saturate)] lkv-rim-btn font-mono font-bold text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--btn-blur)]">Nouveau</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between space-y-[var(--space-3)] p-[var(--space-4)] sm:p-[var(--space-5)]">
          <div className="space-y-[var(--space-1)]">
            <h3 className="line-clamp-2 font-display text-[length:var(--lkv-text-caption)] font-bold leading-snug text-[color:var(--lkv-text-primary)] transition-colors group-hover:text-[color:var(--lkv-forest-800)]">
              {carnet.title}
            </h3>

            {carnet.description && (
              <p className="line-clamp-2 text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-muted)]">
                {carnet.description}
              </p>
            )}
          </div>

          {carnet.tags && Array.isArray(carnet.tags) && carnet.tags.length > 0 && (
            <div className="flex flex-wrap gap-[var(--space-1)]">
              {carnet.tags.slice(0, 3).map((t: string) => (
                <Badge key={t} className="font-mono font-bold">
                  #{t}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-[var(--space-2)] border-t border-[color:var(--lkv-primary)]/10 pt-[var(--space-2)]">
            <span
              role="link"
              tabIndex={0}
              onClick={handleAuthorClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleAuthorClick(e);
              }}
              className="group/author flex min-w-0 cursor-pointer items-center gap-[var(--space-2)] transition-opacity hover:opacity-80"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={authorName}
                  className="h-6 w-6 shrink-0 rounded-full border border-[color:var(--lkv-primary)]/15 object-cover transition-transform group-hover/author:scale-105 motion-reduce:transition-none"
                />
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--lkv-primary)]/15 bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">
                  {authorName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="truncate text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)] group-hover/author:underline">{authorName}</span>
            </span>

            <div className="flex items-center gap-[var(--space-2)]">
              <IconButton
                size="sm"
                onClick={handleLikeClick}
                aria-label="J'aime ce récit"
                variant={isLiked ? 'solid' : 'glass'}
                aria-pressed={isLiked || undefined}
                className="w-auto px-[10px]"
              >
                <span className="inline-flex items-center gap-[var(--space-1)]"><HeartSvg filled={isLiked} /><span className="tabular-nums">{likesCount}</span></span>
              </IconButton>

              <IconButton
                size="sm"
                aria-label="Lire le carnet d'expédition"
              >
                <LKDVIcon name="suivant" size={13} aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
