/**
 * A13 (S3) — Vue trek multi-jours (mobile-first, iOS calme).
 *
 * Vue pure : capacité quotidienne, fatigue, dérive et ajustements proposés.
 * Aucune donnée privée, aucune I/O. Cibles ≥ 44 px, tokens `--lkv-*`,
 * `motion-reduce` respecté, zéro orange.
 */
import type { MultiDayTrekResult, TrekDayResult } from '../domain/multiDayTrek';
import type { StagesSource } from '../domain/planGroupTrek';
import { formatPlanMoment, type GroupPlanLoadState } from './GroupPlanSummary';

export interface TrekPlanViewProps {
  plan: MultiDayTrekResult | null;
  state: GroupPlanLoadState;
  version?: number | null;
  computedAt?: string | null;
  stagesSource?: StagesSource | null;
  requiredPlan?: string | null;
  error?: string | null;
  onCompute?: () => void;
  computing?: boolean;
  className?: string;
}

function capacityTone(capacityPct: number): string {
  if (capacityPct >= 60) return 'bg-[var(--lkv-success)]';
  if (capacityPct >= 30) return 'bg-[var(--lkv-warning)]';
  return 'bg-[var(--lkv-danger)]';
}

function DayRow({ day }: { day: TrekDayResult }) {
  return (
    <li className="rounded-[var(--lkv-radius-md)] bg-[var(--lkv-surface)] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-[var(--lkv-text-primary)]">
          Jour {day.dayNumber}
        </p>
        <p className="text-[12px] tabular-nums text-[var(--lkv-text-secondary)]">
          Capacité {Math.round(day.capacityPct)} % · fatigue {day.difficulty}/100
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--lkv-surface-card)]">
        <div
          className={`h-full rounded-full ${capacityTone(day.capacityPct)}`}
          style={{ width: `${Math.min(100, Math.max(0, day.capacityPct))}%` }}
          aria-hidden="true"
        />
      </div>
      {day.driftRisk > 0 ? (
        <p className="mt-1 text-[11px] text-[var(--lkv-warning-dark)]">
          Dérive cumulée {Math.round(day.driftRisk * 100)} %
        </p>
      ) : null}
      {day.adjustments.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {day.adjustments.map((adjustment) => (
            <li key={`${day.dayNumber}-${adjustment.kind}-${adjustment.label}`}>
              <p className="text-[12px] font-medium text-[var(--lkv-text-primary)]">
                {adjustment.label}
              </p>
              <p className="text-[11px] text-[var(--lkv-text-secondary)]">{adjustment.reason}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function TrekPlanView({
  plan,
  state,
  version = null,
  computedAt = null,
  stagesSource = null,
  requiredPlan = null,
  error = null,
  onCompute,
  computing = false,
  className = '',
}: TrekPlanViewProps) {
  const moment = formatPlanMoment(computedAt);

  return (
    <section
      aria-label="Plan trek multi-jours"
      className={`rounded-[var(--lkv-radius-lg)] bg-[var(--lkv-surface-card)] p-4 shadow-sm ${className}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
            Multi-jours
          </p>
          <h3 className="mt-0.5 text-[17px] font-semibold text-[var(--lkv-text-primary)]">
            Capacité et fatigue
          </h3>
        </div>
        {plan && plan.daily.length > 0 ? (
          <span className="shrink-0 rounded-full bg-[var(--lkv-primary-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--lkv-primary)]">
            {plan.daily.length} jour{plan.daily.length > 1 ? 's' : ''}
          </span>
        ) : null}
      </header>

      {state === 'loading' && (
        <div aria-live="polite" aria-busy="true" className="mt-3 space-y-2">
          <div className="h-5 w-2/3 animate-pulse rounded-full bg-[var(--lkv-surface)] motion-reduce:animate-none" />
          <div className="h-4 w-1/2 animate-pulse rounded-full bg-[var(--lkv-surface)] motion-reduce:animate-none" />
          <span className="sr-only">Simulation du trek en cours</span>
        </div>
      )}

      {state === 'denied' && (
        <div className="mt-3 rounded-[var(--lkv-radius-md)] bg-[var(--lkv-primary-subtle)] p-3">
          <p className="text-[13px] font-semibold text-[var(--lkv-text-primary)]">
            Réservé au plan {requiredPlan ?? 'expedition'}
          </p>
          <p className="mt-1 text-[12px] text-[var(--lkv-text-secondary)]">
            La simulation multi-jours (capacité, dérive, ajustements) fait partie des
            entitlements du plan {requiredPlan ?? 'expedition'}.
          </p>
          <a
            href="/tarifs"
            className="mt-2 inline-flex min-h-[44px] items-center text-[13px] font-semibold text-[var(--lkv-primary)] underline-offset-2 active:opacity-70"
          >
            Voir les plans →
          </a>
        </div>
      )}

      {state === 'absent' && (
        <div className="mt-3">
          <p className="text-[13px] text-[var(--lkv-text-secondary)]">
            Aucune simulation multi-jours pour ce plan.
          </p>
          {onCompute ? (
            <button
              type="button"
              onClick={onCompute}
              disabled={computing}
              className="mt-2 inline-flex min-h-[44px] items-center rounded-full bg-[var(--lkv-primary)] px-4 text-[13px] font-semibold text-white active:opacity-80 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
            >
              {computing ? 'Simulation en cours…' : 'Simuler le trek multi-jours'}
            </button>
          ) : null}
        </div>
      )}

      {state === 'error' && (
        <div className="mt-3" aria-live="polite">
          <p className="text-[13px] text-[var(--lkv-danger-dark)]">
            {error ?? 'Simulation trek indisponible pour le moment.'}
          </p>
          {onCompute ? (
            <button
              type="button"
              onClick={onCompute}
              disabled={computing}
              className="mt-2 inline-flex min-h-[44px] items-center rounded-full bg-[var(--lkv-surface)] px-4 text-[13px] font-semibold text-[var(--lkv-text-primary)] active:opacity-70 disabled:opacity-50"
            >
              Réessayer
            </button>
          ) : null}
        </div>
      )}

      {state === 'ready' && plan ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[var(--lkv-radius-md)] bg-[var(--lkv-surface)] px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-muted)]">
                Journée critique
              </p>
              <p className="mt-1 text-[15px] font-semibold tabular-nums text-[var(--lkv-text-primary)]">
                {plan.worstDay > 0 ? `Jour ${plan.worstDay}` : '—'}
              </p>
            </div>
            <div className="rounded-[var(--lkv-radius-md)] bg-[var(--lkv-surface)] px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-muted)]">
                Dérive max
              </p>
              <p className="mt-1 text-[15px] font-semibold tabular-nums text-[var(--lkv-text-primary)]">
                {Math.round(plan.totalDriftRisk * 100)} %
              </p>
            </div>
          </div>

          <ul className="space-y-2" aria-label="Journées du trek">
            {plan.daily.map((day) => (
              <DayRow key={day.dayNumber} day={day} />
            ))}
          </ul>

          <p className="text-[11px] text-[var(--lkv-text-muted)]">
            {version != null ? `Version ${version}` : ''}
            {moment ? ` · ${moment}` : ''}
            {stagesSource ? ` · ${stagesSource === 'trip_steps' ? 'étapes réelles' : 'blueprint explicite'}` : ''}
          </p>
        </div>
      ) : null}
    </section>
  );
}

export default TrekPlanView;
