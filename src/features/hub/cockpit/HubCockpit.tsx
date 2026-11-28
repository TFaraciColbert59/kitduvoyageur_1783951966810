'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { LazyMotion, MotionConfig, domMax } from 'framer-motion';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { normalizeCivilDateString } from '@/features/trips/engine/temporalPhaseEngine';
import Icon from '@/components/ui/Icon';
import { CommunitySheetShell } from '@/features/community/v2/shared/CommunitySheetShell';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { newId } from '@/lib/uuid';
import { cockpitDayBudget, cockpitDayRoute, currentCockpitDay, momentHour } from './day';
import { useCockpitWeather } from './useCockpitWeather';
import { computeKitWeights } from './kitMath';
import { chunkMembersByThree } from './groupProgress';
import { computeCockpitReadiness, type CockpitWidgetKey } from './cockpitReadiness';
import { readOfflineMapPack, type OfflineMapPack } from './offlineMapPack';
import { loadCarnetDraft, type CarnetLocalDraft } from './CarnetDraftStore';
import {
  enqueueOfflineOp,
  listOfflineOps,
  removeOfflineOp,
  replayOfflineOps,
  type CockpitOfflineOperation,
  type ExpenseCreatePayload,
  type KitTogglePayload,
  type StepExecutionPayload,
} from './offlineQueue';
import { recordStepExecution } from './stepExecutionActions';
import { createCockpitExpense } from './budgetActions';
import { toggleCockpitKitItem } from './kitActions';
import type { StepExecution } from './stepExecution';
import type { CockpitData, CockpitExpense } from './model';
import { HubCockpitHeader } from './HubCockpitHeader';
import { HubCockpitTiles } from './HubCockpitTiles';
import { HubCockpitDrawerPane, renderHubDrawerDetail } from './HubCockpitDrawerBody';
import type { HubSocialAction } from './HubSocialBridge';
import styles from './cockpit.module.css';

const HubSocialBridge = dynamic(
  () => import('./HubSocialBridge').then((m) => ({ default: m.HubSocialBridge })),
  { ssr: false },
);

const WIDGET_ORDER: readonly { key: CockpitWidgetKey; name: string; icon: string }[] = [
  { key: 'carte', name: 'Carte', icon: 'map' },
  { key: 'meteo', name: 'Météo', icon: 'cloud-sun' },
  { key: 'etapes', name: 'Étapes', icon: 'footprints' },
  { key: 'kit', name: 'Kits', icon: 'backpack' },
  { key: 'budget', name: 'Budget', icon: 'wallet' },
  { key: 'carnet', name: 'Carnet', icon: 'book-open' },
  { key: 'paperasse', name: 'Paperasse', icon: 'folder' },
  { key: 'groupe', name: 'Groupe', icon: 'users' },
];

const WIDGET_KEYS = new Set<string>(WIDGET_ORDER.map((w) => w.key));
type View = { widget: CockpitWidgetKey; detail?: string };

function readView(): View | null {
  const query = new URLSearchParams(window.location.search);
  const value = query.get('widget');
  if (!value || !WIDGET_KEYS.has(value)) return null;
  return { widget: value as CockpitWidgetKey, detail: query.get('detail') ?? undefined };
}

export function HubCockpit({
  data,
  fixture = false,
  adventureControl,
}: {
  data: CockpitData;
  fixture?: boolean;
  adventureControl?: ReactNode;
}) {
  const id = useId();
  const { isOnline } = useOnlineStatus();
  const [view, setView] = useState<View | null>(null);
  const [lastWidget, setLastWidget] = useState<CockpitWidgetKey>('carte');
  const [socialAction, setSocialAction] = useState<HubSocialAction | null>(null);
  const [clock, setClock] = useState<{ date: string; hour: number } | null>(null);
  const [selection, setSelection] = useState<{ day: number; date: string | undefined } | null>(null);
  const [carnet, setCarnet] = useState(data.carnet);
  const [savedSteps, setSavedSteps] = useState<Record<string, StepExecution>>({});
  const [addedExpenses, setAddedExpenses] = useState<CockpitExpense[]>([]);
  const [addedDocuments, setAddedDocuments] = useState<NonNullable<CockpitData['documents']>>([]);
  const [kitOverrides, setKitOverrides] = useState<Record<string, boolean>>({});
  const [groupPage, setGroupPage] = useState(0);
  const [meteoTab, setMeteoTab] = useState<'today' | 'days' | 'alerts'>('today');
  const [kitTab, setKitTab] = useState<'list' | 'weights' | 'shared'>('list');
  const [carnetTab, setCarnetTab] = useState<'moments' | 'notes' | 'story'>('moments');
  const [paperasseTab, setPaperasseTab] = useState<'wallet' | 'bookings' | 'rules'>('wallet');
  const [groupeTab, setGroupeTab] = useState<'members' | 'safety'>('members');
  const [mapPack, setMapPack] = useState<OfflineMapPack | null>(null);
  const [carnetDraft, setCarnetDraft] = useState<CarnetLocalDraft | null>(null);
  const [offlineDraftText, setOfflineDraftText] = useState('');
  const [offlineOps, setOfflineOps] = useState<CockpitOfflineOperation[]>([]);
  const [syncingOffline, setSyncingOffline] = useState(false);

  const restore = useRef<{ item: string; top: number } | null>(null);
  const dayRailRef = useRef<HTMLDivElement>(null);

  const widget = view?.widget ?? lastWidget;
  const availableWidgets = useMemo(
    () => (data.trip ? WIDGET_ORDER : WIDGET_ORDER.filter((w) => w.key === 'groupe')),
    [data.trip],
  );

  const weather = useCockpitWeather(data, !fixture && data.trip && isOnline);
  const forecast = weather.forecast;

  const today = !fixture && clock ? currentCockpitDay(data.startDate, data.dayCount, clock.date) : data.today ?? 1;
  const day = selection && selection.date === clock?.date ? selection.day : today;
  const activeDateIso = clock?.date ?? normalizeCivilDateString();

  const mergedBudget = useMemo(() => {
    if (!data.budget) return null;
    if (!addedExpenses.length) return data.budget;
    const seen = new Set(data.budget.expenses.map((e) => e.id));
    const extras = addedExpenses.filter((e) => !seen.has(e.id));
    return { ...data.budget, expenses: [...extras, ...data.budget.expenses] };
  }, [data.budget, addedExpenses]);

  const dailyBudget = mergedBudget && cockpitDayBudget(mergedBudget, data.startDate, day, data.dayCount, activeDateIso);
  const expenses = dailyBudget?.expenses ?? [];
  const reservations = data.reservations ?? [];

  const daySteps = useMemo(() => data.steps.filter((step) => step.day === day), [data.steps, day]);
  const archivedSteps = useMemo(
    () => Object.values(data.stepExecutions ?? {}).filter((step) => step.archived),
    [data.stepExecutions],
  );
  const dayArchive = archivedSteps.filter((step) => step.planned_day_number === day);
  const dayMap = useMemo(
    () => ({ ...data, steps: daySteps, route: cockpitDayRoute(data.route, daySteps, day, data.dayCount) }),
    [data, daySteps, day],
  );
  const dayNotes = data.notes.filter((note) => note.day === day);
  const dayMoments = (carnet?.moments ?? [])
    .filter((moment) => moment.day === day)
    .sort((a, b) => (a.time ?? '24:00').localeCompare(b.time ?? '24:00'));

  const hour =
    day === today && !fixture
      ? clock?.hour ?? 12
      : dayMoments.reduce((first, moment) => Math.min(first, momentHour(moment.time) ?? 24), 24);
  const clockHour = hour < 24 ? hour : 12;

  const mergedKit = useMemo(
    () => data.kit.map((item) => (Object.hasOwn(kitOverrides, item.id) ? { ...item, packed: kitOverrides[item.id] } : item)),
    [data.kit, kitOverrides],
  );
  const dayKit = mergedKit.filter((item) => item.day == null || item.day === day);
  const packedCount = dayKit.filter((item) => item.packed).length;
  const kitWeights = useMemo(() => computeKitWeights(dayKit), [dayKit]);
  const memberChunks = useMemo(() => chunkMembersByThree(data.people), [data.people]);

  const days = useMemo(() => {
    const list = new Set([today, ...data.steps.map((step) => step.day), ...archivedSteps.map((step) => step.planned_day_number)]);
    if (data.dayCount) for (let i = 1; i <= data.dayCount; i += 1) list.add(i);
    return [...list].sort((a, b) => a - b);
  }, [data.steps, data.dayCount, today, archivedSteps]);

  const executionFor = useCallback(
    (stepId: string) => {
      if (!data.stepExecutions) return undefined;
      const fromServer = data.stepExecutions[stepId];
      const saved = savedSteps[stepId];
      return saved && saved.version > (fromServer?.version ?? 0) ? saved : fromServer;
    },
    [data.stepExecutions, savedSteps],
  );

  const completedDaySteps = useMemo(
    () => daySteps.filter((st) => executionFor(st.id)?.status === 'completed').length,
    [daySteps, executionFor],
  );

  const readiness = useMemo(
    () =>
      computeCockpitReadiness(data, {
        day,
        activeDateIso,
        forecastDay: forecast?.days[0] ?? null,
        kitItems: dayKit,
        completedStepCount: completedDaySteps,
        totalDaySteps: daySteps.length,
      }),
    [data, day, activeDateIso, forecast, dayKit, completedDaySteps, daySteps.length],
  );

  // Sync horloge civile
  useEffect(() => {
    function syncClock() {
      const now = new Date();
      const date = normalizeCivilDateString();
      const h = now.getHours();
      setClock((prev) => (prev?.date === date && prev.hour === h ? prev : { date, hour: h }));
    }
    syncClock();
    const timer = window.setInterval(syncClock, 60_000);
    window.addEventListener('pageshow', syncClock);
    document.addEventListener('visibilitychange', syncClock);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pageshow', syncClock);
      document.removeEventListener('visibilitychange', syncClock);
    };
  }, []);

  // Centrer le jour actif dans la capsule J1..Jn
  useEffect(() => {
    const rail = dayRailRef.current;
    const active = rail?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!rail || !active) return;
    rail.scrollLeft = active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2;
  }, [day]);

  // URL state sync
  useEffect(() => {
    const sync = () => {
      const next = readView();
      setView(next);
      if (next) setLastWidget(next.widget);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  // Restauration du scroll après retour d'une vue détail
  useEffect(() => {
    if (!view || view.detail || !restore.current) return;
    const position = restore.current;
    restore.current = null;
    const frame = requestAnimationFrame(() => {
      const dialog = document.querySelector('.lkdv-cv2-sheet');
      const target = [...(dialog?.querySelectorAll<HTMLElement>('[data-hub-item]') ?? [])].find(
        (element) => element.dataset.hubItem === position.item,
      );
      const pane = target?.closest<HTMLElement>('.lkdv-cv2-pane') ?? dialog?.querySelector('.lkdv-cv2-pane');
      if (pane) pane.scrollTop = position.top;
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [view]);

  // Masquer la tabbar flottante quand un drawer est ouvert
  useEffect(() => {
    document.body.classList.toggle('lkdv-dialog-open', view !== null || socialAction !== null);
    return () => {
      document.body.classList.remove('lkdv-dialog-open');
    };
  }, [view, socialAction]);

  const go = useCallback(
    (nextWidget: CockpitWidgetKey, detail?: string, opener?: HTMLElement | null) => {
      const next: View = { widget: nextWidget, detail };
      if (opener) {
        if (!view) opener.focus({ preventScroll: true });
        else if (next.detail && !view.detail && opener.dataset.hubItem) {
          restore.current = { item: opener.dataset.hubItem, top: opener.closest('.lkdv-cv2-pane')?.scrollTop ?? 0 };
        }
      }
      const url = new URL(window.location.href);
      url.searchParams.set('widget', next.widget);
      if (next.detail) url.searchParams.set('detail', next.detail);
      else url.searchParams.delete('detail');
      const depth = Number(window.history.state?.lkdvHubDepth) || 0;
      const fromHour = view?.widget === 'carnet' && view.detail?.startsWith('heure-') && next.detail;
      if ((view?.detail && !fromHour) || (view && !next.detail)) {
        window.history.replaceState(window.history.state, '', url);
      } else {
        window.history.pushState({ ...window.history.state, lkdvHubDepth: depth + 1 }, '', url);
      }
      setLastWidget(next.widget);
      setView(next);
    },
    [view],
  );

  const back = useCallback(() => {
    if (!view) return;
    if (Number(window.history.state?.lkdvHubDepth) > 1) {
      window.history.back();
      return;
    }
    go(view.widget);
  }, [view, go]);

  const close = useCallback(() => {
    setView(null);
    restore.current = null;
    const depth = Number(window.history.state?.lkdvHubDepth) || 0;
    if (depth > 0) window.history.go(-depth);
    else {
      const url = new URL(window.location.href);
      url.searchParams.delete('widget');
      url.searchParams.delete('detail');
      window.history.replaceState(window.history.state, '', url);
    }
  }, []);

  const onStepSaved = useCallback((row: StepExecution) => {
    setSavedSteps((saved) => ((saved[row.step_id]?.version ?? 0) < row.version ? { ...saved, [row.step_id]: row } : saved));
  }, []);

  const refreshOfflineOps = useCallback(async () => {
    if (fixture || !data.trip) return;
    setOfflineOps(await listOfflineOps(data.key));
  }, [fixture, data.trip, data.key]);

  const flushOfflineOps = useCallback(async () => {
    if (fixture || !data.trip || !isOnline) return;
    const pending = await listOfflineOps(data.key);
    if (!pending.some((op) => op.status === 'pending')) {
      setOfflineOps(pending);
      return;
    }
    setSyncingOffline(true);
    try {
      await replayOfflineOps(data.key, async (op) => {
        if (op.kind === 'step_execution') {
          const payload = op.payload as StepExecutionPayload;
          const res = await recordStepExecution({ ...payload, operationId: op.operationId });
          if (res.ok) {
            onStepSaved(res.execution);
            return { status: 'synced' };
          }
          if (res.refresh) return { status: 'conflict', message: res.message };
          return { status: 'retry', message: res.message };
        }
        if (op.kind === 'expense_create') {
          const payload = op.payload as ExpenseCreatePayload;
          const res = await createCockpitExpense({ ...payload, operationId: op.operationId });
          if (res.ok) {
            setAddedExpenses((prev) => [res.expense, ...prev.filter((e) => e.id !== op.operationId)]);
            return { status: 'synced' };
          }
          return { status: 'retry', message: res.message };
        }
        if (op.kind === 'kit_toggle') {
          const payload = op.payload as KitTogglePayload;
          const res = await toggleCockpitKitItem(payload);
          if (res.ok) {
            setKitOverrides((prev) => ({ ...prev, [res.itemId]: res.packed }));
            return { status: 'synced' };
          }
          return { status: 'retry', message: res.message };
        }
        return { status: 'retry', message: 'Type non pris en charge' };
      });
    } finally {
      setSyncingOffline(false);
      await refreshOfflineOps();
    }
  }, [fixture, data.trip, data.key, isOnline, refreshOfflineOps, onStepSaved]);

  useEffect(() => {
    void refreshOfflineOps();
    if (!fixture && data.trip) {
      void readOfflineMapPack(data.key).then(setMapPack);
      setCarnetDraft(loadCarnetDraft(data.key));
    }
  }, [refreshOfflineOps, fixture, data.trip, data.key]);

  useEffect(() => {
    if (isOnline) void flushOfflineOps();
  }, [isOnline, flushOfflineOps]);

  const onStepQueued = useCallback(
    (payload: StepExecutionPayload) => {
      const now = new Date().toISOString();
      const existing = executionFor(payload.stepId);
      const step = data.steps.find((item) => item.id === payload.stepId);
      const optimistic: StepExecution = {
        step_id: payload.stepId,
        status: payload.status,
        version: (existing?.version ?? payload.expectedVersion) + 1,
        occurred_at: now,
        actual_started_at: payload.status === 'started' ? now : existing?.actual_started_at ?? null,
        actual_arrived_at: payload.status === 'arrived' ? now : existing?.actual_arrived_at ?? null,
        actual_completed_at: payload.status === 'completed' ? now : existing?.actual_completed_at ?? null,
        note: payload.note || null,
        archived: false,
        planned_title: step?.title ?? existing?.planned_title ?? 'Étape',
        planned_day_number: step?.day ?? existing?.planned_day_number ?? day,
        planned_start_time: step?.time ?? existing?.planned_start_time ?? null,
      };
      setSavedSteps((saved) => ({ ...saved, [payload.stepId]: optimistic }));
      void refreshOfflineOps();
    },
    [executionFor, data.steps, day, refreshOfflineOps],
  );

  const onToggleKitItem = useCallback(
    (itemId: string, nextPacked: boolean) => {
      setKitOverrides((prev) => ({ ...prev, [itemId]: nextPacked }));
      const payload: KitTogglePayload = { tripId: data.key, itemId, packed: nextPacked };
      if (!isOnline) {
        void enqueueOfflineOp({ operationId: newId(), tripId: data.key, kind: 'kit_toggle', payload }).then(() =>
          refreshOfflineOps(),
        );
      } else {
        void toggleCockpitKitItem(payload).then((res) => {
          if (!res.ok) setKitOverrides((prev) => ({ ...prev, [itemId]: !nextPacked }));
        });
      }
    },
    [data.key, isOnline, refreshOfflineOps],
  );

  const openShare = useCallback(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const permalink = carnet ? `${origin}/carnets/${carnet.id}` : `${origin}/hub`;
    setView(null);
    setSocialAction({
      kind: 'share',
      title: data.title,
      subtitle: data.location,
      permalink,
      entityId: data.key,
    });
  }, [carnet, data.key, data.location, data.title]);

  const openPublishStory = useCallback(
    (kind: 'post' | 'story', markdown: string) => {
      setView(null);
      setSocialAction({
        kind,
        prefill: {
          caption: markdown.slice(0, 600),
          locationName: data.location ?? undefined,
          carnetId: carnet?.id ?? undefined,
        },
      });
    },
    [data.location, carnet?.id],
  );

  const drawerProps = {
    widget,
    data,
    fixture,
    isOnline,
    day,
    activeDateIso,
    forecast,
    weatherPending: weather.pending,
    weatherGps: weather.gps,
    weatherError: weather.error,
    onLocateWeather: () => void weather.locate(),
    mergedBudget,
    dailyBudget,
    expenses,
    onExpenseAdded: (expense: CockpitExpense) => setAddedExpenses((prev) => [expense, ...prev]),
    onExpenseQueued: (payload: ExpenseCreatePayload, operationId: string) => {
      setAddedExpenses((prev) => [
        {
          id: operationId,
          title: `${payload.title} (hors ligne)`,
          amount: payload.amount,
          currency: payload.currency,
          date: payload.date,
          planned: false,
          category: payload.category,
        },
        ...prev,
      ]);
      void refreshOfflineOps();
    },
    dayMap,
    daySteps,
    dayArchive,
    dayNotes,
    dayMoments,
    carnet,
    onCarnetChange: setCarnet,
    carnetDraft,
    onCarnetDraftChange: setCarnetDraft,
    offlineDraftText,
    onOfflineDraftTextChange: setOfflineDraftText,
    dayKit,
    mergedKit,
    packedCount,
    kitWeights,
    onToggleKitItem,
    reservations,
    addedDocuments,
    onDocumentAdded: (doc: NonNullable<CockpitData['documents']>[number]) => setAddedDocuments((prev) => [doc, ...prev]),
    memberChunks,
    groupPage,
    onGroupPageChange: setGroupPage,
    mapPack,
    onMapPackChange: setMapPack,
    offlineOps,
    executionFor,
    onStepSaved,
    onStepQueued,
    meteoTab,
    onMeteoTabChange: setMeteoTab,
    kitTab,
    onKitTabChange: setKitTab,
    carnetTab,
    onCarnetTabChange: setCarnetTab,
    paperasseTab,
    onPaperasseTabChange: setPaperasseTab,
    groupeTab,
    onGroupeTabChange: setGroupeTab,
    onGo: go,
    onBack: back,
    onPublishStory: openPublishStory,
    onShareAdventure: openShare,
  };

  const activeWidgetIndex = Math.max(
    0,
    availableWidgets.findIndex((w) => w.key === widget),
  );
  const detailInfo = view?.detail ? renderHubDrawerDetail(view.detail, drawerProps) : null;

  return (
    <LazyMotion features={domMax}>
      <MotionConfig reducedMotion="user">
        <section className={`lkdv-communaute-v2 ${styles.shell}`} data-hub-cockpit aria-labelledby={id}>
          <HubCockpitHeader
            id={id}
            title={data.title}
            location={data.location}
            trip={data.trip}
            collective={data.collective}
            fixture={fixture}
            hasSwitcher={Boolean(adventureControl)}
            days={days}
            day={day}
            today={today}
            dayRailRef={dayRailRef}
            readiness={readiness}
            onSelectDay={(nextDay) => setSelection({ day: nextDay, date: clock?.date })}
            onOpenWidget={(w, opener) => go(w, undefined, opener)}
            onOpenShare={!fixture && (data.trip || data.collective) ? openShare : undefined}
          />

          {(!isOnline || offlineOps.length > 0 || syncingOffline) && (
            <div role="status" className={styles.statusBanner}>
              <span>
                {!isOnline
                  ? `Hors connexion${offlineOps.length ? ` · ${offlineOps.length} action${offlineOps.length > 1 ? 's' : ''} en attente` : ''}`
                  : syncingOffline
                    ? 'Synchronisation des actions hors ligne…'
                    : offlineOps.some((op) => op.status === 'conflict')
                      ? `${offlineOps.filter((op) => op.status === 'conflict').length} conflit(s) de synchronisation`
                      : `${offlineOps.length} action${offlineOps.length > 1 ? 's' : ''} en attente de synchronisation`}
              </span>
              {isOnline && offlineOps.some((op) => op.status === 'pending') && !syncingOffline && (
                <button type="button" className="lkdv-cv2-chip" onClick={() => void flushOfflineOps()}>
                  Synchroniser
                </button>
              )}
              {offlineOps.some((op) => op.status === 'conflict') && (
                <button
                  type="button"
                  className="lkdv-cv2-chip"
                  onClick={() =>
                    void Promise.all(
                      offlineOps.filter((op) => op.status === 'conflict').map((op) => removeOfflineOp(op.operationId)),
                    ).then(() => refreshOfflineOps())
                  }
                >
                  Ignorer
                </button>
              )}
            </div>
          )}

          {!fixture && !data.trip && !data.collective && (
            <div className={styles.emptyCampCard}>
              <div className={styles.emptyCampIcon}>
                <Icon name="compass" size={28} />
              </div>
              <h2>Aucune aventure active</h2>
              <p className={styles.meta}>
                Crée ta prochaine sortie ou prépare ton sac dans le Compas pour activer ton cockpit terrain.
              </p>
              <div className={styles.emptyCampActions}>
                <Link href="/compas" className={styles.primaryCta}>
                  <Icon name="compass" size={16} /> Préparer une aventure
                </Link>
                <Link href="/explorer" className={styles.secondaryCta}>
                  Explorer la carte 3D
                </Link>
              </div>
            </div>
          )}

          {(data.trip || data.collective) && (
            <HubCockpitTiles
              data={data}
              fixture={fixture}
              day={day}
              dayMap={dayMap}
              daySteps={daySteps}
              dayMoments={dayMoments}
              clockHour={clockHour}
              forecast={forecast}
              weatherPending={weather.pending}
              onLocateWeather={() => void weather.locate()}
              dailyBudget={dailyBudget}
              dayKit={dayKit}
              packedCount={packedCount}
              kitWeights={kitWeights}
              reservations={reservations}
              activeDateIso={activeDateIso}
              mapPack={mapPack}
              executionFor={executionFor}
              onOpen={go}
              onOpenShare={!fixture ? openShare : undefined}
            />
          )}

          {/* Contrôleur de changement d'aventure (piloté par la Command Bar) */}
          {adventureControl}

          {/* Drawer unifié Bible Design : Capsule 56px en haut + Grabber seul (zéro ×) + Sous-volets bas-droite */}
          <CommunitySheetShell
            open={view !== null}
            onClose={close}
            initialDetent="large"
            className={styles.drawerLayer}
            resetKey={widget}
            label={availableWidgets[activeWidgetIndex]?.name ?? 'Hub'}
            capsule={{
              items: availableWidgets.map((w) => ({
                id: `hub-${w.key}`,
                label: w.name,
                icon: <Icon name={w.icon} size={20} />,
              })),
              active: activeWidgetIndex,
              onChange: (idx) => {
                const target = availableWidgets[idx];
                if (target) go(target.key);
              },
              ariaLabel: 'Modules du Hub',
            }}
            panes={availableWidgets.map((w) => (
              <div key={w.key} className={styles.pane}>
                {w.key === widget ? <HubCockpitDrawerPane {...drawerProps} /> : null}
              </div>
            ))}
            detail={
              view?.detail
                ? {
                    title: detailInfo?.title ?? 'Détail indisponible',
                    index: 0,
                    pages: [
                      <div key={view.detail} className={styles.pane}>
                        {detailInfo?.content ?? (
                          <div className="lkdv-cv2-empty">
                            <p>Cette donnée n’est plus accessible.</p>
                          </div>
                        )}
                      </div>,
                    ],
                    onBack: back,
                  }
                : null
            }
          />

          {/* Pont Social In-Place (PostFormV2 / StoryFormV2 / PostSharePanel) — chargé uniquement à la demande */}
          {socialAction && <HubSocialBridge action={socialAction} onClose={() => setSocialAction(null)} />}
        </section>
      </MotionConfig>
    </LazyMotion>
  );
}
