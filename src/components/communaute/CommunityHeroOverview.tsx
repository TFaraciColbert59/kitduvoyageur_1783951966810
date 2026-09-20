import React from 'react';
import { Button, Card } from '@/components/ui';

interface Props {
  carnetsCount: number;
  clubsCount: number;
  groupsCount: number;
  onNavigateTab: (tab: any) => void;
}

export default function CommunityHeroOverview({
  carnetsCount,
  clubsCount,
  groupsCount,
  onNavigateTab,
}: Props) {
  return (
    <Card variant="featured" className="flex flex-col items-center justify-between gap-[var(--space-4)] md:flex-row">
      <div>
        <h2 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-primary)]">
          Le Camp de Base
        </h2>
        <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
          Découvrez {carnetsCount} carnets, rejoignez {clubsCount} clubs ou intégrez {groupsCount} groupes.
        </p>
      </div>
      <div className="flex gap-[var(--space-2)]">
        <Button variant="secondary" size="sm" onClick={() => onNavigateTab('carnets')}>
          Voir les carnets
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onNavigateTab('clubs')}>
          Voir les clubs
        </Button>
      </div>
    </Card>
  );
}
