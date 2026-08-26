'use client';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface DispoData {
  unavailableCount: number;
  total: number;
  hasConflict: boolean;
  nextReturnLabel: string | null;
  availableCount?: number;
}

export function GearCardDispo({ data, className }: { data: DispoData; className?: string }) {
  const available = data.availableCount !== undefined ? data.availableCount : Math.max(0, data.total - data.unavailableCount);
  const availablePct = data.total > 0 ? Math.round((available / data.total) * 100) : 100;
  const tone = availablePct === 100 ? 'sage' : data.unavailableCount <= 2 ? 'warn' : 'danger';

  return (
    <GlassCard as="article" interactive ariaLabelledBy="dispo-title" className={className}>
      <div className="p-2.5 sm:p-5 flex flex-col justify-between h-full gap-1.5 sm:gap-4">
        {/* Header with Title & KPIs */}
        <div className="flex items-start justify-between pr-7 md:pr-10 gap-1.5">
          <div className="space-y-0.5 min-w-0">
            <Eyebrow>Parc & Prêts</Eyebrow>
            <h2 id="dispo-title" className="text-[13px] sm:text-[20px] font-display font-bold text-[#17402C] leading-tight truncate">
              Disponibilité
            </h2>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <div className="glass-sub-card px-1.5 py-0.5 flex items-center gap-0.5">
              <CheckCircle2 size={10} className="text-[#17402C]" />
              <span className="text-[11px] sm:text-[14px] font-mono font-bold text-[#17402C]">{available}</span>
            </div>
            <div className="glass-sub-card px-1.5 py-0.5 flex items-center gap-0.5">
              <Clock size={10} className="text-[#8C6418]" />
              <span className="text-[11px] sm:text-[14px] font-mono font-bold text-[#8C6418]">{data.unavailableCount}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-0.5 sm:space-y-1">
          <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold text-[#365233]">
            <span>Disponible</span>
            <span className="font-mono text-[#17402C]">{availablePct}%</span>
          </div>
          <ProgressBar value={availablePct} label="Équipement disponible" tone={tone} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-1 min-w-0">
            {data.hasConflict ? (
              <Badge tone="danger">
                <span className="flex items-center gap-0.5 text-[8.5px] sm:text-[9px]">
                  <AlertCircle size={9} />
                  <span>Conflit</span>
                </span>
              </Badge>
            ) : (
              <Badge tone="sage">
                <span className="flex items-center gap-0.5 text-[8.5px] sm:text-[9px]">
                  <CheckCircle2 size={9} />
                  <span>0 conflit</span>
                </span>
              </Badge>
            )}
            <span className="text-[9.5px] sm:text-xs text-[#5A7064] hidden sm:inline truncate">
              {data.nextReturnLabel ?? 'À jour'}
            </span>
          </div>

          <Link href="/materiel/disponibilite" className="glass-capsule-btn secondary text-[9.5px] sm:text-xs !h-6 sm:!h-7 !px-2 sm:!px-2.5 shrink-0">
            <span>Prêts</span>
            <ArrowRight size={10} />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
