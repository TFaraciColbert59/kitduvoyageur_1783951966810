'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { IconButton } from '@/components/ui';
import {
  createPlanningDrawerState,
  createUnconfiguredWeatherFeed,
  previewStageBoundaryMove,
  reducePlanningDrawerState,
  searchMultiDayPlans,
  type ContinuousRoute,
  type LodgingAnchor,
  type MultiDayPlan,
  type ParsedPlanCriteria,
  type PlanShareRecord,
  type PlanningDrawerView,
  type SportKind,
  type ViewerContextP01,
  type WeatherFeedSnapshot,
} from '@/features/planning';
import { MultiDayPlanLibrary } from './MultiDayPlanLibrary';
import { PlanDetail } from './PlanDetail';
import { PlanningDrawer } from './PlanningDrawer';
import { SplitRoutePanel } from './SplitRoutePanel';
import { BoundaryEditor } from './BoundaryEditor';
import { LodgingPicker } from './LodgingPicker';

export interface PlanningWorkspaceProps {
  initialPlans: MultiDayPlan[];
  viewer: ViewerContextP01;
  nowIso: string;
  route?: ContinuousRoute | null;
  weatherFeed?: WeatherFeedSnapshot;
  lodgings?: LodgingAnchor[];
  initialQuery?: string;
}

function drawerTitle(view: PlanningDrawerView | null): { title: string; description?: string } {
  if (!view) return { title: 'Planification' };
  switch (view.kind) {
    case 'split_route':
      return {
        title: 'Créer un plan multi-jours',
        description: 'Découpez un tracé continu en étapes indépendantes.',
      };
    case 'choose_lodging':
      return {
        title: 'Choisir un hébergement',
        description: 'Un refuge proche du tracé devient la fin du jour sélectionné.',
      };
    case 'preview_boundary':
      return {
        title: 'Ajuster les bornes',
        description: 'Prévisualisez l’impact sur les jours N et N+1 avant de valider.',
      };
    case 'plan_detail':
      return { title: 'Détail du plan' };
    case 'search_results':
      return { title: 'Résultats de recherche' };
    default:
      return { title: 'Planification' };
  }
}

/**
 * Espace de planification multi-jours : bibliothèque K1.13, détail d'un plan,
 * météo explicite, partage P01 et ajustements K2.30/K2.31. La pile de drawers
 * est celle du contrat C-UI : le retour restaure la vue précédente.
 */
export function PlanningWorkspace({
  initialPlans,
  viewer,
  nowIso,
  route = null,
  weatherFeed,
  lodgings = [],
  initialQuery = '',
}: PlanningWorkspaceProps) {
  const [plans, setPlans] = useState<MultiDayPlan[]>(initialPlans);
  const [query, setQuery] = useState(initialQuery);
  const [sportFilter, setSportFilter] = useState<SportKind | null>(null);
  const [activeSport, setActiveSport] = useState<SportKind | null>(null);
  const [correctedCriteria, setCorrectedCriteria] = useState<Partial<ParsedPlanCriteria>>({});
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(() => createPlanningDrawerState(null));
  const [shareRecords, setShareRecords] = useState<Record<string, PlanShareRecord | null>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const searchResult = useMemo(
    () =>
      searchMultiDayPlans(
        plans,
        {
          rawQuery: query,
          correctedCriteria: Object.keys(correctedCriteria).length > 0 ? correctedCriteria : undefined,
          sportFilter,
        },
        viewer,
      ),
    [plans, query, correctedCriteria, sportFilter, viewer],
  );

  const visiblePlanIds = new Set(searchResult.items.map((plan) => plan.id));
  const activePlan =
    plans.find((plan) => plan.id === activePlanId && visiblePlanIds.has(plan.id)) ??
    plans.find((plan) => visiblePlanIds.has(plan.id)) ??
    null;

  const resolvedFeed =
    activePlan && weatherFeed && weatherFeed.timezone === activePlan.timezone
      ? weatherFeed
      : activePlan
        ? createUnconfiguredWeatherFeed(activePlan.timezone)
        : null;

  const openDrawer = (view: PlanningDrawerView) => {
    setDrawer((previous) => reducePlanningDrawerState(previous, { type: 'open', view }));
  };

  const closeDrawer = () => setDrawer(createPlanningDrawerState(null));
  const backDrawer = () =>
    setDrawer((previous) => reducePlanningDrawerState(previous, { type: 'back' }));

  const updatePlan = (updated: MultiDayPlan) => {
    setPlans((previous) => previous.map((plan) => (plan.id === updated.id ? updated : plan)));
  };

  const handleCreated = (created: MultiDayPlan) => {
    setPlans((previous) => [created, ...previous]);
    setActivePlanId(created.id);
    setQuery('');
    setCorrectedCriteria({});
    closeDrawer();
    setNotice(`Plan « ${created.title} » créé en ${created.daysCount} étapes.`);
  };

  const openBoundary = (dayNumber: number) => {
    if (!activePlan || activePlan.stages.length < 2) {
      setNotice('Ce plan ne contient qu’une étape : aucune borne à déplacer.');
      return;
    }
    const index = activePlan.stages.findIndex((stage) => stage.dayNumber === dayNumber);
    const stageN = activePlan.stages[index];
    const stageNext = activePlan.stages[index + 1];
    if (!stageN || !stageNext) {
      setNotice('La dernière étape ne peut pas être déplacée.');
      return;
    }
    const candidateIndex = Math.min(stageN.endPointIndex + 1, stageNext.endPointIndex - 1);
    const preview = previewStageBoundaryMove(
      activePlan,
      dayNumber,
      candidateIndex,
      activePlan.revision,
    );
    if (!preview) {
      setNotice('Aucune prévisualisation valide pour cette borne.');
      return;
    }
    openDrawer({ kind: 'preview_boundary', preview });
  };

  const drawerMeta = drawerTitle(drawer.active);
  const drawerOpen = drawer.active !== null && drawer.active.kind !== 'search_results';

  return (
    <div className="space-y-[var(--space-5)]">
      {notice && (
        <div
          role="status"
          className="flex items-start justify-between gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-success)] bg-[color:var(--lkv-success-bg)] p-[var(--space-3)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)]"
        >
          <div className="flex items-start gap-[var(--space-2)]">
            <CheckCircle2 aria-hidden="true" size={18} className="mt-[2px] shrink-0" />
            <p>{notice}</p>
          </div>
          <IconButton aria-label="Masquer la notification" size="sm" onClick={() => setNotice(null)}>
            <X aria-hidden="true" size={16} />
          </IconButton>
        </div>
      )}

      <div className="grid gap-[var(--space-6)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
        <MultiDayPlanLibrary
          query={query}
          onQueryChange={setQuery}
          sportFilter={sportFilter}
          onSportFilterChange={setSportFilter}
          correctedCriteria={correctedCriteria}
          onCorrectedCriteriaChange={setCorrectedCriteria}
          result={searchResult}
          activePlanId={activePlan?.id ?? null}
          onSelectPlan={setActivePlanId}
          onCreatePlan={() => openDrawer({ kind: 'split_route', planId: 'new' })}
        />

        <div id="planning-plan-detail" className="min-w-0">
          {activePlan ? (
            <PlanDetail
              key={activePlan.id}
              plan={activePlan}
              viewer={viewer}
              activeSport={activeSport}
              nowIso={nowIso}
              weatherFeed={resolvedFeed ?? createUnconfiguredWeatherFeed(activePlan.timezone)}
              initialShareRecord={shareRecords[activePlan.id] ?? null}
              onPlanChange={updatePlan}
              onShareRecordChange={(record) =>
                setShareRecords((previous) => ({ ...previous, [activePlan.id]: record }))
              }
              onOpenBoundary={openBoundary}
              onActiveSportChange={setActiveSport}
              onOpenLodging={(dayNumber) =>
                openDrawer({
                  kind: 'choose_lodging',
                  planId: activePlan.id,
                  dayNumber,
                })
              }
            />
          ) : (
            <div className="rounded-[var(--lkv-radius-card)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] p-[var(--space-6)] text-center">
              <p className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
                Sélectionnez un plan dans la bibliothèque ou créez-en un à partir d’un tracé.
              </p>
            </div>
          )}
        </div>
      </div>

      <PlanningDrawer
        open={drawerOpen}
        title={drawerMeta.title}
        description={drawerMeta.description}
        onClose={closeDrawer}
        onBack={drawer.stack.length > 1 ? backDrawer : undefined}
      >
        {drawer.active?.kind === 'split_route' && (
          <SplitRoutePanel route={route} nowIso={nowIso} onCreated={handleCreated} />
        )}
        {drawer.active?.kind === 'choose_lodging' && activePlan && (
          <LodgingPicker
            plan={activePlan}
            nowIso={nowIso}
            initialDay={drawer.active.dayNumber}
            lodgings={lodgings}
            onPlanChange={updatePlan}
          />
        )}
        {drawer.active?.kind === 'preview_boundary' && activePlan && (
          <BoundaryEditor
            plan={activePlan}
            nowIso={nowIso}
            initialDay={drawer.active.preview.dayN.dayNumber}
            onPlanChange={updatePlan}
          />
        )}
      </PlanningDrawer>
    </div>
  );
}

export default PlanningWorkspace;
