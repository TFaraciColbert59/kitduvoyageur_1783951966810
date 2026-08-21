'use client';
import Link from 'next/link';
import { ListChecks, Check, ArrowRight } from 'lucide-react';
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
      <div className="p-5 flex flex-col justify-between h-full gap-4">
        {/* Header with Title & Large Metric */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ListChecks size={14} className="text-[#17402C]" />
              <Eyebrow>Checklist de départ</Eyebrow>
            </div>
            <h2 id="forget-title" className="text-[20px] font-display font-bold text-[#0B1F17]">
              À ne pas oublier
            </h2>
          </div>
          <div className="text-right">
            <span className={`text-[36px] font-mono font-bold leading-none ${data.forgetRemaining === 0 ? 'text-[#17402C]' : 'text-[#A8443A]'}`}>
              {data.forgetRemaining}
            </span>
            <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-[#5A7064]">
              {data.forgetRemaining === 0 ? 'Tout prêt' : 'restant(s)'}
            </span>
          </div>
        </div>

        {/* Mini Checklist List (iOS 26 Reminders Style) */}
        <div className="glass-sub-card p-2.5 flex flex-col gap-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2.5 px-1.5 py-1 rounded-lg text-xs font-medium text-[#0B1F17]">
              <span className={`glass-check-circle ${item.is_checked ? 'checked' : ''}`}>
                {item.is_checked && <Check size={11} strokeWidth={3} />}
              </span>
              <span className={`flex-1 truncate ${item.is_checked ? 'line-through opacity-60' : ''}`}>
                {item.name}
              </span>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-[#2D4A3A]">
            <span>Complétude</span>
            <span className="font-mono">{pct}%</span>
          </div>
          <ProgressBar value={pct} label="Checklist de départ" tone={pct === 100 ? 'sage' : 'warn'} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[#5A7064] truncate max-w-[130px]">
            {data.nextDepartLabel ?? 'Aucun départ prévu'}
          </span>
          <Link href="/materiel/forget" className="glass-capsule-btn secondary">
            <span>Voir tout</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
