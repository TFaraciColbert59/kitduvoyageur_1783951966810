'use client';

/**
 * A13 (S3) — Panneau hub « groupe + trek » : résout le dernier plan
 * d'aventure accessible (lié au voyage du groupe si possible, sinon le plus
 * récent), lit les payloads publics persistés et déclenche les calculs S3
 * (POST) quand ils manquent. Aucune fixture : sans plan ou sans données, le
 * panneau ne rend que l'état explicite correspondant.
 */
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { GroupPlanSummaryPublic, StagesSource } from '../domain/planGroupTrek';
import type { MultiDayTrekResult } from '../domain/multiDayTrek';
import GroupPlanSummary, { type GroupPlanLoadState } from './GroupPlanSummary';
import TrekPlanView from './TrekPlanView';

export interface GroupTrekPanelProps {
  /** Voyage lié au groupe, quand il existe (préférence de résolution). */
  tripId?: string | null;
  className?: string;
}

interface GroupLoad {
  state: GroupPlanLoadState;
  plan: GroupPlanSummaryPublic | null;
  version: number | null;
  computedAt: string | null;
  stagesSource: StagesSource | null;
  requiredPlan: string | null;
  error: string | null;
}

interface TrekLoad {
  state: GroupPlanLoadState;
  plan: MultiDayTrekResult | null;
  version: number | null;
  computedAt: string | null;
  stagesSource: StagesSource | null;
  requiredPlan: string | null;
  error: string | null;
}

function emptyGroup(state: GroupPlanLoadState): GroupLoad {
  return { state, plan: null, version: null, computedAt: null, stagesSource: null, requiredPlan: null, error: null };
}

function emptyTrek(state: GroupPlanLoadState): TrekLoad {
  return { state, plan: null, version: null, computedAt: null, stagesSource: null, requiredPlan: null, error: null };
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stagesSourceOrNull(value: unknown): StagesSource | null {
  return value === 'trip_steps' || value === 'blueprint_uniform' ? value : null;
}

/** Réponse serveur → état de chargement groupe (helper pur, testable). */
export async function groupLoadFromResponse(response: Response): Promise<GroupLoad> {
  if (response.status === 200) {
    const body = (await response.json()) as Record<string, unknown>;
    return {
      state: 'ready',
      plan: (body.groupPlan as GroupPlanSummaryPublic) ?? null,
      version: numberOrNull(body.version),
      computedAt: textOrNull(body.computedAt),
      stagesSource: stagesSourceOrNull(body.stagesSource),
      requiredPlan: null,
      error: null,
    };
  }
  if (response.status === 402) {
    const body = (await response.json().catch(() => ({}))) as { requiredPlan?: string };
    return { ...emptyGroup('denied'), requiredPlan: textOrNull(body.requiredPlan) ?? 'group' };
  }
  if (response.status === 404) return emptyGroup('absent');
  return emptyGroup('error');
}

/** Réponse serveur → état de chargement trek (helper pur, testable). */
export async function trekLoadFromResponse(response: Response): Promise<TrekLoad> {
  if (response.status === 200) {
    const body = (await response.json()) as Record<string, unknown>;
    return {
      state: 'ready',
      plan: (body.trekPlan as MultiDayTrekResult) ?? null,
      version: numberOrNull(body.version),
      computedAt: textOrNull(body.computedAt),
      stagesSource: stagesSourceOrNull(body.stagesSource),
      requiredPlan: null,
      error: null,
    };
  }
  if (response.status === 402) {
    const body = (await response.json().catch(() => ({}))) as { requiredPlan?: string };
    return { ...emptyTrek('denied'), requiredPlan: textOrNull(body.requiredPlan) ?? 'expedition' };
  }
  if (response.status === 404) return emptyTrek('absent');
  return emptyTrek('error');
}

async function resolvePlanId(tripId: string | null): Promise<string | null> {
  const supabase = createClient();
  if (tripId) {
    const { data } = await supabase
      .from('adventure_plans')
      .select('id')
      .eq('trip_id', tripId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const id = textOrNull((data as { id?: unknown } | null)?.id);
    if (id) return id;
  }
  const { data } = await supabase
    .from('adventure_plans')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return textOrNull((data as { id?: unknown } | null)?.id);
}

export function GroupTrekPanel({ tripId = null, className = '' }: GroupTrekPanelProps) {
  const [planId, setPlanId] = useState<string | null>(null);
  const [group, setGroup] = useState<GroupLoad>(() => emptyGroup('loading'));
  const [trek, setTrek] = useState<TrekLoad>(() => emptyTrek('loading'));
  const [computingGroup, setComputingGroup] = useState(false);
  const [computingTrek, setComputingTrek] = useState(false);

  const loadAll = useCallback(async (id: string) => {
    setGroup(emptyGroup('loading'));
    setTrek(emptyTrek('loading'));

    const [groupResponse, trekResponse] = await Promise.all([
      fetch(`/api/adventure/${id}/group`).catch(() => null),
      fetch(`/api/adventure/${id}/trek`).catch(() => null),
    ]);

    setGroup(groupResponse ? await groupLoadFromResponse(groupResponse) : emptyGroup('error'));
    setTrek(trekResponse ? await trekLoadFromResponse(trekResponse) : emptyTrek('error'));
  }, []);

  useEffect(() => {
    let active = true;
    resolvePlanId(tripId)
      .then((id) => {
        if (!active) return;
        setPlanId(id);
        if (id) return loadAll(id);
        // Aucun plan accessible : états vides explicites, jamais de squelette
        // infini ni de donnée inventée.
        setGroup(emptyGroup('absent'));
        setTrek(emptyTrek('absent'));
        return undefined;
      })
      .catch(() => {
        if (!active) return;
        setPlanId(null);
        setGroup(emptyGroup('absent'));
        setTrek(emptyTrek('absent'));
      });
    return () => {
      active = false;
    };
  }, [tripId, loadAll]);

  const computeGroup = useCallback(async () => {
    if (!planId) return;
    setComputingGroup(true);
    try {
      const response = await fetch(`/api/adventure/${planId}/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (response.status === 200 || response.status === 402 || response.status === 404) {
        setGroup(await groupLoadFromResponse(response));
      } else {
        setGroup({ ...emptyGroup('error'), error: 'Le calcul de groupe a échoué.' });
      }
    } catch {
      setGroup({ ...emptyGroup('error'), error: 'Réseau indisponible.' });
    } finally {
      setComputingGroup(false);
    }
  }, [planId]);

  const computeTrek = useCallback(async () => {
    if (!planId) return;
    setComputingTrek(true);
    try {
      const response = await fetch(`/api/adventure/${planId}/trek`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (response.status === 200 || response.status === 402 || response.status === 404) {
        setTrek(await trekLoadFromResponse(response));
      } else {
        setTrek({ ...emptyTrek('error'), error: 'La simulation multi-jours a échoué.' });
      }
    } catch {
      setTrek({ ...emptyTrek('error'), error: 'Réseau indisponible.' });
    } finally {
      setComputingTrek(false);
    }
  }, [planId]);

  return (
    <div data-testid="group-trek-panel" className={`space-y-3 ${className}`}>
      <GroupPlanSummary
        plan={group.plan}
        state={group.state}
        version={group.version}
        computedAt={group.computedAt}
        stagesSource={group.stagesSource}
        requiredPlan={group.requiredPlan}
        error={group.error}
        onCompute={planId ? computeGroup : undefined}
        computing={computingGroup}
      />
      <TrekPlanView
        plan={trek.plan}
        state={trek.state}
        version={trek.version}
        computedAt={trek.computedAt}
        stagesSource={trek.stagesSource}
        requiredPlan={trek.requiredPlan}
        error={trek.error}
        onCompute={planId ? computeTrek : undefined}
        computing={computingTrek}
      />
    </div>
  );
}

export default GroupTrekPanel;
