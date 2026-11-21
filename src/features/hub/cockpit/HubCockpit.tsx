'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { LazyMotion, MotionConfig, domMax, m } from 'framer-motion';
import { normalizeCivilDateString } from '@/features/trips/engine/temporalPhaseEngine';
import { CarnetClock } from './CarnetClock';
import { cockpitDayBudget, cockpitDayRoute, currentCockpitDay, momentHour } from './day';
import { weatherGlyph } from './weatherGlyph';
import { useEffect, useId, useMemo, useRef, useState, useCallback, type ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import { IdentityPill } from '@/features/community/feed/PostAuthorPill';
import { CommunitySheetShell } from '@/features/community/v2/shared/CommunitySheetShell';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { CockpitData, CockpitExpense, CockpitWeatherDay } from './model';
import { useCockpitWeather } from './useCockpitWeather';
import { stepStatusLabels, type StepExecution } from './stepExecution';
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
import { deriveWeatherAlerts, weatherFreshnessLabel } from './weatherAdvice';
import { computeKitWeights, formatWeight } from './kitMath';
import { evaluateDocumentExpiry } from './paperasseStatus';
import { chunkMembersByThree } from './groupProgress';
import { ElevationStrip } from './ElevationStrip';
import {
  deleteOfflineMapPack,
  formatPackSize,
  readOfflineMapPack,
  saveOfflineMapPack,
  type OfflineMapPack,
} from './offlineMapPack';
import { clearCarnetDraft, loadCarnetDraft, saveCarnetDraft, type CarnetLocalDraft } from './CarnetDraftStore';
import { estimateTrailCondition } from './weatherAdvanced';
import { estimateConsumablesAutonomy } from './consumablesTracker';
import { buildTripStoryDraft } from './storySummary';
import { buildDestinationSafetyBrief } from './terrainAndCollectiveContracts';
import { DrawerRow, DrawerSection, EmptyBox, ProgressBar, SegmentedTabs, StatusBadge, type BadgeTone } from './DrawerPrimitives';
import { newId } from '@/lib/uuid';
import styles from './cockpit.module.css';
import ds from './cockpitDrawers.module.css';

const BudgetDrawerTools = dynamic(() => import('./BudgetDrawerTools').then((m) => m.BudgetDrawerTools), { ssr: false });
const FieldReportForm = dynamic(() => import('./FieldReportForm').then((m) => m.FieldReportForm), { ssr: false });
const TripLifecycleBar = dynamic(() => import('./TripLifecycleBar').then((m) => m.TripLifecycleBar), { ssr: false });
const SafetyContactsPanel = dynamic(() => import('./SafetyContactsPanel').then((m) => m.SafetyContactsPanel), { ssr: false });
const PaperasseQuickAdd = dynamic(() => import('./PaperasseQuickAdd').then((m) => m.PaperasseQuickAdd), { ssr: false });
const OfficialAlertsPanel = dynamic(() => import('./OfficialAlertsPanel').then((m) => m.OfficialAlertsPanel), { ssr: false });

const Map = dynamic(() => import('./HubCockpitMap').then((m) => m.HubCockpitMap), {
  ssr: false, loading: () => <p className={styles.mapStatus} role="status">Chargement de la carte</p>,
});
const KitScene = dynamic(() => import('./HubKitPreview').then((m) => m.HubKitPreview), {
  ssr: false, loading: () => <p role="status">Chargement du kit…</p>,
});
const StepExecutionDetails = dynamic(() => import('./StepExecutionDetails').then((m) => m.StepExecutionDetails), { ssr: false });
const MomentEditor = dynamic(() => import('./HubMomentEditor').then((m) => m.HubMomentEditor), {
  ssr: false, loading: () => <p role="status">Chargement du carnet…</p>,
});

const widgets = {
  meteo: { name: 'Météo', icon: 'cloud-sun' },
  budget: { name: 'Budget', icon: 'wallet' },
  carte: { name: 'Carte', icon: 'map' },
  etapes: { name: 'Étapes', icon: 'footprints' },
  carnet: { name: 'Carnet', icon: 'book-open' },
  kit: { name: 'Kits', icon: 'backpack' },
  paperasse: { name: 'Paperasse', icon: 'folder' },
  groupe: { name: 'Groupe', icon: 'users' },
};
type Widget = keyof typeof widgets;
type View = { widget: Widget; detail?: string };

const number = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);
const money = ({ amount, currency }: { amount: number; currency: string }) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);

function dateLabel(date: string | null | undefined, full = false) {
  if (!date) return null;
  const time = Date.parse(date.slice(0, 10) + 'T12:00:00Z');
  return Number.isFinite(time)
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', weekday: full ? 'long' : undefined, timeZone: 'UTC' }).format(time)
    : null;
}

function temperatures({ low, high }: CockpitWeatherDay) {
  return [low, high].filter((value): value is number => value != null).map((value) => `${number(value)}°`).join(' / ');
}

function readView(): View | null {
  const query = new URLSearchParams(window.location.search);
  const value = query.get('widget');
  if (!value || !Object.hasOwn(widgets, value)) return null;
  return { widget: value as Widget, detail: query.get('detail') ?? undefined };
}

function Action({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className={`lkdv-cv2-chip ${styles.action}`}>{children}<Icon name="chevron-right" size={16} /></Link>;
}

function Status({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className={`lkdv-cv2-empty ${styles.status}`}><p>{children}</p>{action}</div>;
}

function Pill({ title, meta, onClick, itemId, inline = false }: {
  title: string; meta?: ReactNode; onClick: (element: HTMLButtonElement) => void; itemId: string; inline?: boolean;
}) {
  return <button type="button" className={['lkdv-cv2-chip', styles.pill, inline && styles.inlinePill].filter(Boolean).join(' ')}
    title={title} data-hub-item={itemId} onClick={(event) => onClick(event.currentTarget)}>
    <strong>{title}</strong>{meta && <span>{meta}</span>}
  </button>;
}

function Rail({ label, children, small = false }: { label: string; children: ReactNode; small?: boolean }) {
  return <div className={`lkdv-cv2-rail ${styles.rail} ${small ? styles.railThree : ''}`} role="group" aria-label={label}>{children}</div>;
}

export function HubCockpit({ data, fixture = false, adventureControl }: {
  data: CockpitData; fixture?: boolean; adventureControl?: ReactNode;
}) {
  const id = useId();
  const { isOnline } = useOnlineStatus();
  const [view, setView] = useState<View | null>(null);
  const [lastWidget, setLastWidget] = useState<Widget>('meteo');
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
  const dayRail = useRef<HTMLDivElement>(null);
  const widget = view?.widget ?? lastWidget;
  const weather = useCockpitWeather(data, !fixture && data.trip && isOnline);
  const forecast = weather.forecast;
  const today = !fixture && clock ? currentCockpitDay(data.startDate, data.dayCount, clock.date) : data.today ?? 1;
  const day = selection && selection.date === clock?.date ? selection.day : today;
  const mergedBudget = useMemo(() => {
    if (!data.budget) return null;
    if (!addedExpenses.length) return data.budget;
    const seen = new Set(data.budget.expenses.map((e) => e.id));
    const extras = addedExpenses.filter((e) => !seen.has(e.id));
    return { ...data.budget, expenses: [...extras, ...data.budget.expenses] };
  }, [data.budget, addedExpenses]);
  const activeDateIso = clock?.date ?? normalizeCivilDateString();
  const dailyBudget = mergedBudget && cockpitDayBudget(mergedBudget, data.startDate, day, data.dayCount, activeDateIso);
  const expenses = dailyBudget?.expenses ?? [];
  const reservations = data.reservations ?? [];
  const peopleStatus = data.peopleUnavailable ? 'Membres momentanément indisponibles'
    : data.pending > 0 ? `${data.pending} invitation${data.pending > 1 ? 's' : ''} en attente`
    : 'Aucun membre actif';
  const daySteps = useMemo(() => data.steps.filter((step) => step.day === day), [data.steps, day]);
  const archivedSteps = useMemo(() => Object.values(data.stepExecutions ?? {}).filter((step) => step.archived), [data.stepExecutions]);
  const dayArchive = archivedSteps.filter((step) => step.planned_day_number === day);
  const dayMap = useMemo(() => ({
    ...data, steps: daySteps, route: cockpitDayRoute(data.route, daySteps, day, data.dayCount),
  }), [data, daySteps, day]);
  const dayNotes = data.notes.filter((note) => note.day === day);
  const dayMoments = (carnet?.moments ?? []).filter((moment) => moment.day === day)
    .sort((a, b) => (a.time ?? '24:00').localeCompare(b.time ?? '24:00'));
  const hour = day === today && !fixture ? clock?.hour ?? 12
    : dayMoments.reduce((first, moment) => Math.min(first, momentHour(moment.time) ?? 24), 24);
  const clockHour = hour < 24 ? hour : 12;
  const mergedKit = useMemo(() => data.kit.map((item) => (
    Object.hasOwn(kitOverrides, item.id) ? { ...item, packed: kitOverrides[item.id] } : item
  )), [data.kit, kitOverrides]);
  const dayKit = mergedKit.filter((item) => item.day == null || item.day === day);
  const packed = dayKit.filter((item) => item.packed).length;
  const kitWeights = useMemo(() => computeKitWeights(dayKit), [dayKit]);
  const memberChunks = useMemo(() => chunkMembersByThree(data.people), [data.people]);
  const days = useMemo(() => {
    const list = new Set([today, ...data.steps.map((step) => step.day), ...archivedSteps.map((step) => step.planned_day_number)]);
    if (data.dayCount) for (let i = 1; i <= data.dayCount; i += 1) list.add(i);
    return [...list].sort((a, b) => a - b);
  }, [data.steps, data.dayCount, today, archivedSteps]);

  useEffect(() => {
    function syncClock() {
      const now = new Date();
      const date = normalizeCivilDateString();
      const hour = now.getHours();
      setClock((prev) => prev?.date === date && prev.hour === hour ? prev : { date, hour });
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

  useEffect(() => {
    const rail = dayRail.current;
    const active = rail?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!rail || !active) return;
    rail.scrollLeft = active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2;
  }, [day]);
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

  useEffect(() => {
    if (!view || view.detail || !restore.current) return;
    const position = restore.current;
    restore.current = null;
    const frame = requestAnimationFrame(() => {
      const dialog = document.querySelector('.lkdv-cv2-sheet');
      const target = [...(dialog?.querySelectorAll<HTMLElement>('[data-hub-item]') ?? [])]
        .find((element) => element.dataset.hubItem === position.item);
      const pane = target?.closest<HTMLElement>('.lkdv-cv2-pane') ?? dialog?.querySelector('.lkdv-cv2-pane');
      if (pane) pane.scrollTop = position.top;
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [view]);

  function go(next: View, opener?: HTMLElement | null) {
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
  }

  function back() {
    if (!view) return;
    if (Number(window.history.state?.lkdvHubDepth) > 1) {
      window.history.back();
      return;
    }
    go({ widget: view.widget });
  }

  function close() {
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
  }

  function executionFor(stepId: string) {
    if (!data.stepExecutions) return undefined;
    const fromServer = data.stepExecutions[stepId];
    const saved = savedSteps[stepId];
    return saved && saved.version > (fromServer?.version ?? 0) ? saved : fromServer;
  }

  function onStepSaved(row: StepExecution) {
    setSavedSteps((saved) => (saved[row.step_id]?.version ?? 0) < row.version
      ? { ...saved, [row.step_id]: row } : saved);
  }

  const refreshOfflineOps = useCallback(async () => {
    if (fixture || !data.trip) return;
    const ops = await listOfflineOps(data.key);
    setOfflineOps(ops);
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
  }, [fixture, data.trip, data.key, isOnline, refreshOfflineOps]);

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

  useEffect(() => {
    document.body.classList.toggle('lkdv-dialog-open', view !== null);
    return () => {
      document.body.classList.remove('lkdv-dialog-open');
    };
  }, [view]);

  function onStepQueued(payload: StepExecutionPayload) {
    const now = new Date().toISOString();
    const existing = executionFor(payload.stepId);
    const step = data.steps.find((item) => item.id === payload.stepId);
    const optimistic: StepExecution = {
      step_id: payload.stepId,
      status: payload.status,
      version: (existing?.version ?? payload.expectedVersion) + 1,
      occurred_at: now,
      actual_started_at: payload.status === 'started' ? now : (existing?.actual_started_at ?? null),
      actual_arrived_at: payload.status === 'arrived' ? now : (existing?.actual_arrived_at ?? null),
      actual_completed_at: payload.status === 'completed' ? now : (existing?.actual_completed_at ?? null),
      note: payload.note || null,
      archived: false,
      planned_title: step?.title ?? existing?.planned_title ?? 'Étape',
      planned_day_number: step?.day ?? existing?.planned_day_number ?? day,
      planned_start_time: step?.time ?? existing?.planned_start_time ?? null,
    };
    setSavedSteps((saved) => ({ ...saved, [payload.stepId]: optimistic }));
    void refreshOfflineOps();
  }

  function stepRows(target: 'carte' | 'etapes', showState = false) {
    return daySteps.map((step) => {
      const execution = executionFor(step.id);
      return (
        <Pill key={step.id} itemId={step.id} title={step.title}
          meta={execution ? <>
            <i className={styles.stepIndicator} data-status={execution.status} aria-hidden="true" />
            <span className={showState ? undefined : 'sr-only'}>{stepStatusLabels[execution.status]}{step.time ? ' · ' : ''}</span>{step.time}
          </> : step.time} inline
          onClick={(element) => go({ widget: target, detail: step.id }, element)} />
      );
    });
  }

  function weatherDays() {
    const forecastDate = forecast?.observedAt?.slice(0, 10);
    const upcoming = forecastDate ? forecast?.days.filter((entry) => entry.date > forecastDate) : forecast?.days;
    return (upcoming?.length ? upcoming : forecast?.days)?.map((entry) => (
      <Pill key={entry.date} itemId={entry.date} title={entry.day} meta={entry.high == null ? entry.condition : `${number(entry.high)}°`}
        onClick={(element) => go({ widget: 'meteo', detail: entry.date }, element)} />
    ));
  }

  function budgetRows() {
    return expenses.map((entry) => (
      <Pill key={entry.id} itemId={entry.id} title={entry.title} meta={money(entry)} inline
        onClick={(element) => go({ widget: 'budget', detail: entry.id }, element)} />
    ));
  }

  function reservationRows(entries = reservations) {
    return entries.map((entry) => (
      <Pill key={entry.id} itemId={entry.id} title={entry.title} meta={dateLabel(entry.due) ?? entry.status}
        onClick={(element) => go({ widget: 'paperasse', detail: entry.id }, element)} />
    ));
  }

  function peopleRows() {
    return data.people.map((person) => (
      <IdentityPill key={person.id} name={person.name ?? 'Participant'} avatarUrl={person.avatar} meta={person.role}
        itemId={person.id} onClick={(element) => go({ widget: 'groupe', detail: person.id }, element)} />
    ));
  }

  function dayPicker() {
    return <m.div layoutScroll ref={dayRail} role="group" aria-label="Jour du voyage" className={styles.dayRail}>
      {days.map((option) => <button key={option} className={styles.dayPill} type="button" aria-label={`Jour ${option}`}
        aria-current={option === today ? 'date' : undefined} aria-pressed={option === day}
        onClick={() => setSelection({ day: option, date: clock?.date })}>
        {option === day && <m.span layoutId={`${id}-day`} className={styles.daySelection} aria-hidden="true"
          transition={{ type: 'spring', stiffness: 480, damping: 38 }} />}
        <span>J{option}</span>
      </button>)}
    </m.div>;
  }

  function dayContent(body: ReactNode, className: string, label?: string) {
    return <m.div key={day} className={className} role={label ? 'group' : undefined} aria-label={label}
      initial={{ opacity: 0.64 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}>{body}</m.div>;
  }

  function makeTile(key: Widget, body: ReactNode, control?: ReactNode) {
    const definition = widgets[key];
    return <section className={`lkdv-cv2-card ${styles.tile} ${styles[key] ?? ''}`}>
      <div className={styles.tileHeader}>
        <h2><button className={styles.heading} type="button" aria-haspopup="dialog"
          onClick={(event) => go({ widget: key }, event.currentTarget)}>
          {key !== 'meteo' && <Icon className={styles.headingIcon} name={definition.icon} size={16} />}
          <span>{definition.name}</span>
          <Icon className={styles.chevron} name="chevron-right" size={14} />
        </button></h2>
        {control}
      </div>
      {body}
    </section>;
  }

  function budgetSummary() {
    if (data.unavailableSections?.includes('expenses')) return <p className={styles.meta}>Dépenses momentanément indisponibles</p>;
    if (!dailyBudget) return <p className={styles.meta}>Accès au budget indisponible</p>;
    const currencies = new Set([...dailyBudget.spent, ...dailyBudget.planned].map(({ currency }) => currency));
    if (!currencies.size) return <p className={styles.meta}>Aucune dépense ce jour</p>;
    return <div className={styles.metrics}>{Array.from(currencies, (currency) => {
      const spent = dailyBudget.spent.find((row) => row.currency === currency)?.amount ?? 0;
      const planned = dailyBudget.planned.find((row) => row.currency === currency);
      return <span className={styles.budgetAmount} key={currency}>
        <span className={styles.value}>{money({ amount: spent, currency })}</span>
        {planned && <small title={dailyBudget.estimate ? 'Budget du jour estimé' : 'Budget prévu du jour'}
          aria-label={`sur ${money(planned)} prévus${dailyBudget.estimate ? ', estimation' : ''}`}>/{money(planned)}</small>}
      </span>;
    })}</div>;
  }

  function weatherSummary(inTile = false) {
    if (!forecast) return <p className={styles.meta}>{weather.pending ? 'Recherche des prévisions…' : 'Météo indisponible'}</p>;
    return <>
      <span className={styles.weatherValue}>
        {forecast.weatherCode != null && <span className={styles.weatherGlyph} role="img" aria-label={forecast.condition}>
          <Icon name={weatherGlyph(forecast.weatherCode)} size={25} />
        </span>}
        <span className={styles.value}>{number(forecast.temperature)}°</span>
      </span>
      {!inTile && <p className={styles.meta}>{forecast.condition} · {forecast.place ?? 'Destination du voyage'}</p>}
    </>;
  }

  function renderPane() {
    switch (widget) {
      case 'meteo': {
        const currentForecastDay = forecast?.days[0];
        const alerts = deriveWeatherAlerts(currentForecastDay);
        const freshness = weatherFreshnessLabel(forecast?.observedAt);
        const trailCond = estimateTrailCondition({
          rainMm: currentForecastDay?.rain,
          minTempC: currentForecastDay?.low,
          maxTempC: currentForecastDay?.high,
        });
        return (
          <div className={ds.drawerRoot}>
            <div className={ds.heroCard}>
              <div className={ds.heroTop}>
                <div>
                  <p className={ds.heroFigure}>
                    {forecast ? `${number(forecast.temperature)}°` : '—'}
                  </p>
                  <p className={ds.heroSub}>
                    {forecast
                      ? `${forecast.condition} · ${forecast.place ?? 'Destination du voyage'}`
                      : weather.pending ? 'Recherche des prévisions…' : 'Météo indisponible'}
                  </p>
                </div>
                {forecast?.weatherCode != null && (
                  <span className={ds.rowIcon} data-tone="water" style={{ width: 52, height: 52, borderRadius: 16 }}>
                    <Icon name={weatherGlyph(forecast.weatherCode)} size={28} />
                  </span>
                )}
              </div>
              <div className={ds.heroTop}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {forecast?.source && <StatusBadge tone="water">{forecast.source}</StatusBadge>}
                  {freshness && <StatusBadge tone="good">{freshness}</StatusBadge>}
                  {currentForecastDay && <StatusBadge tone="neutral">{temperatures(currentForecastDay)}</StatusBadge>}
                </div>
                {!fixture && (
                  <button
                    type="button"
                    className={ds.btnSecondary}
                    style={{ minHeight: 36, padding: '0 12px', fontSize: 12 }}
                    disabled={weather.pending}
                    onClick={() => void weather.locate()}
                  >
                    <Icon name="locate" size={14} />{weather.gps ? 'Actualiser' : 'Ma position'}
                  </button>
                )}
              </div>
              {weather.error && <p role="status" className={ds.heroSub}>{weather.error} {forecast && 'Dernière prévision affichée.'}</p>}
            </div>

            <SegmentedTabs
              ariaLabel="Vues météo"
              value={meteoTab}
              onChange={setMeteoTab}
              tabs={[
                { id: 'today', label: 'Aujourd’hui' },
                { id: 'days', label: `10 jours (${forecast?.days.length ?? 0})` },
                { id: 'alerts', label: `Vigilances${alerts.length ? ` (${alerts.length})` : ''}` },
              ]}
            />

            {meteoTab === 'today' && (
              <>
                <div className={ds.kpiGrid2}>
                  <div className={ds.kpiTile}>
                    <span className={ds.kpiLabel}><Icon name="wind" size={13} /> Vent max</span>
                    <span className={ds.kpiValue}>{currentForecastDay?.wind != null ? `${number(currentForecastDay.wind)} km/h` : '—'}</span>
                  </div>
                  <div className={ds.kpiTile}>
                    <span className={ds.kpiLabel}><Icon name="cloud-rain" size={13} /> Précipitations</span>
                    <span className={ds.kpiValue}>{currentForecastDay?.rain != null ? `${number(currentForecastDay.rain)} mm` : '0 mm'}</span>
                  </div>
                  <div className={ds.kpiTile}>
                    <span className={ds.kpiLabel}><Icon name="thermometer" size={13} /> Min / Max</span>
                    <span className={ds.kpiValue}>{currentForecastDay ? temperatures(currentForecastDay) : '—'}</span>
                  </div>
                  <div className={ds.kpiTile}>
                    <span className={ds.kpiLabel}><Icon name="footprints" size={13} /> Sentier (estim.)</span>
                    <span className={ds.kpiValue} style={{ fontSize: 13 }}>{trailCond.label.replace(' (estimation)', '')}</span>
                  </div>
                </div>

                {currentForecastDay?.hours && currentForecastDay.hours.length > 0 && (
                  <DrawerSection title="Frise horaire" padded>
                    <div className={ds.hourlyRail}>
                      {currentForecastDay.hours.slice(0, 12).map((h) => (
                        <div key={h.time} className={ds.hourlyCard}>
                          <span className={ds.rowSub}>{h.time.slice(11, 16)}</span>
                          <strong style={{ fontSize: 15 }}>{h.temperature != null ? `${number(h.temperature)}°` : '—'}</strong>
                          {h.rain != null && h.rain > 0 && <StatusBadge tone="water">{number(h.rain)}mm</StatusBadge>}
                        </div>
                      ))}
                    </div>
                  </DrawerSection>
                )}

                {alerts.length > 0 && (
                  <DrawerSection title="Impacts terrain conseillés">
                    {alerts.map((alert) => (
                      <DrawerRow
                        key={alert.id}
                        icon="alert-triangle"
                        iconTone="warn"
                        title={alert.title}
                        subtitle={alert.detail}
                        right={<StatusBadge tone="warn">{alert.targetLabel}</StatusBadge>}
                        chevron
                        onClick={() => go({ widget: alert.targetWidget })}
                      />
                    ))}
                  </DrawerSection>
                )}
              </>
            )}

            {meteoTab === 'days' && (
              forecast?.days.length ? (
                <DrawerSection title="Prévisions journalières">
                  {forecast.days.map((entry) => (
                    <DrawerRow
                      key={entry.date}
                      itemId={entry.date}
                      icon="cloud-sun"
                      iconTone={entry.rain && entry.rain >= 5 ? 'water' : 'good'}
                      title={dateLabel(entry.date, true) ?? entry.day}
                      subtitle={[entry.condition, entry.rain ? `${number(entry.rain)} mm` : null].filter(Boolean).join(' · ')}
                      right={temperatures(entry) || '—'}
                      chevron
                      onClick={(el) => go({ widget: 'meteo', detail: entry.date }, el)}
                    />
                  ))}
                </DrawerSection>
              ) : <EmptyBox icon="cloud-off" message="Prévisions journalières indisponibles." />
            )}

            {meteoTab === 'alerts' && (
              <>
                {!fixture && isOnline && <OfficialAlertsPanel point={data.weatherPoint} />}
                {alerts.length > 0 && (
                  <DrawerSection title="Alertes seuils météo">
                    {alerts.map((alert) => (
                      <DrawerRow
                        key={alert.id}
                        icon="alert-triangle"
                        iconTone="warn"
                        title={alert.title}
                        subtitle={alert.detail}
                        chevron
                        onClick={() => go({ widget: alert.targetWidget })}
                      />
                    ))}
                  </DrawerSection>
                )}
              </>
            )}
          </div>
        );
      }
      case 'budget': {
        const defaultCurrency = mergedBudget?.planned?.currency ?? expenses[0]?.currency ?? 'EUR';
        const realTotal = (mergedBudget?.expenses ?? [])
          .filter((e) => !e.planned && e.currency === defaultCurrency)
          .reduce((s, e) => s + Math.round(e.amount * 100), 0) / 100;
        const envelope = mergedBudget?.planned?.amount ?? null;
        const pct = envelope && envelope > 0 ? Math.round((realTotal / envelope) * 100) : 0;
        return (
          <div className={ds.drawerRoot}>
            <div className={ds.heroCard}>
              <div className={ds.heroTop}>
                <div>
                  <p className={ds.sectionTitle} style={{ marginBottom: 4 }}>Dépensé réel · {defaultCurrency}</p>
                  <p className={ds.heroFigure}>{money({ amount: realTotal, currency: defaultCurrency })}</p>
                </div>
                {envelope != null && (
                  <StatusBadge tone={pct > 100 ? 'bad' : pct > 85 ? 'warn' : 'good'}>
                    {pct} % sur {money({ amount: envelope, currency: defaultCurrency })}
                  </StatusBadge>
                )}
              </div>
              {envelope != null && <ProgressBar value={pct} tone={pct > 100 ? 'bad' : pct > 85 ? 'warn' : 'good'} />}
              {dailyBudget?.estimate && <p className={ds.heroSub}>Enveloppe journalière répartie équitablement sur la durée du voyage.</p>}
            </div>

            {expenses.length > 0 && (
              <DrawerSection title={`Dépenses du jour (J${day})`} right={<StatusBadge tone="neutral">{expenses.length}</StatusBadge>}>
                {expenses.map((entry) => (
                  <DrawerRow
                    key={entry.id}
                    itemId={entry.id}
                    icon="wallet"
                    iconTone={entry.planned ? 'neutral' : 'good'}
                    title={entry.title}
                    subtitle={[entry.category, entry.payer, entry.planned ? 'Prévu' : 'Réel'].filter(Boolean).join(' · ')}
                    right={money(entry)}
                    chevron
                    onClick={(el) => go({ widget: 'budget', detail: entry.id }, el)}
                  />
                ))}
              </DrawerSection>
            )}

            {mergedBudget && (
              <BudgetDrawerTools
                tripId={data.key}
                currency={defaultCurrency}
                date={activeDateIso}
                allExpenses={mergedBudget.expenses}
                plannedEnvelope={envelope}
                day={day}
                dayCount={data.dayCount}
                people={data.people}
                canEdit={Boolean(data.canEdit)}
                isOnline={isOnline}
                fixture={fixture}
                onAdded={(expense) => setAddedExpenses((prev) => [expense, ...prev])}
                onQueued={(payload, operationId) => {
                  setAddedExpenses((prev) => [{
                    id: operationId,
                    title: `${payload.title} (hors ligne)`,
                    amount: payload.amount,
                    currency: payload.currency,
                    date: payload.date,
                    planned: false,
                    category: payload.category,
                  }, ...prev]);
                  void refreshOfflineOps();
                }}
              />
            )}

            {!fixture && data.budget && (
              <Link href="/hub/budget" className={ds.btnSecondary}>
                Gérer les dépenses complètes <Icon name="chevron-right" size={16} />
              </Link>
            )}
          </div>
        );
      }
      case 'carte': {
        const dayDist = daySteps.reduce((s, st) => s + (st.distance ?? 0), 0);
        const dayElev = daySteps.reduce((s, st) => s + (st.elevation ?? 0), 0);
        return (
          <div className={ds.drawerRoot}>
            <div className={ds.card} style={{ borderRadius: 22 }}>
              <Map data={dayMap} fixture={fixture} onStep={(step) => go({ widget: 'carte', detail: step.id })} />
            </div>

            <div className={ds.kpiGrid3}>
              <div className={ds.kpiTile}>
                <span className={ds.kpiLabel}>Distance J{day}</span>
                <span className={ds.kpiValue}>{dayDist > 0 ? `${number(dayDist)} km` : '—'}</span>
              </div>
              <div className={ds.kpiTile}>
                <span className={ds.kpiLabel}>Dénivelé +</span>
                <span className={ds.kpiValue}>{dayElev > 0 ? `+${number(dayElev)} m` : '—'}</span>
              </div>
              <div className={ds.kpiTile}>
                <span className={ds.kpiLabel}>Repères</span>
                <span className={ds.kpiValue}>{daySteps.length}</span>
              </div>
            </div>

            <ElevationStrip steps={daySteps} onSelectStep={(stepId) => go({ widget: 'carte', detail: stepId })} />

            {!fixture && data.trip && (
              <DrawerSection
                title="Pack carte hors ligne"
                right={<StatusBadge tone={mapPack ? 'good' : 'neutral'}>{mapPack ? formatPackSize(mapPack.sizeBytes) : 'Absent'}</StatusBadge>}
              >
                <div className={ds.row} role="region" aria-label="Pack carte hors ligne">
                  <span className={ds.rowIcon} data-tone={mapPack ? 'good' : 'water'}>
                    <Icon name="download" size={17} />
                  </span>
                  <span className={ds.rowBody}>
                    <span className={ds.rowTitle}>
                      {mapPack ? `Copie hors ligne · ${formatPackSize(mapPack.sizeBytes)}` : 'Aucune copie hors ligne enregistrée'}
                    </span>
                    <span className={ds.rowSub}>Trace + {data.steps.length} étapes stockées sur cet appareil</span>
                  </span>
                  {mapPack ? (
                    <button type="button" className={ds.btnSoftDanger} onClick={() => {
                      void deleteOfflineMapPack(data.key).then(() => setMapPack(null));
                    }}>Supprimer</button>
                  ) : (
                    <button type="button" className={ds.btnSecondary} style={{ minHeight: 36, padding: '0 12px', fontSize: 12 }} onClick={() => {
                      void saveOfflineMapPack({
                        tripId: data.key,
                        title: data.title,
                        route: data.route,
                        steps: data.steps,
                        distance: data.distance,
                        elevation: data.elevation,
                      }).then(setMapPack);
                    }}>Enregistrer hors ligne</button>
                  )}
                </div>
              </DrawerSection>
            )}

            {data.clubRouteUpdates && data.clubRouteUpdates.length > 0 && (
              <DrawerSection title="Révisions de parcours club">
                {data.clubRouteUpdates.map((update) => (
                  <Link key={update.eventId} href={`/sorties/${update.eventId}?source=club#parcours`} className={`${ds.row} ${ds.rowInteractive}`} style={{ textDecoration: 'none' }}>
                    <span className={ds.rowIcon} data-tone={update.decisionPending ? 'warn' : 'good'}>
                      <Icon name="route" size={17} />
                    </span>
                    <span className={ds.rowBody}>
                      <span className={ds.rowTitle}>{update.title}</span>
                      <span className={ds.rowSub}>
                        {update.decisionPending ? 'Parcours à valider'
                          : update.adoptedRevision != null ? `Tracé adopté · R${update.adoptedRevision}`
                            : `Parcours publié · R${update.revision}`}
                      </span>
                    </span>
                    <Icon name="chevron-right" size={16} />
                  </Link>
                ))}
              </DrawerSection>
            )}

            {daySteps.length > 0 && (
              <DrawerSection title={`Repères du jour (J${day})`}>
                {daySteps.map((step) => (
                  <DrawerRow
                    key={step.id}
                    itemId={step.id}
                    icon="map-pin"
                    iconTone="good"
                    title={step.title}
                    subtitle={[step.time ? `Prévue ${step.time}` : null, step.place].filter(Boolean).join(' · ')}
                    right={step.distance ? `${number(step.distance)} km` : undefined}
                    chevron
                    onClick={(el) => go({ widget: 'carte', detail: step.id }, el)}
                  />
                ))}
              </DrawerSection>
            )}

            {!fixture && data.trip && (
              <FieldReportForm tripId={data.key} defaultPoint={data.weatherPoint ?? daySteps.find((s) => s.coordinate)?.coordinate} isOnline={isOnline} />
            )}

            {!fixture && (
              <Link href={'/hub/itineraire?jour=' + day} className={ds.btnSecondary}>
                Ouvrir l’itinéraire complet <Icon name="chevron-right" size={16} />
              </Link>
            )}
          </div>
        );
      }
      case 'etapes': {
        const completed = daySteps.filter((step) => executionFor(step.id)?.status === 'completed').length;
        const pct = daySteps.length > 0 ? Math.round((completed / daySteps.length) * 100) : 0;
        return (
          <div className={ds.drawerRoot}>
            {!fixture && data.trip && (
              <TripLifecycleBar tripId={data.key} canEdit={Boolean(data.canEdit)} isOnline={isOnline} />
            )}

            {data.stepExecutions && daySteps.length > 0 && (
              <DrawerSection
                title={`Progression · Jour ${day}`}
                right={<StatusBadge tone={completed === daySteps.length ? 'good' : 'tint'}>{completed}/{daySteps.length} étapes terminées</StatusBadge>}
                padded
              >
                <ProgressBar value={pct} tone={completed === daySteps.length ? 'good' : 'tint'} />
              </DrawerSection>
            )}

            {daySteps.length > 0 && (
              <div className={ds.timeline} role="list" aria-label={`Timeline des étapes J${day}`}>
                {daySteps.map((step, idx) => {
                  const execution = executionFor(step.id);
                  const st = execution?.status ?? 'planned';
                  return (
                    <div key={step.id} className={ds.timelineItem} role="listitem">
                      <div className={ds.timelineRail}>
                        <span className={ds.timelineDot} data-status={st} aria-hidden="true">
                          {st === 'completed' ? '✓' : idx + 1}
                        </span>
                        <span className={ds.timelineLine} aria-hidden="true" />
                      </div>
                      <button
                        type="button"
                        className={ds.timelineCard}
                        data-hub-item={step.id}
                        onClick={(el) => go({ widget: 'etapes', detail: step.id }, el.currentTarget)}
                      >
                        <div className={ds.heroTop}>
                          <span className={ds.rowTitle}>{step.title}</span>
                          <StatusBadge tone={st === 'completed' ? 'good' : st === 'started' || st === 'arrived' ? 'tint' : st === 'postponed' ? 'warn' : st === 'cancelled' || st === 'skipped' ? 'bad' : 'neutral'}>
                            {execution ? stepStatusLabels[execution.status] : 'Prévue'}
                          </StatusBadge>
                        </div>
                        <span className={ds.rowSub}>
                          {[step.time ? `Prévue ${step.time}` : null, step.distance ? `${number(step.distance)} km` : null, step.elevation ? `+${number(step.elevation)} m` : null, step.place].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {dayArchive.length > 0 && (
              <div role="group" aria-label="Étapes retirées du plan">
                <DrawerSection title="Étapes retirées du plan" right={<StatusBadge tone="neutral">{dayArchive.length}</StatusBadge>}>
                  {dayArchive.map((step) => (
                    <DrawerRow
                      key={step.step_id}
                      itemId={step.step_id}
                      icon="archive"
                      iconTone="neutral"
                      title={step.planned_title}
                      subtitle="Archivée · conservée dans le journal"
                      right={<StatusBadge tone="neutral">{stepStatusLabels[step.status]}</StatusBadge>}
                      chevron
                      onClick={(el) => go({ widget: 'etapes', detail: step.step_id }, el)}
                    />
                  ))}
                </DrawerSection>
              </div>
            )}

            {!daySteps.length && !dayArchive.length && (
              <EmptyBox icon="footprints" message={data.unavailableSections?.includes('steps') ? 'Étapes momentanément indisponibles.' : 'Aucune étape prévue pour ce jour.'} />
            )}

            {!fixture && (
              <Link href={`/hub/itineraire?jour=${day}`} className={ds.btnSecondary}>
                Gérer les étapes dans l’itinéraire <Icon name="chevron-right" size={16} />
              </Link>
            )}
          </div>
        );
      }
      case 'carnet': {
        const story = buildTripStoryDraft({
          title: data.title,
          steps: data.steps,
          executions: data.stepExecutions,
          moments: carnet?.moments ?? [],
        });
        return (
          <div className={ds.drawerRoot}>
            <button
              className={ds.btnPrimary}
              type="button"
              data-hub-item="ajouter"
              onClick={(event) => go({ widget: 'carnet', detail: 'ajouter' }, event.currentTarget)}
            >
              <Icon name="plus" size={18} /> Ajouter un moment
            </button>

            {carnetDraft && (
              <div className={ds.alertBanner} data-tone="warn" role="region" aria-label="Brouillon local du carnet">
                <div style={{ flex: 1 }}>
                  <strong>Brouillon J{carnetDraft.day} : {carnetDraft.caption.slice(0, 60)}</strong>
                  <p className={ds.heroSub}>Conservé localement sur cet appareil</p>
                </div>
                <button type="button" className={ds.btnSoftDanger} onClick={() => {
                  clearCarnetDraft(data.key);
                  setCarnetDraft(null);
                }}>Effacer</button>
              </div>
            )}

            {!isOnline && !fixture && (
              <DrawerSection title="Capture rapide hors ligne" padded>
                <form className={ds.drawerRoot} style={{ paddingBottom: 0 }} aria-label="Brouillon hors ligne" onSubmit={(event) => {
                  event.preventDefault();
                  if (!offlineDraftText.trim()) return;
                  const saved = saveCarnetDraft({
                    tripId: data.key,
                    day,
                    caption: offlineDraftText.trim(),
                    place: daySteps.find((s) => s.place)?.place ?? data.location ?? '',
                    capturedAt: new Date().toISOString(),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
                  });
                  setCarnetDraft(saved);
                  setOfflineDraftText('');
                }}>
                  <label className={ds.fieldGroup}>
                    <span className={ds.fieldLabel}>Note rapide hors ligne (conservée au redémarrage)</span>
                    <textarea
                      className={ds.fieldTextarea}
                      rows={2}
                      maxLength={500}
                      value={offlineDraftText}
                      onChange={(e) => setOfflineDraftText(e.currentTarget.value)}
                      placeholder="Garder un moment même sans réseau…"
                    />
                  </label>
                  <button type="submit" className={ds.btnPrimary}>Garder en brouillon</button>
                </form>
              </DrawerSection>
            )}

            <SegmentedTabs
              ariaLabel="Vues carnet"
              value={carnetTab}
              onChange={setCarnetTab}
              tabs={[
                { id: 'moments', label: `Moments (${dayMoments.length})` },
                { id: 'notes', label: `Notes (${dayNotes.length})` },
                { id: 'story', label: 'Récit' },
              ]}
            />

            {carnetTab === 'moments' && (
              dayMoments.length > 0 ? (
                <DrawerSection title={`Journal du jour · J${day}`}>
                  {dayMoments.map((entry) => (
                    <DrawerRow
                      key={entry.id}
                      itemId={entry.id}
                      icon={entry.audio ? 'mic' : entry.media ? 'camera' : 'book-open'}
                      iconTone="good"
                      title={entry.title}
                      subtitle={`Jour ${day}${entry.time ? ` · ${entry.time}` : ''}`}
                      right={entry.time ? <StatusBadge tone="good">{entry.time}</StatusBadge> : undefined}
                      chevron
                      onClick={(el) => go({ widget: 'carnet', detail: entry.id }, el)}
                    />
                  ))}
                </DrawerSection>
              ) : (
                <EmptyBox icon="book-open" message={data.carnetUnavailable ? 'Carnet momentanément indisponible.' : 'Aucun moment enregistré ce jour.'} />
              )
            )}

            {carnetTab === 'notes' && (
              dayNotes.length > 0 ? (
                <DrawerSection title={`Notes du voyage · J${day}`}>
                  {dayNotes.map((note) => (
                    <DrawerRow
                      key={note.id}
                      icon="file-text"
                      iconTone="neutral"
                      title={note.title ?? 'Note du voyage'}
                      subtitle={note.content}
                    />
                  ))}
                </DrawerSection>
              ) : (
                <EmptyBox icon="file-text" message="Aucune note enregistrée pour ce jour." />
              )
            )}

            {carnetTab === 'story' && (
              <DrawerSection
                title="Récit généré (sans notes internes)"
                right={<StatusBadge tone="good">{story.completedSteps}/{story.totalSteps} étapes</StatusBadge>}
                padded
              >
                <pre className={ds.preBox}>{story.markdown}</pre>
                <button
                  type="button"
                  className={ds.btnSecondary}
                  onClick={() => void navigator.clipboard?.writeText(story.markdown)}
                >
                  <Icon name="copy" size={15} /> Copier le récit
                </button>
              </DrawerSection>
            )}

            {!fixture && (
              <Link href={carnet ? `/carnets/${carnet.id}` : '/hub/journal'} className={ds.btnSecondary}>
                Ouvrir le carnet complet <Icon name="chevron-right" size={16} />
              </Link>
            )}
          </div>
        );
      }
      case 'kit': {
        if (data.confirmedParticipant) {
          return (
            <div className={ds.drawerRoot}>
              <EmptyBox icon="backpack" message="Le kit du voyage est réservé à l’équipe de préparation." />
            </div>
          );
        }
        const kitPct = dayKit.length > 0 ? Math.round((packed / dayKit.length) * 100) : 0;
        const autonomy = estimateConsumablesAutonomy({
          partySize: Math.max(1, data.people.length),
          remainingDays: Math.max(1, (data.dayCount ?? 1) - day + 1),
          hotWeather: (forecast?.days[0]?.high ?? 0) >= 30,
          powerBankMah: 10000,
        });
        const sharedItems = dayKit.filter((item) => item.shared);
        const toggleItem = (itemId: string, nextPacked: boolean) => {
          setKitOverrides((prev) => ({ ...prev, [itemId]: nextPacked }));
          const payload: KitTogglePayload = { tripId: data.key, itemId, packed: nextPacked };
          if (!isOnline) {
            void enqueueOfflineOp({ operationId: newId(), tripId: data.key, kind: 'kit_toggle', payload })
              .then(() => refreshOfflineOps());
          } else {
            void toggleCockpitKitItem(payload).then((res) => {
              if (!res.ok) setKitOverrides((prev) => ({ ...prev, [itemId]: !nextPacked }));
            });
          }
        };

        return (
          <div className={ds.drawerRoot}>
            <div className={ds.heroCard}>
              <div className={ds.kpiGrid3}>
                <div>
                  <span className={ds.kpiLabel}>Poids total</span>
                  <span className={ds.kpiValue}>{formatWeight(kitWeights.totalWeightGrams)}</span>
                </div>
                <div>
                  <span className={ds.kpiLabel}>Préparés</span>
                  <span className={ds.kpiValue}>{packed}/{dayKit.length}</span>
                </div>
                <div>
                  <span className={ds.kpiLabel}>Vitaux restants</span>
                  <span className={ds.kpiValue} style={{ color: kitWeights.vitalUnpackedCount > 0 ? 'var(--hub-bad)' : 'var(--hub-good)' }}>
                    {kitWeights.vitalUnpackedCount}
                  </span>
                </div>
              </div>
              <ProgressBar value={kitPct} tone={kitPct === 100 ? 'good' : 'tint'} />
            </div>

            <SegmentedTabs
              ariaLabel="Vues kit"
              value={kitTab}
              onChange={setKitTab}
              tabs={[
                { id: 'list', label: `Checklist (${dayKit.length})` },
                { id: 'weights', label: 'Poids & Conso' },
                { id: 'shared', label: `Partagé (${sharedItems.length})` },
              ]}
            />

            {kitTab === 'list' && (
              dayKit.length > 0 ? (
                <DrawerSection title="Équipement du voyage">
                  {dayKit.map((item) => (
                    <label
                      key={item.id}
                      className={`${ds.row} ${data.canEdit && !fixture ? ds.rowInteractive : ''}`}
                      style={{ opacity: item.packed ? 0.68 : 1 }}
                    >
                      {data.canEdit && !fixture && (
                        <>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={item.packed}
                            aria-label={`Marquer ${item.title} comme préparé`}
                            onChange={(event) => toggleItem(item.id, event.currentTarget.checked)}
                          />
                          <span className={ds.checkCircle} data-checked={item.packed} aria-hidden="true">
                            {item.packed && '✓'}
                          </span>
                        </>
                      )}
                      <span className={ds.rowBody}>
                        <span className={ds.rowTitle} style={{ textDecoration: item.packed ? 'line-through' : undefined }}>
                          {item.title}{item.amount > 1 ? ` × ${item.amount}` : ''}
                        </span>
                        <span className={ds.rowSub}>
                          {item.packed ? 'Préparé' : 'À préparer'}
                          {item.weightGrams ? ` · ${formatWeight(item.weightGrams * item.amount)}` : ''}
                        </span>
                      </span>
                      <span className={ds.rowRight}>
                        {item.vital && !item.packed && <StatusBadge tone="bad">Vital</StatusBadge>}
                        {item.shared && <StatusBadge tone="good">Partagé</StatusBadge>}
                      </span>
                    </label>
                  ))}
                </DrawerSection>
              ) : (
                <EmptyBox icon="backpack" message="Aucun équipement listé pour ce jour." />
              )
            )}

            {kitTab === 'weights' && (
              <>
                <DrawerSection title="Répartition du poids" padded>
                  <div className={ds.kpiGrid3}>
                    <div className={ds.kpiTile}>
                      <span className={ds.kpiLabel}>Sac de base</span>
                      <span className={ds.kpiValue}>{formatWeight(kitWeights.baseWeightGrams)}</span>
                    </div>
                    <div className={ds.kpiTile}>
                      <span className={ds.kpiLabel}>Porté</span>
                      <span className={ds.kpiValue}>{formatWeight(kitWeights.wornWeightGrams)}</span>
                    </div>
                    <div className={ds.kpiTile}>
                      <span className={ds.kpiLabel}>Conso</span>
                      <span className={ds.kpiValue}>{formatWeight(kitWeights.consumableWeightGrams)}</span>
                    </div>
                  </div>
                </DrawerSection>

                <DrawerSection title="Autonomie estimée (reste du voyage)" padded>
                  <div className={ds.kpiGrid3}>
                    <div className={ds.kpiTile}>
                      <span className={ds.kpiLabel}>💧 Eau</span>
                      <span className={ds.kpiValue}>{autonomy.waterLitersNeeded} L</span>
                    </div>
                    <div className={ds.kpiTile}>
                      <span className={ds.kpiLabel}>🍽️ Repas</span>
                      <span className={ds.kpiValue}>{autonomy.mealsNeeded}</span>
                    </div>
                    <div className={ds.kpiTile}>
                      <span className={ds.kpiLabel}>🔋 GPS 10Ah</span>
                      <span className={ds.kpiValue}>{autonomy.batteryHoursEstimate ? `~${autonomy.batteryHoursEstimate} h` : '—'}</span>
                    </div>
                  </div>
                </DrawerSection>
              </>
            )}

            {kitTab === 'shared' && (
              <>
                {sharedItems.length > 0 ? (
                  <DrawerSection title="Objets partagés du groupe">
                    {sharedItems.map((item) => {
                      const carrier = data.people.find((p) => p.id === item.ownerId);
                      return (
                        <DrawerRow
                          key={item.id}
                          icon="users"
                          iconTone="good"
                          title={`${item.title}${item.amount > 1 ? ` × ${item.amount}` : ''}`}
                          subtitle={carrier?.name ? `Porté par ${carrier.name}` : 'Porteur à confirmer'}
                          right={item.weightGrams ? formatWeight(item.weightGrams * item.amount) : undefined}
                        />
                      );
                    })}
                  </DrawerSection>
                ) : (
                  <EmptyBox icon="users" message="Aucun objet partagé sur ce voyage." />
                )}
                {data.kitId && !fixture && <KitScene kitId={data.kitId} />}
              </>
            )}

            {!fixture && (
              <Link href="/hub/kit-voyage" className={ds.btnSecondary}>
                {data.kitId ? 'Gérer le kit complet' : 'Choisir le kit du voyage'} <Icon name="chevron-right" size={16} />
              </Link>
            )}
          </div>
        );
      }
      case 'paperasse': {
        const allDocs = data.documents ? [...addedDocuments, ...data.documents] : null;
        const expiredDocs = (allDocs ?? []).filter((d) => evaluateDocumentExpiry(d.expiration, activeDateIso).health === 'expired');
        const nextDoc = (allDocs ?? []).find((d) => evaluateDocumentExpiry(d.expiration, activeDateIso).health !== 'expired') ?? allDocs?.[0];
        const safetyBrief = buildDestinationSafetyBrief('FR');
        const docIcon = (cat: string) =>
          cat === 'passport' ? 'id-card' : cat === 'insurance' ? 'shield' : cat === 'ticket' ? 'ticket' : cat === 'booking' ? 'home' : 'file-text';
        const docTone = (health: string): BadgeTone =>
          health === 'expired' ? 'bad' : health === 'expiring_soon' ? 'warn' : health === 'valid' ? 'good' : 'neutral';

        return (
          <div className={ds.drawerRoot}>
            {nextDoc && (
              <div className={ds.walletCard}>
                <div className={ds.heroTop}>
                  <p className={ds.walletMeta}>PROCHAIN DOCUMENT · PORTEFEUILLE</p>
                  <StatusBadge tone="tint">{nextDoc.category.toUpperCase()}</StatusBadge>
                </div>
                <p className={ds.walletTitle}>{nextDoc.title}</p>
                <p className={ds.walletMeta}>
                  {nextDoc.expiration ? `Échéance : ${dateLabel(nextDoc.expiration, true)}` : 'Sans date d’expiration'}
                </p>
              </div>
            )}

            {expiredDocs.length > 0 && (
              <div className={ds.alertBanner} data-tone="bad" role="alert">
                <Icon name="alert-triangle" size={18} />
                <span>{expiredDocs.length} document(s) expiré(s) : {expiredDocs.map((d) => d.title).join(', ')}</span>
              </div>
            )}

            <SegmentedTabs
              ariaLabel="Vues paperasse"
              value={paperasseTab}
              onChange={setPaperasseTab}
              tabs={[
                { id: 'wallet', label: `Documents (${allDocs?.length ?? 0})` },
                { id: 'bookings', label: `À réserver (${reservations.length})` },
                { id: 'rules', label: 'Urgences' },
              ]}
            />

            {paperasseTab === 'wallet' && (
              <>
                {allDocs && allDocs.length > 0 ? (
                  <DrawerSection title="Portefeuille du voyage">
                    {allDocs.map((document) => {
                      const expiry = evaluateDocumentExpiry(document.expiration, activeDateIso);
                      const tone = docTone(expiry.health);
                      return (
                        <DrawerRow
                          key={document.id}
                          itemId={`doc-${document.id}`}
                          icon={docIcon(document.category)}
                          iconTone={tone === 'tint' ? 'good' : tone}
                          title={document.title}
                          subtitle={document.category === 'passport' || document.category === 'medical' ? 'Personnel · Titulaire 🔒' : 'Document du voyage'}
                          right={<StatusBadge tone={tone}>{expiry.health === 'no_expiry' ? (dateLabel(document.expiration) ?? 'Actif') : expiry.label}</StatusBadge>}
                          chevron
                          onClick={(el) => go({ widget: 'paperasse', detail: `doc-${document.id}` }, el)}
                        />
                      );
                    })}
                  </DrawerSection>
                ) : (
                  <EmptyBox icon="folder" message="Aucun document enregistré pour ce voyage." />
                )}

                {!fixture && data.canEdit && data.trip && (
                  <PaperasseQuickAdd tripId={data.key} isOnline={isOnline}
                    onAdded={(doc) => setAddedDocuments((prev) => [doc, ...prev])} />
                )}
              </>
            )}

            {paperasseTab === 'bookings' && (
              reservations.length > 0 ? (
                <DrawerSection title="Réservations à traiter">
                  {reservations.map((entry) => (
                    <DrawerRow
                      key={entry.id}
                      itemId={entry.id}
                      icon="calendar"
                      iconTone={entry.status === 'À réserver' ? 'warn' : 'neutral'}
                      title={entry.title}
                      subtitle={entry.due ? `Échéance ${dateLabel(entry.due)}` : 'Échéance non renseignée'}
                      right={<StatusBadge tone={entry.status === 'À réserver' ? 'warn' : 'neutral'}>{entry.status}</StatusBadge>}
                      chevron
                      onClick={(el) => go({ widget: 'paperasse', detail: entry.id }, el)}
                    />
                  ))}
                </DrawerSection>
              ) : (
                <EmptyBox icon="check" message={data.reservations === null ? (data.canEdit ? 'Réservations momentanément indisponibles.' : 'Accès aux réservations limité.') : 'Aucune réservation à traiter.'} />
              )
            )}

            {paperasseTab === 'rules' && (
              <DrawerSection title="Urgences & réglementation terrain" padded>
                <a className={ds.btnDanger} href={`tel:${safetyBrief.emergencyNumber.replace(/[^0-9+]/g, '')}`}>
                  <Icon name="phone" size={16} /> Secours officiels · {safetyBrief.emergencyNumber}
                </a>
                <p className={ds.heroSub}>{safetyBrief.bivouacRuleNote}</p>
              </DrawerSection>
            )}

            {!fixture && data.documents !== null && (
              <Link href="/hub/documents" className={ds.btnSecondary}>
                Gérer tous les documents <Icon name="chevron-right" size={16} />
              </Link>
            )}
          </div>
        );
      }
      case 'groupe': {
        const clampedPage = Math.min(groupPage, Math.max(0, memberChunks.length - 1));
        const visibleMembers = memberChunks[clampedPage] ?? [];
        return (
          <div className={ds.drawerRoot}>
            <div className={ds.heroCard}>
              <div className={ds.heroTop}>
                <div>
                  <p className={ds.sectionTitle} style={{ marginBottom: 4 }}>Équipe du voyage</p>
                  <p className={ds.heroFigure}>{data.people.length} <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--hub-label2)' }}>membres</span></p>
                </div>
                {data.pending > 0 && <StatusBadge tone="warn">{data.pending} en attente</StatusBadge>}
              </div>
            </div>

            <SegmentedTabs
              ariaLabel="Vues groupe"
              value={groupeTab}
              onChange={setGroupeTab}
              tabs={[
                { id: 'members', label: `Membres (${data.people.length})` },
                { id: 'safety', label: 'Positions & Sécurité' },
              ]}
            />

            {groupeTab === 'members' && (
              <>
                {visibleMembers.length > 0 ? (
                  <DrawerSection
                    title="Membres actifs"
                    right={memberChunks.length > 1 ? <StatusBadge tone="neutral">Bloc {clampedPage + 1}/{memberChunks.length} ({data.people.length} membres)</StatusBadge> : undefined}
                  >
                    <div className={ds.cardPadded}>
                      {visibleMembers.map((person) => (
                        <IdentityPill key={person.id} name={person.name ?? 'Participant'} avatarUrl={person.avatar} meta={person.role}
                          itemId={person.id} onClick={(element) => go({ widget: 'groupe', detail: person.id }, element)} />
                      ))}
                    </div>
                  </DrawerSection>
                ) : (
                  <EmptyBox icon="users" message={peopleStatus} />
                )}

                {memberChunks.length > 1 && (
                  <div className={ds.btnRow} role="navigation" aria-label="Blocs de participants">
                    <button type="button" className={ds.btnSecondary} disabled={clampedPage === 0}
                      onClick={() => setGroupPage((p) => Math.max(0, p - 1))}>Précédents</button>
                    <button type="button" className={ds.btnSecondary} disabled={clampedPage >= memberChunks.length - 1}
                      onClick={() => setGroupPage((p) => Math.min(memberChunks.length - 1, p + 1))}>Suivants</button>
                  </div>
                )}

                {!fixture && (
                  <Link href="/hub/groupe" className={ds.btnSecondary}>
                    Gérer le groupe & invitations <Icon name="chevron-right" size={16} />
                  </Link>
                )}
              </>
            )}

            {groupeTab === 'safety' && (
              <>
                <DrawerSection title="Urgence secours officiels" padded>
                  <a className={ds.btnDanger} href="tel:112">
                    <Icon name="phone" size={16} /> Urgence secours officiels · 112
                  </a>
                  <p className={ds.heroSub}>Seuls les secours officiels assurent la prise en charge d’urgence.</p>
                </DrawerSection>

                {!fixture && data.trip && (
                  <SafetyContactsPanel tripId={data.key} defaultPoint={data.weatherPoint} isOnline={isOnline} />
                )}

                {!fixture && data.trip && (
                  <Link href="/hub/securite" className={ds.btnSecondary}>
                    Ouvrir le centre sécurité <Icon name="chevron-right" size={16} />
                  </Link>
                )}
              </>
            )}
          </div>
        );
      }
    }
  }

  function renderDetail(detailId: string): { title: string; content: ReactNode } | null {
    if (widget === 'meteo') {
      const entry = forecast?.days.find((item) => item.date === detailId);
      return entry ? { title: dateLabel(entry.date, true) ?? entry.day, content: <div className={ds.drawerRoot}>
        <div className={ds.heroCard}>
          <div className={ds.heroTop}>
            <div>
              <p className={ds.heroEyebrow}>{forecast?.place ?? data.location ?? 'Prévision du jour'}</p>
              <p className={ds.heroValue}>{temperatures(entry) || 'Températures indisponibles'}</p>
              <p className={ds.heroSub}>{entry.condition ?? 'Condition météo'}</p>
            </div>
            <StatusBadge tone={entry.rain != null && entry.rain >= 5 ? 'warn' : 'water'}>
              {dateLabel(entry.date, true) ?? entry.day}
            </StatusBadge>
          </div>
          <div className={ds.kpiGrid2}>
            <div className={ds.kpiTile}>
              <p className={ds.kpiLabel}>Vent moyen</p>
              <p className={ds.kpiValue}>{entry.wind != null ? `${number(entry.wind)} km/h` : '—'}</p>
            </div>
            <div className={ds.kpiTile}>
              <p className={ds.kpiLabel}>Précipitations</p>
              <p className={ds.kpiValue}>{entry.rain != null ? `${number(entry.rain)} mm` : '—'}</p>
            </div>
          </div>
        </div>
        <DrawerSection title="Détail heure par heure" right={entry.hours?.length ? <StatusBadge tone="neutral">{entry.hours.length} créneaux</StatusBadge> : undefined} padded>
          {entry.hours?.length ? (
            <div className={ds.hourlyRail}>
              {entry.hours.map((hour) => (
                <div key={hour.time} className={ds.hourlyCard}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--hub-label2)' }}>{hour.time.slice(11, 16)}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--hub-label)' }}>{hour.temperature == null ? '—' : `${number(hour.temperature)}°`}</span>
                  <span style={{ fontSize: 10, color: 'var(--hub-label2)', textAlign: 'center' }}>
                    {[hour.wind == null ? null : `${number(hour.wind)} km/h`, hour.rain == null ? null : `${number(hour.rain)} mm`].filter(Boolean).join(' · ') || 'Calme'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBox icon="clock" message="Prévision horaire indisponible pour ce jour." />
          )}
        </DrawerSection>
      </div> } : null;
    }
    if (widget === 'budget') {
      const entry = expenses.find((item) => item.id === detailId);
      const splitShare = entry && partySize > 0 ? Math.round((entry.amount / partySize) * 100) / 100 : null;
      return entry ? { title: entry.title, content: <div className={ds.drawerRoot}>
        <div className={ds.heroCard}>
          <div className={ds.heroTop}>
            <div>
              <p className={ds.heroEyebrow}>{entry.category ?? 'Dépense'}</p>
              <p className={ds.heroValue}>{money(entry)}</p>
              <p className={ds.heroSub}>{entry.title}</p>
            </div>
            <StatusBadge tone="good">{entry.payer ? `Payé par ${entry.payer}` : 'Groupe'}</StatusBadge>
          </div>
          {splitShare != null && (
            <div className={ds.kpiGrid2}>
              <div className={ds.kpiTile}>
                <p className={ds.kpiLabel}>Part par personne</p>
                <p className={ds.kpiValue}>{money({ amount: splitShare, currency: entry.currency })}</p>
              </div>
              <div className={ds.kpiTile}>
                <p className={ds.kpiLabel}>Participants</p>
                <p className={ds.kpiValue}>{partySize} pers.</p>
              </div>
            </div>
          )}
        </div>
        {(entry.category || entry.payer) && (
          <DrawerSection title="Détails">
            {entry.category && <DrawerRow icon="tag" iconTone="neutral" title="Catégorie" right={<StatusBadge tone="neutral">{entry.category}</StatusBadge>} />}
            {entry.payer && <DrawerRow icon="user" iconTone="water" title="Payé par" right={<StatusBadge tone="water">{entry.payer}</StatusBadge>} />}
          </DrawerSection>
        )}
        {!fixture && <Link href="/hub/budget" className={ds.btnSecondary}>Gérer les dépenses</Link>}
      </div> } : null;
    }
    if (widget === 'carte' || widget === 'etapes') {
      const step = data.steps.find((item) => item.id === detailId);
      const execution = executionFor(detailId);
      const plan = step ?? (execution?.archived ? {
        title: execution.planned_title,
        day: execution.planned_day_number,
        time: execution.planned_start_time?.slice(0, 5),
      } : null);
      if (!plan) return null;
      const { title, day: stepDay, time } = plan;
      const execStatus = execution?.status ?? 'planned';
      return { title, content: <div className={ds.drawerRoot}>
        <div className={ds.heroCard}>
          <div className={ds.heroTop}>
            <div>
              <p className={ds.heroEyebrow}>{[`J${stepDay}`, time ? `Prévue à ${time}` : null, step?.place].filter(Boolean).join(' · ')}</p>
              <p className={ds.heroValue} style={{ fontSize: 20 }}>{title}</p>
              {!step && <p className={ds.heroSub}>Retirée du plan</p>}
            </div>
            <StatusBadge tone={!step ? 'warn' : execStatus === 'completed' ? 'good' : execStatus === 'started' || execStatus === 'arrived' ? 'tint' : 'neutral'}>
              {!step ? 'Archivée' : STEP_STATUS_LABELS[execStatus]}
            </StatusBadge>
          </div>
          {(step?.distance != null || step?.elevation != null) && (
            <div className={ds.kpiGrid2}>
              {step?.distance != null && (
                <div className={ds.kpiTile}>
                  <p className={ds.kpiLabel}>Distance prévue</p>
                  <p className={ds.kpiValue}>{number(step.distance)} km</p>
                </div>
              )}
              {step?.elevation != null && (
                <div className={ds.kpiTile}>
                  <p className={ds.kpiLabel}>Dénivelé</p>
                  <p className={ds.kpiValue}>+{number(step.elevation)} m</p>
                </div>
              )}
            </div>
          )}
          {step?.description && <p className={ds.heroSub}>{step.description}</p>}
        </div>
        {data.stepExecutions === null && <EmptyBox icon="alert-triangle" message="Suivi terrain momentanément indisponible." />}
        {data.stepExecutions && (
          <StepExecutionDetails key={detailId} tripId={data.key} stepId={detailId} execution={execution}
            planUpdatedAt={step?.planUpdatedAt} canSave={Boolean(step && data.canEdit)} isOnline={isOnline}
            pendingOffline={offlineOps.some((op) => op.kind === 'step_execution' && (op.payload as StepExecutionPayload).stepId === detailId)}
            onSaved={onStepSaved} onQueued={onStepQueued} />
        )}
        {!fixture && step && <Link href={`/hub/itineraire?jour=${stepDay}`} className={ds.btnSecondary}>Ouvrir dans l’itinéraire</Link>}
      </div> };
    }
    if (widget === 'carnet') {
      const clockMatch = /^heure-([0-9]{1,2})$/.exec(detailId);
      if (clockMatch) {
        const label = clockMatch[1].padStart(2, '0') + 'h';
        const entries = dayMoments.filter((entry) => momentHour(entry.time) === Number(clockMatch[1]));
        return { title: `Moments de ${label}`, content: <div className={ds.drawerRoot}>
          {entries.length ? (
            <div className={ds.card}>
              {entries.map((entry) => (
                <DrawerRow
                  key={entry.id}
                  itemId={entry.id}
                  icon={entry.media ? 'camera' : 'book-open'}
                  iconTone="water"
                  title={entry.title}
                  subtitle={entry.time ?? label}
                  chevron
                  onClick={(el) => go({ widget: 'carnet', detail: entry.id }, el)}
                />
              ))}
            </div>
          ) : (
            <EmptyBox icon="clock" message={`Aucun moment à ${label}.`} />
          )}
        </div> };
      }
      if (detailId === 'ajouter') return { title: 'Ajouter un moment', content: fixture
        ? <div className={ds.drawerRoot}><EmptyBox icon="lock" message="Connecte-toi à ton voyage pour enregistrer un moment." /></div>
        : <MomentEditor tripId={data.key} day={day} place={daySteps.find((step) => step.place)?.place ?? data.location}
            carnet={carnet} kitItems={data.carnetKitItems ?? []} canCreate={Boolean(data.canCreateCarnet)} onChange={setCarnet} onBack={back} /> };
      const moment = carnet?.moments.find((item) => item.id === detailId);
      return moment ? { title: 'Moment', content: <div className={ds.drawerRoot}>
        <div className={ds.heroCard}>
          <div className={ds.heroTop}>
            <div>
              <p className={ds.heroEyebrow}>{moment.time ?? `Jour ${day}`}</p>
              <p className={ds.heroValue} style={{ fontSize: 19 }}>{moment.title}</p>
            </div>
            <StatusBadge tone="water">{moment.type === 'video' ? 'Vidéo' : moment.media ? 'Photo' : 'Note'}</StatusBadge>
          </div>
        </div>
        {moment.audio && (
          <div className={`${ds.card} ${ds.cardPadded}`}>
            <audio controls preload="metadata" src={moment.audio} aria-label="Note vocale" style={{ width: '100%' }} />
          </div>
        )}
        {moment.media && (
          <div className={ds.card}>
            {moment.type === 'video'
              ? <video className={styles.momentMedia} controls playsInline preload="metadata" src={moment.media} aria-label="Vidéo du moment" />
              // eslint-disable-next-line @next/next/no-img-element -- le média privé passe par le proxy du carnet
              : <img className={styles.momentMedia} alt="Photo du moment" src={moment.media} />}
          </div>
        )}
        <Link href={`/carnets/${carnet!.id}`} className={ds.btnSecondary}>Ouvrir le carnet</Link>
      </div> } : null;
    }
    if (widget === 'paperasse') {
      const entry = reservations.find((item) => item.id === detailId);
      if (entry) return { title: entry.title, content: <div className={ds.drawerRoot}>
        <div className={ds.heroCard}>
          <div className={ds.heroTop}>
            <div>
              <p className={ds.heroEyebrow}>Réservation</p>
              <p className={ds.heroValue} style={{ fontSize: 19 }}>{entry.title}</p>
            </div>
            <StatusBadge tone={entry.status.toLowerCase().includes('confirm') ? 'good' : 'warn'}>{entry.status}</StatusBadge>
          </div>
        </div>
        <div className={ds.card}>
          <DrawerRow icon="calendar" iconTone="neutral" title="Échéance" subtitle={entry.due ? dateLabel(entry.due) : 'Non renseignée'} />
          {entry.when && <DrawerRow icon="clock" iconTone="neutral" title="Date prévue" subtitle={dateLabel(entry.when)} />}
        </div>
        {entry.partnerSlug && <a className={ds.btnPrimary} rel="sponsored nofollow" href={`/go/${encodeURIComponent(entry.partnerSlug)}`}>Voir les options de réservation</a>}
        {!fixture && <Link href={entry.stepId ? '/hub/itineraire' : '/hub/budget'} className={ds.btnSecondary}>Voir dans le voyage</Link>}
      </div> };
      const document = data.documents?.find((item) => `doc-${item.id}` === detailId);
      const isExpired = document?.expiration ? document.expiration < new Date().toISOString().slice(0, 10) : false;
      return document ? { title: document.title, content: <div className={ds.drawerRoot}>
        <div className={ds.heroCard}>
          <div className={ds.heroTop}>
            <div>
              <p className={ds.heroEyebrow}>
                {document.category === 'ticket' ? 'Billet' : document.category === 'booking' ? 'Réservation' : 'Document de voyage'}
              </p>
              <p className={ds.heroValue} style={{ fontSize: 19 }}>{document.title}</p>
            </div>
            <StatusBadge tone={isExpired ? 'bad' : 'good'}>{isExpired ? 'Expiré' : 'Valide'}</StatusBadge>
          </div>
        </div>
        <div className={ds.card}>
          <DrawerRow icon="calendar" iconTone={isExpired ? 'bad' : 'neutral'} title="Échéance" subtitle={document.expiration ? dateLabel(document.expiration) : 'Aucune date limite'} />
          <DrawerRow icon="file-text" iconTone="neutral" title="Catégorie" subtitle={document.category === 'ticket' ? 'Billet' : document.category === 'booking' ? 'Réservation' : 'Document de voyage'} />
        </div>
        {!fixture && <Link href="/hub/documents" className={ds.btnSecondary}>Ouvrir les documents du voyage</Link>}
      </div> } : null;
    }
    if (widget === 'groupe') {
      const person = data.people.find((item) => item.id === detailId);
      const carriedGear = person ? mergedKit.filter((item) => item.shared && item.ownerId === person.id) : [];
      return person ? { title: person.name ?? 'Participant', content: <div className={ds.drawerRoot}>
        <div className={ds.heroCard}>
          <IdentityPill name={person.name ?? 'Participant'} avatarUrl={person.avatar} meta={person.role} href={fixture ? undefined : `/profil/${encodeURIComponent(person.id)}`} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <StatusBadge tone={person.confirmed ? 'good' : 'warn'}>{person.confirmed ? 'Participation confirmée' : 'Invité'}</StatusBadge>
            {person.role && <StatusBadge tone="neutral">{person.role}</StatusBadge>}
          </div>
        </div>
        <DrawerSection title="Matériel collectif porté" right={<StatusBadge tone="neutral">{carriedGear.length}</StatusBadge>}>
          {carriedGear.length > 0 ? (
            carriedGear.map((gear) => (
              <DrawerRow
                key={gear.id}
                icon="backpack"
                iconTone="water"
                title={gear.title}
                subtitle={[gear.weightGrams ? `${gear.weightGrams} g` : null, gear.checked ? 'Dans le sac' : 'À prendre'].filter(Boolean).join(' · ')}
                right={<StatusBadge tone={gear.checked ? 'good' : 'warn'}>{gear.checked ? 'Prêt' : 'À faire'}</StatusBadge>}
              />
            ))
          ) : (
            <div className={ds.cardPadded}>
              <EmptyBox icon="backpack" message="Aucun équipement collectif assigné." />
            </div>
          )}
        </DrawerSection>
        {!fixture && <Link href="/hub/groupe" className={ds.btnSecondary}>Ouvrir le groupe</Link>}
      </div> } : null;
    }
    return null;
  }

  const info = view?.detail ? renderDetail(view.detail) : null;

  return <LazyMotion features={domMax}><MotionConfig reducedMotion="user"><section className={`lkdv-communaute-v2 ${styles.shell}`} data-hub-cockpit aria-labelledby={id}>
    <h1 id={id} className="sr-only">{data.title}</h1>
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
          <button type="button" className="lkdv-cv2-chip" onClick={() => void flushOfflineOps()}>Synchroniser</button>
        )}
        {offlineOps.some((op) => op.status === 'conflict') && (
          <button type="button" className="lkdv-cv2-chip" onClick={() => {
            void Promise.all(offlineOps.filter((op) => op.status === 'conflict').map((op) => removeOfflineOp(op.operationId)))
              .then(() => refreshOfflineOps());
          }}>Ignorer le conflit</button>
        )}
      </div>
    )}
    {!fixture && !data.trip && <Action href="/compas">Préparer une aventure</Action>}
    {(data.trip || data.collective) && <div className={styles.gridSpace}><div className={styles.grid} data-trip={data.trip}>
      {data.trip && <>
        {makeTile('meteo', <>
          {weatherSummary(true)}
          {forecast?.days.length ? <Rail label="Prochains jours" small>{weatherDays()}</Rail>
            : !fixture && <button type="button" className="lkdv-cv2-chip" disabled={weather.pending} onClick={() => void weather.locate()}>Utiliser ma position</button>}
        </>)}
        {makeTile('budget', dayContent(<>
          {budgetSummary()}
          {expenses.length > 0 && <Rail label="Dépenses du jour">{budgetRows().slice(0, 12)}</Rail>}
        </>, styles.budgetBody))}
        {makeTile('carte', <>
          <button className={styles.mapOpen} type="button" aria-label="Ouvrir la carte" onClick={(event) => go({ widget: 'carte' }, event.currentTarget)}>
            <Map data={dayMap} fixture={fixture} />
          </button>
        </>)}
        {makeTile('etapes', daySteps.length ? dayContent(stepRows('etapes'), styles.daySteps, 'Étapes de la journée')
          : <p className={styles.meta}>{data.unavailableSections?.includes('steps') ? 'Étapes indisponibles' : 'Aucune étape prévue'}</p>, dayPicker())}
        {makeTile('carnet', dayContent(<>
          <CarnetClock focusHour={clockHour} moments={dayMoments}
            onOpen={(value, element) => go({ widget: 'carnet', detail: `heure-${value}` }, element)} />
          <button className={styles.momentAddBox} type="button" aria-label="Ajouter un moment"
            data-hub-item="ajouter" onClick={(event) => go({ widget: 'carnet', detail: 'ajouter' }, event.currentTarget)}>
            <Icon name="plus" size={25} />
          </button>
        </>, styles.carnetBody))}
        {makeTile('kit', <p className={styles.meta}>{data.kitName && <>{data.kitName}{dayKit.length > 0 && <br />}</>}
          {dayKit.length ? `${packed}/${dayKit.length} préparés` : !data.kitName && (data.confirmedParticipant ? 'Accès réservé' : 'Aucun kit affecté')}</p>)}
        {makeTile('paperasse', reservations.length ? <Rail label="À réserver">{reservationRows()}</Rail>
          : <p className={styles.meta}>{data.reservations === null ? 'Réservations indisponibles' : 'Aucune réservation à traiter'}</p>)}
      </>}
      {makeTile('groupe', data.people.length ? <Rail label="Membres actifs">{peopleRows()}</Rail>
        : <p className={styles.meta}>{data.pending > 0 ? `${data.pending} invitation(s) en attente` : 'Aucun membre actif'}</p>)}
    </div></div>}
    {adventureControl && <footer className={styles.footer}>{adventureControl}</footer>}
    <CommunitySheetShell
      open={view !== null}
      onClose={close}
      initialDetent="large"
      hideCapsule
      showClose
      className={styles.drawerLayer}
      resetKey={widget}
      label={widgets[widget].name}
      capsule={{ items: [{ id: `hub-${widget}`, label: widgets[widget].name, icon: <Icon name={widgets[widget].icon} size={22} /> }],
        active: 0, onChange: () => undefined }}
      panes={[<div key={widget} className={styles.pane}>{renderPane()}</div>]}
      detail={view?.detail ? {
        title: info?.title ?? 'Détail indisponible', index: 0,
        pages: [<div key={view.detail} className={styles.pane}>{info?.content ?? <Status>Cette donnée n’est plus accessible.</Status>}</div>],
        onBack: back,
      } : null}
    />
  </section></MotionConfig></LazyMotion>;
}
