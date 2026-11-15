'use client';

import React from 'react';
import { Play } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import {
  getStageLaunchReadiness,
  type MultiDayPlan,
  type SportKind,
  type StageLaunchDecision,
  type ViewerContextP01,
} from '@/features/planning';
import {
  formatDistanceKm,
  formatElevationM,
  formatHours,
  launchReasonLabel,
} from './format';
import { OfflineCapabilitiesList } from './OfflineCapabilities';

export interface StageTimelineProps {
  plan: MultiDayPlan;
  viewer: ViewerContextP01;
  activeSport?: SportKind | null;
  onLaunch: (decision: StageLaunchDecision, dayNumber: number) => void;
}

/**
 * Liste des étapes K2.32. Chaque journée expose ses métriques, son hébergement
 * d'arrivée, ses capacités hors-ligne et l'action « Démarrer cette étape »
 * uniquement lorsque le contrat la déclare visible et lançable.
 */
export function StageTimeline({ plan, viewer, activeSport = null, onLaunch }: StageTimelineProps) {
  return (
    <ol className="space-y-[var(--space-3)]">
      {plan.stages.map((stage) => {
        const decision = getStageLaunchReadiness(plan, stage.dayNumber, viewer, activeSport);
        return (
          <li key={stage.stageId}>
            <Card as="article" variant="standard" className="p-[var(--space-4)]">
              <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
                <div>
                  <div className="flex items-center gap-[var(--space-2)]">
                    <Badge tone="sage">J{stage.dayNumber}</Badge>
                    <h3 className="text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">
                      Étape {stage.dayNumber}
                    </h3>
                    <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                      rév. {stage.revision}
                    </span>
                  </div>
                  <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                    {formatDistanceKm(stage.distanceKm)} · +{formatElevationM(stage.elevationGainM)} ·{' '}
                    {formatHours(stage.estimatedHours)}
                  </p>
                </div>
                {stage.endLodging && (
                  <Badge tone="info">
                    Arrivée : {stage.endLodging.name} ({stage.endLodging.type})
                  </Badge>
                )}
              </div>

              <div className="mt-[var(--space-3)]">
                <OfflineCapabilitiesList offline={stage.offline} />
              </div>

              <div className="mt-[var(--space-3)] flex flex-wrap items-center justify-between gap-[var(--space-2)]">
                {decision.visible ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Play aria-hidden="true" size={14} />}
                    onClick={() => onLaunch(decision, stage.dayNumber)}
                    aria-label={`Démarrer l’étape ${stage.dayNumber}`}
                  >
                    Démarrer cette étape
                  </Button>
                ) : (
                  <p className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
                    Action masquée : {launchReasonLabel(decision.reason)}.
                  </p>
                )}
                <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  {stage.startPointIndex} → {stage.endPointIndex} · {stage.points.length} points
                </span>
              </div>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}

export default StageTimeline;
