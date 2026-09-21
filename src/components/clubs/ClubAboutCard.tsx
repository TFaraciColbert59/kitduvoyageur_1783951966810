'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Badge, Button, Card } from '@/components/ui';

interface ClubAboutCardProps {
  club: {
    category?: string;
    location?: string;
    privacy?: string;
    members_count?: number;
    created_at?: string;
    rules?: string;
    description?: string;
  };
}

export default function ClubAboutCard({ club }: ClubAboutCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [showRules, setShowRules] = useState(false);

  const createdYear = club.created_at
    ? new Date(club.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    : '2024';

  return (
    <Card className="space-y-[var(--space-3)] p-[var(--space-4)] transition-all duration-[var(--motion-control-duration)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[var(--space-2)]">
          <span className="text-[length:var(--lkv-text-caption)]" aria-hidden>ℹ️</span>
          <h2 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
            Infos &amp; Charte du Collectif
          </h2>
        </div>
        <Badge className="py-[2px] font-mono font-bold">
          {club.privacy === 'open' ? 'Public' : 'Privé'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-[var(--space-2)] text-[length:var(--lkv-text-caption-2)]">
        <Card variant="compact">
          <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Catégorie</span>
          <span className="mt-[var(--space-1)] block truncate font-bold text-[color:var(--lkv-text-primary)]">{club.category || 'Outdoor'}</span>
        </Card>

        <Card variant="compact">
          <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Localisation</span>
          <span className="mt-[var(--space-1)] block truncate font-bold text-[color:var(--lkv-text-primary)]">{club.location || 'France'}</span>
        </Card>

        <Card variant="compact">
          <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Membres</span>
          <span className="mt-[var(--space-1)] block truncate font-bold text-[color:var(--lkv-text-primary)]">{club.members_count || 1} inscrits</span>
        </Card>

        <Card variant="compact">
          <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Créé en</span>
          <span className="mt-[var(--space-1)] block truncate font-bold text-[color:var(--lkv-text-primary)]">{createdYear}</span>
        </Card>
      </div>

      {(club.rules || club.description) && (
        <div className="border-t border-[color:var(--lkv-primary)]/10 pt-[var(--space-2)]">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            aria-expanded={showRules}
            onClick={() => {
              triggerHaptic('light');
              setShowRules(!showRules);
            }}
            className="justify-between"
          >
            <span className="flex items-center gap-[var(--space-2)]">
              <span aria-hidden>📜</span>
              <span>Charte d&apos;engagement</span>
            </span>
            <span className="font-mono text-[length:var(--lkv-text-caption-2)]">{showRules ? '▲ Fermer' : '▼ Lire'}</span>
          </Button>

          {showRules && (
            <Card variant="compact" className="mt-[var(--space-2)] whitespace-pre-wrap text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-primary)]">
              {club.rules || club.description}
            </Card>
          )}
        </div>
      )}
    </Card>
  );
}
