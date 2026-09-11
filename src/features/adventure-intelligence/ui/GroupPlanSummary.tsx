/**
 * A13 (S3) — Résumé public du plan de groupe (mobile-first, iOS calme).
 *
 * Vue pure : aucune I/O, uniquement des agrégats publics (jamais d'identité,
 * jamais de vitesse individuelle). Cibles ≥ 44 px, tokens `--lkv-*`, transitions
 * désactivées sous `prefers-reduced-motion`, zéro orange.
 */
import type { GroupPlanSummaryPublic, StagesSource } from '../domain/planGroupTrek';

export type GroupPlanLoadState = 'loading' | 'ready' | 'absent' | 'denied' | 'error';

export interface GroupPlanSummaryProps {
  plan: GroupPlanSummaryPublic | null;
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

const RISK_TONES: Record<
  GroupPlanSummaryPublic['separationRisk']['level'],
  { badge: string; label: string }
> = {
  low: { badge: 'bg-[var(--lkv-success-bg)] text-[var(--lkv-success)]', label: 'Faible' },
  medium: { badge: 'bg-[var(--lkv-warning-bg)] text-[var(--lkv-warning-dark)]', label: 'Moyen' },
  high: { badge: 'bg-[var(--lkv-danger-bg)] text-[var(--lkv-danger-dark)]', label: 'Élevé' },
};

const SOURCE_LABELS: Record<StagesSource, string> = {
  trip_steps: 'étapes réelles du voyage',
  blueprint_uniform: 'répartition blueprint explicite',
};

export function formatPlanMoment(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

export function GroupPlanSummary({
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
}: GroupPlanSummaryProps) {
  const risk = plan ? RISK_TONES[plan.separationRisk.level] : null;
  const moment = formatPlanMoment(computedAt);

  return (
    <section
      aria-label="Plan de groupe"
      className={`rounded-[var(--lkv-radius-lg)] bg-[var(--lkv-surface-card)] p-4 shadow-sm ${className}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
            Intelligence collective
          </p>
          <h3 className="mt-0.5 text-[17px] font-semibold text-[var(--lkv-text-primary)]">
            Allure du groupe
          </h3>
        </div>
        {plan ? (
          <span className="shrink-0 rounded-full bg-[var(--lkv-primary-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--lkv-primary)]">
            {plan.memberCount} membre{plan.memberCount > 1 ? 's' : ''}
          </span>
        ) : null}
      </header>

      {state === 'loading' && (
        <div
          aria-live="polite"
          aria-busy="true"
          className="mt-3 space-y-2 motion-reduce:animate-none"
        >
          <div className="h-5 w-1/2 animate-pulse rounded-full bg-[var(--lkv-surface)] motion-reduce:animate-none" />
          <div className="h-4 w-3/4 animate-pulse rounded-full bg-[var(--lkv-surface)] motion-reduce:animate-none" />
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-[var(--lkv-surface)] motion-reduce:animate-none" />
          <span className="sr-only">Calcul du plan de groupe en cours</span>
        </div>
      )}

      {state === 'denied' && (
        <div className="mt-3 rounded-[var(--lkv-radius-md)] bg-[var(--lkv-primary-subtle)] p-3">
          <p className="text-[13px] font-semibold text-[var(--lkv-text-primary)]">
            Réservé au plan {requiredPlan ?? 'group'}
          </p>
          <p className="mt-1 text-[12px] text-[var(--lkv-text-secondary)]">
            L’analyse collective (membre limitant, redistribution, risque de séparation) fait
            partie des entitlements du plan {requiredPlan ?? 'group'}.
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
            Aucune analyse de groupe n’est encore calculée pour ce plan.
          </p>
          {onCompute ? (
            <button
              type="button"
              onClick={onCompute}
              disabled={computing}
              className="mt-2 inline-flex min-h-[44px] items-center rounded-full bg-[var(--lkv-primary)] px-4 text-[13px] font-semibold text-white active:opacity-80 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
            >
              {computing ? 'Calcul en cours…' : 'Calculer l’analyse de groupe'}
            </button>
          ) : null}
        </div>
      )}

      {state === 'error' && (
        <div className="mt-3" aria-live="polite">
          <p className="text-[13px] text-[var(--lkv-danger-dark)]">
            {error ?? 'Analyse de groupe indisponible pour le moment.'}
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

      {state === 'ready' && plan && risk ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[var(--lkv-radius-md)] bg-[var(--lkv-surface)] px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-muted)]">
                Allure collective
              </p>
              <p className="mt-1 text-[17px] font-semibold tabular-nums text-[var(--lkv-text-primary)]">
                {plan.groupPaceKmH.toFixed(2)}
                <span className="ml-1 text-[11px] font-medium text-[var(--lkv-text-muted)]">
                  km/h
                </span>
              </p>
            </div>
            <div className="rounded-[var(--lkv-radius-md)] bg-[var(--lkv-surface)] px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-muted)]">
                Difficulté groupe
              </p>
              <p className="mt-1 text-[17px] font-semibold tabular-nums text-[var(--lkv-text-primary)]">
                {plan.groupDifficulty}
                <span className="ml-1 text-[11px] font-medium text-[var(--lkv-text-muted)]">
                  /100
                </span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--lkv-surface-card)]">
                <div
                  className="h-full rounded-full bg-[var(--lkv-primary)]"
                  style={{ width: `${Math.min(100, Math.max(0, plan.groupDifficulty))}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          <div className="rounded-[var(--lkv-radius-md)] bg-[var(--lkv-surface)] px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-muted)]">
              Membre limitant
            </p>
            <p className="mt-1 text-[13px] text-[var(--lkv-text-primary)]">
              {plan.limitingReason ?? 'Aucun membre limitant identifié.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[var(--lkv-radius-md)] bg-[var(--lkv-surface)] px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-muted)]">
                Redistribution
              </p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--lkv-text-primary)]">
                {plan.gearRedistribution.transfers === 0
                  ? 'Aucun transfert nécessaire'
                  : `${plan.gearRedistribution.transfers} transfert${
                      plan.gearRedistribution.transfers > 1 ? 's' : ''
                    } · ${plan.gearRedistribution.totalWeightKg.toFixed(1)} kg`}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--lkv-text-muted)]">
                Plafond {plan.gearRedistribution.maxPerReceiverKg} kg par receveur
              </p>
            </div>
            <div className="rounded-[var(--lkv-radius-md)] bg-[var(--lkv-surface)] px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-muted)]">
                Pause conseillée
              </p>
              <p className="mt-1 text-[13px] font-semibold tabular-nums text-[var(--lkv-text-primary)]">
                toutes les {plan.pauseEveryMinutes} min
              </p>
              {plan.difficultyRange ? (
                <p className="mt-0.5 text-[11px] tabular-nums text-[var(--lkv-text-muted)]">
                  Difficultés {plan.difficultyRange.min}–{plan.difficultyRange.max}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${risk.badge}`}
            >
              Séparation {risk.label}
            </span>
            {plan.separationRisk.reasons.map((reason) => (
              <span key={reason} className="text-[11px] text-[var(--lkv-text-secondary)]">
                {reason}
              </span>
            ))}
          </div>

          <p className="text-[11px] text-[var(--lkv-text-muted)]">
            {version != null ? `Version ${version}` : ''}
            {moment ? ` · ${moment}` : ''}
            {stagesSource ? ` · ${SOURCE_LABELS[stagesSource]}` : ''}
          </p>
        </div>
      ) : null}
    </section>
  );
}

export default GroupPlanSummary;
