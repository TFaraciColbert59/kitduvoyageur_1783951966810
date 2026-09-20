'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import { Footprints, Car, Bus, Train, Plane, Ship, Bike, Compass } from 'lucide-react';
import type { PlannerStep } from './plannerEngine';
import { isLlmSuggestion } from '../engine/llmProvenance';
import { LlmSuggestionBadge } from '../components/LlmSuggestionBadge';
import { Badge, Card, IconButton } from '@/components/ui';

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
  const TransportIcon = getTransportIcon(step.transport_mode);
  const modeLabel = getTransportLabel(step.transport_mode);
  const llmStep = isLlmSuggestion(step.source, step.metadata);

  return (
    <Card className="sm:p-[var(--space-5)]">
      <div className="flex items-start justify-between gap-[var(--space-3)]">
        {/* En-tête de l'étape & Titre */}
        <div className="flex min-w-0 flex-1 items-start gap-[var(--space-3)]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--lkv-border-subtle)] bg-[color:var(--lkv-surface-muted)] text-[color:var(--lkv-primary)]">
            <TransportIcon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-[var(--space-2)]">
              <Badge tone="stone">{modeLabel}</Badge>
              {llmStep && <LlmSuggestionBadge />}
              {step.location_name && (
                <span className="flex max-w-[200px] items-center gap-[var(--space-1)] truncate text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
                  <Icon name="map-pin" size={14} className="shrink-0 text-[color:var(--lkv-primary)]" />
                  {step.location_name}
                </span>
              )}
            </div>

            <h4 className="break-words text-[length:var(--lkv-text-footnote)] font-semibold leading-snug text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-body-sm)]">
              {step.title}
            </h4>

            {step.description && (
              <p className="mt-1 line-clamp-2 text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--lkv-text-muted)]">
                {step.description}
              </p>
            )}

            {/* Badges de métriques */}
            <div className="mt-[var(--space-3)] flex flex-wrap items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-medium">
              {step.distance_km != null && step.distance_km > 0 && (
                <Badge tone="sage">{step.distance_km} km</Badge>
              )}
              {step.elevation_gain_m != null && step.elevation_gain_m > 0 && (
                <Badge tone="sage">+{step.elevation_gain_m}m D+</Badge>
              )}
              {step.elevation_loss_m != null && step.elevation_loss_m > 0 && (
                <Badge tone="stone">-{step.elevation_loss_m}m D-</Badge>
              )}
              {step.accommodation_name && (
                <Badge tone="stone" className="max-w-[200px] truncate">
                  <Icon
                    name="bed-double"
                    size={14}
                    className="shrink-0 text-[color:var(--lkv-primary)]"
                  />
                  {step.accommodation_name}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Contrôles tactiles et accessibles (min 44px) */}
        {canEdit && (
          <div className="ml-[var(--space-2)] flex shrink-0 flex-col items-center gap-[var(--space-1)] sm:flex-row">
            {/* Monter / Descendre */}
            <div className="flex items-center gap-[var(--space-1)] sm:flex-col">
              <IconButton
                type="button"
                size="sm"
                onClick={() => onMoveUp(step.id)}
                disabled={isFirst}
                aria-label="Monter cette étape"
              >
                <Icon name="chevron-up" size={16} />
              </IconButton>
              <IconButton
                type="button"
                size="sm"
                onClick={() => onMoveDown(step.id)}
                disabled={isLast}
                aria-label="Descendre cette étape"
              >
                <Icon name="chevron-down" size={16} />
              </IconButton>
            </div>

            {/* Déplacer vers un autre jour */}
            <IconButton
              type="button"
              size="sm"
              onClick={() => onMoveToDay(step)}
              aria-label="Déplacer vers un autre jour"
              title="Déplacer vers un autre jour"
            >
              <Icon name="arrow-right-left" size={16} />
            </IconButton>

            {/* Modifier */}
            <IconButton
              type="button"
              size="sm"
              onClick={() => onEdit(step)}
              aria-label="Modifier l'étape"
              title="Modifier"
            >
              <Icon name="pencil" size={16} />
            </IconButton>

            {/* Supprimer */}
            <IconButton
              type="button"
              size="sm"
              onClick={() => onDelete(step.id)}
              aria-label="Supprimer l'étape"
              title="Supprimer"
            >
              <Icon name="trash2" size={16} />
            </IconButton>
          </div>
        )}
      </div>
    </Card>
  );
}
