'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import { StepCard } from './StepCard';
import { recalculateDayMetrics, type PlannerStep } from './plannerEngine';
import { GlassCapsuleBtn, GlassSubCard } from '@/components/ui';
import { formatCivilDayIndex } from '@/lib/dates/tripDates';

export interface DayViewProps {
  dayNumber: number;
  startDate?: string | null;
  steps: PlannerStep[];
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

  return (
    <div className="space-y-4">
      {/* En-tête de la journée */}
      <div className="glass rounded-[var(--lkv-radius-card)] p-4 sm:p-5 border border-white/60 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--lkv-text-primary)] glass-sub-card px-2.5 py-0.5 rounded-[var(--lkv-radius-full)] border border-white/60">
                Jour {dayNumber}
              </span>
              {fullDate && (
                <span className="text-xs font-medium text-[var(--lkv-text-secondary)] capitalize">
                  {fullDate}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[var(--lkv-text-primary)] mt-1 font-display">
              Itinéraire de la journée
            </h2>
          </div>

          {/* Actions de journée */}
          {canEdit && (
            <div className="relative flex items-center gap-2">
              <GlassCapsuleBtn
                size="sm"
                onClick={() => onAddStep(dayNumber)}
                icon={<Icon name="plus" className="w-3.5 h-3.5" />}
                className="hidden sm:inline-flex"
              >
                <span>Ajouter étape</span>
              </GlassCapsuleBtn>

              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                aria-label="Options de la journée"
                className="w-8 h-8 rounded-full glass-sub-card border border-white/60 flex items-center justify-center text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] hover:bg-white transition-all cursor-pointer shadow-2xs"
              >
                <Icon name="more-vertical" className="w-4 h-4" />
              </button>

              {/* Menu contextuel de la journée */}
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-11 z-40 w-56 glass rounded-[var(--lkv-radius-md)] border border-white/80 shadow-xl py-1.5 text-xs text-[var(--lkv-text-primary)] animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onAddStep(dayNumber);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-white/60 text-left cursor-pointer"
                    >
                      <Icon name="plus" className="w-4 h-4 text-[var(--lkv-primary)]" />
                      <span>Ajouter une étape</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onInsertDayAfter(dayNumber);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-white/60 text-left cursor-pointer"
                    >
                      <Icon name="calendar-plus" className="w-4 h-4 text-[var(--lkv-primary)]" />
                      <span>Insérer un jour après</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onDuplicateDay(dayNumber);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-white/60 text-left cursor-pointer"
                    >
                      <Icon name="copy" className="w-4 h-4 text-[var(--lkv-primary)]" />
                      <span>Dupliquer la journée</span>
                    </button>
                    <div className="my-1 border-t border-white/40" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onDeleteDay(dayNumber);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[var(--lkv-danger)]/10 text-left text-[var(--lkv-danger)] font-medium cursor-pointer"
                    >
                      <Icon name="trash2" className="w-4 h-4 text-[var(--lkv-danger)]" />
                      <span>Supprimer la journée</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Barre de métriques déterministes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-4 pt-3 border-t border-white/40">
          <div className="glass-sub-card rounded-[var(--lkv-radius-md)] p-2.5 flex items-center gap-2.5 border border-white/50 shadow-2xs">
            <div className="w-8 h-8 rounded-full bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)] flex items-center justify-center shrink-0">
              <Icon name="map-pin" className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9.5px] font-mono uppercase tracking-wider text-[var(--lkv-text-secondary)] block">
                Distance
              </span>
              <span className="text-sm font-bold text-[var(--lkv-text-primary)]">
                {metrics.totalDistanceKm} km
              </span>
            </div>
          </div>

          <div className="glass-sub-card rounded-[var(--lkv-radius-md)] p-2.5 flex items-center gap-2.5 border border-white/50 shadow-2xs">
            <div className="w-8 h-8 rounded-full bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)] flex items-center justify-center shrink-0">
              <Icon name="trending-up" className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9.5px] font-mono uppercase tracking-wider text-[var(--lkv-text-secondary)] block">
                Dénivelé
              </span>
              <span className="text-sm font-bold text-[var(--lkv-text-primary)]">
                +{metrics.totalElevationGainM}m
              </span>
            </div>
          </div>

          <div className="glass-sub-card rounded-[var(--lkv-radius-md)] p-2.5 flex items-center gap-2.5 border border-white/50 shadow-2xs">
            <div className="w-8 h-8 rounded-full bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)] flex items-center justify-center shrink-0">
              <Icon name="clock" className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9.5px] font-mono uppercase tracking-wider text-[var(--lkv-text-secondary)] block">
                Durée est.
              </span>
              <span className="text-sm font-bold text-[var(--lkv-text-primary)]">
                {formatDuration(metrics.estimatedDurationMinutes)}
              </span>
            </div>
          </div>

          <div className="glass-sub-card rounded-[var(--lkv-radius-md)] p-2.5 flex items-center gap-2.5 border border-white/50 shadow-2xs">
            <div className="w-8 h-8 rounded-full bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)] flex items-center justify-center shrink-0">
              <Icon name="footprints" className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9.5px] font-mono uppercase tracking-wider text-[var(--lkv-text-secondary)] block">
                Étapes
              </span>
              <span className="text-sm font-bold text-[var(--lkv-text-primary)]">
                {metrics.stepsCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Liste ordonnée des étapes */}
      {steps.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-[var(--lkv-radius-card)] glass border border-dashed border-white/60 shadow-sm">
          <div className="w-12 h-12 rounded-full glass-sub-card text-[var(--lkv-primary)] flex items-center justify-center mx-auto mb-3 shadow-2xs">
            <Icon name="footprints" className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-[var(--lkv-text-primary)] text-base font-display">
            Aucune étape pour cette journée
          </h3>
          <p className="text-xs text-[var(--lkv-text-secondary)] max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
            Cette journée peut servir de temps libre, de repos ou d’acclimatation.
          </p>
          {canEdit && (
            <GlassCapsuleBtn
              variant="primary"
              size="sm"
              onClick={() => onAddStep(dayNumber)}
              icon={<Icon name="plus" className="w-3.5 h-3.5" />}
            >
              <span>Ajouter la première étape</span>
            </GlassCapsuleBtn>
          )}
        </div>
      ) : (
        <div className="space-y-3">
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
            <GlassCapsuleBtn
              size="sm"
              onClick={() => onAddStep(dayNumber)}
              icon={<Icon name="plus" className="w-3.5 h-3.5" />}
              className="sm:hidden w-full !py-2.5"
            >
              <span>Ajouter une étape au Jour {dayNumber}</span>
            </GlassCapsuleBtn>
          )}
        </div>
      )}
    </div>
  );
}
