'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Phone, Radio, ShieldCheck } from 'lucide-react';
import type { TripFull, TripSafetyCheckpoint } from '@/features/trips/types/trip.types';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { checkTripSafetyPoint } from '@/features/trips/actions/checkTripSafetyPoint';
import {
  isSafetyOverdue,
  nextSafetyCheckpoint,
  safetyProgress,
  safetyStatusLabel,
  sortSafetyCheckpoints,
  type SafetyStatus,
} from '../../../mobile/safetyEngine';
import { BudgetRing } from '../budget/BudgetRing';
import { GroupeChipsRow, type GroupeChipDef } from '../groupe/GroupeChipsRow';
import { GroupeDrawer } from '../groupe/GroupeDrawer';
import { GroupeRail } from '../groupe/GroupeRail';

export interface SafetyMobileExperienceProps {
  trip: TripFull;
}

type SafetyFilter = 'all' | 'pending' | 'checked' | 'late';

const STATUS_TONES: Record<SafetyStatus, string> = {
  pending: 'bg-[var(--lkv-warning)]/10 text-[var(--lkv-warning)]',
  checked: 'bg-[var(--sage-50)] text-[var(--sage-700)]',
  missed: 'bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)]',
  alert_sent: 'bg-[var(--lkv-danger)]/15 text-[var(--lkv-danger)]',
};

const STATUS_ICONS: Record<SafetyStatus, typeof Clock> = {
  pending: Clock,
  checked: CheckCircle2,
  missed: AlertTriangle,
  alert_sent: Radio,
};

function formatSchedule(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SafetyMobileExperience({ trip }: SafetyMobileExperienceProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [isPending, startTransition] = useTransition();
  const [checkpoints, setCheckpoints] = useState<TripSafetyCheckpoint[]>(trip.safety_checkpoints || []);
  useEffect(() => {
    setCheckpoints(trip.safety_checkpoints || []);
  }, [trip.safety_checkpoints]);
  const [filter, setFilter] = useState<SafetyFilter>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pointerError, setPointerError] = useState<string | null>(null);

  const canEdit = trip.permissions.canEdit;
  const now = useMemo(() => new Date(), []);
  const sorted = useMemo(() => sortSafetyCheckpoints(checkpoints), [checkpoints]);
  const progress = useMemo(() => safetyProgress(checkpoints), [checkpoints]);
  const next = useMemo(() => nextSafetyCheckpoint(checkpoints, now), [checkpoints, now]);
  const lateCount = checkpoints.filter((checkpoint) => checkpoint.status === 'missed' || checkpoint.status === 'alert_sent').length;
  const pendingCount = checkpoints.filter((checkpoint) => checkpoint.status === 'pending').length;

  const handleCheckIn = (checkpoint: TripSafetyCheckpoint) => {
    triggerHaptic('success');
    const snapshot = checkpoints;
    setCheckpoints((prev) =>
      prev.map((entry) =>
        entry.id === checkpoint.id
          ? { ...entry, status: 'checked' as const, checked_at: new Date().toISOString() }
          : entry
      )
    );
    startTransition(async () => {
      const res = await checkTripSafetyPoint(trip.id, checkpoint.id, trip.slug);
      if (!res.ok) {
        setCheckpoints(snapshot);
        setPointerError(res.error ?? 'Pointage impossible pour le moment.');
      } else {
        setPointerError(null);
      }
    });
  };

  const openWith = (nextFilter: SafetyFilter) => {
    setFilter(nextFilter);
    setDrawerOpen(true);
  };

  const chips: GroupeChipDef[] = [
    {
      key: 'pending',
      icon: Clock,
      value: String(pendingCount),
      label: 'à pointer',
      tone: pendingCount > 0 ? 'accent' : 'default',
      onClick: () => openWith('pending'),
    },
    {
      key: 'checked',
      icon: CheckCircle2,
      value: String(progress.checked),
      label: 'validés',
      onClick: () => openWith('checked'),
    },
    {
      key: 'late',
      icon: AlertTriangle,
      value: String(lateCount),
      label: 'en alerte',
      tone: lateCount > 0 ? 'warn' : 'default',
      onClick: () => openWith('late'),
    },
  ];

  const filtered = sorted.filter((checkpoint) => {
    if (filter === 'pending') return checkpoint.status === 'pending';
    if (filter === 'checked') return checkpoint.status === 'checked';
    if (filter === 'late') return checkpoint.status === 'missed' || checkpoint.status === 'alert_sent';
    return true;
  });

  const checkpointCard = (checkpoint: TripSafetyCheckpoint) => {
    const overdue = isSafetyOverdue(checkpoint, now);
    const Icon = STATUS_ICONS[checkpoint.status];
    return (
      <li key={checkpoint.id} className="shrink-0 snap-start">
        <div
          className={`glass flex h-[10.5rem] w-[11rem] flex-col rounded-[1.4rem] p-3 ${
            overdue ? 'border-2 border-[var(--lkv-danger)]/30' : ''
          }`}
        >
          <span
            className={`flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONES[checkpoint.status]}`}
          >
            <Icon size={11} aria-hidden="true" />
            {overdue ? 'En retard' : safetyStatusLabel(checkpoint.status)}
          </span>
          <p className="mt-2 line-clamp-2 text-[12.5px] font-bold leading-snug text-[var(--lkv-text-primary)]">
            {checkpoint.label}
          </p>
          <p className="mt-1 text-[10px] font-medium leading-snug text-[var(--lkv-text-primary)]/65">
            {formatSchedule(checkpoint.scheduled_at)}
          </p>
          {checkpoint.contact_name && (
            <p className="mt-1 flex items-center gap-1 truncate text-[9.5px] font-medium text-[var(--lkv-text-primary)]/60">
              <Phone size={10} aria-hidden="true" />
              {checkpoint.contact_name}
            </p>
          )}
          {checkpoint.status !== 'checked' && canEdit ? (
            <button
              type="button"
              onClick={() => handleCheckIn(checkpoint)}
              disabled={isPending}
              aria-label={`Pointer ${checkpoint.label}`}
              className="glass-capsule-btn primary mt-auto inline-flex min-h-[44px] items-center justify-center !py-2 text-[11px] font-bold disabled:opacity-50"
            >
              Pointer
            </button>
          ) : (
            <p className="mt-auto text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--lkv-text-primary)]/50">
              {checkpoint.status === 'checked' ? 'Pointé' : 'Lecture seule'}
            </p>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-1">
      {pointerError && (
        <div
          className="glass tone-danger flex items-center justify-between gap-2 rounded-xl p-3 text-xs text-[var(--lkv-danger)]"
          role="alert"
        >
          <span>{pointerError}</span>
          <button
            type="button"
            onClick={() => setPointerError(null)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--lkv-text-muted)]"
            aria-label="Fermer le message"
          >
            ×
          </button>
        </div>
      )}

      <section className="glass relative overflow-hidden rounded-[1.75rem] p-4" aria-label="Sécurité du voyage">
        <header className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
            Sécurité du voyage
          </p>
          <span className="glass-pill shrink-0 uppercase tracking-[0.08em]">
            {progress.checked}/{progress.total} pointés
          </span>
        </header>

        <div className="mt-3 flex items-center gap-4">
          <BudgetRing pct={progress.pct}>
            <span className="font-display text-2xl font-extrabold leading-none text-[var(--lkv-text-primary)]">
              {progress.pct}%
            </span>
            <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/75">
              pointé
            </span>
          </BudgetRing>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="flex items-center gap-1.5 text-sm font-bold text-[var(--lkv-text-primary)]">
              <ShieldCheck size={15} aria-hidden="true" />
              {next ? 'Prochain point' : 'Tous les points sont validés'}
            </p>
            {next && (
              <p className="text-xs font-medium leading-snug text-[var(--lkv-text-primary)]/70">
                « {next.label} » · {formatSchedule(next.scheduled_at)}
              </p>
            )}
            {lateCount > 0 && (
              <p className="text-[11px] font-semibold text-[var(--lkv-danger)]">
                {lateCount} point{lateCount > 1 ? 's' : ''} en alerte
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => openWith('pending')}
          className="glass-capsule-btn primary mt-4 inline-flex w-full items-center justify-center gap-1.5 !py-3 text-sm font-bold"
        >
          Voir les points de contrôle
        </button>
      </section>

      <GroupeChipsRow chips={chips} />

      <GroupeRail
        title="Points de contrôle"
        subtitle={`${pendingCount} en attente · ${lateCount} en alerte`}
        actionLabel="Tout voir"
        onAction={() => openWith('all')}
        ariaLabel="Points de contrôle"
      >
        {sorted.length === 0 ? (
          <li className="shrink-0 snap-start">
            <div className="glass-sub-card flex h-[10.5rem] w-[13rem] flex-col items-start justify-center gap-1 rounded-[1.4rem] p-4">
              <span className="text-sm font-bold text-[var(--lkv-text-primary)]">Aucun point de contrôle</span>
              <span className="text-xs font-medium text-[var(--lkv-text-primary)]/70">
                Les points de sécurité apparaîtront ici.
              </span>
            </div>
          </li>
        ) : (
          sorted.map(checkpointCard)
        )}
      </GroupeRail>

      <GroupeRail
        title="Numéros d'urgence"
        subtitle="Toujours accessibles"
        ariaLabel="Numéros d'urgence"
      >
        <li className="shrink-0 snap-start">
          <a
            href="tel:112"
            className="glass flex h-[7.5rem] w-[9.5rem] flex-col items-center justify-center gap-1 rounded-[1.4rem] p-3 text-center"
            aria-label="Appeler le 112 — urgences européennes"
          >
            <Phone size={18} className="text-[var(--lkv-danger)]" aria-hidden="true" />
            <span className="font-display text-xl font-extrabold text-[var(--lkv-text-primary)]">112</span>
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[var(--lkv-text-primary)]/60">
              Urgences
            </span>
          </a>
        </li>
        <li className="shrink-0 snap-start">
          <a
            href="tel:114"
            className="glass flex h-[7.5rem] w-[9.5rem] flex-col items-center justify-center gap-1 rounded-[1.4rem] p-3 text-center"
            aria-label="Appeler le 114 — urgences montagne"
          >
            <Phone size={18} className="text-[var(--lkv-primary)]" aria-hidden="true" />
            <span className="font-display text-xl font-extrabold text-[var(--lkv-text-primary)]">114</span>
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[var(--lkv-text-primary)]/60">
              Montagne
            </span>
          </a>
        </li>
      </GroupeRail>

      <GroupeDrawer open={drawerOpen} onOpenChange={setDrawerOpen} title="Points de contrôle" width={460}>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: 'all', label: 'Tout' },
              { key: 'pending', label: 'À pointer' },
              { key: 'checked', label: 'Validés' },
              { key: 'late', label: 'En alerte' },
            ] as Array<{ key: SafetyFilter; label: string }>
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              aria-pressed={filter === option.key}
              className={`min-h-[44px] rounded-full px-3.5 text-xs font-bold transition-colors ${
                filter === option.key
                  ? 'bg-[var(--lkv-primary)] text-white'
                  : 'glass-sub-card text-[var(--lkv-text-primary)]/75'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm font-medium text-[var(--lkv-text-primary)]/70">
            Aucun point dans ce filtre.
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((checkpoint) => {
              const Icon = STATUS_ICONS[checkpoint.status];
              return (
                <li key={checkpoint.id} className="glass-sub-card rounded-2xl p-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${STATUS_TONES[checkpoint.status]}`}>
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-[var(--lkv-text-primary)]">
                        {checkpoint.label}
                      </span>
                      <span className="block text-[10.5px] font-medium text-[var(--lkv-text-primary)]/65">
                        {formatSchedule(checkpoint.scheduled_at)} · {safetyStatusLabel(checkpoint.status)}
                      </span>
                    </span>
                    {checkpoint.status !== 'checked' && canEdit && (
                      <button
                        type="button"
                        onClick={() => handleCheckIn(checkpoint)}
                        disabled={isPending}
                        aria-label={`Pointer ${checkpoint.label}`}
                        className="glass-capsule-btn primary inline-flex min-h-[44px] shrink-0 items-center !px-3 !py-2 text-[11px] font-bold disabled:opacity-50"
                      >
                        Pointer
                      </button>
                    )}
                  </div>
                  {checkpoint.notes && (
                    <p className="mt-2 text-[11px] font-medium leading-snug text-[var(--lkv-text-primary)]/70">
                      {checkpoint.notes}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </GroupeDrawer>
    </div>
  );
}

export default SafetyMobileExperience;
