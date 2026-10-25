'use client';

import Icon from '@/components/ui/Icon';
import React, { useRef, useEffect } from 'react';
import type { PlannerStep } from './plannerEngine';
import { formatCivilDayIndex } from '@/lib/dates/tripDates';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Button, Chip } from '@/components/ui';

export interface DayNavigatorProps {
  daysCount: number;
  selectedDay: number;
  onSelectDay: (dayNumber: number) => void;
  onAddDay: () => void;
  startDate?: string | null;
  steps: PlannerStep[];
  canEdit: boolean;
}

export function DayNavigator({
  daysCount,
  selectedDay,
  onSelectDay,
  onAddDay,
  startDate,
  steps,
  canEdit,
}: DayNavigatorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { triggerHaptic } = useHapticFeedback();

  // Défilement automatique pour garder le jour actif centré/visible sur mobile
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeBtn = scrollContainerRef.current.querySelector<HTMLElement>(
        `[data-day="${selectedDay}"]`
      );
      if (activeBtn) {
        activeBtn.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [selectedDay]);

  const daysList = Array.from({ length: Math.max(1, daysCount) }, (_, i) => i + 1);

  function formatDayDate(dayIndex: number): string | null {
    return formatCivilDayIndex(startDate, dayIndex, { weekday: 'short', month: 'short' });
  }

  return (
    <div className="relative w-full py-1">
      <div
        ref={scrollContainerRef}
        className="flex snap-x snap-mandatory items-center gap-[var(--space-2)] overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {daysList.map((dayNum) => {
          const isSelected = selectedDay === dayNum;
          const daySteps = steps.filter((s) => s.day_number === dayNum);
          const dateStr = formatDayDate(dayNum);

          return (
            <span key={dayNum} data-day={dayNum} className="shrink-0 snap-start">
              <Chip
                selected={isSelected}
                onClick={() => {
                  triggerHaptic('selection');
                  onSelectDay(dayNum);
                }}
                className="min-w-[72px] flex-col items-start py-[var(--space-2)] text-left"
              >
                <span className="flex w-full items-center justify-between gap-[var(--space-2)]">
                  <span className="text-[length:var(--lkv-text-caption-2)] font-bold tracking-tight">
                    Jour {dayNum}
                  </span>
                  <span className="rounded-full bg-black/10 px-1.5 py-0.5 font-mono text-[9px] font-bold">
                    {daySteps.length}
                  </span>
                </span>
                {dateStr && (
                  <span className="mt-0.5 block max-w-[85px] truncate text-[10px]">{dateStr}</span>
                )}
              </Chip>
            </span>
          );
        })}

        {/* Bouton pour insérer un jour en fin de voyage */}
        {canEdit && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={<Icon name="plus" size={14} />}
            onClick={() => {
              triggerHaptic('light');
              onAddDay();
            }}
            className="shrink-0"
            title="Ajouter un jour supplémentaire"
          >
            Ajouter jour
          </Button>
        )}
      </div>
      {/* Fondu de bord (plus de chips coupés brutalement) */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-[linear-gradient(to_left,var(--lkv-surface-card),transparent)]"
        aria-hidden="true"
      />
    </div>
  );
}
