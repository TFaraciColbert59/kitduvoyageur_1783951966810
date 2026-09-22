'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Badge, Card, IconButton } from '@/components/ui';
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

  const dateRangeStr = formatDateRange(carnet.start_date, carnet.end_date);

  return (
    <Card className="relative flex flex-col justify-between space-y-[var(--space-3)] p-[var(--space-4)] transition-transform active:scale-[0.99] motion-reduce:transition-none">
      <Link
        href={carnetHref}
        onClick={() => triggerHaptic('light')}
        className="group relative block h-44 w-full overflow-hidden rounded-[var(--lkv-radius-2xl)] bg-[color:var(--btn-tint)]"
      >
        <img
          src={carnet.cover_image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80'}
          alt={carnet.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
          loading="lazy"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[color:var(--lkv-primary)]/80 via-transparent to-black/30" />

        <div className="absolute left-[var(--space-2)] right-[var(--space-2)] top-[var(--space-2)] z-10 flex items-center justify-between">
          <Badge className="border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] border saturate-[var(--btn-saturate)] lkv-rim-btn font-mono font-semibold text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--btn-blur)]">
            📍 {carnet.destination || 'Massif & Randonnée'}
          </Badge>

          {carnet.route_rating !== undefined && (
            <Badge className="border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] border saturate-[var(--btn-saturate)] lkv-rim-btn font-mono font-bold text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--btn-blur)]">
              ★ {carnet.route_rating}/10
            </Badge>
          )}
        </div>

        <div className="absolute bottom-[var(--space-2)] left-[var(--space-2)] right-[var(--space-2)] z-10">
          {dateRangeStr && (
            <span className="mb-[var(--space-1)] block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-forest-200)]">
              {dateRangeStr}
            </span>
          )}
          <h3 className="line-clamp-2 font-display text-[length:var(--lkv-text-caption)] font-bold leading-snug text-[color:var(--lkv-text-inverted)]">
            {carnet.title}
          </h3>
        </div>
      </Link>

      <div className="space-y-[var(--space-2)]">
        <Link
          href={carnet.author_id ? `/profil/${carnet.author_id}` : '/communaute'}
          onClick={() => triggerHaptic('light')}
          className="group/author flex cursor-pointer items-center gap-[var(--space-2)]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn font-serif text-[length:var(--lkv-text-caption-2)] font-bold italic text-[color:var(--lkv-text-primary)] transition-transform group-hover/author:scale-105 motion-reduce:transition-none">
            {carnet.author?.avatar_url ? (
              <img src={carnet.author.avatar_url} alt={carnet.author?.full_name || 'Auteur du carnet'} className="h-full w-full object-cover" />
            ) : (
              carnet.author?.full_name?.charAt(0) || '👤'
            )}
          </span>
          <span className="min-w-0 flex-1">
            <h4 className="truncate text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)] group-hover/author:underline">
              {carnet.author?.full_name || 'Voyageur passionné'}
            </h4>
            <p className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Récit de terrain vérifié</p>
          </span>
        </Link>

        {carnet.description && (
          <p className="line-clamp-2 pl-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-muted)]">
            {carnet.description}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[color:var(--lkv-primary)]/10 pt-[var(--space-2)]">
        <div className="flex items-center gap-[var(--space-1)]">
          <IconButton
            size="sm"
            onClick={() => {
              triggerHaptic('selection');
              if (onLike) onLike(carnet.id, !carnet.user_liked);
            }}
            aria-label="Aimer ce carnet"
            variant={carnet.user_liked ? 'solid' : 'glass'}
            aria-pressed={carnet.user_liked || undefined}
            className={`w-auto px-[10px] ${carnet.user_liked ? 'bg-[color:var(--lkv-danger-bg)] text-[color:var(--lkv-danger)]' : ''}`}
          >
            <span className="inline-flex items-center gap-[var(--space-1)]">
              <Icon
                name="HeartIcon"
                size={13}
                className={carnet.user_liked ? 'fill-[color:var(--lkv-danger)] text-[color:var(--lkv-danger)]' : ''}
                aria-hidden="true"
              />
              <span className="tabular-nums">{carnet.likes_count || 0}</span>
            </span>
          </IconButton>

          <IconButton
            size="sm"
            onClick={() => {
              triggerHaptic('selection');
              if (onFavorite) onFavorite(carnet.id, !carnet.user_favorited);
            }}
            aria-label="Enregistrer dans ma collection"
            variant={carnet.user_favorited ? 'solid' : 'glass'}
            aria-pressed={carnet.user_favorited || undefined}
            className={carnet.user_favorited ? 'bg-[color:var(--lkv-warning-bg)] text-[color:var(--lkv-warning-dark)]' : undefined}
          >
            <Icon
              name="BookmarkIcon"
              size={13}
              className={carnet.user_favorited ? 'fill-[color:var(--lkv-warning-dark)] text-[color:var(--lkv-warning-dark)]' : ''}
              aria-hidden="true"
            />
          </IconButton>

          <IconButton
            size="sm"
            onClick={() => {
              triggerHaptic('light');
              if (onShare) onShare(carnet);
            }}
            aria-label="Partager"
          >
            <Icon name="ShareIcon" size={13} aria-hidden="true" />
          </IconButton>
        </div>

        <Link
          href={carnetHref}
          onClick={() => triggerHaptic('light')}
          className="inline-flex min-h-[var(--control-height-sm)] items-center gap-[var(--space-1)] rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-4)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]"
        >
          <span>Lire le récit</span>
          <Icon name="ArrowRightIcon" size={12} aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const d1 = new Date(start);
  const d1Str = d1.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  if (!end) return d1Str;
  const d2 = new Date(end);
  const d2Str = d2.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `${d1Str} – ${d2Str}`;
}
