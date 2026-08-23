'use client';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Package, Scale } from 'lucide-react';

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
          <div className="w-10 h-10 rounded-2xl bg-[#17402C]/10 border border-[#17402C]/20 flex items-center justify-center text-[#17402C]">
            <Package size={20} />
          </div>
          <div>
            <Eyebrow>Matériel préparé</Eyebrow>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-display font-bold text-lg sm:text-xl text-[#17402C]">
                {kpi.active} {kpi.active > 1 ? 'kits prêts' : 'kit prêt'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pl-4 border-l border-white/20 text-right">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#5A7064] block">Poids cumulé</span>
            <span className="font-mono font-bold text-base sm:text-lg text-[#17402C]">
              {(kpi.totalWeightG / 1000).toFixed(1)} kg
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#5A7064] shrink-0">
            <Scale size={16} />
          </div>
        </div>
      </GlassCard>
    </section>
  );
}
