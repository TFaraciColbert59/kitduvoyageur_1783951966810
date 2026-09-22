'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Badge, Button, Card } from '@/components/ui';

export interface ClubCardItem {
  id: string;
  slug?: string;
  name: string;
  type?: string;
  emoji?: string;
  description: string;
  cover_image?: string;
  cover_color?: string;
  category?: string;
  members_count: number;
  active_this_month?: number;
  is_verified?: boolean;
  is_member?: boolean;
}

interface MobileClubCardProps {
  club: ClubCardItem;
  isMember?: boolean;
  onJoin?: (clubId: string) => Promise<void> | void;
  joining?: boolean;
}

export default function MobileClubCard({
  club,
  isMember = false,
  onJoin,
  joining = false,
}: MobileClubCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const clubHref = `/clubs/${club.slug || club.id}`;

  return (
    <Card className="relative flex flex-col justify-between space-y-[var(--space-3)] p-[var(--space-4)] transition-transform active:scale-[0.99] motion-reduce:transition-none">
      <div className="flex items-start justify-between gap-[var(--space-3)]">
        <div className="flex min-w-0 items-center gap-[var(--space-3)]">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--lkv-radius-2xl)] border border-[color:var(--lkv-primary)]/10 bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-title-sm)]">
            {club.cover_image ? (
              <img
                src={club.cover_image}
                alt={club.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span aria-hidden>{club.emoji || '🏕️'}</span>
            )}
          </div>

          <div className="min-w-0 space-y-[2px]">
            <div className="flex flex-wrap items-center gap-[var(--space-1)]">
              {club.category && (
                <Badge className="shrink-0 font-mono font-bold">
                  {club.category}
                </Badge>
              )}
              {club.type && (
                <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  {club.type === 'activite' ? '⚡ Activité' : '🌍 Pays'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-[var(--space-1)]">
              <h3 className="truncate font-display text-[length:var(--lkv-text-caption)] font-bold leading-snug text-[color:var(--lkv-text-primary)]">
                {club.name}
              </h3>
              {club.is_verified && (
                <span className="shrink-0 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-forest-700)]" title="Club vérifié">
                  ✓
                </span>
              )}
            </div>
          </div>
        </div>

        {isMember ? (
          <Badge tone="sage" className="shrink-0 font-mono font-bold">
            ✓ Membre
          </Badge>
        ) : (
          <Badge className="shrink-0 font-mono">
            Collectif
          </Badge>
        )}
      </div>

      {club.description && (
        <p className="line-clamp-2 pl-[var(--space-1)] text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-muted)]">
          {club.description}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-[color:var(--lkv-primary)]/10 pt-[var(--space-2)]">
        <div className="flex items-center gap-[var(--space-3)] font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
          <div className="flex items-center gap-[var(--space-1)]">
            <span aria-hidden>👥</span>
            <span className="font-bold text-[color:var(--lkv-text-primary)]">{club.members_count || 1}</span>
            <span className="text-[length:var(--lkv-text-caption-2)]">membres</span>
          </div>

          {club.active_this_month !== undefined && club.active_this_month > 0 && (
            <Badge tone="sage" className="font-mono font-bold">
              🔥 {club.active_this_month} actifs/mois
            </Badge>
          )}
        </div>

        {isMember ? (
          <Link
            href={clubHref}
            onClick={() => triggerHaptic('light')}
            className="inline-flex min-h-[var(--control-height-sm)] items-center gap-[var(--space-1)] rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-3)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--blur-md)]"
          >
            <span>Ouvrir</span>
            <Icon name="ArrowRightIcon" size={12} aria-hidden="true" />
          </Link>
        ) : (
          <div className="flex items-center gap-[var(--space-2)]">
            <Link
              href={clubHref}
              onClick={() => triggerHaptic('light')}
              className="inline-flex min-h-[var(--control-height-sm)] items-center rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-3)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--blur-md)]"
            >
              <span>Détails</span>
            </Link>
            <Button
              type="button"
              size="sm"
              disabled={joining}
              loading={joining}
              onClick={() => {
                triggerHaptic('selection');
                if (onJoin) onJoin(club.id);
              }}
            >
              {joining ? '...' : '+ Rejoindre'}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
