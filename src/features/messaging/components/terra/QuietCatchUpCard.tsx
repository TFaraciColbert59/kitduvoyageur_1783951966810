'use client';

import React from 'react';
import type { QuietCatchUpSummary } from '../../types/terra.types';

export interface QuietCatchUpCardProps {
  summary: QuietCatchUpSummary;
  onDismiss?: () => void;
  onCitationClick?: (seq: number) => void;
  className?: string;
}

export const QuietCatchUpCard: React.FC<QuietCatchUpCardProps> = ({
  summary,
  onDismiss,
  onCitationClick,
  className = '',
}) => {
  return (
    <section
      aria-label="Résumé Quiet Catch-Up"
      role="region"
      className={`bg-forest-950/20 border border-forest-800/40 rounded-2xl p-4 text-stone-100 shadow-sm backdrop-blur-md ${className}`}
    >
      <header className="flex items-center justify-between pb-3 border-b border-forest-800/30">
        <div className="flex items-center space-x-2">
          <span className="text-base font-semibold text-forest-300">🌱 Quiet Catch-Up</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-forest-800/50 text-forest-200">
            {summary.unreadCount} non lus
          </span>
        </div>
        <button
          type="button"
          aria-label="Fermer le résumé"
          onClick={onDismiss}
          className="min-h-[44px] min-w-[44px] h-[44px] px-3 flex items-center justify-center text-forest-300/80 hover:text-stone-100 rounded-lg text-sm transition-colors"
        >
          Fermer
        </button>
      </header>

      <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-stone-200">
        {summary.bullets.map((bullet, idx) => (
          <li key={idx} className="flex items-start space-x-2">
            <span className="text-forest-400 mt-1 select-none">•</span>
            <div className="flex-1">
              <span>{bullet.text}</span>
              {bullet.citations && bullet.citations.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {bullet.citations.map((c, cIdx) => (
                    <button
                      key={cIdx}
                      type="button"
                      aria-label={`Aller au message séquence ${c.sequenceNumber}`}
                      onClick={() => onCitationClick && onCitationClick(c.sequenceNumber)}
                      className="min-h-[44px] min-w-[44px] h-[44px] px-2.5 inline-flex items-center text-xs font-mono font-medium rounded-md bg-forest-900/40 text-forest-300 border border-forest-700/50 hover:bg-forest-800/60 transition-colors"
                    >
                      {c.rawCitation}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
