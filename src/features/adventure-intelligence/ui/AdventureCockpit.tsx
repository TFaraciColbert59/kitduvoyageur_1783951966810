'use client';

/**
 * A7 — Cockpit mobile calme (iOS) : Hero unique → 3 indicateurs → 3 actions →
 * alertes verticales → ETA P50/P90 → difficulté → allure → demi-tour →
 * confiance → raisons de recalcul → bandeau offline.
 *
 * Vue pure de `buildCockpitView` : le composant ne calcule rien, ne fait
 * aucune I/O. Cibles ≥ 44 px, safe-area, `prefers-reduced-motion`, animations
 * transform/opacité ≤ 220 ms, rayons/ombres système uniquement.
 */
import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Icon from '@/components/ui/Icon';
import {
  buildCockpitView,
  type CockpitActionKind,
  type CockpitInput,
  type CockpitPriorityAction,
  type CockpitTone,
} from '../domain/cockpit';
import { RECALC_REASONS } from '../domain/recalcTriggers';
import { SEVERITY_COLORS, SEVERITY_LABELS } from '@/features/terrain-live/lib/terrainDisplay';
import type { TerrainSeverity } from '@/features/adventure-intelligence/schemas/live.schema';
import OfflineBanner from './OfflineBanner';

export interface AdventureCockpitProps {
  input: CockpitInput;
  pendingSyncCount?: number;
  onDecide?: (decisionId: string) => void;
  onReport?: () => void;
  onNavigate?: () => void;
  onRecalculate?: () => void;
  className?: string;
}

const TONE_TEXT_CLASSES: Record<CockpitTone, string> = {
  neutral: 'text-[var(--lkv-text-primary)]',
  positive: 'text-[var(--lkv-success)]',
  warning: 'text-[var(--lkv-warning-dark)]',
  critical: 'text-[var(--lkv-danger-dark)]',
};

const TONE_BAR_CLASSES: Record<CockpitTone, string> = {
  neutral: 'bg-[var(--lkv-text-subtle)]',
  positive: 'bg-[var(--lkv-success)]',
  warning: 'bg-[var(--lkv-warning)]',
  critical: 'bg-[var(--lkv-danger)]',
};

const ACTION_ICONS: Record<CockpitActionKind, string> = {
  decide: 'check-circle',
  navigate: 'navigation',
  report: 'alert-triangle',
};

const SEVERITY_ICONS: Record<TerrainSeverity, string> = {
  critical: 'alert-triangle',
  warning: 'alert-circle',
  info: 'info',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'élevée',
  medium: 'moyenne',
  low: 'faible',
};

const RECALC_REASON_LABELS: Record<string, string> = {
  [RECALC_REASONS.position]: 'Déplacement significatif',
  [RECALC_REASONS.pause]: 'Reprise après pause',
  [RECALC_REASONS.pace]: 'Allure modifiée',
  [RECALC_REASONS.offroute]: 'Hors trace',
  [RECALC_REASONS.terrain]: 'Terrain modifié',
  [RECALC_REASONS.battery]: 'Batterie faible',
  [RECALC_REASONS.route]: 'Itinéraire modifié',
};

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function etaText(p50: string | null, p90: string | null): string {
  const start = formatTime(p50);
  const end = formatTime(p90);
  if (start && end) return `${start} – ${end}`;
  if (start) return `vers ${start}`;
  if (end) return `avant ${end}`;
  return '—';
}

function aheadBehindText(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes === 0) return 'À l’heure';
  return minutes > 0 ? `${minutes} min d’avance` : `${Math.abs(minutes)} min de retard`;
}

/** Consommation live (charge A3) sur fixes réels — null si indisponible. */
function consumptionText(view: ReturnType<typeof buildCockpitView>): string | null {
  const consumption = view.consumption;
  if (!consumption) return null;
  return `Charge consommée ${Math.round(consumption.loadScore)}/100 · ${Math.round(
    consumption.elevationGainM
  )} m D+`;
}

export function AdventureCockpit({
  input,
  pendingSyncCount = 0,
  onDecide,
  onReport,
  onNavigate,
  onRecalculate,
  className = '',
}: AdventureCockpitProps) {
  const reduceMotion = useReducedMotion();
  const view = useMemo(() => buildCockpitView(input), [input]);

  const handleAction = (action: CockpitPriorityAction) => {
    if (action.kind === 'decide') onDecide?.(action.id);
    else if (action.kind === 'report') onReport?.();
    else onNavigate?.();
  };

  const etaHint = aheadBehindText(view.eta.aheadBehindMinutes);
  const consumptionHint = consumptionText(view);
  const turnaround = formatTime(view.turnaroundTime);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={`space-y-3 pb-[env(safe-area-inset-bottom)] ${className}`}
      role="group"
      aria-label="Cockpit aventure"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[20px] font-semibold text-[var(--lkv-text-primary)]">
            {view.hero.title}
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--lkv-text-secondary)]">{view.hero.subtitle}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--lkv-primary-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--lkv-primary)]">
          {view.hero.status}
        </span>
      </header>

      {view.indicators.length > 0 && (
        <ul className="grid grid-cols-3 gap-2" aria-label="Indicateurs clés">
          {view.indicators.map((indicator) => (
            <li
              key={indicator.id}
              className="rounded-2xl bg-[var(--lkv-surface-card)] px-3 py-2.5 shadow-sm"
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-muted)]">
                {indicator.label}
              </p>
              <p
                className={`mt-1 text-[17px] font-semibold tabular-nums ${TONE_TEXT_CLASSES[indicator.tone]}`}
              >
                {indicator.value}
              </p>
            </li>
          ))}
        </ul>
      )}

      {view.priorityActions.length > 0 && (
        <ul className="space-y-2" aria-label="Actions prioritaires">
          {view.priorityActions.map((action) => (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => handleAction(action)}
                className={`flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-4 text-left text-[15px] font-semibold active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] ${
                  action.kind === 'decide'
                    ? 'bg-[var(--lkv-primary)] text-white'
                    : 'bg-[var(--lkv-surface-card)] text-[var(--lkv-text-primary)] shadow-sm'
                }`}
              >
                <Icon name={ACTION_ICONS[action.kind]} size={17} aria-hidden="true" />
                <span className="flex-1">{action.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {view.alerts.length > 0 && (
        <ul className="space-y-1.5" aria-label="Alertes terrain">
          {view.alerts.map((alert) => (
            <li
              key={alert.id}
              className="flex items-center gap-2.5 rounded-xl bg-[var(--lkv-surface-card)] px-3 py-2"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: SEVERITY_COLORS[alert.severity] }}
              />
              <Icon
                name={SEVERITY_ICONS[alert.severity]}
                size={14}
                style={{ color: SEVERITY_COLORS[alert.severity] }}
                aria-hidden="true"
              />
              <span className="flex-1 text-[13px] text-[var(--lkv-text-primary)]">
                {alert.label}
              </span>
              <span className="sr-only">{SEVERITY_LABELS[alert.severity]}</span>
            </li>
          ))}
        </ul>
      )}

      <section
        aria-label="Heure d’arrivée estimée"
        className="rounded-2xl bg-[var(--lkv-surface-card)] p-4 shadow-sm"
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-muted)]">
          Arrivée estimée
        </p>
        <p
          className="mt-1 text-[17px] font-semibold tabular-nums text-[var(--lkv-text-primary)]"
          suppressHydrationWarning
        >
          {etaText(view.eta.p50, view.eta.p90)}
        </p>
        {etaHint && <p className="mt-0.5 text-[12px] text-[var(--lkv-text-secondary)]">{etaHint}</p>}
        {consumptionHint && (
          <p className="mt-1 text-[11px] text-[var(--lkv-text-muted)]">{consumptionHint}</p>
        )}
      </section>

      {(view.difficulty.value != null || view.paceStrategy || turnaround) && (
        <div className="grid grid-cols-2 gap-2">
          {view.difficulty.value != null && (
            <section
              aria-label="Difficulté personnelle"
              className="rounded-2xl bg-[var(--lkv-surface-card)] px-3 py-2.5 shadow-sm"
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-muted)]">
                Difficulté
              </p>
              <p className="mt-1 text-[15px] font-semibold text-[var(--lkv-text-primary)]">
                {view.difficulty.label}
                <span className="ml-1 text-[12px] font-medium text-[var(--lkv-text-muted)]">
                  {view.difficulty.value}/100
                </span>
              </p>
              <div
                aria-hidden="true"
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--lkv-surface)]"
              >
                <div
                  className={`h-full rounded-full ${TONE_BAR_CLASSES[view.indicators.find((i) => i.id === 'difficulty')?.tone ?? 'neutral']}`}
                  style={{ width: `${view.difficulty.value}%` }}
                />
              </div>
            </section>
          )}
          {view.paceStrategy && (
            <section
              aria-label="Stratégie d’allure"
              className="rounded-2xl bg-[var(--lkv-surface-card)] px-3 py-2.5 shadow-sm"
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-muted)]">
                Allure
              </p>
              <p className="mt-1 text-[15px] font-semibold text-[var(--lkv-text-primary)]">
                {view.paceStrategy.label}
              </p>
            </section>
          )}
          {turnaround && (
            <section
              aria-label="Heure de demi-tour"
              className="col-span-2 rounded-2xl bg-[var(--lkv-surface-card)] px-3 py-2.5 shadow-sm"
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-muted)]">
                Demi-tour
              </p>
              <p
                className="mt-1 text-[15px] font-semibold tabular-nums text-[var(--lkv-text-primary)]"
                suppressHydrationWarning
              >
                {turnaround}
              </p>
            </section>
          )}
        </div>
      )}

      {view.confidence && (
        <section
          aria-label="Confiance de la prédiction"
          className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--lkv-surface-card)] px-3 py-2.5 shadow-sm"
        >
          <p className="text-[12px] text-[var(--lkv-text-secondary)]">
            Confiance{' '}
            <span className="font-semibold text-[var(--lkv-text-primary)]">
              {CONFIDENCE_LABELS[view.confidence.level] ?? view.confidence.level}
            </span>
          </p>
          <p className="text-[12px] tabular-nums text-[var(--lkv-text-muted)]">
            {Math.round(view.confidence.score * 100)} % · {view.confidence.sampleCount} obs.
          </p>
        </section>
      )}

      {view.recalcReasons.length > 0 && (
        <section
          aria-label="Recalcul suggéré"
          className="rounded-2xl bg-[var(--lkv-warning-subtle)] p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-[var(--lkv-warning-dark)]">
              Mise à jour conseillée
            </p>
            {onRecalculate && (
              <button
                type="button"
                onClick={onRecalculate}
                className="min-h-[44px] rounded-full px-3 text-[12px] font-semibold text-[var(--lkv-primary)] active:opacity-70"
              >
                Recalculer
              </button>
            )}
          </div>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {view.recalcReasons.map((reason) => (
              <li
                key={reason}
                className="rounded-full bg-white/60 px-2 py-0.5 text-[11px] text-[var(--lkv-text-secondary)]"
              >
                {RECALC_REASON_LABELS[reason] ?? reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <OfflineBanner offline={view.offline} pendingCount={pendingSyncCount} />
    </motion.div>
  );
}

export default AdventureCockpit;
