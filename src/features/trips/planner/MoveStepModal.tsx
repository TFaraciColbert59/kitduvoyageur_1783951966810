'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import type { PlannerStep } from './plannerEngine';
import { formatCivilDayIndex } from '@/lib/dates/tripDates';
import { Badge, ListItem, Modal } from '@/components/ui';

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
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Déplacer l’étape — ${step.title}`}
    >
      <div className="space-y-[var(--space-2)] pr-1">
        <p className="mb-[var(--space-3)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
          Sélectionnez la journée de destination (actuellement au Jour {step.day_number}) :
        </p>

        <ul className="space-y-[var(--space-2)]">
          {daysList.map((dayNum) => {
            const isCurrent = step.day_number === dayNum;
            const daySteps = steps.filter((s) => s.day_number === dayNum);
            const dateStr = formatDayDate(dayNum);

            return (
              <li key={dayNum}>
                <ListItem
                  disabled={isCurrent}
                  selected={isCurrent}
                  onClick={() => handlePick(dayNum)}
                  leading={
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-[length:var(--lkv-text-caption-2)] font-bold ${
                        isCurrent
                          ? 'bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]'
                          : 'border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)]  text-[color:var(--lkv-primary)]'
                      }`}
                    >
                      J{dayNum}
                    </span>
                  }
                  title={
                    <span className="flex items-center gap-[var(--space-2)]">
                      <span>Jour {dayNum}</span>
                      {isCurrent && <Badge tone="sage">Actuel</Badge>}
                    </span>
                  }
                  subtitle={
                    <span className="flex items-center gap-[var(--space-2)]">
                      {dateStr && <span>{dateStr}</span>}
                      <span>•</span>
                      <span>{daySteps.length} étape(s)</span>
                    </span>
                  }
                  trailing={
                    !isCurrent ? (
                      <Icon
                        name="arrow-right"
                        size={16}
                        className="shrink-0 text-[color:var(--lkv-primary)]"
                      />
                    ) : undefined
                  }
                  className="min-h-[48px]"
                />
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
