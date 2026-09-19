'use client';

import Icon from '@/components/ui/Icon';
import React, { useRef, useEffect } from 'react';
import type { PlannerStep } from './plannerEngine';
import { formatCivilDayIndex } from '@/lib/dates/tripDates';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

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
      const activeBtn = scrollContainerRef.current.querySelector<HTMLButtonElement>(
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
        className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
      >
        {daysList.map((dayNum) => {
          const isSelected = selectedDay === dayNum;
          const daySteps = steps.filter((s) => s.day_number === dayNum);
          const dateStr = formatDayDate(dayNum);

          return (
            <button
              key={dayNum}
              data-day={dayNum}
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onSelectDay(dayNum);
              }}
              className={`glass-capsule-btn snap-start flex flex-col !items-start !justify-start !px-3.5 !py-2 !rounded-2xl transition-all shrink-0 min-w-[72px] text-left select-none cursor-pointer active:scale-95 ${
                isSelected ? 'primary shadow-sm' : ''
              }`}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <span className="text-xs font-bold tracking-tight">Jour {dayNum}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold bg-white/20">
                  {daySteps.length}
                </span>
              </div>
              {dateStr && (
                <span className="text-[10px] truncate max-w-[85px] mt-0.5">
                  {dateStr}
                </span>
              )}
            </button>
          );
        })}

        {/* Bouton pour insérer un jour en fin de voyage */}
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onAddDay();
            }}
            className="glass-capsule-btn flex items-center justify-center gap-1.5 !px-3.5 !py-2 !rounded-2xl transition-all shrink-0 text-xs font-semibold cursor-pointer active:scale-95"
            title="Ajouter un jour supplémentaire"
          >
            <Icon name="plus" className="w-3.5 h-3.5" />
            <span>Ajouter jour</span>
          </button>
        )}
      </div>
      {/* Fondu de bord (plus de chips coupés brutalement) */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-8"
        style={{ background: 'linear-gradient(to left, rgba(255,255,255,0.85), transparent)' }}
        aria-hidden="true"
      />
    </div>
  );
}
