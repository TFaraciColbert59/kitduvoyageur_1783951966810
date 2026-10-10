'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { QuietCatchUpSummary, SummaryCitation } from '../types/terra.types';

export interface QuietCatchUpCardProps {
  summary: QuietCatchUpSummary;
  onSelectCitation?: (sequenceNumber: number) => void;
  onDismiss?: () => void;
  className?: string;
}

export const QuietCatchUpCard: React.FC<QuietCatchUpCardProps> = ({
  summary,
  onSelectCitation,
  onDismiss,
  className = '',
}) => {
  const { haptic } = useHapticFeedback();
  const { unreadRange, bullets, keyDecisions, actionItems } = summary;

  const handleCitationClick = (seq: number) => {
    haptic('light');
    onSelectCitation?.(seq);
  };

  const handleDismiss = () => {
    haptic('light');
    onDismiss?.();
  };

  const getTopicIcon = (topic: string) => {
    switch (topic) {
      case 'gear':
        return '🎒';
      case 'weather':
        return '⛅';
      case 'safety':
        return '⚠️';
      case 'logistics':
        return '📍';
      default:
        return '💬';
    }
  };

  return (
    <article
      aria-label="Résumé Quiet Catch-Up par Terra AI"
      className={`relative my-3 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] p-4 text-[color:var(--lkv-text-primary)] shadow-elevation-2 backdrop-blur-[var(--glass-blur-sm)] transition-all ${className}`}
    >
      {/* Header : Terra AI Badge & Unread Range & Dismiss Button */}
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] pb-3 dark:border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
            <span className="text-base" role="img" aria-label="Terra AI">
              ✨
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight">Quiet Catch-Up</span>
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                Terra AI
              </span>
            </div>
            <p className="text-xs text-[color:var(--lkv-text-secondary)]">
              Messages #{unreadRange.fromSequence} à #{unreadRange.toSequence} ({unreadRange.totalMessages} non lus)
            </p>
          </div>
        </div>

        {/* Apple HIG 44px Dismiss Button */}
        {onDismiss && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Fermer le résumé"
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-black/[0.05] hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-200"
          >
            <span className="text-lg">✕</span>
          </button>
        )}
      </div>

      {/* Summary Bullets with Interactive Citations */}
      <div className="mt-3.5 space-y-2.5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]">
          Points clés de la discussion
        </h4>
        <ul className="space-y-2">
          {bullets.map((bullet) => (
            <li
              key={bullet.id}
              className="flex items-start gap-2.5 rounded-xl bg-black/[0.02] p-2.5 text-xs leading-relaxed dark:bg-white/[0.02]"
            >
              <span className="text-sm select-none" aria-hidden="true">
                {getTopicIcon(bullet.topic)}
              </span>
              <div className="flex-1">
                <span className="font-medium">{bullet.text}</span>

                {/* Clickable Citation Badges */}
                {bullet.citations && bullet.citations.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {bullet.citations.map((cit, idx) => (
                      <button
                        key={`${bullet.id}-cit-${cit.sequenceNumber}-${idx}`}
                        type="button"
                        onClick={() => handleCitationClick(cit.sequenceNumber)}
                        aria-label={`Voir le message #${cit.sequenceNumber} par @${cit.authorName}`}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-black/[0.08] bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 shadow-sm transition-all hover:bg-indigo-50 active:scale-95 dark:border-white/[0.12] dark:bg-zinc-800/90 dark:text-indigo-300 dark:hover:bg-zinc-700"
                      >
                        <span>#{cit.sequenceNumber}</span>
                        <span className="font-normal opacity-75">@{cit.authorName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Key Decisions Section */}
      {keyDecisions && keyDecisions.length > 0 && (
        <div className="mt-3.5 border-t border-black/[0.06] pt-3 dark:border-white/[0.08]">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <span>✓</span> Décisions validées
          </h4>
          <ul className="mt-1.5 space-y-1.5">
            {keyDecisions.map((dec, idx) => (
              <li
                key={`dec-${idx}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-200"
              >
                <span>{dec.decision}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Items Section */}
      {actionItems && actionItems.length > 0 && (
        <div className="mt-3.5 border-t border-black/[0.06] pt-3 dark:border-white/[0.08]">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]">
            Actions à mener
          </h4>
          <ul className="mt-1.5 space-y-1.5">
            {actionItems.map((act, idx) => (
              <li
                key={`act-${idx}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-black/[0.02] px-2.5 py-1.5 text-xs dark:bg-white/[0.02]"
              >
                <span>{act.task}</span>
                {act.assignedToName && (
                  <span className="rounded-md bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                    @{act.assignedToName}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer / Done Action */}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleDismiss}
          className="flex h-11 min-h-[44px] items-center justify-center rounded-xl bg-black/[0.05] px-4 text-xs font-semibold text-zinc-700 transition hover:bg-black/[0.08] active:scale-[0.98] dark:bg-white/[0.08] dark:text-zinc-200 dark:hover:bg-white/[0.12]"
        >
          C'est clair, fermer
        </button>
      </div>
    </article>
  );
};
