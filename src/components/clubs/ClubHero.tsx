'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, IconButton } from '@/components/ui';

interface ClubHeroProps {
  club: {
    id: string;
    name: string;
    type?: string;
    emoji?: string;
    description?: string;
    category?: string;
    privacy?: string;
    is_verified?: boolean;
    members_count?: number;
    active_this_month?: number;
    cover_image?: string;
    location?: string;
  };
  eventsCount?: number;
  isMember?: boolean;
  joining?: boolean;
  onToggleMember?: () => void;
  onShare?: () => void;
}

export default function ClubHero({
  club,
  eventsCount = 0,
  isMember = false,
  joining = false,
  onToggleMember,
  onShare,
}: ClubHeroProps) {
  const membersCount = club.members_count || 1;
  const isOnline = club.active_this_month || 0;

  return (
    <div className="relative flex flex-col items-start justify-between gap-[var(--space-6)] overflow-hidden rounded-[var(--lkv-radius-card)] border border-[color:var(--glass-border)] bg-gradient-to-br from-[color:var(--lkv-primary)]/95 via-[color:var(--lkv-primary)]/85 to-[color:var(--lkv-forest-600)]/90 p-[var(--space-8)] text-[color:var(--stone-50)] sm:p-[var(--space-10)] md:flex-row md:items-end">
      <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-[40rem] w-[40rem] rounded-full bg-[color:var(--lkv-text-inverted)] opacity-5 blur-[100px]" />

      <div className="relative z-10 max-w-2xl">
        <Badge className="mb-[var(--space-6)] border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--lkv-text-inverted)]">
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--lkv-forest-400)]" />
          <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest">
            {club.type || 'CLUB'} · {membersCount} MEMBRES · {club.privacy === 'open' ? 'PUBLIC' : 'PRIVÉ'}
          </span>
        </Badge>

        <h1 className="mb-[var(--space-6)] text-[length:var(--lkv-text-title-xl)] leading-[1.1] text-[color:var(--lkv-text-inverted)]">
          <span className="block font-display font-bold">{club.name}</span>
          <span className="font-serif font-normal italic text-[color:var(--lkv-forest-200)]">{club.category || 'Collectif Outdoor'}</span>
        </h1>

        {club.description && (
          <p className="mb-[var(--space-8)] max-w-xl font-sans text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-inverted)]/80 md:text-[length:var(--lkv-text-body-sm)]">
            {club.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-[var(--space-4)] font-mono text-[length:var(--lkv-text-caption)] sm:gap-[var(--space-6)]">
          <div className="flex flex-col">
            <span className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-inverted)]/60">Membres</span>
            <span className="font-bold text-[color:var(--lkv-text-inverted)]">{membersCount}</span>
          </div>
          <div aria-hidden className="h-8 w-px bg-[color:var(--lkv-text-inverted)]/20" />
          <div className="flex flex-col">
            <span className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-inverted)]/60">En ligne</span>
            <span className="font-bold text-[color:var(--lkv-forest-400)]">{isOnline}</span>
          </div>
          <div aria-hidden className="h-8 w-px bg-[color:var(--lkv-text-inverted)]/20" />
          <div className="flex flex-col">
            <span className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-inverted)]/60">Sorties</span>
            <span className="font-bold text-[color:var(--lkv-text-inverted)]">{eventsCount}</span>
          </div>
          <div aria-hidden className="h-8 w-px bg-[color:var(--lkv-text-inverted)]/20" />
          <div className="flex flex-col">
            <span className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-inverted)]/60">Lieu</span>
            <span className="max-w-[120px] truncate font-bold text-[color:var(--lkv-text-inverted)]">{club.location || 'Monde'}</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-[var(--space-6)] flex w-full flex-col items-end gap-[var(--space-3)] md:mt-0 md:w-auto">
        <Card variant="compact" className="mb-[var(--space-1)] flex h-24 w-24 flex-col items-center justify-center border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)]">
          <span className="mb-[var(--space-1)] text-[length:var(--lkv-text-title-sm)]" aria-hidden>{club.emoji || '🏕️'}</span>
          <span className="px-[var(--space-1)] text-center font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-inverted)]/70">
            {club.category?.slice(0, 10) || 'Club'}
          </span>
        </Card>

        <div className="flex w-full items-center gap-[var(--space-2)] md:w-auto">
          {onShare && (
            <IconButton
              variant="glass"
              onClick={onShare}
              aria-label="Partager le club"
            >
              <Icon name="ShareIcon" size={16} aria-hidden="true" />
            </IconButton>
          )}
          <Button
            type="button"
            variant={isMember ? 'secondary' : 'primary'}
            onClick={onToggleMember}
            disabled={joining}
            loading={joining}
            className="w-full md:w-auto"
          >
            {joining ? 'Patientez...' : isMember ? '✓ Membre du club' : '＋ Rejoindre le club'}
          </Button>
        </div>
      </div>
    </div>
  );
}
