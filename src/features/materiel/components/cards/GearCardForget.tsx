'use client';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface ForgetData {
  forgetRemaining: number;
  checkedItems: number;
  totalItems: number;
  nextDepartLabel: string | null;
  sampleItems?: { name: string; is_checked: boolean }[];
}

export function GearCardForget({ data, className }: { data: ForgetData; className?: string }) {
  const pct = data.totalItems > 0 ? Math.round((data.checkedItems / data.totalItems) * 100) : 100;
  const items = data.sampleItems && data.sampleItems.length > 0 ? data.sampleItems : [
    { name: 'Tente & Bivouac', is_checked: true },
    { name: 'Gourde filtrante 1L', is_checked: false },
    { name: 'Trousse de secours', is_checked: false },
  ];

  return (
    <GlassCard as="article" interactive ariaLabelledBy="forget-title" className={className}>
      <div className="p-2.5 sm:p-5 flex flex-col justify-between h-full gap-1.5 sm:gap-4">
        {/* Header with Title & Large Metric */}
        <div className="flex items-start justify-between pr-7 md:pr-10 gap-1.5">
          <div className="space-y-0.5 min-w-0 flex-1">
            <Eyebrow>Checklist</Eyebrow>
            <h2 id="forget-title" className="text-[12px] sm:text-[18px] font-display font-bold text-[#17402C] leading-tight truncate">
              À ne pas oublier
            </h2>
          </div>
          <div className="text-right shrink-0 pl-1">
            <span className={`text-[17px] sm:text-[32px] font-mono font-bold leading-none ${data.forgetRemaining === 0 ? 'text-[#17402C]' : 'text-[#A8443A]'}`}>
              {data.forgetRemaining}
            </span>
            <span className="block text-[8px] sm:text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] whitespace-nowrap">
              {data.forgetRemaining === 0 ? 'Prêt' : 'restant(s)'}
            </span>
          </div>
        </div>

        {/* Mini Checklist List */}
        <div className="glass-sub-card p-1.5 sm:p-2.5 flex flex-col gap-1 sm:gap-2">
          {items.slice(0, 2).map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 px-0.5 py-0.2 rounded-lg text-[10px] sm:text-xs font-medium text-[#17402C]">
              <span className={`glass-check-circle ${item.is_checked ? 'checked' : ''} !w-3.5 !h-3.5`}>
                {item.is_checked && <Check size={8} strokeWidth={3} />}
              </span>
              <span className={`flex-1 truncate ${item.is_checked ? 'line-through opacity-60 text-[#365233]' : ''}`}>
                {item.name}
              </span>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="space-y-0.5 sm:space-y-1">
          <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold text-[#365233]">
            <span>Complétude</span>
            <span className="font-mono text-[#17402C]">{pct}%</span>
          </div>
          <ProgressBar value={pct} label="Checklist de départ" tone={pct === 100 ? 'sage' : 'warn'} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[9.5px] sm:text-xs text-[#5A7064] truncate max-w-[80px] sm:max-w-[140px]">
            {data.nextDepartLabel ?? 'Aucun départ'}
          </span>
          <Link href="/materiel/forget" className="glass-capsule-btn secondary text-[9.5px] sm:text-xs !h-6 sm:!h-7 !px-2 sm:!px-2.5">
            <span>Voir</span>
            <ArrowRight size={10} />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
