'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GearPhotoCarousel } from './GearPhotoCarousel';
import { GearItemPanel } from './GearItemPanel';
import { togglePackedAction } from '@/app/voyages/kit-actions';
import type { GearCardData } from '../../../mobile/gearEngine';

export interface GearCarouselBlockProps {
  tripSlug: string;
  cards: GearCardData[];
}

export function GearCarouselBlock({ tripSlug, cards }: GearCarouselBlockProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<GearCardData | null>(null);

  const togglePacked = (card: GearCardData) =>
    startTransition(async () => {
      const res = await togglePackedAction(card.id, !card.isPacked, tripSlug);
      if (!res.success) return;
      setSelected((current) =>
        current && current.id === card.id ? { ...current, isPacked: !card.isPacked } : current,
      );
      router.refresh();
    });

  return (
    <>
      <GearPhotoCarousel cards={cards} onSelect={setSelected} />
      <GearItemPanel
        card={selected}
        tripSlug={tripSlug}
        open={selected !== null}
        onOpenChange={(value) => {
          if (!value) setSelected(null);
        }}
        busy={pending}
        onTogglePacked={togglePacked}
      />
    </>
  );
}

export default GearCarouselBlock;
