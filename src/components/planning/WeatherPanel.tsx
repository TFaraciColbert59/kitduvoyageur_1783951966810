'use client';

import React from 'react';
import { CloudSun, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui';
import {
  evaluatePlanWeather,
  findOptimalWindows,
  type MultiDayPlan,
  type OptimalWindowOptions,
  type WeatherFeedSnapshot,
} from '@/features/planning';
import {
  ALERT_LABELS,
  PROVIDER_STATUS_LABELS,
  WEATHER_STATUS_LABELS,
  alertTone,
  formatDateTime,
  formatDistanceKm,
  formatHours,
  maxStageElevationM,
  weatherTone,
} from './format';

export interface WeatherPanelProps {
  plan: MultiDayPlan;
  feed: WeatherFeedSnapshot;
  nowIso: string;
  options?: Partial<OptimalWindowOptions>;
}

const STATUS_BOX: Record<'sage' | 'warn' | 'danger' | 'info' | 'stone', string> = {
  sage: 'border-[color:var(--lkv-success)] bg-[color:var(--lkv-success-bg)]',
  warn: 'border-[color:var(--lkv-warning)] bg-[color:var(--lkv-warning-bg)]',
  danger: 'border-[color:var(--lkv-danger)] bg-[color:var(--lkv-danger-bg)]',
  info: 'border-[color:var(--lkv-info)] bg-[color:var(--lkv-info-bg)]',
  stone: 'border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)]',
};

/**
 * Météo explicite : statut du fournisseur, fraîcheur, alertes officielles et
 * fenêtres optimales calculées dans le fuseau du plan. Sans bulletin réel,
 * aucune valeur ni fenêtre n'est inventée.
 */
export function WeatherPanel({ plan, feed, nowIso, options }: WeatherPanelProps) {
  const report = evaluatePlanWeather(plan, feed, nowIso);
  const windowOptions: OptimalWindowOptions = {
    ...options,
    minDurationHours: options?.minDurationHours ?? 3,
    maxStageElevationM:
      options?.maxStageElevationM === undefined
        ? maxStageElevationM(plan)
        : options.maxStageElevationM,
  };
  const windows = findOptimalWindows(plan, feed, nowIso, windowOptions);
  const tone = weatherTone(report.status);
  const providerLabel =
    feed.status === 'available'
      ? feed.providerName ?? 'Fournisseur sans nom'
      : PROVIDER_STATUS_LABELS[feed.status];

  return (
    <section aria-labelledby="planning-weather-title" className="space-y-[var(--space-3)]">
      <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
        <div>
          <div className="flex items-center gap-[var(--space-2)]">
            <CloudSun aria-hidden="true" size={20} className="text-[color:var(--lkv-info)]" />
            <h3
              id="planning-weather-title"
              className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]"
            >
              Météo, conditions et fenêtres
            </h3>
          </div>
          <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
            Calculées dans le fuseau du plan ({plan.timezone}) ; aucune valeur n’est extrapolée sans
            fournisseur réel.
          </p>
        </div>
        <span data-weather-status={report.status}>
          <Badge tone={tone}>{WEATHER_STATUS_LABELS[report.status]}</Badge>
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-[var(--space-3)] text-[length:var(--lkv-text-footnote)] sm:grid-cols-4">
        <div>
          <dt className="text-[color:var(--lkv-text-muted)]">Fournisseur</dt>
          <dd className="font-semibold text-[color:var(--lkv-text-primary)]">{providerLabel}</dd>
        </div>
        <div>
          <dt className="text-[color:var(--lkv-text-muted)]">Fuseau</dt>
          <dd className="font-mono text-[color:var(--lkv-text-primary)]">{report.timezone}</dd>
        </div>
        <div>
          <dt className="text-[color:var(--lkv-text-muted)]">Relevé</dt>
          <dd className="text-[color:var(--lkv-text-primary)]">
            {formatDateTime(report.fetchedAtIso, report.timezone)}
          </dd>
        </div>
        <div>
          <dt className="text-[color:var(--lkv-text-muted)]">Fraîcheur</dt>
          <dd className="text-[color:var(--lkv-text-primary)]">
            {report.freshnessMinutes === null
              ? '—'
              : `${report.freshnessMinutes} min${report.isStale ? ' (périmé)' : ''}`}
          </dd>
        </div>
      </dl>

      <div
        data-testid="planning-weather-status"
        className={`flex items-start gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border p-[var(--space-3)] ${STATUS_BOX[tone]}`}
      >
        <TriangleAlert aria-hidden="true" size={18} className="mt-[2px] shrink-0" />
        <div className="min-w-0 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)]">
          <p className="font-semibold">
            {report.pointsEvaluated} point{report.pointsEvaluated > 1 ? 's' : ''} évalué
            {report.pointsEvaluated > 1 ? 's' : ''} · {ALERT_LABELS[report.maxAlertSeverity]}
          </p>
          <p className="mt-[var(--space-1)] text-[color:var(--lkv-text-secondary)]">
            {report.missingReason ??
              'Bulletin disponible et dans sa fenêtre de fraîcheur ; les fenêtres ci-dessous respectent les seuils.'}
          </p>
          {report.hasOfficialAlert && (
            <Badge tone={alertTone(report.maxAlertSeverity)} className="mt-[var(--space-2)]">
              {ALERT_LABELS[report.maxAlertSeverity]}
            </Badge>
          )}
        </div>
      </div>

      {windows.windows.length === 0 ? (
        <div className="rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] p-[var(--space-4)]">
          <p className="text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
            Aucune fenêtre optimale disponible
          </p>
          <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
            {windows.missingReason ??
              'Aucune séquence ne respecte les seuils demandés pour cette période.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-[var(--space-2)]">
          {windows.windows.map((window) => (
            <li
              key={`${window.startIso}-${window.endIso}`}
              className="rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border-subtle)] bg-[color:var(--lkv-surface-paper)] p-[var(--space-3)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-[var(--space-2)]">
                <p className="text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
                  {window.localDate} · {window.localStartTime}–{window.localEndTime} ({window.timezone})
                </p>
                <Badge tone={window.score >= 70 ? 'sage' : window.score >= 40 ? 'warn' : 'danger'}>
                  Score {window.score}/100
                </Badge>
              </div>
              <div className="mt-[var(--space-2)] grid grid-cols-2 gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)] sm:grid-cols-4">
                <span>
                  Durée {formatHours((Date.parse(window.endIso) - Date.parse(window.startIso)) / 3_600_000 + 1)}
                </span>
                <span>Rafales {window.maxGustKmh ?? '—'} km/h</span>
                <span>Précip. {window.totalPrecipMm ?? '—'} mm</span>
                <span>
                  Temp. {window.minTempC ?? '—'}–{window.maxTempC ?? '—'} °C
                </span>
              </div>
              <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                {window.reasons.join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
        {formatDistanceKm(plan.stages.reduce((sum, stage) => sum + stage.distanceKm, 0))} de tracé ·
        altitude max prise en compte :{' '}
        {windowOptions.maxStageElevationM === null || windowOptions.maxStageElevationM === undefined
          ? 'non renseignée'
          : `${windowOptions.maxStageElevationM} m`}
        . Source météo : {feed.providerName ?? 'aucune'}.
      </p>
    </section>
  );
}

export default WeatherPanel;
