import { Moon, Sun, Sunrise, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MOMENT_SLOT_LABELS, momentTitleBody, type MomentSlot } from '../engine/momentSlots';

/**
 * Ligne de moment d'enrichissement (§4.3) — rendu compact matin / après-midi /
 * soir, distinct d'une étape d'itinéraire. Utilisé par la timeline mobile
 * (ItineraryDayTimeline) et l'onglet itinéraire desktop (TripItineraryTab).
 */
const SLOT_STYLES: Record<MomentSlot, { Icon: LucideIcon; tone: string }> = {
  matin: { Icon: Sunrise, tone: 'bg-[var(--sage-50)] text-[var(--sage-700)]' },
  'apres-midi': {
    Icon: Sun,
    tone: 'bg-[var(--lkv-secondary-subtle)] text-[var(--lkv-secondary-hover)]',
  },
  soir: { Icon: Moon, tone: 'bg-[var(--lkv-warm-300)] text-[var(--lkv-warm-700)]' },
};

export interface MomentRowProps {
  title: string | null | undefined;
  slot: MomentSlot;
  startTime?: string | null;
  className?: string;
}

export function MomentRow({ title, slot, startTime, className }: MomentRowProps) {
  const { Icon, tone } = SLOT_STYLES[slot];
  const time = startTime ? startTime.slice(0, 5) : null;

  return (
    <div
      data-moment-slot={slot}
      className={cn(
        'glass flex min-h-[44px] w-full items-center gap-2.5 rounded-[1.4rem] px-3 py-2',
        className
      )}
    >
      <span
        className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', tone)}
      >
        <Icon size={13} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--lkv-text-secondary)]">
          {MOMENT_SLOT_LABELS[slot]}
        </span>
        <span className="block truncate text-[12.5px] font-semibold leading-snug text-[var(--lkv-text-primary)]">
          {momentTitleBody(title)}
        </span>
      </span>
      {time && (
        <span className="shrink-0 text-[10px] font-semibold tabular-nums text-[var(--lkv-text-secondary)]">
          {time}
        </span>
      )}
    </div>
  );
}

export default MomentRow;
