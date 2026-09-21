'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { useToast } from '@/contexts/ToastContext';
import { Badge, Button, Card, IconButton } from '@/components/ui';

interface HeroVoyageProps {
  data: any;
  groupId?: string;
  inviteCode?: string;
  onOpenChat?: () => void;
}

export default function HeroVoyage({ data, groupId, inviteCode, onOpenChat }: HeroVoyageProps) {
  const { toast } = useToast();

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/groupes/${inviteCode || groupId}`
    : '';

  const handleInvite = async () => {
    if (inviteCode) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        toast(`Code d'invitation : ${inviteCode}`, 'success');
      } catch {
        toast(`Code d'invitation : ${inviteCode}`, 'success');
      }
    } else {
      toast("Aucun code d'invitation disponible", 'error');
    }
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({ title: `${data.meta.titlePrefix} ${data.meta.titleSuffix}`, url });
      } catch (err) {}
      return;
    }
    navigator.clipboard.writeText(url);
    toast('Lien copié dans le presse-papier !', 'success');
  };

  return (
    <div className="relative flex flex-col justify-between gap-[var(--space-6)] overflow-hidden rounded-[var(--lkv-radius-card)] border border-[color:var(--glass-border)] bg-gradient-to-br from-[color:var(--lkv-primary)]/95 via-[color:var(--lkv-primary)]/85 to-[color:var(--lkv-forest-600)]/90 p-[var(--space-8)] text-[color:var(--stone-50)] sm:p-[var(--space-10)] md:flex-row md:items-end">
      <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-[40rem] w-[40rem] rounded-full bg-[color:var(--lkv-text-inverted)] opacity-5 blur-[100px]" />

      <div className="relative z-10 max-w-2xl">
        <Badge className="mb-[var(--space-6)] border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--lkv-text-inverted)]">
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--lkv-forest-400)]" />
          <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest">
            {data.meta.type} · {data.meta.participantsCount} PERSONNES · {data.meta.season}
          </span>
        </Badge>

        <h1 className="mb-[var(--space-6)] text-[length:var(--lkv-text-title-xl)] leading-[1.1] text-[color:var(--lkv-text-inverted)]">
          <span className="block font-display font-bold">{data.meta.titlePrefix}</span>
          <span className="font-serif font-normal italic text-[color:var(--lkv-forest-200)]">{data.meta.titleSuffix}</span>
        </h1>

        <p className="mb-[var(--space-8)] max-w-xl font-sans text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-inverted)]/80 md:text-[length:var(--lkv-text-body-sm)]">
          {data.meta.description}
        </p>

        <div className="flex flex-wrap items-center gap-[var(--space-4)] font-mono text-[length:var(--lkv-text-caption)] sm:gap-[var(--space-6)]">
          <div className="flex flex-col">
            <span className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-inverted)]/60">Durée</span>
            <span className="font-bold text-[color:var(--lkv-text-inverted)]">{data.meta.durationDays} jours</span>
          </div>
          <div aria-hidden className="h-8 w-px bg-[color:var(--lkv-text-inverted)]/20" />
          <div className="flex flex-col">
            <span className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-inverted)]/60">Distance</span>
            <span className="font-bold text-[color:var(--lkv-text-inverted)]">{data.meta.distanceKm} km</span>
          </div>
          <div aria-hidden className="h-8 w-px bg-[color:var(--lkv-text-inverted)]/20" />
          <div className="flex flex-col">
            <span className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-inverted)]/60">Dénivelé +</span>
            <span className="font-bold text-[color:var(--lkv-text-inverted)]">{data.meta.elevationGain} m</span>
          </div>
          <div aria-hidden className="h-8 w-px bg-[color:var(--lkv-text-inverted)]/20" />
          <div className="flex flex-col">
            <span className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-inverted)]/60">Voyageurs</span>
            <span className="font-bold text-[color:var(--lkv-text-inverted)]">{data.meta.participantsCount}</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-[var(--space-8)] flex w-full flex-col items-end gap-[var(--space-4)] md:mt-0 md:w-auto">
        <Card variant="compact" className="mb-[var(--space-2)] flex h-24 w-24 flex-col items-center justify-center border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)]">
          <span className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-inverted)]">J-{data.meta.daysLeft}</span>
          <span className="px-[var(--space-2)] text-center font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-inverted)]/70">
            avant le<br />départ
          </span>
        </Card>

        <Button
          onClick={handleInvite}
          icon={<Icon name="PlusIcon" size={16} aria-hidden="true" />}
          className="w-full md:w-auto"
        >
          Inviter un ami
        </Button>

        <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-2)]">
          <IconButton variant="glass" aria-label="Ouvrir la discussion" onClick={onOpenChat}>
            <Icon name="ChatBubbleLeftIcon" size={16} aria-hidden="true" />
          </IconButton>
          <IconButton variant="glass" aria-label="Partager le voyage" onClick={handleShare}>
            <Icon name="ShareIcon" size={16} aria-hidden="true" />
          </IconButton>
          <IconButton variant="glass" aria-label="Options du voyage" onClick={handleInvite}>
            <Icon name="EllipsisHorizontalIcon" size={16} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
