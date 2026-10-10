'use client';

import React from 'react';
import Sheet from '@/components/ui/Sheet';
import Icon from '@/components/ui/AppIcon';
import { Button, Badge } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { RecommendationTransparency } from '@/features/community/feed/types/feed.types';

export interface TransparencySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transparency?: RecommendationTransparency | null;
  postTitle?: string;
  authorName?: string;
}

interface FactorItem {
  id: string;
  label: string;
  weightLabel: string;
  description: string;
  score: number; // 0 to 1
  icon: string;
}

const REASON_BADGES: Record<string, { label: string; icon: string }> = {
  travel_intent: { label: 'Intention de voyage', icon: 'map' },
  quality_field_proof: { label: 'Vérifié terrain', icon: 'shield-check' },
  territory: { label: 'Proximité terrain', icon: 'map-pin' },
  following: { label: 'Abonnement', icon: 'user-check' },
  club: { label: 'Club & Collectif', icon: 'compass' },
  discovery: { label: 'Découverte outdoor', icon: 'sparkles' },
};

export default function TransparencySheet({
  open,
  onOpenChange,
  transparency,
  postTitle,
  authorName,
}: TransparencySheetProps) {
  const { triggerHaptic } = useHapticFeedback();

  const handleClose = () => {
    triggerHaptic('light');
    onOpenChange(false);
  };

  const primaryReason = transparency?.primaryReason || 'discovery';
  const badgeConfig = REASON_BADGES[primaryReason] || {
    label: transparency?.badgeLabel || 'Recommandé pour vous',
    icon: 'sparkles',
  };

  const breakdown = transparency?.scoreBreakdown;

  const factors: FactorItem[] = [
    {
      id: 'intent',
      label: 'Intention de voyage',
      weightLabel: 'Poids 30%',
      description: transparency?.matchedSignals?.tripDestination
        ? `Aligné avec votre projet : ${transparency.matchedSignals.tripDestination}`
        : 'Correspondance avec vos projets et destinations actives',
      score: breakdown?.intent ?? 0.65,
      icon: 'map',
    },
    {
      id: 'utility',
      label: 'Utilité & Données terrain',
      weightLabel: 'Poids 25%',
      description: transparency?.matchedSignals?.isVerifiedCarnet
        ? 'Récit vérifié avec carnet de route et tracé GPX complet'
        : 'Tracé GPS, matériel testé, sécurité et conseils réels',
      score: breakdown?.utility ?? 0.75,
      icon: 'shield-check',
    },
    {
      id: 'quality',
      label: 'Qualité & Fiabilité auteur',
      weightLabel: 'Poids 20%',
      description: transparency?.matchedSignals?.authorTrustScore
        ? `Score de confiance auteur : ${transparency.matchedSignals.authorTrustScore}/100`
        : 'Niveau d’expérience et authenticité des contributions',
      score: breakdown?.quality ?? 0.8,
      icon: 'award',
    },
    {
      id: 'geo',
      label: 'Proximité & Territoire',
      weightLabel: 'Poids 15%',
      description: transparency?.matchedSignals?.massif
        ? `Massif concerné : ${transparency.matchedSignals.massif}`
        : 'Distance géographique avec votre position ou camp de base',
      score: breakdown?.geo ?? 0.5,
      icon: 'map-pin',
    },
    {
      id: 'social',
      label: 'Affinité sociale & Clubs',
      weightLabel: 'Poids 10%',
      description: transparency?.matchedSignals?.clubName
        ? `Partagé au sein du collectif : ${transparency.matchedSignals.clubName}`
        : 'Créateurs suivis et collectifs partagés',
      score: breakdown?.social ?? 0.4,
      icon: 'users',
    },
  ];

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Pourquoi je vois ce contenu"
      description="Algorithme de recommandation Feed V1 — Transparence et signaux terrain"
      dragToDismiss={true}
      detent="auto"
    >
      <div className="space-y-[var(--space-4)] pt-[var(--space-1)] text-[color:var(--lkv-text-primary)]">
        {/* 1. Header Pill & Primary Explanation */}
        <div className="rounded-[var(--lkv-radius-lg)] border border-[color:var(--btn-glass-border)] bg-[color:var(--glass-bg-subtle)] p-[var(--space-4)] shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-[var(--space-2)] pb-[var(--space-2)]">
            <Badge
              tone="sage"
              className="inline-flex min-h-[28px] items-center gap-1.5 px-3 py-1 font-mono text-[length:var(--lkv-text-caption)] font-bold shadow-sm"
            >
              <Icon name={badgeConfig.icon} size={14} aria-hidden="true" />
              <span>{transparency?.badgeLabel || badgeConfig.label}</span>
            </Badge>

            <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-secondary)]">
              Moteur Feed V1
            </span>
          </div>

          <p className="font-sans text-[length:var(--lkv-text-subheadline)] font-medium leading-relaxed text-[color:var(--lkv-text-primary)]">
            {transparency?.explanation ||
              'Cette publication a été sélectionnée pour sa haute utilité terrain et sa pertinence avec votre profil de voyageur outdoor.'}
          </p>

          {(postTitle || authorName) && (
            <p className="mt-[var(--space-2)] truncate font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
              {authorName ? `Par ${authorName}` : ''}
              {authorName && postTitle ? ' · ' : ''}
              {postTitle ? `« ${postTitle} »` : ''}
            </p>
          )}
        </div>

        {/* 2. Breakdown Factors Section */}
        <div className="space-y-[var(--space-3)]">
          <div className="flex items-center justify-between px-[var(--space-1)]">
            <h3 className="font-display text-[length:var(--lkv-text-footnote)] font-bold tracking-tight text-[color:var(--lkv-text-primary)]">
              Facteurs d&apos;attribution
            </h3>
            <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
              Utilité &gt; Viralité
            </span>
          </div>

          <div className="space-y-[var(--space-2)]">
            {factors.map((factor) => {
              const percentage = Math.min(100, Math.max(0, Math.round(factor.score * 100)));

              return (
                <div
                  key={factor.id}
                  className="rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-3)] shadow-elevation-1 transition-colors"
                >
                  <div className="flex items-center justify-between gap-[var(--space-2)]">
                    <div className="flex items-center gap-[var(--space-2)]">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--lkv-action)]/10 text-[color:var(--lkv-action)]">
                        <Icon name={factor.icon} size={14} aria-hidden="true" />
                      </div>
                      <span className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
                        {factor.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-[var(--space-2)]">
                      <Badge tone="stone" className="font-mono text-[length:var(--lkv-text-caption-2)]">
                        {factor.weightLabel}
                      </Badge>
                      <span className="min-w-[36px] text-right font-mono text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-action)]">
                        {percentage}%
                      </span>
                    </div>
                  </div>

                  <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption)] leading-normal text-[color:var(--lkv-text-secondary)]">
                    {factor.description}
                  </p>

                  {/* Progress Bar with Apple HIG smooth pill */}
                  <div
                    role="progressbar"
                    aria-label={factor.label}
                    aria-valuenow={percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="mt-[var(--space-2)] h-2 w-full overflow-hidden rounded-full bg-[color:var(--glass-bg-subtle)]"
                  >
                    <div
                      className="h-full rounded-full bg-[color:var(--lkv-action)] transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. LKDV Outdoor Manifesto Footnote */}
        <div className="rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] p-[var(--space-3)]">
          <div className="flex items-start gap-[var(--space-2)]">
            <span className="text-base" aria-hidden="true">🌲</span>
            <p className="text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
              <strong className="text-[color:var(--lkv-text-primary)]">Engagement éthique LKDV :</strong> Notre algorithme met en avant la sécurité, l&apos;utilité terrain et le respect de la montagne, sans jamais exploiter de mécanismes d&apos;addiction ou d&apos;indignation.
            </p>
          </div>
        </div>

        {/* 4. Action Button with 44px min height */}
        <div className="pt-[var(--space-2)]">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            onClick={handleClose}
            className="min-h-[44px] rounded-[var(--lkv-radius-md)] font-medium"
          >
            Fermer
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
