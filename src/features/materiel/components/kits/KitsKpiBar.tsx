'use client';
import Icon from '@/components/ui/Icon';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';

export interface KitsKpi {
  active: number;
  totalWeightG: number;
}

/** W-K-1 KitsKpiBar — Fusion Kits actifs et Poids total en une seule carte épurée. */
export function KitsKpiBar({ kpi }: { kpi: KitsKpi }) {
  return (
    <section aria-label="Indicateurs clés">
      <GlassCard tone="sage" className="p-3.5 sm:p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--lkv-primary)]/10 border border-[var(--lkv-primary)]/20 flex items-center justify-center text-[var(--lkv-primary)]">
            <Icon name="package" size={20} />
          </div>
          <div>
            <Eyebrow>Matériel préparé</Eyebrow>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-display font-bold text-lg sm:text-xl text-[var(--lkv-primary)]">
                {kpi.active} {kpi.active > 1 ? 'kits prêts' : 'kit prêt'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pl-4 border-l border-white/20 text-right">
          <div>
            <span className="text-[10px] uppercase font-bold text-[var(--lkv-text-muted)] block">
              Poids cumulé
            </span>
            <span className="font-mono font-bold text-base sm:text-lg text-[var(--lkv-primary)]">
              {(kpi.totalWeightG / 1000).toFixed(1)} kg
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[var(--lkv-text-muted)] shrink-0">
            <Icon name="scale" size={16} />
          </div>
        </div>
      </GlassCard>
    </section>
  );
}
