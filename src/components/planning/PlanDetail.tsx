'use client';

import React, { useState } from 'react';
import { CalendarRange, Compass, MountainSnow } from 'lucide-react';
import { Badge, Button, Card, CapsuleTabs, CountryFlag } from '@/components/ui';
import {
  type MultiDayPlan,
  type PlanShareRecord,
  type SportKind,
  type StageLaunchDecision,
  type ViewerContextP01,
  type WeatherFeedSnapshot,
} from '@/features/planning';
import {
  AUDIENCE_LABELS,
  SPORT_LABELS,
  countryLabel,
  formatDistanceKm,
  formatElevationM,
  formatHours,
  planTotals,
} from './format';
import { StageTimeline } from './StageTimeline';
import { StageLaunchPanel } from './StageLaunchPanel';
import { WeatherPanel } from './WeatherPanel';
import { SharePanel } from './SharePanel';

export interface PlanDetailProps {
  plan: MultiDayPlan;
  viewer: ViewerContextP01;
  activeSport: SportKind | null;
  nowIso: string;
  weatherFeed: WeatherFeedSnapshot;
  initialShareRecord: PlanShareRecord | null;
  onPlanChange: (plan: MultiDayPlan) => void;
  onShareRecordChange: (record: PlanShareRecord | null) => void;
  onOpenBoundary: (dayNumber: number) => void;
  onOpenLodging: (dayNumber: number) => void;
  onActiveSportChange: (sport: SportKind | null) => void;
}

const TABS = [
  { id: 'stages', label: 'Étapes' },
  { id: 'weather', label: 'Météo' },
  { id: 'share', label: 'Partage' },
  { id: 'adjust', label: 'Ajuster' },
] as const;

/**
 * Détail d'un plan : étapes navigables, météo explicite, partage P01 et
 * ajustements K2.30/K2.31. Les révisions affichées sont celles du contrat.
 */
export function PlanDetail({
  plan,
  viewer,
  activeSport,
  nowIso,
  weatherFeed,
  initialShareRecord,
  onPlanChange,
  onShareRecordChange,
  onOpenBoundary,
  onOpenLodging,
  onActiveSportChange,
}: PlanDetailProps) {
  const [tabIndex, setTabIndex] = useState(0);
  const [launchDecision, setLaunchDecision] = useState<StageLaunchDecision | null>(null);
  const [launchDay, setLaunchDay] = useState<number | null>(null);
  const totals = planTotals(plan);
  const activeTab = TABS[tabIndex] ?? TABS[0];

  return (
    <section
      data-testid="planning-plan-detail"
      aria-labelledby="planning-plan-title"
      className="space-y-[var(--space-4)]"
    >
      <Card as="div" variant="featured">
        <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
          <div className="min-w-0">
            <div className="flex items-center gap-[var(--space-2)]">
              <CountryFlag
                code={plan.countryCode}
                name={countryLabel(plan.countryCode)}
                size="md"
              />
              <div>
                <h2
                  id="planning-plan-title"
                  className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]"
                >
                  {plan.title}
                </h2>
                <p className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                  {plan.daysCount} jour{plan.daysCount > 1 ? 's' : ''} · fuseau {plan.timezone} ·
                  révision {plan.revision}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-[var(--space-1)]">
            <Badge tone={plan.audience === 'public' ? 'sage' : 'stone'}>
              {AUDIENCE_LABELS[plan.audience]}
            </Badge>
            <Badge tone={plan.publicShareConsented ? 'sage' : 'warn'}>
              {plan.publicShareConsented ? 'Consentement public' : 'Sans consentement public'}
            </Badge>
          </div>
        </div>

        <dl className="mt-[var(--space-3)] grid grid-cols-2 gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] sm:grid-cols-4">
          <div>
            <dt className="text-[color:var(--lkv-text-muted)]">Distance</dt>
            <dd className="font-semibold text-[color:var(--lkv-text-primary)]">
              {formatDistanceKm(totals.distanceKm)}
            </dd>
          </div>
          <div>
            <dt className="text-[color:var(--lkv-text-muted)]">Dénivelé +</dt>
            <dd className="font-semibold text-[color:var(--lkv-text-primary)]">
              +{formatElevationM(totals.elevationGainM)}
            </dd>
          </div>
          <div>
            <dt className="text-[color:var(--lkv-text-muted)]">Durée estimée</dt>
            <dd className="font-semibold text-[color:var(--lkv-text-primary)]">
              {formatHours(totals.estimatedHours)}
            </dd>
          </div>
          <div>
            <dt className="text-[color:var(--lkv-text-muted)]">Étapes</dt>
            <dd className="font-semibold text-[color:var(--lkv-text-primary)]">
              {plan.stages.length}
            </dd>
          </div>
        </dl>

        <label className="mt-[var(--space-3)] flex max-w-xs flex-col gap-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
          <span>Sport actif pour le lancement</span>
          <select
            className="h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
            value={activeSport ?? ''}
            onChange={(event) =>
              onActiveSportChange(event.target.value ? (event.target.value as SportKind) : null)
            }
          >
            <option value="">Automatique (sport du plan)</option>
            {(Object.keys(SPORT_LABELS) as SportKind[]).map((sport) => (
              <option key={sport} value={sport}>
                {SPORT_LABELS[sport]}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <CapsuleTabs
        items={TABS}
        activeIndex={tabIndex}
        onIndexChange={setTabIndex}
        ariaLabel="Sections du plan"
        idFor={(id) => `planning-tab-${id}`}
        panelIdFor={(id) => `planning-panel-${id}`}
      />

      <div
        id={`planning-panel-${activeTab.id}`}
        role="tabpanel"
        aria-labelledby={`planning-tab-${activeTab.id}`}
        className="space-y-[var(--space-3)]"
      >
        {activeTab.id === 'stages' && (
          <>
            <StageTimeline
              plan={plan}
              viewer={viewer}
              activeSport={activeSport}
              onLaunch={(decision, dayNumber) => {
                setLaunchDecision(decision);
                setLaunchDay(dayNumber);
              }}
            />
            <StageLaunchPanel
              plan={plan}
              dayNumber={launchDay}
              decision={launchDecision}
              onClose={() => {
                setLaunchDecision(null);
                setLaunchDay(null);
              }}
            />
          </>
        )}

        {activeTab.id === 'weather' && (
          <WeatherPanel plan={plan} feed={weatherFeed} nowIso={nowIso} />
        )}

        {activeTab.id === 'share' && (
          <SharePanel
            plan={plan}
            actorId={plan.ownerId}
            nowIso={nowIso}
            initialRecord={initialShareRecord}
            onPlanChange={onPlanChange}
            onRecordChange={onShareRecordChange}
          />
        )}

        {activeTab.id === 'adjust' && (
          <div className="grid gap-[var(--space-3)] sm:grid-cols-2">
            <Card as="section" variant="standard">
              <div className="flex items-center gap-[var(--space-2)]">
                <CalendarRange aria-hidden="true" size={18} className="text-[color:var(--lkv-info)]" />
                <h3 className="text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">
                  Déplacer une borne
                </h3>
              </div>
              <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                Ajuste la fin du jour N et le début du jour N+1, sans toucher aux autres journées.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-[var(--space-3)]"
                onClick={() => onOpenBoundary(plan.stages[0]?.dayNumber ?? 1)}
              >
                Ouvrir l’ajustement des bornes
              </Button>
            </Card>

            <Card as="section" variant="standard">
              <div className="flex items-center gap-[var(--space-2)]">
                <MountainSnow aria-hidden="true" size={18} className="text-[color:var(--lkv-info)]" />
                <h3 className="text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">
                  Ancrer un refuge
                </h3>
              </div>
              <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                Choisit le point du tracé le plus proche et recalcule les jours N et N+1.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-[var(--space-3)]"
                onClick={() => onOpenLodging(plan.stages[0]?.dayNumber ?? 1)}
              >
                Ouvrir le choix d’hébergement
              </Button>
            </Card>

            <Card as="section" variant="standard" className="sm:col-span-2">
              <div className="flex items-start gap-[var(--space-2)]">
                <Compass aria-hidden="true" size={18} className="mt-[2px] text-[color:var(--lkv-text-muted)]" />
                <p className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                  Les ajustements sont prévisualisés avant validation. En cas de conflit de
                  révision, l’ancien découpage est conservé et la prévisualisation est actualisée.
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}

export default PlanDetail;
