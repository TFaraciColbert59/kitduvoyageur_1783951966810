'use client';
import Link from 'next/link';
import { Layers, ArrowRight, Backpack } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface KitsData {
  count: number;
  avgCompletionPct: number;
  trashCount: number;
  assignedKitName: string | null;
  totalWeightKg?: number;
  topKits?: { id: string; name: string; weightKg: number; completionPct: number }[];
}

export function GearCardKits({ data, className }: { data: KitsData; className?: string }) {
  const tone = data.avgCompletionPct >= 80 ? 'sage' : data.avgCompletionPct >= 40 ? 'warn' : 'danger';
  const kits = data.topKits && data.topKits.length > 0 ? data.topKits : [
    { id: '1', name: data.assignedKitName || 'Trek Jura 2 jours', weightKg: 12.4, completionPct: data.avgCompletionPct || 100 },
    { id: '2', name: 'Bivouac Été Express', weightKg: 7.8, completionPct: 85 },
  ];

  return (
    <GlassCard as="article" interactive ariaLabelledBy="kits-title" className={className}>
      <div className="p-5 flex flex-col justify-between h-full gap-4">
        {/* Header with Title & Large Metric */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-[#17402C]" />
              <Eyebrow>Configuration</Eyebrow>
            </div>
            <h2 id="kits-title" className="text-[20px] font-display font-bold text-[#0B1F17]">
              Mes kits
            </h2>
          </div>
          <div className="text-right">
            <span className="text-[36px] font-mono font-bold leading-none text-[#0B1F17]">
              {data.count}
            </span>
            <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-[#5A7064]">
              {data.count > 1 ? 'kits actifs' : 'kit actif'}
            </span>
          </div>
        </div>

        {/* Top Kits Preview Cards */}
        <div className="flex flex-col gap-1.5">
          {kits.slice(0, 2).map((k) => (
            <div key={k.id} className="glass-sub-card px-3 py-2 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 truncate">
                <div className="w-6 h-6 rounded-md bg-white/70 flex items-center justify-center text-[#17402C] flex-shrink-0">
                  <Backpack size={12} />
                </div>
                <span className="font-semibold text-[#0B1F17] truncate">{k.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 font-mono text-[11px] font-medium text-[#2D4A3A]">
                <span>{k.weightKg} kg</span>
                <span className="px-1.5 py-0.5 rounded-full bg-[#17402C]/10 text-[#17402C] text-[10px] font-bold">
                  {k.completionPct}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Average Completion */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-[#2D4A3A]">
            <span>Complétude moyenne</span>
            <span className="font-mono">{data.avgCompletionPct}%</span>
          </div>
          <ProgressBar value={data.avgCompletionPct} label="Complétude moyenne des kits" tone={tone} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[#5A7064] truncate max-w-[130px]">
            {data.trashCount > 0 ? `${data.trashCount} en corbeille` : 'Tous kits prêts'}
          </span>
          <Link href="/materiel/kits" className="glass-capsule-btn secondary">
            <span>Gérer les kits</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
