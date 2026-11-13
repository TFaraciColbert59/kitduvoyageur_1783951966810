'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Lock,
  MapPin,
  Search,
} from 'lucide-react';
import { DrawerShell, type DrawerTab } from '../shell/DrawerShell';
import {
  PROGRESSION_PERIODS,
  buildMonthCalendar,
  buildMonthlyProgression,
  buildPeriodStats,
  buildWeekSummary,
  formatDuration,
  localDateKey,
  longDateLabel,
  monthKeyOf,
  monthLabel,
  resolveTimeZone,
  searchSessions,
  sessionStatus,
  shiftMonthKey,
  shortDateLabel,
  sportLabel,
  todayKey,
  type ProgressionMetric,
  type ProgressionPeriod,
  type ProgressionSession,
} from '@/features/compte/progression/engine';

export interface ProgressionDrawerProps {
  initialView?: 'calendar' | 'stats';
  sessions?: ProgressionSession[];
  /** Fuseau du profil voyageur (`user_traveller.time_zone`), ou null. */
  timeZone?: string | null;
  state?: 'loading' | 'error' | 'ready';
  onRetry?: () => void;
  /** Signale le changement d’onglet au runtime pour le restaurer au retour. */
  onViewChange?: (view: 'calendar' | 'stats') => void;
  /** Identité propriétaire : le cache d’interface ne traverse pas les comptes. */
  accountKey?: string;
}

interface ProgressionUiCache {
  monthKey: string;
  selectedDay: string;
  query: string;
  period: ProgressionPeriod;
}

/**
 * État d’interface seulement (mois, jour, recherche, période), jamais des
 * données de séance. Il permet au retour depuis un drawer Sortie de retrouver
 * le contexte du parent, sans requête supplémentaire. La clé propriétaire
 * empêche qu’un autre compte hérite d’une recherche ou d’un mois affiché.
 */
let progressionUiCache: { key: string; state: ProgressionUiCache } | null = null;

const WEEKDAYS = [
  { short: 'L', long: 'lundi' },
  { short: 'M', long: 'mardi' },
  { short: 'M', long: 'mercredi' },
  { short: 'J', long: 'jeudi' },
  { short: 'V', long: 'vendredi' },
  { short: 'S', long: 'samedi' },
  { short: 'D', long: 'dimanche' },
] as const;

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

function formatKm(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `${numberFormat.format(value)} km`;
}

function formatDplus(value: number | null): string {
  return value === null || !Number.isFinite(value)
    ? '—'
    : `+${Math.round(value).toLocaleString('fr-FR')} m`;
}

function metricText(metricValue: ProgressionMetric, formatter: (value: number | null) => string): string {
  return formatter(metricValue.value);
}

function metricHint(metricValue: ProgressionMetric, label: string): string {
  if (metricValue.value === null) return `${label} indisponible : aucune valeur enregistrée`;
  if (metricValue.missing > 0) {
    return `${label} partielle : ${metricValue.missing} séance(s) sans valeur`;
  }
  return label;
}

function openSession(id: string): void {
  if (typeof window === 'undefined') return;
  const runtime = window as unknown as {
    __lkdvCompteAct?: (action: string, value?: unknown) => void;
  };
  if (typeof runtime.__lkdvCompteAct === 'function') {
    runtime.__lkdvCompteAct('openProgressionOuting', id);
    return;
  }
  runtime.__lkdvCompteAct?.('openOutingDrawer', id);
}

function statusLabel(session: ProgressionSession): string {
  const status = sessionStatus(session);
  if (status === 'planned') return 'Prévue';
  if (status === 'ongoing') return 'En cours';
  if (status === 'done') return 'Terminée';
  return 'Non terminée';
}

function SessionRow({ session, zone }: { session: ProgressionSession; zone: string }) {
  const key = localDateKey(session.startedAt, zone);
  return (
    <button
      type="button"
      className="lkdv-prog-session"
      onClick={() => openSession(session.id)}
      aria-label={`Ouvrir ${session.title}, ${key ? longDateLabel(key) : 'date non renseignée'}, ${sportLabel(session.sport)}`}
    >
      <span className="lkdv-prog-session-main">
        <b>{session.title}</b>
        <small>
          {key ? shortDateLabel(key) : 'Date non renseignée'} · {sportLabel(session.sport)}
          {session.massif ? ` · ${session.massif}` : ''}
        </small>
      </span>
      <span className="lkdv-prog-session-metrics">
        <b>{formatKm(session.km)}</b>
        <small>{formatDplus(session.dplus)}</small>
      </span>
      <span className={`lkdv-prog-status is-${sessionStatus(session)}`} aria-label={statusLabel(session)}>
        {statusLabel(session)}
      </span>
    </button>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="lkdv-prog-metric" title={hint}>
      <span className="lkdv-prog-metric-ico" aria-hidden="true">{icon}</span>
      <small>{label}</small>
      <b>{value}</b>
      {hint.includes('indisponible') || hint.includes('partielle') ? (
        <em>{hint.includes('partielle') ? 'partiel' : 'indisponible'}</em>
      ) : null}
    </div>
  );
}

export function ProgressionDrawer({
  initialView = 'calendar',
  sessions = [],
  timeZone = null,
  state = 'ready',
  onRetry,
  onViewChange,
  accountKey = 'anonymous',
}: ProgressionDrawerProps) {
  const zoneInfo = useMemo(() => resolveTimeZone(timeZone), [timeZone]);
  const zone = zoneInfo.timeZone;
  const [now] = useState(() => new Date());
  const today = useMemo(() => todayKey(zone, now), [zone, now]);
  const cachedUi = progressionUiCache?.key === accountKey ? progressionUiCache.state : null;
  const [view, setView] = useState(initialView === 'stats' ? 1 : 0);
  const [monthKey, setMonthKey] = useState(
    () => cachedUi?.monthKey ?? monthKeyOf(today)
  );
  const [selectedDay, setSelectedDay] = useState(
    () => cachedUi?.selectedDay ?? today
  );
  const [query, setQuery] = useState(() => cachedUi?.query ?? '');
  const [period, setPeriod] = useState<ProgressionPeriod>(
    () => cachedUi?.period ?? '30d'
  );
  const [chartMetric, setChartMetric] = useState<'km' | 'dplus'>('km');

  useEffect(() => {
    setView(initialView === 'stats' ? 1 : 0);
  }, [initialView]);

  useEffect(() => {
    progressionUiCache = { key: accountKey, state: { monthKey, selectedDay, query, period } };
  }, [accountKey, monthKey, selectedDay, query, period]);

  const changeView = (index: number) => {
    setView(index);
    onViewChange?.(index === 1 ? 'stats' : 'calendar');
  };

  const calendar = useMemo(
    () => buildMonthCalendar(sessions, monthKey, zone, now),
    [sessions, monthKey, zone, now]
  );
  const week = useMemo(
    () => buildWeekSummary(sessions, selectedDay, zone, now),
    [sessions, selectedDay, zone, now]
  );
  const selectedSessions = useMemo(
    () =>
      sessions
        .filter((session) => localDateKey(session.startedAt, zone) === selectedDay)
        .sort((left, right) => (right.startedAt ?? '').localeCompare(left.startedAt ?? '')),
    [sessions, selectedDay, zone]
  );
  const searchResults = useMemo(
    () => (query.trim() ? searchSessions(sessions, query, zone) : []),
    [sessions, query, zone]
  );
  const periodStats = useMemo(
    () => buildPeriodStats(sessions, period, zone, now),
    [sessions, period, zone, now]
  );
  const monthly = useMemo(
    () => buildMonthlyProgression(sessions, zone, now, 12),
    [sessions, zone, now]
  );

  const maxChartValue = Math.max(
    1,
    ...monthly.map((point) => (chartMetric === 'km' ? point.km.value : point.dplusM.value) ?? 0)
  );
  const hasMonthlyKm = monthly.some((point) => {
    const value = chartMetric === 'km' ? point.km.value : point.dplusM.value;
    return value !== null && value > 0;
  });
  const chartValueLabel = chartMetric === 'km' ? 'distance' : 'dénivelé positif';
  const chartTitle = chartMetric === 'km' ? 'Distance par mois' : 'Dénivelé par mois';
  const formatChartValue = chartMetric === 'km' ? formatKm : formatDplus;
  const partialParts: string[] = [];
  if (periodStats.totals.km.missing > 0) {
    partialParts.push(`${periodStats.totals.km.missing} séance(s) sans distance`);
  }
  if (periodStats.totals.dplusM.missing > 0) {
    partialParts.push(`${periodStats.totals.dplusM.missing} séance(s) sans D+`);
  }
  if (periodStats.totals.durationS.missing > 0) {
    partialParts.push(`${periodStats.totals.durationS.missing} séance(s) sans temps`);
  }
  const partialNote = partialParts.length > 0 ? `Partiel : ${partialParts.join(', ')}.` : null;
  const previous = periodStats.previousTotals;
  const previousRange = periodStats.range.previous;
  const currentKm = periodStats.totals.km.value;
  const previousKm = previous?.km.value ?? null;
  const comparisonPartial =
    periodStats.totals.km.missing > 0 || (previous?.km.missing ?? 0) > 0;
  const comparison =
    !previousRange
      ? 'Pas de période précédente pour « Tout l’historique ».'
      : !previous || previous.sessions === 0
        ? 'Aucune séance terminée sur la période précédente.'
        : currentKm === null || previousKm === null
          ? 'Comparaison indisponible : une distance manque sur l’une des deux périodes.'
          : comparisonPartial
            ? 'Comparaison partielle : une ou plusieurs séances n’ont pas de distance enregistrée.'
            : currentKm === previousKm
              ? 'Distance stable par rapport à la période précédente.'
              : currentKm > previousKm
                ? `+${numberFormat.format(currentKm - previousKm)} km par rapport à la période précédente.`
                : `−${numberFormat.format(previousKm - currentKm)} km par rapport à la période précédente.`;

  const timeZoneNote =
    zoneInfo.source === 'profile'
      ? `Fuseau ${zone} (profil voyageur).`
      : zoneInfo.source === 'browser'
        ? `Fuseau ${zone} (navigateur, profil voyageur non renseigné).`
        : 'Fuseau UTC (aucun fuseau connu).';

  const rangeLabel =
    period === 'all'
      ? 'Tout l’historique'
      : `${shortDateLabel(periodStats.range.startKey)} – ${shortDateLabel(periodStats.range.endKey)}`;

  const goToMonth = (delta: number) => {
    const next = shiftMonthKey(monthKey, delta);
    setMonthKey(next);
    setSelectedDay(`${next}-01`);
  };

  const tabs: DrawerTab[] = [
    {
      id: 'calendar',
      label: 'Calendrier',
      icon: <CalendarDays size={18} aria-hidden="true" />,
      render: () => (
        <div className="lkdv-prog-pane" role="region" aria-label="Calendrier des séances">
          <p className="lkdv-prog-note">
            <Lock size={13} aria-hidden="true" />
            <span>Calendrier privé, lu depuis tes seules sorties. {timeZoneNote}</span>
          </p>

          <section className="lkdv-prog-card" aria-label="Choisir le mois">
            <div className="lkdv-prog-monthbar">
              <button
                type="button"
                className="lkdv-prog-iconbtn"
                onClick={() => goToMonth(-1)}
                aria-label="Mois précédent"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <label className="lkdv-prog-monthlabel">
                <span className="lkdv-prog-sr">Mois affiché</span>
                <b>{monthLabel(monthKey)}</b>
                <input
                  type="month"
                  value={monthKey}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(next)) return;
                    setMonthKey(next);
                    setSelectedDay(`${next}-01`);
                  }}
                  aria-label="Choisir le mois du calendrier"
                />
              </label>
              <button
                type="button"
                className="lkdv-prog-iconbtn"
                onClick={() => goToMonth(1)}
                aria-label="Mois suivant"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="lkdv-prog-today"
                onClick={() => {
                  setMonthKey(monthKeyOf(today));
                  setSelectedDay(today);
                }}
              >
                Aujourd’hui
              </button>
            </div>

            <div className="lkdv-prog-weekdays" aria-hidden="true">
              {WEEKDAYS.map((day) => (
                <span key={day.long} title={day.long}>{day.short}</span>
              ))}
            </div>
            <div className="lkdv-prog-grid" role="group" aria-label={`Calendrier de ${monthLabel(monthKey)}`}>
              {calendar.days.map((day) => {
                const selected = day.key === selectedDay;
                const sessionCount = day.sessions.length;
                return (
                  <button
                    key={day.key}
                    type="button"
                    className="lkdv-prog-day"
                    data-outside={day.inMonth ? 'false' : 'true'}
                    data-selected={selected ? 'true' : 'false'}
                    aria-pressed={selected}
                    aria-label={`${longDateLabel(day.key)}, ${sessionCount} séance(s)${day.done ? `, ${day.done} terminée(s)` : ''}`}
                    onClick={() => {
                      setSelectedDay(day.key);
                      if (!day.inMonth) setMonthKey(day.key.slice(0, 7));
                    }}
                  >
                    <span>{day.day}</span>
                    {sessionCount > 0 ? (
                      <i className="lkdv-prog-day-dot" aria-hidden="true">
                        {sessionCount > 9 ? '9+' : sessionCount}
                      </i>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="lkdv-prog-card" aria-label="Synthèse hebdomadaire">
            <div className="lkdv-prog-card-head">
              <div>
                <small>Synthèse hebdomadaire</small>
                <b>{week.label}</b>
              </div>
              <span className="lkdv-prog-chip">{week.done} terminée(s)</span>
            </div>
            <div className="lkdv-prog-metrics">
              <MetricCard
                label="Séances"
                value={String(week.totals.sessions)}
                hint="Séances terminées cette semaine"
                icon={<CalendarDays size={15} aria-hidden="true" />}
              />
              <MetricCard
                label="Distance"
                value={metricText(week.totals.km, formatKm)}
                hint={metricHint(week.totals.km, 'Distance')}
                icon={<MapPin size={15} aria-hidden="true" />}
              />
              <MetricCard
                label="D+"
                value={metricText(week.totals.dplusM, formatDplus)}
                hint={metricHint(week.totals.dplusM, 'Dénivelé positif')}
                icon={<BarChart3 size={15} aria-hidden="true" />}
              />
              <MetricCard
                label="Temps"
                value={formatDuration(week.totals.durationS.value)}
                hint={metricHint(week.totals.durationS, 'Temps enregistré')}
                icon={<Clock3 size={15} aria-hidden="true" />}
              />
            </div>
            {week.totals.sessions === 0 ? (
              <p className="lkdv-prog-empty">Aucune séance terminée cette semaine.</p>
            ) : null}
          </section>

          <section className="lkdv-prog-card" aria-label={`Séances du ${longDateLabel(selectedDay)}`}>
            <div className="lkdv-prog-card-head">
              <div>
                <small>Séance(s) du jour</small>
                <b>{longDateLabel(selectedDay)}</b>
              </div>
            </div>
            {selectedSessions.length === 0 ? (
              <p className="lkdv-prog-empty">Aucune séance enregistrée ce jour.</p>
            ) : (
              <div className="lkdv-prog-list">
                {selectedSessions.map((session) => (
                  <SessionRow key={session.id} session={session} zone={zone} />
                ))}
              </div>
            )}
          </section>

          <section className="lkdv-prog-card" aria-label="Rechercher une séance">
            <div className="lkdv-prog-card-head">
              <div>
                <small>Carnet d’entraînement</small>
                <b>Retrouver une séance</b>
              </div>
            </div>
            <label className="lkdv-prog-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Titre, massif ou date"
                aria-label="Rechercher une séance par titre, massif ou date"
              />
            </label>
            {query.trim() ? (
              searchResults.length > 0 ? (
                <div className="lkdv-prog-list">
                  {searchResults.map((session) => (
                    <SessionRow key={session.id} session={session} zone={zone} />
                  ))}
                </div>
              ) : (
                <p className="lkdv-prog-empty">Aucune séance trouvée pour cette recherche.</p>
              )
            ) : (
              <p className="lkdv-prog-empty">
                Cherche une séance de l’historique complet, y compris hors du mois affiché.
              </p>
            )}
          </section>
        </div>
      ),
    },
    {
      id: 'stats',
      label: 'Statistiques',
      icon: <BarChart3 size={18} aria-hidden="true" />,
      render: () => (
        <div className="lkdv-prog-pane" role="region" aria-label="Statistiques cumulées">
          <p className="lkdv-prog-note">
            <Lock size={13} aria-hidden="true" />
            <span>
              Cumuls privés, calculés sur tes seules séances terminées. {timeZoneNote}
            </span>
          </p>

          <div className="lkdv-prog-periods" role="group" aria-label="Période des statistiques">
            {PROGRESSION_PERIODS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="lkdv-prog-period"
                aria-pressed={period === option.id}
                onClick={() => setPeriod(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <section className="lkdv-prog-card" aria-label="Cumuls de la période">
            <div className="lkdv-prog-card-head">
              <div>
                <small>{periodStats.range.label}</small>
                <b>{rangeLabel}</b>
              </div>
              <span className="lkdv-prog-chip">{periodStats.done} séance(s)</span>
            </div>
            <div className="lkdv-prog-metrics">
              <MetricCard
                label="Séances"
                value={String(periodStats.totals.sessions)}
                hint="Séances terminées sur la période"
                icon={<CalendarDays size={15} aria-hidden="true" />}
              />
              <MetricCard
                label="Distance"
                value={metricText(periodStats.totals.km, formatKm)}
                hint={metricHint(periodStats.totals.km, 'Distance')}
                icon={<MapPin size={15} aria-hidden="true" />}
              />
              <MetricCard
                label="D+"
                value={metricText(periodStats.totals.dplusM, formatDplus)}
                hint={metricHint(periodStats.totals.dplusM, 'Dénivelé positif')}
                icon={<BarChart3 size={15} aria-hidden="true" />}
              />
              <MetricCard
                label="Temps"
                value={formatDuration(periodStats.totals.durationS.value)}
                hint={metricHint(periodStats.totals.durationS, 'Temps enregistré')}
                icon={<Clock3 size={15} aria-hidden="true" />}
              />
            </div>
            <p className="lkdv-prog-compare">{comparison}</p>
            {periodStats.excluded > 0 ? (
              <p className="lkdv-prog-empty">
                {periodStats.excluded} séance(s) non terminée(s) exclue(s) des cumuls.
              </p>
            ) : null}
            {periodStats.totals.sessions === 0 ? (
              <p className="lkdv-prog-empty">
                Aucune séance terminée sur cette période. Change de période ou enregistre une sortie.
              </p>
            ) : null}
          </section>

          <section className="lkdv-prog-card" aria-label="Cumuls par sport">
            <div className="lkdv-prog-card-head">
              <div>
                <small>Par sport et sur la même période</small>
                <b>Répartition</b>
              </div>
            </div>
            {periodStats.unknownSport > 0 ? (
              <p className="lkdv-prog-note">
                <span>
                  {periodStats.unknownSport} séance(s) sans sport connu : elles restent
                  regroupées sous « Sport non renseigné », sans attribution inventée.
                </span>
              </p>
            ) : null}
            {periodStats.sports.length === 0 ? (
              <p className="lkdv-prog-empty">Aucune séance terminée à répartir sur cette période.</p>
            ) : (
              <>
                <div className="lkdv-prog-tablewrap">
                  <table className="lkdv-prog-table">
                    <thead>
                      <tr>
                        <th scope="col">Sport</th>
                        <th scope="col">Séances</th>
                        <th scope="col">Distance</th>
                        <th scope="col">D+</th>
                        <th scope="col">Temps</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodStats.sports.map((group) => (
                        <tr key={group.sport ?? 'unknown'}>
                          <th scope="row">{group.label}</th>
                          <td>{group.sessions}</td>
                          <td title={metricHint(group.km, 'Distance')}>{formatKm(group.km.value)}</td>
                          <td title={metricHint(group.dplusM, 'Dénivelé positif')}>
                            {formatDplus(group.dplusM.value)}
                          </td>
                          <td title={metricHint(group.durationS, 'Temps enregistré')}>
                            {formatDuration(group.durationS.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">Total</th>
                        <td>{periodStats.totals.sessions}</td>
                        <td>{formatKm(periodStats.totals.km.value)}</td>
                        <td>{formatDplus(periodStats.totals.dplusM.value)}</td>
                        <td>{formatDuration(periodStats.totals.durationS.value)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="lkdv-prog-legend">— = donnée indisponible (aucune valeur enregistrée).</p>
                {partialNote ? <p className="lkdv-prog-legend">{partialNote}</p> : null}
              </>
            )}
          </section>

          <section className="lkdv-prog-card" aria-label="Progression sur douze mois">
            <div className="lkdv-prog-card-head">
              <div>
                <small>12 derniers mois</small>
                <b>{chartTitle}</b>
              </div>
            </div>
            <div className="lkdv-prog-chart-toggle" role="group" aria-label="Grandeur du graphique">
              <button
                type="button"
                className="lkdv-prog-period"
                aria-pressed={chartMetric === 'km'}
                onClick={() => setChartMetric('km')}
              >
                Distance
              </button>
              <button
                type="button"
                className="lkdv-prog-period"
                aria-pressed={chartMetric === 'dplus'}
                onClick={() => setChartMetric('dplus')}
              >
                D+
              </button>
            </div>
            {!hasMonthlyKm ? (
              <p className="lkdv-prog-empty">
                Graphique indisponible : aucun {chartValueLabel} enregistré sur les douze derniers mois.
              </p>
            ) : (
              <>
                <div
                  className="lkdv-prog-chart"
                  role="list"
                  aria-label={`${chartTitle} sur douze mois`}
                >
                  {monthly.map((point) => {
                    const metricValue = chartMetric === 'km' ? point.km : point.dplusM;
                    const value = metricValue.value;
                    const height =
                      value !== null && value > 0
                        ? Math.max(4, Math.round((value / maxChartValue) * 100))
                        : 0;
                    return (
                      <div
                        key={point.key}
                        className="lkdv-prog-chart-col"
                        role="listitem"
                        aria-label={`${point.label} : ${value === null ? `${chartValueLabel} indisponible` : formatChartValue(value)}, ${point.sessions} séance(s)`}
                      >
                        <div className="lkdv-prog-chart-track" aria-hidden="true">
                          <span
                            className="lkdv-prog-chart-bar"
                            data-missing={value === null ? 'true' : 'false'}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <small>{point.label}</small>
                      </div>
                    );
                  })}
                </div>
                <p className="lkdv-prog-legend">
                  Hauteur proportionnelle au {chartValueLabel} enregistré. Les mois sans valeur restent vides.
                </p>
              </>
            )}
          </section>
        </div>
      ),
    },
  ];

  return (
    <div className="lkdv-progression-root" data-testid="progression-drawer">
      <DrawerShell
        tabs={tabs}
        activeIndex={view}
        onIndexChange={changeView}
        state={state}
        onRetry={onRetry}
      />
      <style dangerouslySetInnerHTML={{ __html: PROGRESSION_DRAWER_CSS }} />
    </div>
  );
}

export const PROGRESSION_DRAWER_CSS = `
.lkdv-progression-root{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;width:100%!important;}
.lkdv-prog-pane{display:flex!important;flex-direction:column!important;gap:10px!important;padding:4px 0 20px!important;}
.lkdv-prog-card{display:flex!important;flex-direction:column!important;gap:10px!important;padding:12px!important;border-radius:18px!important;background:rgba(255,255,255,.55)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.08)!important;}
.lkdv-prog-card-head{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:8px!important;}
.lkdv-prog-card-head small{display:block!important;font:600 10px var(--sf)!important;color:var(--label2)!important;text-transform:uppercase!important;letter-spacing:.06em!important;}
.lkdv-prog-card-head b{display:block!important;font:650 14px/1.25 var(--sf)!important;color:var(--label)!important;margin-top:2px!important;}
.lkdv-prog-chip{flex:none!important;display:inline-flex!important;align-items:center!important;height:24px!important;padding:0 9px!important;border-radius:999px!important;background:var(--mint)!important;color:var(--tint)!important;font:600 11px var(--sf)!important;white-space:nowrap!important;}
.lkdv-prog-note{display:flex!important;align-items:flex-start!important;gap:6px!important;margin:0!important;padding:8px 10px!important;border-radius:14px!important;background:var(--fill2)!important;color:var(--label2)!important;font:500 11.5px/1.4 var(--sf)!important;}
.lkdv-prog-note svg{flex:none!important;margin-top:1px!important;color:var(--tint)!important;}
.lkdv-prog-monthbar{display:flex!important;align-items:center!important;gap:6px!important;}
.lkdv-prog-iconbtn{display:grid!important;place-items:center!important;width:44px!important;height:44px!important;flex:none!important;border:0!important;border-radius:999px!important;background:var(--fill)!important;color:var(--label)!important;cursor:pointer!important;}
.lkdv-prog-iconbtn:active{transform:scale(.96)!important;}
.lkdv-prog-iconbtn:focus-visible,.lkdv-prog-today:focus-visible,.lkdv-prog-day:focus-visible,.lkdv-prog-session:focus-visible,.lkdv-prog-period:focus-visible,.lkdv-prog-search input:focus-visible{outline:2px solid #17402C!important;outline-offset:2px!important;}
.lkdv-prog-monthlabel:focus-within{outline:2px solid #17402C!important;outline-offset:2px!important;}
.lkdv-prog-monthlabel{position:relative!important;flex:1!important;min-width:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;height:44px!important;border-radius:999px!important;background:var(--mint)!important;color:var(--tint)!important;cursor:pointer!important;overflow:hidden!important;}
.lkdv-prog-monthlabel b{font:650 13.5px var(--sf)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important;padding:0 8px!important;}
.lkdv-prog-monthlabel input{position:absolute!important;inset:0!important;opacity:0!important;width:100%!important;height:100%!important;cursor:pointer!important;border:0!important;}
.lkdv-prog-today{height:34px!important;padding:0 11px!important;flex:none!important;border:0!important;border-radius:999px!important;background:var(--fill)!important;color:var(--label)!important;font:600 11.5px var(--sf)!important;cursor:pointer!important;}
.lkdv-prog-weekdays{display:grid!important;grid-template-columns:repeat(7,minmax(0,1fr))!important;gap:3px!important;margin-top:2px!important;}
.lkdv-prog-weekdays span{text-align:center!important;font:600 10px var(--sf)!important;color:var(--label3)!important;text-transform:uppercase!important;letter-spacing:.04em!important;}
.lkdv-prog-grid{display:grid!important;grid-template-columns:repeat(7,minmax(0,1fr))!important;gap:3px!important;}
.lkdv-prog-day{position:relative!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:1px!important;min-height:44px!important;padding:2px 0!important;border:0!important;border-radius:12px!important;background:transparent!important;color:var(--label)!important;font:600 12px var(--sf)!important;cursor:pointer!important;}
.lkdv-prog-day[data-outside="true"]{color:var(--label3)!important;opacity:.72!important;}
.lkdv-prog-day[data-selected="true"]{background:var(--tint)!important;color:#fff!important;box-shadow:0 5px 14px rgba(23,64,44,.22)!important;}
.lkdv-prog-day:active{transform:scale(.96)!important;}
.lkdv-prog-day-dot{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:14px!important;height:12px!important;padding:0 3px!important;border-radius:999px!important;background:var(--accent)!important;color:#fff!important;font:700 8px/1 var(--sf)!important;font-style:normal!important;}
.lkdv-prog-day[data-selected="true"] .lkdv-prog-day-dot{background:#fff!important;color:var(--tint)!important;}
.lkdv-prog-metrics{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important;}
.lkdv-prog-metric{display:flex!important;flex-direction:column!important;gap:2px!important;min-width:0!important;padding:8px 7px!important;border-radius:13px!important;background:var(--fill2)!important;}
.lkdv-prog-metric-ico{display:flex!important;color:var(--tint)!important;margin-bottom:2px!important;}
.lkdv-prog-metric small{font:600 9px/1.2 var(--sf)!important;color:var(--label2)!important;text-transform:uppercase!important;letter-spacing:.04em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-prog-metric b{font:650 12.5px/1.2 var(--sf)!important;color:var(--label)!important;font-variant-numeric:tabular-nums!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-prog-metric em{font:600 8.5px var(--sf)!important;color:var(--warn)!important;font-style:normal!important;}
.lkdv-prog-empty{margin:0!important;font:400 11.5px/1.45 var(--sf)!important;color:var(--label2)!important;}
.lkdv-prog-compare{margin:0!important;font:500 11.5px/1.4 var(--sf)!important;color:var(--label2)!important;}
.lkdv-prog-list{display:flex!important;flex-direction:column!important;gap:5px!important;}
.lkdv-prog-session{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:4px 8px!important;width:100%!important;padding:9px 10px!important;border:0!important;border-radius:13px!important;background:var(--fill2)!important;color:var(--label)!important;text-align:left!important;cursor:pointer!important;}
.lkdv-prog-session:active{transform:scale(.99)!important;}
.lkdv-prog-session-main{min-width:0!important;display:flex!important;flex-direction:column!important;gap:2px!important;}
.lkdv-prog-session-main b{font:600 12.5px/1.25 var(--sf)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-prog-session-main small{font:400 10.5px/1.3 var(--sf)!important;color:var(--label2)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-prog-session-metrics{display:flex!important;flex-direction:column!important;align-items:flex-end!important;gap:1px!important;}
.lkdv-prog-session-metrics b{font:650 11.5px var(--sf)!important;font-variant-numeric:tabular-nums!important;}
.lkdv-prog-session-metrics small{font:500 10px var(--sf)!important;color:var(--label2)!important;font-variant-numeric:tabular-nums!important;}
.lkdv-prog-status{grid-column:1/-1!important;justify-self:start!important;display:inline-flex!important;align-items:center!important;height:18px!important;padding:0 7px!important;border-radius:999px!important;background:var(--fill)!important;color:var(--label2)!important;font:600 9px var(--sf)!important;}
.lkdv-prog-status.is-done{background:var(--mint)!important;color:var(--tint)!important;}
.lkdv-prog-status.is-planned,.lkdv-prog-status.is-ongoing{background:var(--warn-bg)!important;color:var(--warn)!important;}
.lkdv-prog-search{display:flex!important;align-items:center!important;gap:7px!important;height:38px!important;padding:0 11px!important;border-radius:12px!important;background:var(--fill)!important;color:var(--label2)!important;}
.lkdv-prog-search input{flex:1!important;min-width:0!important;height:36px!important;border:0!important;background:none!important;color:var(--label)!important;font:400 13px var(--sf)!important;outline:none!important;}
.lkdv-prog-search input::placeholder{color:var(--label3)!important;}
.lkdv-prog-periods{display:flex!important;gap:5px!important;overflow-x:auto!important;padding:2px 0!important;scrollbar-width:none!important;}
.lkdv-prog-chart-toggle{display:flex!important;gap:5px!important;align-items:center!important;}
.lkdv-prog-periods::-webkit-scrollbar{display:none!important;}
.lkdv-prog-period{flex:none!important;height:32px!important;padding:0 12px!important;border:0!important;border-radius:999px!important;background:var(--fill)!important;color:var(--label)!important;font:600 11.5px var(--sf)!important;cursor:pointer!important;white-space:nowrap!important;}
.lkdv-prog-period[aria-pressed="true"]{background:var(--tint)!important;color:#fff!important;box-shadow:0 4px 12px rgba(23,64,44,.2)!important;}
.lkdv-prog-tablewrap{width:100%!important;overflow-x:auto!important;}
.lkdv-prog-table{width:100%!important;border-collapse:collapse!important;font:500 11px var(--sf)!important;color:var(--label)!important;}
.lkdv-prog-table th,.lkdv-prog-table td{padding:6px 5px!important;text-align:right!important;white-space:nowrap!important;border-bottom:.5px solid var(--sep)!important;}
.lkdv-prog-table thead th{font:600 9px var(--sf)!important;color:var(--label2)!important;text-transform:uppercase!important;letter-spacing:.04em!important;}
.lkdv-prog-table th:first-child,.lkdv-prog-table td:first-child{text-align:left!important;}
.lkdv-prog-table tbody th{font-weight:600!important;}
.lkdv-prog-table tfoot th,.lkdv-prog-table tfoot td{border-bottom:0!important;font-weight:700!important;color:var(--tint)!important;}
.lkdv-prog-legend{margin:0!important;font:400 10px/1.35 var(--sf)!important;color:var(--label3)!important;}
.lkdv-prog-chart{display:grid!important;grid-template-columns:repeat(12,minmax(0,1fr))!important;align-items:end!important;gap:3px!important;height:132px!important;padding-top:4px!important;}
.lkdv-prog-chart-col{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-end!important;gap:4px!important;height:100%!important;min-width:0!important;}
.lkdv-prog-chart-track{position:relative!important;display:flex!important;align-items:flex-end!important;justify-content:center!important;width:100%!important;height:104px!important;border-radius:7px!important;background:var(--fill2)!important;overflow:hidden!important;}
.lkdv-prog-chart-bar{display:block!important;width:70%!important;min-height:0!important;border-radius:5px 5px 2px 2px!important;background:linear-gradient(180deg,var(--accent),var(--tint))!important;}
.lkdv-prog-chart-bar[data-missing="true"]{background:transparent!important;}
.lkdv-prog-chart-col small{font:500 8px var(--sf)!important;color:var(--label2)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important;}
.lkdv-prog-sr{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important;}
@media (prefers-reduced-motion:reduce){.lkdv-prog-iconbtn,.lkdv-prog-day,.lkdv-prog-session{transition:none!important;}}
`;
