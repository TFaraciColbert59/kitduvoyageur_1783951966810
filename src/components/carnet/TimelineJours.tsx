import React from 'react';
import JourCard from './JourCard';
import HebergementCard from './HebergementCard';
import type { CarnetJour, CarnetHebergement } from '@/lib/mock/carnet-chartreuse';

interface TimelineJoursProps {
  jours: CarnetJour[];
  hebergements: CarnetHebergement[];
}

export default function TimelineJours({ jours, hebergements }: TimelineJoursProps) {
  const items: { type: 'jour' | 'hebergement'; data: CarnetJour | CarnetHebergement; number: number }[] = [];

  jours.forEach((jour, i) => {
    items.push({ type: 'jour', data: jour, number: jour.dayNumber });
    if (hebergements[i]) {
      items.push({ type: 'hebergement', data: hebergements[i], number: i + 1 });
    }
  });

  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute bottom-0 left-4 top-0 w-px bg-[color:var(--lkv-primary)]/10" />

      <div className="space-y-[var(--space-8)]">
        {items.map((item, idx) => (
          <div key={idx} className="relative pl-[var(--space-12)]">
            {item.type === 'jour' && (
              <div className="absolute left-0 top-0 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--lkv-primary)] font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-inverted)]">
                {(item.data as CarnetJour).dayNumber}
              </div>
            )}
            {item.type === 'hebergement' && (
              <div className="absolute left-0 top-[var(--space-2)] z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--lkv-forest-600)]/20 bg-[color:var(--lkv-forest-600)]/10" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--lkv-forest-600)" strokeWidth="2"><path d="M3 21V7l9-4 9 4v14"/><path d="M9 21V12h6v9"/></svg>
              </div>
            )}

            {item.type === 'jour' ? (
              <JourCard jour={item.data as CarnetJour} />
            ) : (
              <HebergementCard hebergement={item.data as CarnetHebergement} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
