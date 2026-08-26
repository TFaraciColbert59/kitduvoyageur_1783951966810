import React from 'react';
import JourCard from './JourCard';
import HebergementCard from './HebergementCard';
import type { CarnetJour, CarnetHebergement } from '@/lib/mock/carnet-chartreuse';

interface TimelineJoursProps {
  jours: CarnetJour[];
  hebergements: CarnetHebergement[];
}

export default function TimelineJours({ jours, hebergements }: TimelineJoursProps) {
  // Build interleaved items: jour1, hebergement1, jour2, hebergement2, jour3
  const items: { type: 'jour' | 'hebergement'; data: CarnetJour | CarnetHebergement; number: number }[] = [];

  jours.forEach((jour, i) => {
    items.push({ type: 'jour', data: jour, number: jour.dayNumber });
    if (hebergements[i]) {
      items.push({ type: 'hebergement', data: hebergements[i], number: i + 1 });
    }
  });

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-[#17402C]/10" aria-hidden="true" />

      <div className="space-y-8">
        {items.map((item, idx) => (
          <div key={idx} className="relative pl-12">
            {/* Circle marker */}
            {item.type === 'jour' && (
              <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-[#17402C] text-white flex items-center justify-center text-xs font-mono font-bold z-10">
                {(item.data as CarnetJour).dayNumber}
              </div>
            )}
            {item.type === 'hebergement' && (
              <div className="absolute left-0 top-2 w-8 h-8 rounded-full bg-[#33463C]/10 border border-[#33463C]/20 flex items-center justify-center z-10" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#33463C" strokeWidth="2"><path d="M3 21V7l9-4 9 4v14"/><path d="M9 21V12h6v9"/></svg>
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
