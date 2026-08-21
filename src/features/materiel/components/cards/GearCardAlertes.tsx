'use client';
import Link from 'next/link';
import { ShieldAlert, ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react';
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
      <div className="p-5 flex flex-col justify-between h-full gap-4">
        {/* Header with Title & Large Metric */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {data.count > 0 ? (
                <ShieldAlert size={14} className={data.criticalCount > 0 ? 'text-[#A8443A]' : 'text-[#8C6418]'} />
              ) : (
                <ShieldCheck size={14} className="text-[#17402C]" />
              )}
              <Eyebrow>Diagnostic</Eyebrow>
            </div>
            <h2 id="alertes-title" className="text-[20px] font-display font-bold text-[#0B1F17]">
              Alertes & fiabilité
            </h2>
          </div>
          <div className="text-right">
            <span className={`text-[36px] font-mono font-bold leading-none ${data.count > 0 ? (data.criticalCount > 0 ? 'text-[#A8443A]' : 'text-[#8C6418]') : 'text-[#17402C]'}`}>
              {data.count}
            </span>
            <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-[#5A7064]">
              {data.count > 1 ? 'alertes' : data.count === 1 ? 'alerte' : 'matériel sain'}
            </span>
          </div>
        </div>

        {/* Badges / Status Strip */}
        <div className="flex items-center gap-2 flex-wrap min-h-[32px]">
          {data.criticalCount > 0 && (
            <Badge tone="danger">
              <span className="flex items-center gap-1">
                <AlertTriangle size={11} />
                <span>{data.criticalCount} critique(s)</span>
              </span>
            </Badge>
          )}
          {data.warningCount > 0 && (
            <Badge tone="warn">
              <span>{data.warningCount} avertissement(s)</span>
            </Badge>
          )}
          {data.count === 0 && (
            <Badge tone="sage">
              <span className="flex items-center gap-1">
                <ShieldCheck size={11} />
                <span>100% opérationnel</span>
              </span>
            </Badge>
          )}
        </div>

        {/* Reliability Score Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-[#2D4A3A]">
            <span>Score de fiabilité</span>
            <span className="font-mono">{data.reliabilityScore}%</span>
          </div>
          <ProgressBar value={data.reliabilityScore} label="Score de fiabilité" tone={tone} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[#5A7064] truncate max-w-[130px]">
            {data.lastAlertLabel ?? 'Équipement vérifié'}
          </span>
          <Link href="/materiel/alertes" className="glass-capsule-btn secondary">
            <span>{data.count > 0 ? 'Voir détail' : 'Consulter'}</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
