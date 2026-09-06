'use client';

import React, { useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import type { PlannerStep } from './plannerEngine';

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
    if (!startDate) return null;
    try {
      const d = new Date(startDate);
      d.setDate(d.getDate() + (dayIndex - 1));
      return new Intl.DateTimeFormat('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(d);
    } catch {
      return null;
    }
  }

  return (
    <div className="w-full bg-surface-card/80 backdrop-blur-md border-b border-border/40 py-2.5 px-4 sticky top-0 z-20">
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth"
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
              onClick={() => onSelectDay(dayNum)}
              className={`flex flex-col items-start px-3.5 py-2 rounded-xl transition-all duration-200 shrink-0 min-h-[46px] min-w-[72px] text-left select-none ${
                isSelected
                  ? 'bg-forest-900 text-white shadow-sm ring-2 ring-forest-800/30'
                  : 'bg-surface-subtle/70 hover:bg-surface-subtle text-text-secondary hover:text-text-primary border border-border/30 active:scale-95'
              }`}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <span className="text-xs font-bold tracking-tight">Jour {dayNum}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-forest-900/10 text-forest-800'
                  }`}
                >
                  {daySteps.length}
                </span>
              </div>
              {dateStr && (
                <span
                  className={`text-[10px] truncate max-w-[85px] mt-0.5 ${
                    isSelected ? 'text-white/80' : 'text-text-muted'
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
            onClick={onAddDay}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-dashed border-forest-800/40 text-forest-800 hover:bg-forest-900/5 transition-colors shrink-0 min-h-[46px] text-xs font-medium active:scale-95"
            title="Ajouter un jour supplémentaire"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter jour</span>
          </button>
        )}
      </div>
    </div>
  );
}
