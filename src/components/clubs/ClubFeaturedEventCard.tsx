'use client';

import React from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Button, Card } from '@/components/ui';

interface ClubFeaturedEventCardProps {
  event: {
    id: string;
    title: string;
    description?: string | null;
    event_date?: string | null;
    location?: string | null;
    participants_count?: number;
    max_participants?: number;
  };
  isRegistered?: boolean;
  onRegister?: () => void;
  onViewParticipants?: () => void;
}

export default function ClubFeaturedEventCard({
  event,
  isRegistered = false,
  onRegister,
  onViewParticipants,
}: ClubFeaturedEventCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const dateObj = event.event_date ? new Date(event.event_date) : null;
  const monthStr = dateObj
    ? dateObj.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase()
    : 'TBD';
  const dayStr = dateObj ? dateObj.getDate() : '-';

  const maxParticipants = event.max_participants || 20;
  const currentParticipants = event.participants_count || 0;
  const progressPercent = Math.min(100, Math.round((currentParticipants / maxParticipants) * 100));

  return (
    <Card className="relative space-y-[var(--space-3)] overflow-hidden p-[var(--space-4)] transition-all duration-[var(--motion-control-duration)]">
      <div className="flex items-start gap-[var(--space-3)]">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[var(--lkv-radius-2xl)] bg-[color:var(--lkv-primary)] text-[color:var(--lkv-text-inverted)]">
          <span className="text-[length:var(--lkv-text-caption-2)] font-bold uppercase leading-none tracking-wider text-[color:var(--lkv-forest-200)]">
            {monthStr}
          </span>
          <span className="mt-[var(--space-1)] font-display text-[length:var(--lkv-text-subheadline)] font-extrabold leading-none">
            {dayStr}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-[2px]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-wide text-[color:var(--lkv-text-primary)]">
              🏕️ Sortie Collective
            </span>
            <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-[var(--lkv-forest-500)]" title="Sortie active" />
          </div>
          <h3 className="truncate font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
            {event.title}
          </h3>
          <p className="flex items-center gap-[var(--space-1)] truncate font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
            <span aria-hidden>📍</span>
            <span>{event.location || 'Lieu à définir'}</span>
          </p>
        </div>
      </div>

      {event.description && (
        <p className="line-clamp-2 pl-[var(--space-1)] text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-muted)]">
          {event.description}
        </p>
      )}

      <div className="space-y-[var(--space-1)] pt-[var(--space-1)]">
        <div className="flex items-center justify-between font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
          <span>Places réservées</span>
          <span className="font-bold text-[color:var(--lkv-text-primary)]">
            {currentParticipants} / {maxParticipants}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Places réservées"
          className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--lkv-primary)]/10"
        >
          <div
            className="h-full rounded-full bg-[color:var(--lkv-forest-600)] transition-all duration-500 motion-reduce:transition-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-[var(--space-2)] border-t border-[color:var(--lkv-primary)]/10 pt-[var(--space-2)]">
        {onViewParticipants ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onViewParticipants}
            className="font-medium"
          >
            Participants ({currentParticipants})
          </Button>
        ) : (
          <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
            {maxParticipants - currentParticipants} places restantes
          </span>
        )}

        <Button
          type="button"
          variant={isRegistered ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => {
            triggerHaptic('selection');
            if (onRegister) onRegister();
          }}
        >
          {isRegistered ? '✓ Inscrit(e)' : "S'inscrire"}
        </Button>
      </div>
    </Card>
  );
}
