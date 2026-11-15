'use client';

import React from 'react';
import { Badge, Button, Card } from '@/components/ui';
import type { MultiDayPlan, StageLaunchDecision } from '@/features/planning';
import { SPORT_LABELS, formatDistanceKm, launchReasonLabel } from './format';
import { OfflineCapabilitiesList } from './OfflineCapabilities';

export interface StageLaunchPanelProps {
  plan: MultiDayPlan;
  dayNumber: number | null;
  decision: StageLaunchDecision | null;
  onClose: () => void;
}

function coordinate(value: number): string {
  return value.toFixed(5);
}

/**
 * Résultat de « Démarrer cette étape » : payload figé (révisions inclues),
 * fuseau explicite et capacités hors-ligne. Aucun départ n'est créé ici.
 */
export function StageLaunchPanel({ plan, dayNumber, decision, onClose }: StageLaunchPanelProps) {
  if (!decision || dayNumber === null) return null;

  if (!decision.visible) {
    return (
      <Card
        as="section"
        tone="warn"
        aria-labelledby="planning-launch-title"
        data-testid="planning-launch-panel"
      >
        <div className="flex items-start justify-between gap-[var(--space-3)]">
          <div>
            <h3
              id="planning-launch-title"
              className="text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]"
            >
              Étape {dayNumber} indisponible
            </h3>
            <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
              {launchReasonLabel(decision.reason)}.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </Card>
    );
  }

  const { payload } = decision;
  return (
    <Card
      as="section"
      tone="sage"
      aria-labelledby="planning-launch-title"
      data-testid="planning-launch-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
        <div>
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">
            <Badge tone="sage">Étape prête</Badge>
            <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
              {payload.stageId}
            </span>
          </div>
          <h3
            id="planning-launch-title"
            className="mt-[var(--space-1)] text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]"
          >
            Jour {payload.dayNumber} · {SPORT_LABELS[payload.sport]}
          </h3>
          <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
            {formatDistanceKm(
              plan.stages.find((stage) => stage.dayNumber === payload.dayNumber)?.distanceKm ?? 0,
            )}{' '}
            · fuseau {payload.timezone}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fermer
        </Button>
      </div>

      <dl className="mt-[var(--space-3)] grid grid-cols-2 gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] sm:grid-cols-4">
        <div>
          <dt className="text-[color:var(--lkv-text-muted)]">Révision étape</dt>
          <dd className="font-mono font-semibold text-[color:var(--lkv-text-primary)]">
            {payload.stageRevision}
          </dd>
        </div>
        <div>
          <dt className="text-[color:var(--lkv-text-muted)]">Révision plan</dt>
          <dd className="font-mono font-semibold text-[color:var(--lkv-text-primary)]">
            {payload.planRevision}
          </dd>
        </div>
        <div>
          <dt className="text-[color:var(--lkv-text-muted)]">Départ</dt>
          <dd className="font-mono text-[color:var(--lkv-text-primary)]">
            {coordinate(payload.startCoord.lat)}, {coordinate(payload.startCoord.lon)}
          </dd>
        </div>
        <div>
          <dt className="text-[color:var(--lkv-text-muted)]">Arrivée</dt>
          <dd className="font-mono text-[color:var(--lkv-text-primary)]">
            {coordinate(payload.endCoord.lat)}, {coordinate(payload.endCoord.lon)}
          </dd>
        </div>
      </dl>

      <div className="mt-[var(--space-3)]">
        <OfflineCapabilitiesList offline={payload.offline} />
      </div>

      <p className="mt-[var(--space-3)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
        Cette étape est lançable indépendamment : sa révision et celle du plan sont figées dans le
        payload. Vérifiez les capacités hors-ligne avant de partir.
      </p>
    </Card>
  );
}

export default StageLaunchPanel;
