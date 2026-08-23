'use client';
import Link from 'next/link';
import { Package, ArrowRight, Check } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface KitsData {
  count: number;
  avgCompletionPct: number;
  trashCount: number;
  assignedKitName: string | null;
  totalWeightKg: number;
  topKits: { id: string; name: string; weightKg: number; completionPct: number }[];
}

export function GearCardKits({ data, className }: { data: KitsData; className?: string }) {
  const kits = data.topKits && data.topKits.length > 0 ? data.topKits : [
    { id: '1', name: data.assignedKitName || 'Trek Jura 2 jours', weightKg: 12.4, completionPct: data.avgCompletionPct || 100 },
    { id: '2', name: 'Bivouac Été Express', weightKg: 7.8, completionPct: 85 },
  ];

  return (
    <GlassCard as="article" interactive ariaLabelledBy="kits-title" className={className}>
      <div className="p-3.5 sm:p-5 flex flex-col justify-between h-full gap-3 sm:gap-4">
        {/* Header with Title & Large Metric */}
        <div className="flex items-start justify-between pr-8 md:pr-10">
          <div className="space-y-0.5 sm:space-y-1">
            <Eyebrow>Configuration</Eyebrow>
            <h2 id="kits-title" className="text-[15px] sm:text-[20px] font-display font-bold text-[#17402C] leading-tight">
              Mes kits
            </h2>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[24px] sm:text-[36px] font-mono font-bold leading-none text-[#17402C]">
              {data.count}
            </span>
            <span className="block text-[9px] sm:text-[10.5px] font-semibold uppercase tracking-wider text-[#5A7064]">
              {data.count > 1 ? 'actifs' : 'actif'}
            </span>
          </div>
        </div>

        {/* Top Kits Preview Cards */}
        <div className="flex flex-col gap-1.5">
          {kits.slice(0, 2).map((k) => (
            <div key={k.id} className="glass-sub-card px-2.5 py-1.5 flex items-center justify-between gap-1.5 text-[11px] sm:text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <div className="w-5 h-5 rounded bg-white/[0.08] border border-white/20 flex items-center justify-center text-[#17402C] flex-shrink-0">
                  <Package size={10} />
                </div>
                <span className="font-semibold text-[#17402C] truncate">{k.name}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-mono text-[#5A7064]">{k.weightKg}kg</span>
                {k.completionPct === 100 && (
                  <span className="glass-check-circle checked w-3.5 h-3.5 flex items-center justify-center">
                    <Check size={8} strokeWidth={3} />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-[#365233]">
            <span>Complétude moyenne</span>
            <span className="font-mono text-[#17402C]">{data.avgCompletionPct}%</span>
          </div>
          <ProgressBar value={data.avgCompletionPct} label="Complétude moyenne" tone="sage" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[10px] sm:text-xs text-[#5A7064] truncate">
            {data.totalWeightKg > 0 ? `${data.totalWeightKg} kg total` : 'Kits prêts'}
          </span>
          <Link href="/materiel/kits" className="glass-capsule-btn secondary text-[10px] sm:text-xs h-6.5 sm:h-7 px-2.5">
            <span>Ouvrir</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
