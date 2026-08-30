'use client';
import { Backpack, Calendar, ChevronRight } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { CountdownLive } from '@/features/materiel/components/cards/CountdownLive';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';

interface DepartHeaderProps {
  depart: Pick<DepartDetail, 'destination' | 'startsAt' | 'checklistPct' | 'readinessScore' | 'assignedKit'>;
}

const STATUS_LABELS = {
  ok: 'Prêt',
  warning: 'À finaliser',
  critical: 'Incomplet',
};

function deriveStatus(pct: number): 'ok' | 'warning' | 'critical' {
  if (pct >= 80) return 'ok';
  if (pct >= 40) return 'warning';
  return 'critical';
}

export function DepartHeader({ depart }: DepartHeaderProps) {
  const status = deriveStatus(depart.checklistPct);
  const badgeTone = status === 'ok' ? 'sage' : status === 'warning' ? 'warn' : 'danger';
  const weightKg = (depart.assignedKit.totalWeightG / 1000).toFixed(1);

  const departsAt = new Date(depart.startsAt);
  const dateLabel = departsAt.toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  return (
    <GlassCard tone={badgeTone === 'sage' ? 'sage' : badgeTone === 'warn' ? 'warn' : 'danger'} as="article" ariaLabelledBy="depart-heading">
      <div className="p-4 sm:p-5 space-y-3">
        {/* Titre + Badge statut */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <Eyebrow>Prochain départ</Eyebrow>
            <h1
              id="depart-heading"
              className="text-xl sm:text-3xl font-display font-bold tracking-tight text-[#17402C] leading-tight truncate"
            >
              {depart.destination}
            </h1>
          </div>
          <Badge tone={badgeTone}>
            <span className="flex items-center gap-1 font-bold text-[10px] sm:text-[11.5px]">
              {status === 'ok' && '✓ '}
              {status === 'warning' && '⚠ '}
              {status === 'critical' && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-ping mr-0.5" aria-hidden="true" />
              )}
              <span>{STATUS_LABELS[status]}</span>
            </span>
          </Badge>
        </div>

        {/* Countdown + Poids */}
        <div className="glass-sub-card p-3 sm:p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/40 shadow-xs border border-white/60 flex items-center justify-center text-[#17402C] shrink-0" aria-hidden="true">
              <Calendar size={16} className="sm:hidden" />
              <Calendar size={18} className="hidden sm:block" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#5A7064]">
                Départ dans
              </p>
              <div className="text-lg sm:text-2xl font-mono font-bold leading-tight text-[#17402C] tabular-nums" aria-live="polite">
                <CountdownLive target={depart.startsAt} />
              </div>
              <p className="text-[10px] text-[#5A7064] mt-0.5">{dateLabel}</p>
            </div>
          </div>

          {/* Poids + Grade (sm+) */}
          <div className="hidden sm:flex flex-col items-end gap-1 border-l border-white/30 pl-4 shrink-0">
            <div className="flex items-center gap-1.5 text-[#17402C]">
              <Backpack size={15} aria-hidden="true" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A7064]">Poids</span>
            </div>
            <span className="text-xl font-mono font-bold text-[#17402C]" aria-label={`${weightKg} kilogrammes`}>
              {weightKg} <span className="text-sm font-semibold">kg</span>
            </span>
          </div>

          {/* Grade mobile (xs) */}
          <div className="sm:hidden flex flex-col items-end shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5A7064]">Niveau</span>
            <span className="text-2xl font-display font-bold text-[#17402C] leading-none">
              {depart.readinessScore.grade}
            </span>
          </div>
        </div>

        {/* Facteurs readiness (sm+) */}
        {depart.readinessScore.factors.length > 0 && (
          <ul className="hidden sm:flex flex-wrap gap-2" aria-label="Facteurs de préparation">
            {depart.readinessScore.factors.map((f) => (
              <li key={f} className="flex items-center gap-1 text-[11px] text-[#5A7064] font-medium">
                <ChevronRight size={10} aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>
    </GlassCard>
  );
}
