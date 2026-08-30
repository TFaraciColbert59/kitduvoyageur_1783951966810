import Link from 'next/link';
import { Backpack, CheckSquare, ArrowRight, ListChecks } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatWeight } from '@/features/materiel/domain/departCalculations';

interface DepartPreparationProps {
  checklistPct: number;
  totalWeightG: number;
  itemsCount: number;
  checkedCount: number;
  kitId: string;
}

export function DepartPreparation({
  checklistPct,
  totalWeightG,
  itemsCount,
  checkedCount,
  kitId,
}: DepartPreparationProps) {
  const progressTone =
    checklistPct >= 80 ? 'sage' : checklistPct >= 40 ? 'warn' : 'danger';

  const ctaHref = `/materiel/kits`;
  const ctaLabel = checklistPct >= 100 ? 'Revoir le kit' : 'Compléter le kit';

  return (
    <GlassCard tone="neutral">
      <div className="p-4 sm:p-5 space-y-3.5">
        {/* Titre + % */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks size={16} className="text-[#5A7064]" aria-hidden="true" />
            <span className="text-[13px] sm:text-sm font-semibold text-[#17402C]">
              Progression du pack
            </span>
          </div>
          <span
            className="text-lg sm:text-xl font-mono font-bold text-[#17402C] tabular-nums"
            aria-label={`${checklistPct} pourcent prêt`}
          >
            {checklistPct}%
          </span>
        </div>

        <ProgressBar
          value={checklistPct}
          tone={progressTone}
          label={`Préparation du départ : ${checklistPct}%`}
        />

        {/* Métriques */}
        <div className="flex items-stretch gap-2.5">
          {/* Poids */}
          <div className="glass-sub-card flex-1 flex flex-col items-start p-3 gap-0.5">
            <div className="flex items-center gap-1.5 text-[#5A7064]">
              <Backpack size={13} aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Poids</span>
            </div>
            <span
              className="text-base sm:text-lg font-mono font-bold text-[#17402C] leading-tight"
              aria-label={`Poids total : ${formatWeight(totalWeightG)}`}
            >
              {formatWeight(totalWeightG)}
            </span>
          </div>

          {/* Articles */}
          <div className="glass-sub-card flex-1 flex flex-col items-start p-3 gap-0.5">
            <div className="flex items-center gap-1.5 text-[#5A7064]">
              <CheckSquare size={13} aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Articles</span>
            </div>
            <span
              className="text-base sm:text-lg font-mono font-bold text-[#17402C] leading-tight"
              aria-label={`${checkedCount} articles sur ${itemsCount} cochés`}
            >
              {checkedCount}
              <span className="text-[#5A7064] font-medium text-sm">/{itemsCount}</span>
            </span>
          </div>

          {/* CTA */}
          <Link
            href={ctaHref}
            className="glass-capsule-btn primary !h-auto py-3 px-4 flex items-center gap-1.5 shrink-0 text-xs font-semibold"
            aria-label={ctaLabel}
          >
            <span className="hidden sm:inline">{ctaLabel}</span>
            <span className="sm:hidden">Kit</span>
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
