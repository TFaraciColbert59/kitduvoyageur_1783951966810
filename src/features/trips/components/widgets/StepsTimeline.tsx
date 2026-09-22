'use client';

import Icon from '@/components/ui/Icon';
import React, { useMemo } from 'react';
import Link from 'next/link';
import type { TripPhase } from '../../engine/temporalPhaseEngine';
import type { TripStep } from '../../types/trip.types';
import { Badge, Card } from '@/components/ui';

export interface StepsTimelineProps {
  steps: TripStep[];
  dayIndex: number;
  phase: TripPhase;
}

function fmtKm(km: number | null): string {
  if (!km || km <= 0) return '';
  return `${(Math.round(km * 10) / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
}

function fmtMeters(m: number | null, unit = 'm'): string {
  if (!m || m <= 0) return '';
  return `${m.toLocaleString('fr-FR')} ${unit}`;
}

const LINK_CARD_CLASS =
  'flex w-full flex-col items-stretch justify-start gap-[var(--space-1)] rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-3)] transition-colors hover:bg-[color:var(--lkv-hover-surface)]';

/**
 * Widget `steps-timeline` — déroulé des étapes du jour (liste simple).
 * La carte « Point de départ » ouvre la liste, suivie des étapes du jour
 * courant ; le conteneur défile simplement (jours réels uniquement).
 */
export function StepsTimeline({ steps, dayIndex, phase }: StepsTimelineProps) {
  const ordered = useMemo(
    () => [...steps].sort((a, b) => a.day_number - b.day_number || a.order_index - b.order_index),
    [steps]
  );

  const startStep = useMemo(
    () =>
      ordered.find((s) => s.day_number === 1 && s.order_index === 0) ??
      ordered.find((s) => s.latitude != null && s.longitude != null) ??
      ordered[0],
    [ordered]
  );

  const totals = useMemo(() => {
    const km = ordered.reduce((sum, s) => sum + (Number(s.distance_km) || 0), 0);
    const dPlus = ordered.reduce((sum, s) => sum + (Number(s.elevation_gain_m) || 0), 0);
    const dLoss = ordered.reduce((sum, s) => sum + (Number(s.elevation_loss_m) || 0), 0);
    return { km, dPlus, dLoss, hasAny: km > 0 || dPlus > 0 };
  }, [ordered]);

  const availableDays = ordered.length > 0 ? Math.max(...ordered.map((s) => s.day_number)) : 0;
  const clampedDay = availableDays > 0 ? Math.min(Math.max(1, dayIndex), availableDays) : 1;
  const daySteps = ordered.filter((s) => s.day_number === clampedDay);

  const phasePill =
    phase === 'live'
      ? `Jour ${clampedDay} · en direct`
      : phase === 'recount'
        ? `Carnet · J${clampedDay}`
        : `Départ · J${clampedDay}`;

  return (
    <Card className="flex h-full min-h-0 flex-col space-y-[var(--space-2)] p-[var(--space-3)]">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-[var(--space-2)] font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-primary)]">
          <Icon name="route" size={13} aria-hidden="true" />
          Déroulé du jour
        </h3>
        <Badge tone="stone">{phasePill}</Badge>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Déroulé des étapes du voyage"
      >
        <div className="space-y-[var(--space-2)] pb-[var(--space-2)]">
          {startStep ? (
            <Link
              href="/hub/itineraire"
              className={LINK_CARD_CLASS}
              aria-label={`Point de départ : ${startStep.location_name ?? startStep.title}`}
            >
              <div className="flex items-center justify-between gap-[var(--space-2)]">
                <Badge tone="sage">
                  <Icon name="map-pin" size={10} aria-hidden="true" />
                  Point de départ
                </Badge>
                <Badge tone="stone" className="tabular-nums">
                  J{startStep.day_number}
                </Badge>
              </div>
              <div className="text-[length:var(--lkv-text-footnote)] font-bold leading-snug text-[color:var(--lkv-text-primary)]">
                {startStep.title}
              </div>
              {startStep.location_name && (
                <div className="flex items-center gap-[var(--space-1)] text-[11px] text-[color:var(--lkv-text-secondary)]">
                  <Icon name="map-pin" size={11} aria-hidden="true" />
                  {startStep.location_name}
                </div>
              )}
              {totals.hasAny && (
                <div className="flex flex-wrap items-center gap-x-[var(--space-3)] gap-y-0.5 border-t border-[color:var(--lkv-primary)]/10 pt-0.5 text-[11px] tabular-nums text-[color:var(--lkv-text-secondary)]">
                  {totals.km > 0 && (
                    <span className="flex items-center gap-[var(--space-1)] whitespace-nowrap">
                      <Icon name="route" size={11} aria-hidden="true" />
                      {fmtKm(totals.km)}
                    </span>
                  )}
                  {totals.dPlus > 0 && (
                    <span className="flex items-center gap-[var(--space-1)] whitespace-nowrap">
                      <Icon name="mountain" size={11} aria-hidden="true" />+
                      {fmtMeters(totals.dPlus)}
                    </span>
                  )}
                  {totals.dLoss > 0 && (
                    <span className="flex items-center gap-[var(--space-1)] whitespace-nowrap">
                      <Icon name="mountain" size={11} className="rotate-180" aria-hidden="true" />
                      −{fmtMeters(totals.dLoss)}
                    </span>
                  )}
                </div>
              )}
            </Link>
          ) : null}

          {daySteps.length > 0 ? (
            daySteps.map((step) => (
              <Link
                key={step.id}
                href="/hub/itineraire"
                className={LINK_CARD_CLASS}
                aria-label={`Étape ${step.order_index + 1} du jour ${step.day_number} : ${step.title}`}
              >
                <div className="flex items-center justify-between gap-[var(--space-2)]">
                  <Badge tone="stone" className="tabular-nums">
                    J{step.day_number} · {step.order_index + 1}
                  </Badge>
                  {step.accommodation_name && (
                    <span className="flex min-w-0 items-center gap-[var(--space-1)] truncate text-[10px] text-[color:var(--lkv-text-muted)]">
                      <Icon name="moon-star" size={10} aria-hidden="true" />
                      {step.accommodation_name}
                    </span>
                  )}
                </div>
                <div className="text-[length:var(--lkv-text-footnote)] font-bold leading-snug text-[color:var(--lkv-text-primary)]">
                  {step.title}
                </div>
                {step.location_name && (
                  <div className="flex items-center gap-[var(--space-1)] text-[11px] text-[color:var(--lkv-text-secondary)]">
                    <Icon name="map-pin" size={11} aria-hidden="true" />
                    {step.location_name}
                  </div>
                )}
                {(step.distance_km || step.elevation_gain_m) && (
                  <div className="flex items-center gap-[var(--space-2)] text-[11px] tabular-nums text-[color:var(--lkv-text-muted)]">
                    {fmtKm(step.distance_km) && (
                      <span className="flex items-center gap-[var(--space-1)]">
                        <Icon name="route" size={11} aria-hidden="true" />
                        {fmtKm(step.distance_km)}
                      </span>
                    )}
                    {Number(step.elevation_gain_m) > 0 && (
                      <span className="flex items-center gap-[var(--space-1)]">
                        <Icon name="mountain" size={11} aria-hidden="true" />+
                        {fmtMeters(step.elevation_gain_m)}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))
          ) : (
            <Card variant="compact" className="space-y-[var(--space-1)] text-center">
              <p className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                Aucune étape pour le jour {clampedDay}
              </p>
              <p className="text-[11px] text-[color:var(--lkv-text-secondary)]">
                La suite du déroulé apparaît dès qu&apos;une étape est planifiée.
              </p>
            </Card>
          )}
        </div>
      </div>
    </Card>
  );
}

export default StepsTimeline;
