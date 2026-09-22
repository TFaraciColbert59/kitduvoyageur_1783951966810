'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { Badge, Card, IconButton } from '@/components/ui';
import SmartImage from '@/components/ui/SmartImage';

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
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={`h-3.5 w-3.5 scale-110 text-[color:var(--lkv-danger)] transition-transform duration-200 motion-reduce:transition-none ${className}`}
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
      aria-hidden="true"
      className={`h-3.5 w-3.5 text-[color:var(--lkv-text-primary)] transition-colors hover:text-[color:var(--lkv-danger)] ${className}`}
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
      <Card className="flex h-full flex-col overflow-hidden p-0 transition-transform duration-[var(--motion-control-duration)] group-hover:-translate-y-1 group-hover:shadow-elevation-3 motion-reduce:transition-none">
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
              <Icon name={isSaved ? 'BookmarkSolidIcon' : 'BookmarkIcon'} size={13} aria-hidden="true" />
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
                <Icon name="ArrowRightIcon" size={13} aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
