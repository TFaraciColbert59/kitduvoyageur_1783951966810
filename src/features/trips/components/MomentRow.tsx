import { Moon, Sun, Sunrise, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MOMENT_SLOT_LABELS, momentTitleBody, type MomentSlot } from '../engine/momentSlots';
import { isLlmSuggestion } from '../engine/llmProvenance';
import { LlmSuggestionBadge } from './LlmSuggestionBadge';

/**
 * Ligne de moment d'enrichissement (§4.3) — rendu compact matin / après-midi /
 * soir, distinct d'une étape d'itinéraire. Utilisé par la timeline mobile
 * (ItineraryDayTimeline) et l'onglet itinéraire desktop (TripItineraryTab).
 * Fix round final — badge « Suggestion IA » quand la ligne vient du job LLM
 * (`source` ou `metadata.source === 'llm_suggestion'`), une pastille par rangée.
 */
const SLOT_STYLES: Record<MomentSlot, { Icon: LucideIcon; tone: string }> = {
  matin: { Icon: Sunrise, tone: 'bg-[color:var(--sage-50)] text-[color:var(--sage-700)]' },
  'apres-midi': {
    Icon: Sun,
    tone: 'bg-[color:var(--lkv-secondary-subtle)] text-[color:var(--lkv-secondary-hover)]',
  },
  soir: { Icon: Moon, tone: 'bg-[color:var(--lkv-warm-300)] text-[color:var(--lkv-warm-700)]' },
};

export interface MomentRowProps {
  title: string | null | undefined;
  slot: MomentSlot;
  startTime?: string | null;
  /** Provenance additive de la ligne (`llm_suggestion`). */
  source?: string | null;
  metadata?: Record<string, unknown> | null;
  className?: string;
}

export function MomentRow({
  title,
  slot,
  startTime,
  source,
  metadata,
  className,
}: MomentRowProps) {
  const { Icon, tone } = SLOT_STYLES[slot];
  const time = startTime ? startTime.slice(0, 5) : null;
  const showBadge = isLlmSuggestion(source, metadata);

  return (
    <div
      data-moment-slot={slot}
      className={cn(
        'flex min-h-[44px] w-full items-center gap-[var(--space-3)] rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-3)] py-[var(--space-2)]',
        className
      )}
    >
      <span
        className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', tone)}
      >
        <Icon size={13} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--lkv-text-secondary)]">
          {MOMENT_SLOT_LABELS[slot]}
        </span>
        <span className="block truncate text-[12.5px] font-semibold leading-snug text-[color:var(--lkv-text-primary)]">
          {momentTitleBody(title)}
        </span>
      </span>
      {showBadge && <LlmSuggestionBadge />}
      {time && (
        <span className="shrink-0 text-[10px] font-semibold tabular-nums text-[color:var(--lkv-text-secondary)]">
          {time}
        </span>
      )}
    </div>
  );
}

export default MomentRow;
