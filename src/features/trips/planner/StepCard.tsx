'use client';

import React from 'react';
import {
  Footprints,
  Car,
  Bus,
  Train,
  Plane,
  Ship,
  Bike,
  Compass,
  ChevronUp,
  ChevronDown,
  ArrowRightLeft,
  Pencil,
  Trash2,
  MapPin,
  BedDouble,
} from 'lucide-react';
import type { PlannerStep } from './plannerEngine';

export interface StepCardProps {
  step: PlannerStep;
  isFirst: boolean;
  isLast: boolean;
  canEdit: boolean;
  onMoveUp: (stepId: string) => void;
  onMoveDown: (stepId: string) => void;
  onEdit: (step: PlannerStep) => void;
  onMoveToDay: (step: PlannerStep) => void;
  onDelete: (stepId: string) => void;
}

function getTransportIcon(mode?: string | null) {
  const m = (mode || '').toLowerCase();
  switch (m) {
    case 'flight':
    case 'plane':
      return Plane;
    case 'train':
      return Train;
    case 'car':
      return Car;
    case 'bus':
      return Bus;
    case 'boat':
      return Ship;
    case 'bike':
      return Bike;
    case 'hiking':
    case 'walking':
    case 'foot':
      return Footprints;
    default:
      return Compass;
  }
}

function getTransportLabel(mode?: string | null): string {
  const m = (mode || '').toLowerCase();
  switch (m) {
    case 'flight':
    case 'plane':
      return 'Vol';
    case 'train':
      return 'Train';
    case 'car':
      return 'Voiture';
    case 'bus':
      return 'Bus';
    case 'boat':
      return 'Bateau';
    case 'bike':
      return 'Vélo';
    case 'hiking':
      return 'Rando';
    case 'walking':
    case 'foot':
      return 'À pied';
    default:
      return 'Étape';
  }
}

export function StepCard({
  step,
  isFirst,
  isLast,
  canEdit,
  onMoveUp,
  onMoveDown,
  onEdit,
  onMoveToDay,
  onDelete,
}: StepCardProps) {
  const Icon = getTransportIcon(step.transport_mode);
  const modeLabel = getTransportLabel(step.transport_mode);

  return (
    <div className="glass rounded-[var(--lkv-radius-card)] p-4 sm:p-5 border border-white/60 shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        {/* En-tête de l'étape & Titre */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full glass-sub-card border border-white/60 text-[var(--lkv-primary)] flex items-center justify-center shrink-0 shadow-2xs">
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full glass-sub-card text-[var(--lkv-primary)] border border-white/60 shadow-2xs">
                {modeLabel}
              </span>
              {step.location_name && (
                <span className="text-xs text-[var(--lkv-text-muted)] flex items-center gap-1 truncate max-w-[200px]">
                  <MapPin className="w-3.5 h-3.5 text-[var(--lkv-primary)] shrink-0" />
                  {step.location_name}
                </span>
              )}
            </div>

            <h4 className="font-semibold text-[var(--lkv-text)] text-sm sm:text-base leading-snug break-words">
              {step.title}
            </h4>

            {step.description && (
              <p className="text-xs text-[var(--lkv-text-muted)] mt-1 line-clamp-2 leading-relaxed">
                {step.description}
              </p>
            )}

            {/* Badges de métriques */}
            <div className="flex items-center gap-2 mt-3 flex-wrap text-xs font-medium">
              {step.distance_km != null && step.distance_km > 0 && (
                <span className="inline-flex items-center gap-1 glass-sub-card px-2.5 py-1 rounded-full border border-white/60 text-xs font-semibold text-[var(--lkv-primary)] shadow-2xs">
                  {step.distance_km} km
                </span>
              )}
              {step.elevation_gain_m != null && step.elevation_gain_m > 0 && (
                <span className="inline-flex items-center gap-1 glass-sub-card px-2.5 py-1 rounded-full border border-white/60 text-xs font-semibold text-[var(--lkv-primary)] shadow-2xs">
                  +{step.elevation_gain_m}m D+
                </span>
              )}
              {step.elevation_loss_m != null && step.elevation_loss_m > 0 && (
                <span className="inline-flex items-center gap-1 glass-sub-card px-2.5 py-1 rounded-full border border-white/60 text-xs font-semibold text-[var(--lkv-text-muted)] shadow-2xs">
                  -{step.elevation_loss_m}m D-
                </span>
              )}
              {step.accommodation_name && (
                <span className="inline-flex items-center gap-1 glass-sub-card px-2.5 py-1 rounded-full border border-white/60 text-xs text-[var(--lkv-primary)] font-medium shadow-2xs truncate max-w-[200px]">
                  <BedDouble className="w-3.5 h-3.5 text-[var(--lkv-primary)] shrink-0" />
                  {step.accommodation_name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Contrôles tactiles et accessibles (min 44px) */}
        {canEdit && (
          <div className="flex flex-col sm:flex-row items-center gap-1.5 shrink-0 ml-2">
            {/* Monter / Descendre */}
            <div className="flex sm:flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => onMoveUp(step.id)}
                disabled={isFirst}
                aria-label="Monter cette étape"
                className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all shadow-2xs ${
                  isFirst
                    ? 'opacity-30 cursor-not-allowed border border-white/30 text-[var(--lkv-text-muted)]'
                    : 'glass-sub-card border border-white/60 text-[var(--lkv-text-muted)] hover:text-[var(--lkv-primary)] hover:bg-white/90 active:scale-95'
                }`}
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onMoveDown(step.id)}
                disabled={isLast}
                aria-label="Descendre cette étape"
                className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all shadow-2xs ${
                  isLast
                    ? 'opacity-30 cursor-not-allowed border border-white/30 text-[var(--lkv-text-muted)]'
                    : 'glass-sub-card border border-white/60 text-[var(--lkv-text-muted)] hover:text-[var(--lkv-primary)] hover:bg-white/90 active:scale-95'
                }`}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Déplacer vers un autre jour */}
            <button
              type="button"
              onClick={() => onMoveToDay(step)}
              aria-label="Déplacer vers un autre jour"
              title="Déplacer vers un autre jour"
              className="w-9 h-9 sm:w-8 sm:h-8 rounded-full glass-sub-card border border-white/60 flex items-center justify-center text-[var(--lkv-text-muted)] hover:text-[var(--lkv-primary)] hover:bg-white/90 active:scale-95 transition-all shadow-2xs"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>

            {/* Modifier */}
            <button
              type="button"
              onClick={() => onEdit(step)}
              aria-label="Modifier l'étape"
              title="Modifier"
              className="w-9 h-9 sm:w-8 sm:h-8 rounded-full glass-sub-card border border-white/60 flex items-center justify-center text-[var(--lkv-text-muted)] hover:text-[var(--lkv-primary)] hover:bg-white/90 active:scale-95 transition-all shadow-2xs"
            >
              <Pencil className="w-4 h-4" />
            </button>

            {/* Supprimer */}
            <button
              type="button"
              onClick={() => onDelete(step.id)}
              aria-label="Supprimer l'étape"
              title="Supprimer"
              className="w-9 h-9 sm:w-8 sm:h-8 rounded-full glass-sub-card border border-white/60 flex items-center justify-center text-[var(--lkv-text-muted)] hover:text-[var(--lkv-danger)] hover:bg-[var(--lkv-danger)]/10 active:scale-95 transition-all shadow-2xs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
