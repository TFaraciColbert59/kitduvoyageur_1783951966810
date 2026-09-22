'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import { StepCard } from './StepCard';
import { recalculateDayMetrics, type PlannerStep } from './plannerEngine';
import { Badge, Button, Card, EmptyState, IconButton } from '@/components/ui';
import { formatCivilDayIndex } from '@/lib/dates/tripDates';
import { ActivitySectionSkeleton } from '@/features/hub/components/live/ActivitySectionSkeleton';

export interface DayViewProps {
  dayNumber: number;
  startDate?: string | null;
  steps: PlannerStep[];
  /** IMPORTANT 7 — enrichissement en attente + zéro étape → squelette timeline. */
  enrichmentPending?: boolean;
  canEdit: boolean;
  onAddStep: (dayNumber: number) => void;
  onEditStep: (step: PlannerStep) => void;
  onDeleteStep: (stepId: string) => void;
  onMoveUpStep: (stepId: string) => void;
  onMoveDownStep: (stepId: string) => void;
  onMoveToDay: (step: PlannerStep) => void;
  onInsertDayAfter: (dayNumber: number) => void;
  onDuplicateDay: (dayNumber: number) => void;
  onDeleteDay: (dayNumber: number) => void;
}

export function DayView({
  dayNumber,
  startDate,
  steps,
  enrichmentPending = false,
  canEdit,
  onAddStep,
  onEditStep,
  onDeleteStep,
  onMoveUpStep,
  onMoveDownStep,
  onMoveToDay,
  onInsertDayAfter,
  onDuplicateDay,
  onDeleteDay,
}: DayViewProps) {
  const [showMenu, setShowMenu] = useState(false);
  const metrics = recalculateDayMetrics(steps);

  function formatFullDate(dayIndex: number): string | null {
    return formatCivilDayIndex(startDate, dayIndex, {
      weekday: 'long',
      month: 'long',
      includeYear: true,
    });
  }

  function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
  }

  const fullDate = formatFullDate(dayNumber);

  const menuItems = [
    {
      label: 'Ajouter une étape',
      icon: 'plus',
      onSelect: () => onAddStep(dayNumber),
    },
    {
      label: 'Insérer un jour après',
      icon: 'calendar-plus',
      onSelect: () => onInsertDayAfter(dayNumber),
    },
    {
      label: 'Dupliquer la journée',
      icon: 'copy',
      onSelect: () => onDuplicateDay(dayNumber),
    },
    {
      label: 'Supprimer la journée',
      icon: 'trash2',
      destructive: true,
      onSelect: () => onDeleteDay(dayNumber),
    },
  ] as const;

  return (
    <div className="space-y-[var(--space-4)]">
      {/* En-tête de la journée */}
      <Card className="sm:p-[var(--space-6)]">
        <div className="flex items-start justify-between gap-[var(--space-4)]">
          <div>
            <div className="flex items-center gap-[var(--space-2)]">
              <Badge tone="stone">Jour {dayNumber}</Badge>
              {fullDate && (
                <span className="text-[length:var(--lkv-text-footnote)] font-medium capitalize text-[color:var(--lkv-text-secondary)]">
                  {fullDate}
                </span>
              )}
            </div>
            <h2 className="mt-1.5 font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
              Itinéraire de la journée
            </h2>
          </div>

          {/* Actions de journée */}
          {canEdit && (
            <div className="relative flex items-center gap-[var(--space-2)]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onAddStep(dayNumber)}
                icon={<Icon name="plus" size={14} />}
                className="hidden sm:inline-flex"
              >
                Ajouter étape
              </Button>

              <IconButton
                type="button"
                size="sm"
                onClick={() => setShowMenu(!showMenu)}
                aria-label="Options de la journée"
                aria-expanded={showMenu}
              >
                <Icon name="more-vertical" size={16} />
              </IconButton>

              {/* Menu contextuel de la journée */}
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-[var(--z-sticky)]"
                    onClick={() => setShowMenu(false)}
                    aria-hidden="true"
                  />
                  <div
                    className="absolute right-0 top-11 z-[var(--z-fab)] w-56 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] py-1.5 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)] shadow-elevation-3 animate-in fade-in zoom-in-95"
                    role="menu"
                  >
                    {menuItems.map((item) => (
                      <Button
                        key={item.label}
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setShowMenu(false);
                          item.onSelect();
                        }}
                        icon={<Icon name={item.icon} size={16} />}
                        className={`w-full justify-start gap-[var(--space-3)] whitespace-normal rounded-[var(--lkv-radius-sm)] px-[var(--space-3)] font-normal ${
                          'destructive' in item && item.destructive
                            ? 'text-[color:var(--lkv-danger)]'
                            : ''
                        }`}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Barre de métriques déterministes */}
        <div className="mt-[var(--space-5)] grid grid-cols-2 gap-[var(--space-3)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-4)] sm:grid-cols-4">
          <Card variant="compact" className="flex items-center gap-[var(--space-3)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-primary)]">
              <Icon name="map-pin" size={16} />
            </div>
            <div>
              <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--lkv-text-secondary)]">
                Distance
              </span>
              <span className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                {metrics.totalDistanceKm} km
              </span>
            </div>
          </Card>

          <Card variant="compact" className="flex items-center gap-[var(--space-3)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-primary)]">
              <Icon name="trending-up" size={16} />
            </div>
            <div>
              <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--lkv-text-secondary)]">
                Dénivelé
              </span>
              <span className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                +{metrics.totalElevationGainM}m
              </span>
            </div>
          </Card>

          <Card variant="compact" className="flex items-center gap-[var(--space-3)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-primary)]">
              <Icon name="clock" size={16} />
            </div>
            <div>
              <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--lkv-text-secondary)]">
                Durée est.
              </span>
              <span className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                {formatDuration(metrics.estimatedDurationMinutes)}
              </span>
            </div>
          </Card>

          <Card variant="compact" className="flex items-center gap-[var(--space-3)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-primary)]">
              <Icon name="footprints" size={16} />
            </div>
            <div>
              <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--lkv-text-secondary)]">
                Étapes
              </span>
              <span className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                {metrics.stepsCount}
              </span>
            </div>
          </Card>
        </div>
      </Card>

      {/* Liste ordonnée des étapes */}
      {steps.length === 0 ? (
        enrichmentPending ? (
          <ActivitySectionSkeleton variant="timeline" />
        ) : (
          <Card className="border-dashed">
            <EmptyState
              icon={<Icon name="footprints" size={24} />}
              title="Aucune étape pour cette journée"
              description="Cette journée peut servir de temps libre, de repos ou d’acclimatation."
              actionLabel={canEdit ? 'Ajouter la première étape' : undefined}
              onAction={canEdit ? () => onAddStep(dayNumber) : undefined}
            />
          </Card>
        )
      ) : (
        <div className="space-y-[var(--space-3)]">
          {steps.map((step, idx) => (
            <StepCard
              key={step.id}
              step={step}
              isFirst={idx === 0}
              isLast={idx === steps.length - 1}
              canEdit={canEdit}
              onMoveUp={onMoveUpStep}
              onMoveDown={onMoveDownStep}
              onEdit={onEditStep}
              onMoveToDay={onMoveToDay}
              onDelete={onDeleteStep}
            />
          ))}

          {/* Bouton mobile pour ajouter rapidement */}
          {canEdit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onAddStep(dayNumber)}
              icon={<Icon name="plus" size={14} />}
              fullWidth
              className="sm:hidden"
            >
              Ajouter une étape au Jour {dayNumber}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
