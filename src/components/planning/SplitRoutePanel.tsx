'use client';

import React, { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Badge, Button, CapsuleTabs } from '@/components/ui';
import {
  computeStageMetrics,
  splitRouteIntoDays,
  type ContinuousRoute,
  type MultiDayPlan,
} from '@/features/planning';
import { SPORT_LABELS, THEME_LABELS, formatDistanceKm, formatElevationM, formatHours } from './format';

const FIELD_CLASS =
  'h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

export interface SplitRoutePanelProps {
  route: ContinuousRoute | null;
  nowIso: string;
  onCreated: (plan: MultiDayPlan) => void;
}

/**
 * K2.29 : découpage d'un tracé continu en N jours, soit par nombre de jours,
 * soit par durée journalière cible. Chaque étape reçoit sa révision, ses
 * métriques et ses capacités hors-ligne dès la création.
 */
export function SplitRoutePanel({ route, nowIso, onCreated }: SplitRoutePanelProps) {
  const [modeIndex, setModeIndex] = useState(0);
  const [targetDays, setTargetDays] = useState(4);
  const [targetHours, setTargetHours] = useState(6);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!route) {
    return (
      <p className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
        Aucun tracé source chargé : importez un GPX ou choisissez un tracé avant de découper.
      </p>
    );
  }

  const metrics = computeStageMetrics(route.points, route.sport);

  const create = () => {
    setError(null);
    setSuccess(null);
    try {
      const plan = splitRouteIntoDays(route, {
        planId: `plan-${route.id}-${Date.now()}`,
        ...(modeIndex === 0 ? { targetDays } : { targetHoursPerDay: targetHours }),
        nowIso,
        publicShareConsented: consent,
      });
      onCreated(plan);
      setSuccess(
        `Plan « ${plan.title} » créé en ${plan.daysCount} étape${plan.daysCount > 1 ? 's' : ''} (révision ${plan.revision}).`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le découpage a échoué.');
    }
  };

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border-subtle)] p-[var(--space-3)]">
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          <h3 className="text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">
            {route.title}
          </h3>
          <Badge tone="info">{SPORT_LABELS[route.sport]}</Badge>
          <Badge tone="sage">{THEME_LABELS[route.theme]}</Badge>
        </div>
        <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
          {route.points.length} points · {formatDistanceKm(metrics.distanceKm)} · +
          {formatElevationM(metrics.elevationGainM)} · {formatHours(metrics.estimatedHours)} ·
          fuseau {route.timezone}
        </p>
      </div>

      <CapsuleTabs
        items={[
          { id: 'days', label: 'Nombre de jours' },
          { id: 'hours', label: 'Durée par jour' },
        ]}
        activeIndex={modeIndex}
        onIndexChange={setModeIndex}
        ariaLabel="Mode de découpage"
      />

      {modeIndex === 0 ? (
        <label className="block space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
          <span>Nombre de jours cible</span>
          <input
            type="number"
            min={1}
            max={route.points.length - 1}
            className={FIELD_CLASS}
            value={targetDays}
            onChange={(event) => setTargetDays(Number.parseInt(event.target.value, 10) || 1)}
          />
        </label>
      ) : (
        <label className="block space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
          <span>Durée journalière cible (heures)</span>
          <input
            type="number"
            min={0.5}
            step={0.5}
            className={FIELD_CLASS}
            value={targetHours}
            onChange={(event) => setTargetHours(Number.parseFloat(event.target.value) || 0.5)}
          />
        </label>
      )}

      <label className="flex items-start gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
        <input
          type="checkbox"
          className="mt-[2px] h-4 w-4 accent-[color:var(--lkv-action)]"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>
          <span className="block font-semibold text-[color:var(--lkv-text-primary)]">
            Consentement au partage public
          </span>
          Nécessaire pour qu’un partage public P01 puisse être créé ensuite.
        </span>
      </label>

      {error && (
        <p role="alert" className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger-dark)]">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-success)]">
          {success}
        </p>
      )}

      <Button
        variant="primary"
        size="sm"
        icon={<CalendarDays aria-hidden="true" size={14} />}
        onClick={create}
      >
        Découper le tracé
      </Button>
    </div>
  );
}

export default SplitRoutePanel;
