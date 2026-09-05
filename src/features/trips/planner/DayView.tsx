'use client';

import React, { useState } from 'react';
import {
  Plus,
  Clock,
  TrendingUp,
  MapPin,
  MoreVertical,
  Copy,
  CalendarPlus,
  Trash2,
  Footprints,
} from 'lucide-react';
import { StepCard } from './StepCard';
import { recalculateDayMetrics, type PlannerStep } from './plannerEngine';
import { LkvButton } from '@/components/ui/LkvButton';

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
    if (!startDate) return null;
    try {
      const d = new Date(startDate);
      d.setDate(d.getDate() + (dayIndex - 1));
      return new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(d);
    } catch {
      return null;
    }
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
      <div className="bg-surface-card/60 backdrop-blur-sm rounded-2xl p-4 sm:p-5 border border-border/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-forest-800 bg-forest-900/10 px-2.5 py-0.5 rounded-full">
                Jour {dayNumber}
              </span>
              {fullDate && (
                <span className="text-xs font-medium text-text-secondary capitalize">
                  {fullDate}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-text-primary mt-1">
              Itinéraire de la journée
            </h2>
          </div>

          {/* Actions de journée */}
          {canEdit && (
            <div className="relative flex items-center gap-2">
              <LkvButton
                variant="secondary"
                size="sm"
                onClick={() => onAddStep(dayNumber)}
                className="hidden sm:inline-flex items-center gap-1.5 min-h-[38px]"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter étape</span>
              </LkvButton>

              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                aria-label="Options de la journée"
                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center border border-border/40 hover:bg-forest-900/5 text-text-secondary transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Menu contextuel de la journée */}
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-11 z-40 w-56 bg-surface-card border border-border/60 rounded-xl shadow-xl py-1.5 text-sm animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onAddStep(dayNumber);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-forest-900/5 text-left text-text-primary"
                    >
                      <Plus className="w-4 h-4 text-forest-800" />
                      <span>Ajouter une étape</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onInsertDayAfter(dayNumber);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-forest-900/5 text-left text-text-primary"
                    >
                      <CalendarPlus className="w-4 h-4 text-forest-800" />
                      <span>Insérer un jour après</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onDuplicateDay(dayNumber);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-forest-900/5 text-left text-text-primary"
                    >
                      <Copy className="w-4 h-4 text-forest-800" />
                      <span>Dupliquer la journée</span>
                    </button>
                    <div className="my-1 border-t border-border/30" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onDeleteDay(dayNumber);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-red-50 text-left text-red-600 font-medium"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                      <span>Supprimer la journée</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Barre de métriques déterministes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-4 pt-3 border-t border-border/30">
          <div className="bg-surface-subtle/50 rounded-xl p-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-forest-900/10 text-forest-800 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase tracking-wider block">
                Distance
              </span>
              <span className="text-sm font-bold text-text-primary">
                {metrics.totalDistanceKm} km
              </span>
            </div>
          </div>

          <div className="bg-surface-subtle/50 rounded-xl p-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-forest-900/10 text-forest-800 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase tracking-wider block">
                Dénivelé
              </span>
              <span className="text-sm font-bold text-text-primary">
                +{metrics.totalElevationGainM}m
              </span>
            </div>
          </div>

          <div className="bg-surface-subtle/50 rounded-xl p-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-forest-900/10 text-forest-800 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase tracking-wider block">
                Durée est.
              </span>
              <span className="text-sm font-bold text-text-primary">
                {formatDuration(metrics.estimatedDurationMinutes)}
              </span>
            </div>
          </div>

          <div className="bg-surface-subtle/50 rounded-xl p-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-forest-900/10 text-forest-800 flex items-center justify-center shrink-0">
              <Footprints className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase tracking-wider block">
                Étapes
              </span>
              <span className="text-sm font-bold text-text-primary">
                {metrics.stepsCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Liste ordonnée des étapes */}
      {steps.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-border/60 bg-surface-card/40">
          <div className="w-12 h-12 rounded-full bg-forest-900/5 text-forest-800 flex items-center justify-center mx-auto mb-3">
            <Footprints className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-text-primary text-base">
            Aucune étape pour cette journée
          </h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mt-1 mb-4">
            Cette journée peut servir de temps libre, de repos ou d’acclimatation.
          </p>
          {canEdit && (
            <LkvButton
              variant="primary"
              size="sm"
              onClick={() => onAddStep(dayNumber)}
              className="inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter la première étape</span>
            </LkvButton>
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
            <button
              type="button"
              onClick={() => onAddStep(dayNumber)}
              className="sm:hidden w-full py-3 rounded-xl border border-dashed border-forest-800/40 text-forest-800 font-medium text-xs flex items-center justify-center gap-1.5 hover:bg-forest-900/5 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter une étape au Jour {dayNumber}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
