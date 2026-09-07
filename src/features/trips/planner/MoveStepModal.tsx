'use client';

import React from 'react';
import { X, ArrowRight } from 'lucide-react';
import type { PlannerStep } from './plannerEngine';
import { formatCivilDayIndex } from '@/lib/dates/tripDates';

export interface MoveStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  step: PlannerStep | null;
  daysCount: number;
  startDate?: string | null;
  steps: PlannerStep[];
  onSelectTargetDay: (stepId: string, fromDay: number, toDay: number) => Promise<void>;
}

export function MoveStepModal({
  isOpen,
  onClose,
  step,
  daysCount,
  startDate,
  steps,
  onSelectTargetDay,
}: MoveStepModalProps) {
  if (!isOpen || !step) return null;

  const daysList = Array.from({ length: Math.max(1, daysCount) }, (_, i) => i + 1);

  function formatDayDate(dayIndex: number): string | null {
    return formatCivilDayIndex(startDate, dayIndex, { weekday: 'short', month: 'short' });
  }

  async function handlePick(targetDay: number) {
    if (!step) return;
    await onSelectTargetDay(step.id, step.day_number, targetDay);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full sm:max-w-md glass rounded-t-3xl sm:rounded-[var(--lkv-radius-card)] border border-white/60 shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/40">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--lkv-primary)]">
              Déplacer l’étape
            </span>
            <h3 className="font-bold text-base text-[var(--lkv-text-primary)] truncate max-w-[260px]">
              {step.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-9 h-9 rounded-full flex items-center justify-center glass-sub-card border border-white/60 text-[var(--lkv-text-muted)] hover:text-[var(--lkv-primary)] transition-all shadow-2xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Liste des jours */}
        <div className="p-4 overflow-y-auto space-y-2">
          <p className="text-xs text-[var(--lkv-text-muted)] mb-3">
            Sélectionnez la journée de destination (actuellement au Jour {step.day_number}) :
          </p>

          {daysList.map((dayNum) => {
            const isCurrent = step.day_number === dayNum;
            const daySteps = steps.filter((s) => s.day_number === dayNum);
            const dateStr = formatDayDate(dayNum);

            return (
              <button
                key={dayNum}
                type="button"
                disabled={isCurrent}
                onClick={() => handlePick(dayNum)}
                className={`w-full flex items-center justify-between p-3.5 rounded-[var(--lkv-radius-md)] border text-left transition-all min-h-[48px] shadow-2xs ${
                  isCurrent
                    ? 'glass-sub-card border-white/30 opacity-60 cursor-not-allowed'
                    : 'glass-sub-card border-white/60 hover:bg-white/90 active:scale-[0.99]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs ${
                      isCurrent
                        ? 'bg-[var(--lkv-primary)] text-white'
                        : 'glass border border-white/60 text-[var(--lkv-primary)]'
                    }`}
                  >
                    J{dayNum}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[var(--lkv-text-primary)] flex items-center gap-2">
                      <span>Jour {dayNum}</span>
                      {isCurrent && (
                        <span className="text-[10px] bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)] px-2 py-0.5 rounded-full font-medium border border-[var(--lkv-primary)]/20">
                          Actuel
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--lkv-text-muted)] flex items-center gap-2 mt-0.5">
                      {dateStr && <span>{dateStr}</span>}
                      <span>•</span>
                      <span>{daySteps.length} étape(s)</span>
                    </div>
                  </div>
                </div>

                {!isCurrent && (
                  <ArrowRight className="w-4 h-4 text-[var(--lkv-primary)] shrink-0 mr-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
