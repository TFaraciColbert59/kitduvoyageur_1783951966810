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
import { newId } from '@/lib/uuid';
import styles from './cockpit.module.css';

const BudgetDrawerTools = dynamic(() => import('./BudgetDrawerTools').then((m) => m.BudgetDrawerTools), { ssr: false });
const FieldReportForm = dynamic(() => import('./FieldReportForm').then((m) => m.FieldReportForm), { ssr: false });

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
  const [kitOverrides, setKitOverrides] = useState<Record<string, boolean>>({});
  const [groupPage, setGroupPage] = useState(0);
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
        return <>
          {weatherSummary()}
          {!fixture && <button className="lkdv-cv2-chip" type="button" disabled={weather.pending} onClick={() => void weather.locate()}>
            <Icon name="locate" size={16} />{weather.gps ? 'Actualiser ma position' : 'Utiliser ma position'}
          </button>}
          {weather.error && <p role="status" className={styles.meta}>{weather.error} {forecast && 'Dernière prévision affichée.'}</p>}
          {forecast?.observedAt && <p className={styles.meta}>Prévision · {forecast.observedAt.slice(11, 16)} · {forecast.source}{freshness ? ` · ${freshness}` : ''}</p>}
          {alerts.length > 0 && (
            <div role="region" aria-label="Alertes météo terrain" className={styles.stepExecution}>
              {alerts.map((alert) => (
                <div key={alert.id} className={styles.statusBanner}>
                  <div>
                    <strong>{alert.title}</strong>
                    <p className={styles.meta}>{alert.detail}</p>
                  </div>
                  <button type="button" className="lkdv-cv2-chip" onClick={() => go({ widget: alert.targetWidget })}>
                    {alert.targetLabel}
                  </button>
                </div>
              ))}
            </div>
          )}
          {forecast?.days.length ? <div className={styles.rows}>{weatherDays()}</div> : <Status>Prévisions journalières indisponibles.</Status>}
        </>;
      }
      case 'budget': {
        const defaultCurrency = mergedBudget?.planned?.currency ?? expenses[0]?.currency ?? 'EUR';
        return <>
          {budgetSummary()}
          {dailyBudget?.estimate && <p className={styles.meta}>Budget du jour estimé à partir de l’enveloppe du voyage.</p>}
          {expenses.length > 0 && <div className={styles.rows}>{budgetRows()}</div>}
          {mergedBudget && (
            <BudgetDrawerTools
              tripId={data.key}
              currency={defaultCurrency}
              date={activeDateIso}
              allExpenses={mergedBudget.expenses}
              plannedEnvelope={mergedBudget.planned?.amount ?? null}
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
          {!fixture && data.budget && <Action href="/hub/budget">Gérer les dépenses</Action>}
        </>;
      }
      case 'carte':
        return <>
          <Map data={dayMap} fixture={fixture} onStep={(step) => go({ widget: 'carte', detail: step.id })} />
          <ElevationStrip steps={daySteps} onSelectStep={(stepId) => go({ widget: 'carte', detail: stepId })} />
          {!fixture && data.trip && (
            <div className={styles.statusBanner} role="region" aria-label="Pack carte hors ligne">
              <span>
                {mapPack
                  ? `Copie hors ligne · ${formatPackSize(mapPack.sizeBytes)}`
                  : 'Aucune copie hors ligne enregistrée'}
              </span>
              {mapPack ? (
                <button type="button" className="lkdv-cv2-chip" onClick={() => {
                  void deleteOfflineMapPack(data.key).then(() => setMapPack(null));
                }}>Supprimer</button>
              ) : (
                <button type="button" className="lkdv-cv2-chip" onClick={() => {
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
          )}
          {data.clubRouteUpdates?.map((update) => (
            <Action key={update.eventId} href={`/sorties/${update.eventId}?source=club#parcours`}>
              {update.title} · {update.decisionPending ? 'Parcours à valider'
                : update.adoptedRevision != null ? `Tracé adopté · R${update.adoptedRevision}`
                  : `Parcours publié · R${update.revision}`}
            </Action>
          ))}
          {daySteps.length > 0 && <div className={styles.rows}>{stepRows('carte')}</div>}
          {!fixture && data.trip && (
            <FieldReportForm tripId={data.key} defaultPoint={data.weatherPoint ?? daySteps.find((s) => s.coordinate)?.coordinate} isOnline={isOnline} />
          )}
          {!fixture && <Action href={"/hub/itineraire?jour=" + day}>Ouvrir l’itinéraire</Action>}
        </>;
      case 'etapes': {
        const completed = daySteps.filter((step) => executionFor(step.id)?.status === 'completed').length;
        return <>
          {data.stepExecutions && daySteps.length > 0 && (
            <p className={styles.meta}>{completed}/{daySteps.length} étapes terminées</p>
          )}
          {daySteps.length > 0 && <div className={styles.rows}>{stepRows('etapes', true)}</div>}
          {dayArchive.length > 0 && (
            <div role="group" aria-label="Étapes retirées du plan" className={styles.rows}>
              <p className={styles.meta}>Étapes retirées du plan</p>
              {dayArchive.map((step) => <Pill key={step.step_id} itemId={step.step_id} title={step.planned_title}
                meta={stepStatusLabels[step.status]} inline
                onClick={(element) => go({ widget: 'etapes', detail: step.step_id }, element)} />)}
            </div>
          )}
          {!daySteps.length && !dayArchive.length && (
            <Status>{data.unavailableSections?.includes('steps') ? 'Étapes momentanément indisponibles.' : 'Aucune étape prévue pour ce jour.'}</Status>
          )}
          {!fixture && <Action href={`/hub/itineraire?jour=${day}`}>Gérer les étapes</Action>}
        </>;
      }
      case 'carnet':
        return <>
          <button className={`lkdv-cv2-chip ${styles.addMoment}`} type="button"
            data-hub-item="ajouter" onClick={(event) => go({ widget: 'carnet', detail: 'ajouter' }, event.currentTarget)}>
            <Icon name="plus" size={17} /> Ajouter un moment
          </button>
          {carnetDraft && (
            <div className={styles.statusBanner} role="region" aria-label="Brouillon local du carnet">
              <span>Brouillon J{carnetDraft.day} : {carnetDraft.caption.slice(0, 60)}</span>
              <button type="button" className="lkdv-cv2-chip" onClick={() => {
                clearCarnetDraft(data.key);
                setCarnetDraft(null);
              }}>Effacer</button>
            </div>
          )}
          {!isOnline && !fixture && (
            <form className={styles.stepExecution} aria-label="Brouillon hors ligne" onSubmit={(event) => {
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
              <label className={styles.stepNote}>
                Note rapide hors ligne (conservée au redémarrage)
                <textarea rows={2} maxLength={500} value={offlineDraftText}
                  onChange={(e) => setOfflineDraftText(e.currentTarget.value)}
                  placeholder="Garder un moment même sans réseau…" />
              </label>
              <button type="submit" className="lkdv-cv2-chip">Garder en brouillon</button>
            </form>
          )}
          {dayMoments.length ? <div className={styles.rows}>{momentRows(dayMoments)}</div>
            : !dayNotes.length && <Status>{data.carnetUnavailable ? 'Carnet momentanément indisponible.' : 'Aucun moment enregistré ce jour.'}</Status>}
          {dayNotes.length > 0 && <ul className={styles.list}>{dayNotes.map((note) =>
            <li key={note.id}><strong>{note.title ?? 'Note du voyage'}</strong><p>{note.content}</p></li>)}</ul>}
          {!fixture && <Action href={carnet ? `/carnets/${carnet.id}` : '/hub/journal'}>Ouvrir le carnet</Action>}
        </>;
      case 'kit':
        if (data.confirmedParticipant) return <Status>Le kit du voyage est réservé à l’équipe de préparation.</Status>;
        return <>
          {data.kitId && !fixture && <KitScene kitId={data.kitId} />}
          {!data.kitId && <Status action={!fixture && <Action href="/hub/kit-voyage">Choisir le kit du voyage</Action>}>Aucun kit affecté au voyage.</Status>}
          {kitWeights.totalWeightGrams > 0 && (
            <dl className={styles.stepTimes} aria-label="Poids du kit">
              <div><dt>Poids total</dt><dd>{formatWeight(kitWeights.totalWeightGrams)}</dd></div>
              <div><dt>Base / Porté / Conso</dt><dd>{formatWeight(kitWeights.baseWeightGrams)} · {formatWeight(kitWeights.wornWeightGrams)} · {formatWeight(kitWeights.consumableWeightGrams)}</dd></div>
              {kitWeights.vitalUnpackedCount > 0 && <div><dt>Éléments vitaux à préparer</dt><dd>{kitWeights.vitalUnpackedCount}</dd></div>}
            </dl>
          )}
          {!!dayKit.length && <ul className={styles.list}>{dayKit.map((item) => (
            <li key={item.id}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: data.canEdit && !fixture ? 'pointer' : 'default' }}>
                <span>
                  <strong>{item.title}{item.amount > 1 && ` × ${item.amount}`}</strong>
                  <span className={styles.meta}>
                    {' · '}{item.packed ? 'Préparé' : 'À préparer'}
                    {item.weightGrams ? ` · ${formatWeight(item.weightGrams * item.amount)}` : ''}
                    {item.shared ? ' · Partagé' : ''}
                    {item.vital ? ' · Vital' : ''}
                  </span>
                </span>
                {data.canEdit && !fixture && (
                  <input
                    type="checkbox"
                    checked={item.packed}
                    aria-label={`Marquer ${item.title} comme préparé`}
                    onChange={(event) => {
                      const nextPacked = event.currentTarget.checked;
                      setKitOverrides((prev) => ({ ...prev, [item.id]: nextPacked }));
                      const payload: KitTogglePayload = { tripId: data.key, itemId: item.id, packed: nextPacked };
                      if (!isOnline) {
                        void enqueueOfflineOp({ operationId: newId(), tripId: data.key, kind: 'kit_toggle', payload })
                          .then(() => refreshOfflineOps());
                      } else {
                        void toggleCockpitKitItem(payload).then((res) => {
                          if (!res.ok) setKitOverrides((prev) => ({ ...prev, [item.id]: !nextPacked }));
                        });
                      }
                    }}
                  />
                )}
              </label>
            </li>
          ))}</ul>}
          {!fixture && data.kitId && <Action href="/hub/kit-voyage">Gérer le kit</Action>}
        </>;
      case 'paperasse':
        return <>
          {reservations.length ? <div className={styles.rows}>{reservationRows()}</div>
            : <Status>{data.reservations === null ? (data.canEdit ? 'Réservations momentanément indisponibles.' : 'Accès aux réservations limité.') : 'Aucune réservation à traiter.'}</Status>}
          {!!data.documents?.length && <div className={styles.rows}>{data.documents.map((document) => {
            const expiry = evaluateDocumentExpiry(document.expiration, activeDateIso);
            return <Pill key={document.id} itemId={`doc-${document.id}`} title={document.title}
              meta={expiry.health === 'no_expiry' ? dateLabel(document.expiration) : expiry.label}
              onClick={(element) => go({ widget: 'paperasse', detail: `doc-${document.id}` }, element)} />;
          })}</div>}
          {!fixture && data.documents !== null && <Action href="/hub/documents">Gérer les documents</Action>}
        </>;
      case 'groupe': {
        const clampedPage = Math.min(groupPage, Math.max(0, memberChunks.length - 1));
        const visibleMembers = memberChunks[clampedPage] ?? [];
        return <>
          {visibleMembers.length > 0 && (
            <div className={styles.rows}>
              {visibleMembers.map((person) => (
                <IdentityPill key={person.id} name={person.name ?? 'Participant'} avatarUrl={person.avatar} meta={person.role}
                  itemId={person.id} onClick={(element) => go({ widget: 'groupe', detail: person.id }, element)} />
              ))}
            </div>
          )}
          {memberChunks.length > 1 && (
            <div className={styles.stepButtons} role="navigation" aria-label="Blocs de participants">
              <button type="button" className="lkdv-cv2-chip" disabled={clampedPage === 0}
                onClick={() => setGroupPage((p) => Math.max(0, p - 1))}>Précédents</button>
              <span className={styles.meta}>Bloc {clampedPage + 1}/{memberChunks.length} ({data.people.length} membres)</span>
              <button type="button" className="lkdv-cv2-chip" disabled={clampedPage >= memberChunks.length - 1}
                onClick={() => setGroupPage((p) => Math.min(memberChunks.length - 1, p + 1))}>Suivants</button>
            </div>
          )}
          {(!data.people.length || data.pending > 0) && <Status>{peopleStatus}</Status>}
          {!fixture && <Action href="/hub/groupe">Gérer le groupe</Action>}
          {!fixture && data.trip && <Action href="/hub/securite">Sécurité</Action>}
          <a className="lkdv-cv2-chip" href="tel:112">Urgence secours officiels · 112</a>
        </>;
      }
    }
  }

  function momentRows(entries: typeof dayMoments) {
    return entries.map((entry) => <Pill key={entry.id} itemId={entry.id} title={entry.title} meta={entry.time} inline
      onClick={(element) => go({ widget: 'carnet', detail: entry.id }, element)} />);
  }

  function renderDetail(detailId: string): { title: string; content: ReactNode } | null {
    if (widget === 'meteo') {
      const entry = forecast?.days.find((item) => item.date === detailId);
      return entry ? { title: dateLabel(entry.date, true) ?? entry.day, content: <>
        <p className={styles.value}>{temperatures(entry) || 'Températures indisponibles'}</p>
        <p>{[entry.condition, forecast?.place].filter(Boolean).join(' · ')}</p>
        {entry.wind != null && <p>Vent moyen jusqu’à {number(entry.wind)} km/h</p>}
        {entry.rain != null && <p>Précipitations · {number(entry.rain)} mm</p>}
        {entry.hours?.length ? <ul className={styles.list}>{entry.hours.map((hour) =>
          <li key={hour.time}><strong>{hour.time.slice(11, 16)}</strong>
            <p>{[hour.temperature == null ? null : `${number(hour.temperature)}°`, hour.wind == null ? null : `${number(hour.wind)} km/h`,
              hour.rain == null ? null : `${number(hour.rain)} mm`].filter(Boolean).join(' · ') || 'Détail indisponible'}</p></li>)}</ul>
          : <p className={styles.meta}>Prévision horaire indisponible pour ce jour.</p>}
      </> } : null;
    }
    if (widget === 'budget') {
      const entry = expenses.find((item) => item.id === detailId);
      return entry ? { title: entry.title, content: <>
        <p><strong>{entry.title}</strong></p>
        <p className={styles.value}>{money(entry)}</p>
        {[entry.category, entry.payer].filter(Boolean).length > 0 && <p>{[entry.category, entry.payer].filter(Boolean).join(' · ')}</p>}
        {!fixture && <Action href="/hub/budget">Gérer les dépenses</Action>}
      </> } : null;
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
      return { title, content: <>
        <p><strong>{title}</strong></p>
        <p>{[`J${stepDay}`, time ? `Prévue à ${time}` : null, step?.place].filter(Boolean).join(' · ')}</p>
        {!step && <p className={styles.meta}>Retirée du plan</p>}
        {step?.description && <p className={styles.bodyCopy}>{step.description}</p>}
        {step?.distance != null && <p>{number(step.distance)} km prévus</p>}
        {step?.elevation != null && <p>+{number(step.elevation)} m</p>}
        {data.stepExecutions === null && <p className={styles.meta}>Suivi terrain momentanément indisponible.</p>}
        {data.stepExecutions && (
          <StepExecutionDetails key={detailId} tripId={data.key} stepId={detailId} execution={execution}
            planUpdatedAt={step?.planUpdatedAt} canSave={Boolean(step && data.canEdit)} isOnline={isOnline}
            pendingOffline={offlineOps.some((op) => op.kind === 'step_execution' && (op.payload as StepExecutionPayload).stepId === detailId)}
            onSaved={onStepSaved} onQueued={onStepQueued} />
        )}
        {!fixture && step && <Action href={`/hub/itineraire?jour=${stepDay}`}>Ouvrir dans l’itinéraire</Action>}
      </> };
    }
    if (widget === 'carnet') {
      const clockMatch = /^heure-([0-9]{1,2})$/.exec(detailId);
      if (clockMatch) {
        const label = clockMatch[1].padStart(2, '0') + 'h';
        const entries = dayMoments.filter((entry) => momentHour(entry.time) === Number(clockMatch[1]));
        return { title: `Moments de ${label}`, content: entries.length
          ? <div className={styles.rows}>{momentRows(entries)}</div>
          : <Status>Aucun moment à {label}.</Status> };
      }
      if (detailId === 'ajouter') return { title: 'Ajouter un moment', content: fixture
        ? <Status>Connecte-toi à ton voyage pour enregistrer un moment.</Status>
        : <MomentEditor tripId={data.key} day={day} place={daySteps.find((step) => step.place)?.place ?? data.location}
            carnet={carnet} kitItems={data.carnetKitItems ?? []} canCreate={Boolean(data.canCreateCarnet)} onChange={setCarnet} onBack={back} /> };
      const moment = carnet?.moments.find((item) => item.id === detailId);
      return moment ? { title: 'Moment', content: <>
        <p>{moment.title}</p>{moment.time && <p>{moment.time}</p>}
        {moment.audio && <audio controls preload="metadata" src={moment.audio} aria-label="Note vocale" />}
        {moment.media && (moment.type === 'video'
          ? <video className={styles.momentMedia} controls playsInline preload="metadata" src={moment.media} aria-label="Vidéo du moment" />
          // eslint-disable-next-line @next/next/no-img-element -- le média privé passe par le proxy du carnet
          : <img className={styles.momentMedia} alt="Photo du moment" src={moment.media} />)}
        <Action href={`/carnets/${carnet!.id}`}>Ouvrir le carnet</Action></> } : null;
    }
    if (widget === 'paperasse') {
      const entry = reservations.find((item) => item.id === detailId);
      if (entry) return { title: entry.title, content: <>
        <p><strong>{entry.title}</strong></p>
        <p>{entry.status}</p>
        <p>{entry.due ? `Échéance · ${dateLabel(entry.due)}` : 'Échéance non renseignée'}</p>
        {entry.when && <p>Prévu le {dateLabel(entry.when)}</p>}
        {entry.partnerSlug && <a className="lkdv-cv2-chip" rel="sponsored nofollow" href={`/go/${encodeURIComponent(entry.partnerSlug)}`}>Voir les options de réservation</a>}
        {!fixture && <Action href={entry.stepId ? '/hub/itineraire' : '/hub/budget'}>Voir dans le voyage</Action>}
      </> };
      const document = data.documents?.find((item) => `doc-${item.id}` === detailId);
      return document ? { title: document.title, content: <>
        <p><strong>{document.title}</strong></p>
        {document.expiration && <p>Échéance · {dateLabel(document.expiration)}</p>}
        <p>{document.category === 'ticket' ? 'Billet' : document.category === 'booking' ? 'Réservation' : 'Document de voyage'}</p>
        {!fixture && <Action href="/hub/documents">Ouvrir les documents du voyage</Action>}
      </> } : null;
    }
    if (widget === 'groupe') {
      const person = data.people.find((item) => item.id === detailId);
      return person ? { title: person.name ?? 'Participant', content: <>
        <IdentityPill name={person.name ?? 'Participant'} avatarUrl={person.avatar} meta={person.role} href={fixture ? undefined : `/profil/${encodeURIComponent(person.id)}`} />
        {person.confirmed && <p className={styles.meta}>Participation confirmée</p>}
        {!fixture && <Action href="/hub/groupe">Ouvrir le groupe</Action>}
      </> } : null;
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
      hideDetailTitle
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
