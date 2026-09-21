'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { createClient } from '@/lib/supabase/client';
import { Badge, Button, Card, IconButton } from '@/components/ui';

interface CarnetHeroProps {
  meta: {
    badge?: string;
    titleLine1: string;
    titleLine2?: string;
    subtitleLine1?: string;
    subtitleLine2?: string;
    voyageurs?: number;
    dateRange?: string;
    itineraire?: string;
    likesCount?: number;
    commentsCount?: number;
    authorId?: string;
    authorName?: string;
    authorAvatar?: string;
  };
  onExport: () => void;
  carnetId?: string;
  onOpenComments?: () => void;
}

export default function CarnetHero({ meta, onExport, carnetId, onOpenComments }: CarnetHeroProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSaved, setIsSaved] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(meta.likesCount || 24);
  const [commentsCount] = useState(meta.commentsCount || 8);
  const supabase = createClient();

  useEffect(() => {
    if (!user || !carnetId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('carnet_favorites')
          .select('id')
          .eq('carnet_id', carnetId)
          .eq('user_id', user.id)
          .maybeSingle();
        setIsSaved(!!data);
      } catch (err) {
        console.error('Error checking favorite:', err);
      }
    })();
  }, [user, carnetId, supabase]);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({ title: `${meta.titleLine1} ${meta.titleLine2 || ''}`, url });
      } catch (err) {}
      return;
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      toast('Lien copié dans le presse-papier !', 'success');
    }
  };

  const handleToggleLike = () => {
    if (hasLiked) {
      setHasLiked(false);
      setLikesCount(prev => Math.max(0, prev - 1));
    } else {
      setHasLiked(true);
      setLikesCount(prev => prev + 1);
      toast('Merci pour votre réaction ! 🎒', 'success');
    }
  };

  const handleToggleSave = async () => {
    if (!user) { toast('Connectez-vous pour enregistrer ce carnet', 'error'); return; }
    if (!carnetId) { toast('Carnet indisponible', 'error'); return; }
    if (isSaved) {
      await supabase.from('carnet_favorites').delete().eq('carnet_id', carnetId).eq('user_id', user.id);
      setIsSaved(false);
      toast('Retiré des favoris', 'success');
    } else {
      await supabase.from('carnet_favorites').insert({ carnet_id: carnetId, user_id: user.id });
      setIsSaved(true);
      toast('Ajouté aux favoris ⭐', 'success');
    }
  };

  let displayTitle1 = meta.titleLine1 || 'Trek & Récit';
  let displayTitle2 = meta.titleLine2 || '';

  if (!displayTitle2 && displayTitle1.includes(' ')) {
    const words = displayTitle1.split(' ');
    if (words.length >= 3) {
      displayTitle1 = words.slice(0, 2).join(' ');
      displayTitle2 = words.slice(2).join(' ');
    }
  }

  const voyageursCount = meta.voyageurs || 1;
  const descriptionText = [meta.subtitleLine1, meta.subtitleLine2].filter(Boolean).join(' ');

  return (
    <div className="relative flex flex-col items-start justify-between gap-[var(--space-6)] overflow-hidden rounded-[var(--lkv-radius-card)] border border-[color:var(--glass-border)] bg-gradient-to-br from-[color:var(--lkv-primary)]/95 via-[color:var(--lkv-primary)]/85 to-[color:var(--lkv-forest-600)]/90 p-[var(--space-8)] text-[color:var(--stone-50)] sm:p-[var(--space-10)] md:flex-row md:items-end">
      <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-[40rem] w-[40rem] rounded-full bg-[color:var(--lkv-text-inverted)] opacity-5 blur-[100px]" />

      <div className="relative z-10 max-w-2xl">
        <div className="mb-[var(--space-6)] flex flex-wrap items-center gap-[var(--space-2)]">
          <Badge className="border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--lkv-text-inverted)]">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--lkv-forest-400)]" />
            <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest">
              {meta.badge || 'CARNET D’EXPÉDITION'} · {voyageursCount} {voyageursCount > 1 ? 'VOYAGEURS' : 'VOYAGEUR'} {meta.dateRange ? `· ${meta.dateRange}` : ''}
            </span>
          </Badge>

          {meta.authorName && (
            <Link
              href={meta.authorId ? `/profil/${meta.authorId}` : '/communaute'}
              className="group inline-flex items-center gap-[var(--space-1)] rounded-full border border-[color:var(--glass-border)] bg-[color:var(--lkv-primary)]/30 px-[var(--space-3)] py-[var(--space-1)] transition-colors hover:bg-[color:var(--lkv-primary)]/50"
            >
              <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-forest-300)]">Par</span>
              <span className="text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-inverted)] group-hover:underline">{meta.authorName}</span>
            </Link>
          )}
        </div>

        <h1 className="mb-[var(--space-6)] text-[length:var(--lkv-text-title-xl)] leading-[1.1] text-[color:var(--lkv-text-inverted)]">
          <span className="block font-display font-bold">{displayTitle1}</span>
          {displayTitle2 && (
            <span className="font-serif font-normal italic text-[color:var(--lkv-forest-200)]">{displayTitle2}</span>
          )}
        </h1>

        {descriptionText && (
          <p className="mb-[var(--space-8)] max-w-xl font-sans text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-inverted)]/80 md:text-[length:var(--lkv-text-body-sm)]">
            {descriptionText}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-[var(--space-4)] font-mono text-[length:var(--lkv-text-caption)] sm:gap-[var(--space-6)]">
          {meta.itineraire && (
            <div className="flex flex-col">
              <span className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-inverted)]/60">Itinéraire</span>
              <span className="max-w-[200px] truncate font-bold text-[color:var(--lkv-text-inverted)]">{meta.itineraire}</span>
            </div>
          )}
          {meta.dateRange && (
            <>
              <div aria-hidden className="h-8 w-px bg-[color:var(--lkv-text-inverted)]/20" />
              <div className="flex flex-col">
                <span className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-inverted)]/60">Période</span>
                <span className="font-bold text-[color:var(--lkv-text-inverted)]">{meta.dateRange}</span>
              </div>
            </>
          )}
          <div aria-hidden className="h-8 w-px bg-[color:var(--lkv-text-inverted)]/20" />
          <div className="flex flex-col">
            <span className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-inverted)]/60">Équipe</span>
            <span className="font-bold text-[color:var(--lkv-text-inverted)]">{voyageursCount} pers.</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-[var(--space-8)] flex w-full flex-col items-end gap-[var(--space-4)] md:mt-0 md:w-auto">
        <Card variant="compact" className="mb-[var(--space-2)] flex h-28 w-28 flex-col items-center justify-center border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-2)] text-center">
          <span className="mb-[var(--space-1)] text-[length:var(--lkv-text-title-sm)]" aria-hidden>📖</span>
          <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase leading-tight tracking-widest text-[color:var(--lkv-text-inverted)]/80">
            Récit Vérifié
          </span>
          <span className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-forest-300)]">Certifié LKDV</span>
        </Card>

        <Button
          type="button"
          onClick={onExport}
          icon={<Icon name="ArrowDownTrayIcon" size={16} aria-hidden="true" />}
          className="w-full md:w-auto"
        >
          Exporter le carnet
        </Button>

        <div className="mt-[var(--space-1)] flex flex-wrap items-center justify-end gap-[var(--space-2)]">
          <Button
            type="button"
            variant={hasLiked ? 'primary' : 'secondary'}
            onClick={handleToggleLike}
            aria-label="Réagir au carnet"
            aria-pressed={hasLiked}
            icon={<span aria-hidden>🎒</span>}
            className="px-[var(--space-3)]"
          >
            <span className="font-mono">{likesCount}</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={onOpenComments}
            aria-label="Commentaires du carnet"
            icon={<Icon name="ChatBubbleLeftIcon" size={14} aria-hidden="true" />}
            className="px-[var(--space-3)]"
          >
            <span className="font-mono">{commentsCount}</span>
          </Button>

          <IconButton
            type="button"
            variant="glass"
            onClick={handleShare}
            aria-label="Partager le carnet"
          >
            <Icon name="ShareIcon" size={15} aria-hidden="true" />
          </IconButton>

          <IconButton
            type="button"
            variant={isSaved ? 'solid' : 'glass'}
            onClick={handleToggleSave}
            aria-label="Enregistrer dans les favoris"
            aria-pressed={isSaved}
            className={isSaved ? 'bg-[color:var(--lkv-warning)] text-[color:var(--lkv-warning-dark)]' : ''}
          >
            <Icon name={isSaved ? 'BookmarkSolidIcon' : 'BookmarkIcon'} size={15} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
