'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import type { TripPhase } from '../engine/temporalPhaseEngine';

export interface TripPhaseControllerProps {
  activePhase: TripPhase;
  naturalPhase: TripPhase;
  onPhaseChange: (phase: TripPhase) => void;
  dayIndex?: number | null;
  totalDays?: number | null;
  daysUntilStart?: number | null;
}

/**
 * TripPhaseController — sélecteur de phase à double ligne (libellé + repère
 * temporel) et marqueur de phase naturelle : contenu non couvert par `Tabs`,
 * exception documentée. Surface, typo, couleurs et états consomment les tokens.
 */
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
      icon: <Icon name="compass" size={18} />,
    },
    {
      id: 'live',
      label: 'Vivre',
      subLabel: dayIndex && totalDays ? `Jour ${dayIndex}/${totalDays}` : 'Cockpit terrain',
      icon: <Icon name="flame" size={18} />,
    },
    {
      id: 'recount',
      label: 'Raconter',
      subLabel: 'Récits & bilan',
      icon: <Icon name="book-open" size={18} />,
    },
  ];

  return (
    <div className="w-full rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn p-1.5">
      <div
        className="grid grid-cols-3 gap-1.5"
        role="tablist"
        aria-label="Phases temporelles du voyage"
      >
        {phases.map((p) => {
          const isSelected = activePhase === p.id;
          const isNatural = naturalPhase === p.id;

          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onPhaseChange(p.id)}
              className={`relative flex min-h-[52px] select-none flex-col items-center justify-center gap-1.5 rounded-full px-2 py-2 font-medium transition-colors duration-200 sm:flex-row sm:gap-2.5 sm:py-3 ${
                isSelected
                  ? 'bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] text-[color:var(--lkv-text-primary)] shadow-elevation-1'
                  : 'text-[color:var(--lkv-text-secondary)] hover:bg-[color:var(--lkv-hover-surface)]'
              }`}
            >
              {/* Icône de la phase */}
              <span className="z-10">{p.icon}</span>

              {/* Titre & Sous-titre */}
              <div className="z-10 text-center sm:text-left">
                <div className="text-[length:var(--lkv-text-footnote)] font-extrabold leading-tight">
                  {p.label}
                </div>
                <div className="hidden truncate text-[10px] font-medium sm:block">{p.subLabel}</div>
              </div>

              {/* Pastille indiquant la phase temporelle naturelle en cours */}
              {isNatural && (
                <span
                  title="Phase actuelle du voyage"
                  className={`absolute right-1.5 top-1.5 z-10 flex h-2 w-2 rounded-full sm:right-2.5 sm:top-2 ${
                    isSelected
                      ? 'bg-[color:var(--lkv-accent)]'
                      : 'bg-[color:var(--lkv-success)] ring-2 ring-white'
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
