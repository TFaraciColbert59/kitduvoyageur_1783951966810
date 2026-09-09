'use client';

import React, { useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
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
              className={`snap-start flex flex-col items-start px-3.5 py-2 rounded-[var(--lkv-radius-md)] transition-all shrink-0 min-h-[44px] min-w-[72px] text-left select-none cursor-pointer border active:scale-95 ${
                isSelected
                  ? 'bg-[var(--lkv-primary)] text-white border-[var(--lkv-primary)] shadow-sm'
                  : 'glass-sub-card border border-white/50 text-[var(--lkv-text-primary)] hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <span className="text-xs font-bold tracking-tight">Jour {dayNum}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-black/5 text-[var(--lkv-text-secondary)]'
                  }`}
                >
                  {daySteps.length}
                </span>
              </div>
              {dateStr && (
                <span
                  className={`text-[10px] truncate max-w-[85px] mt-0.5 ${
                    isSelected ? 'text-white/80' : 'text-[var(--lkv-text-secondary)]'
                  }`}
                >
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
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-[var(--lkv-radius-md)] glass-sub-card border border-dashed border-white/80 text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] hover:bg-white transition-all shrink-0 min-h-[44px] text-xs font-semibold cursor-pointer active:scale-95"
            title="Ajouter un jour supplémentaire"
          >
            <Plus className="w-3.5 h-3.5" />
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
