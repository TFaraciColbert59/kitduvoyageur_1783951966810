'use client';

import {
  BatteryCharging,
  CalendarDays,
  Clock,
  FileText,
  Mountain,
  Share2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { BudgetRing } from '@/features/hub/components/mobile/budget/BudgetRing';
import { CountdownLive } from '@/features/materiel/components/cards/CountdownLive';
import { formatDistanceKm, formatWeight } from '@/features/materiel/domain/departCalculations';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { cn } from '@/lib/utils';
import type { DepartIdentity } from '@/features/materiel/domain/departIdentity';
import type { DepartDetail, DepartStatus } from '@/features/materiel/services/getDepartDetail';

export interface DepartHeroCardProps {
  depart: DepartDetail;
  identity: DepartIdentity;
  kits?: { id: string; name: string }[];
  isOnline?: boolean;
  onOpenSheet: () => void;
  onShare: () => void;
  onSelectKit?: (kitId: string) => void;
}

const STATUS_LABELS: Record<DepartStatus, string> = {
  draft: 'En préparation',
  ready: 'Prêt',
  active: 'Actif',
  done: 'Terminé',
};

const STATUS_TONES: Record<DepartStatus, string> = {
  draft: 'pill-warn',
  ready: '',
  active: 'pill-info',
  done: '',
};

export function DepartHeroCard({
  depart,
  identity,
  kits,
  isOnline = true,
  onOpenSheet,
  onShare,
  onSelectKit,
}: DepartHeroCardProps) {
  const { triggerHaptic } = useHapticFeedback();

  const readinessPct = depart?.readinessScore?.percentage ?? depart?.checklistPct ?? 0;
  const missingCount = (depart?.checklistItems ?? []).filter((item) => !item.done).length;
  const status = depart?.status ?? 'draft';
  const startsAt = depart?.startsAt ?? null;
  const activity = depart?.activityType ?? null;

  const dateLabel = startsAt
    ? `Départ le ${new Date(startsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
    : 'Date à fixer';

  const handleOpenSheet = () => {
    triggerHaptic('light');
    onOpenSheet();
  };

  const handleShare = () => {
    triggerHaptic('light');
    onShare();
  };

  return (
    <section className="glass relative overflow-hidden rounded-[1.75rem] p-4" aria-label="Départ">
      <header className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
          Départ
        </p>
        <span
          className={cn('glass-pill shrink-0 uppercase tracking-[0.08em]', STATUS_TONES[status])}
        >
          {STATUS_LABELS[status]}
        </span>
      </header>

      <div className="mt-2.5">
        <h2 className="font-display text-[17px] font-bold leading-snug text-[var(--lkv-text-primary)]">
          {identity.title}
        </h2>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-[var(--lkv-text-primary)]/70">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={12} aria-hidden="true" />
            {dateLabel}
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock size={12} aria-hidden="true" />
            <CountdownLive target={startsAt} />
          </span>
          {activity && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Mountain size={12} aria-hidden="true" />
                {activity}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <BudgetRing pct={readinessPct} size={96} stroke={9}>
          <span className="font-display text-2xl font-extrabold leading-none text-[var(--lkv-text-primary)]">
            {readinessPct} %
          </span>
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/75">
            Prêt
          </span>
        </BudgetRing>

        <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
          <div className="glass-sub-card rounded-2xl p-2.5 text-center">
            <p className="truncate font-display text-sm font-extrabold leading-none tabular-nums text-[var(--lkv-text-primary)]">
              {formatWeight(depart?.totalPackWeightG ?? 0)}
            </p>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
              Poids
            </p>
          </div>
          <div className="glass-sub-card rounded-2xl p-2.5 text-center">
            <p className="font-display text-sm font-extrabold leading-none tabular-nums text-[var(--lkv-text-primary)]">
              {missingCount}
            </p>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
              Manquants
            </p>
          </div>
          <div className="glass-sub-card rounded-2xl p-2.5 text-center">
            <p className="truncate font-display text-sm font-extrabold leading-none tabular-nums text-[var(--lkv-text-primary)]">
              {formatDistanceKm(depart?.trail?.distance_km)}
            </p>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
              Distance
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleOpenSheet}
          className="glass-capsule-btn primary min-h-[44px] flex-1 !py-3 text-sm font-bold active:scale-[0.97]"
        >
          <FileText size={15} aria-hidden="true" />
          Ouvrir la fiche de départ
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="glass-capsule-btn min-h-[44px] !px-3 text-xs font-bold active:scale-[0.97]"
        >
          <Share2 size={14} aria-hidden="true" />
          Partager
        </button>
      </div>

      <footer className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--lkv-primary)]/10 pt-2.5 text-[10px] uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/60">
        {depart?.status && (
          <span
            className="glass-sub-card inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
            title="Mode éco batterie"
          >
            <BatteryCharging size={12} aria-hidden="true" />
            ÉCO
          </span>
        )}
        <span
          className="inline-flex items-center gap-1 font-semibold"
          title={isOnline ? 'En ligne' : 'Hors-ligne (cache local)'}
        >
          {isOnline ? <Wifi size={12} aria-hidden="true" /> : <WifiOff size={12} aria-hidden="true" />}
          {isOnline ? 'En ligne' : 'Hors-ligne'}
        </span>
        {kits && kits.length > 1 && (
          <select
            aria-label="Changer de kit"
            defaultValue={depart?.assignedKit?.id}
            onChange={(event) => onSelectKit?.(event.target.value)}
            className="glass-sub-card ml-auto max-w-[45%] truncate rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--lkv-text-primary)] outline-none"
          >
            {kits.map((kit) => (
              <option key={kit.id} value={kit.id}>
                {kit.id === depart?.assignedKit?.id && depart.assignedKit.name
                  ? depart.assignedKit.name
                  : kit.name}
              </option>
            ))}
          </select>
        )}
      </footer>
    </section>
  );
}
