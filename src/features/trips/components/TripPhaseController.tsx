'use client';

import React from 'react';
import { Compass, Flame, BookOpen } from 'lucide-react';
import type { TripPhase } from '../engine/temporalPhaseEngine';

export interface TripPhaseControllerProps {
  activePhase: TripPhase;
  naturalPhase: TripPhase;
  onPhaseChange: (phase: TripPhase) => void;
  dayIndex?: number | null;
  totalDays?: number | null;
  daysUntilStart?: number | null;
}

export function TripPhaseController({
  activePhase,
  naturalPhase,
  onPhaseChange,
  dayIndex,
  totalDays,
  daysUntilStart,
}: TripPhaseControllerProps) {
  const phases: {
    id: TripPhase;
    label: string;
    subLabel: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'prepare',
      label: 'Préparer',
      subLabel:
        daysUntilStart !== null && daysUntilStart !== undefined && daysUntilStart > 0
          ? `J-${daysUntilStart}`
          : 'Avant départ',
      icon: <Compass size={18} />,
    },
    {
      id: 'live',
      label: 'Vivre',
      subLabel:
        dayIndex && totalDays ? `Jour ${dayIndex}/${totalDays}` : 'Cockpit terrain',
      icon: <Flame size={18} />,
    },
    {
      id: 'recount',
      label: 'Raconter',
      subLabel: 'Récits & bilan',
      icon: <BookOpen size={18} />,
    },
  ];

  return (
    <div className="w-full bg-white/75 backdrop-blur-md p-1.5 rounded-[24px] border border-black/5 shadow-xs">
      <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="Phases temporelles du voyage">
        {phases.map(p => {
          const isSelected = activePhase === p.id;
          const isNatural = naturalPhase === p.id;

          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onPhaseChange(p.id)}
              className={`relative flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2.5 py-2 sm:py-3 px-2 rounded-[18px] font-medium transition-all duration-200 min-h-[52px] select-none ${
                isSelected
                  ? 'bg-lkv-primary text-white shadow-md'
                  : 'text-lkv-primary hover:bg-white/90 active:scale-98'
              }`}
            >
              {/* Icône de la phase */}
              <span className={isSelected ? 'text-[#A6C1A0]' : 'text-lkv-secondary'}>
                {p.icon}
              </span>

              {/* Titre & Sous-titre */}
              <div className="text-center sm:text-left">
                <div className="text-xs sm:text-sm font-extrabold leading-tight">
                  {p.label}
                </div>
                <div
                  className={`text-[10px] hidden sm:block font-medium truncate ${
                    isSelected ? 'text-white/80' : 'text-lkv-secondary'
                  }`}
                >
                  {p.subLabel}
                </div>
              </div>

              {/* Pastille indiquant la phase temporelle naturelle en cours */}
              {isNatural && (
                <span
                  title="Phase actuelle du voyage"
                  className={`absolute top-1.5 right-1.5 sm:top-2 sm:right-2.5 flex h-2 w-2 rounded-full ${
                    isSelected ? 'bg-amber-400' : 'bg-emerald-500 ring-2 ring-white'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
