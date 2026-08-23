'use client';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface AlertesData {
  count: number;
  criticalCount: number;
  warningCount: number;
  reliabilityScore: number;
  lastAlertLabel: string | null;
}

export function GearCardAlertes({ data, className }: { data: AlertesData; className?: string }) {
  const tone = data.criticalCount > 0 ? 'danger' : data.warningCount > 0 ? 'warn' : 'sage';

  return (
    <GlassCard
      as="article"
      interactive
      tone={data.criticalCount > 0 ? 'danger' : 'neutral'}
      ariaLabelledBy="alertes-title"
      className={className}
    >
      <div className="p-3.5 sm:p-5 flex flex-col justify-between h-full gap-3 sm:gap-4">
        {/* Header with Title & Large Metric */}
        <div className="flex items-start justify-between pr-8 md:pr-10">
          <div className="space-y-0.5 sm:space-y-1">
            <Eyebrow>Diagnostic</Eyebrow>
            <h2 id="alertes-title" className="text-[15px] sm:text-[20px] font-display font-bold text-[#17402C] leading-tight">
              Alertes
            </h2>
          </div>
          <div className="text-right shrink-0">
            <span className={`text-[24px] sm:text-[36px] font-mono font-bold leading-none ${data.count > 0 ? (data.criticalCount > 0 ? 'text-[#A8443A]' : 'text-[#8C6418]') : 'text-[#17402C]'}`}>
              {data.count}
            </span>
            <span className="block text-[9px] sm:text-[10.5px] font-semibold uppercase tracking-wider text-[#5A7064]">
              {data.count > 1 ? 'alertes' : data.count === 1 ? 'alerte' : 'sain'}
            </span>
          </div>
        </div>

        {/* Badges / Status Strip */}
        <div className="flex items-center gap-1.5 flex-wrap min-h-[26px]">
          {data.criticalCount > 0 && (
            <Badge tone="danger">
              <span className="flex items-center gap-1 text-[9px] sm:text-[10px]">
                <AlertTriangle size={10} />
                <span>{data.criticalCount} critique(s)</span>
              </span>
            </Badge>
          )}
          {data.warningCount > 0 && (
            <Badge tone="warn">
              <span className="text-[9px] sm:text-[10px]">{data.warningCount} avis</span>
            </Badge>
          )}
          {data.count === 0 && (
            <Badge tone="sage">
              <span className="flex items-center gap-1 text-[9px] sm:text-[10px]">
                <ShieldCheck size={10} />
                <span>100% OK</span>
              </span>
            </Badge>
          )}
        </div>

        {/* Reliability Score Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-[#365233]">
            <span>Fiabilité</span>
            <span className="font-mono text-[#17402C]">{data.reliabilityScore}%</span>
          </div>
          <ProgressBar value={data.reliabilityScore} label="Score de fiabilité" tone={tone} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[10px] sm:text-xs text-[#5A7064] truncate max-w-[100px] sm:max-w-[130px]">
            {data.lastAlertLabel ?? 'Vérifié'}
          </span>
          <Link href="/materiel/alertes" className="glass-capsule-btn secondary text-[10px] sm:text-xs h-6.5 sm:h-7 px-2.5">
            <span>Détail</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
