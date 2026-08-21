'use client';
import Link from 'next/link';
import { Compass, Clock, ArrowRight, Backpack } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CountdownLive } from './CountdownLive';

interface DepartData {
  id: string;
  destination: string;
  startsAt: string;
  readinessPct: number;
  status: 'ok' | 'warning' | 'critical';
  totalWeightKg?: number;
  itemsCount?: number;
}

export function GearCardDepart({ data, className }: { data: DepartData; className?: string }) {
  return (
    <GlassCard as="article" interactive tone="sage" ariaLabelledBy="depart-title" className={className}>
      <div className="p-5 flex flex-col justify-between h-full gap-4">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Compass size={14} className="text-[#17402C]" />
              <Eyebrow>Prochain départ</Eyebrow>
            </div>
            <h2 id="depart-title" className="text-[28px] sm:text-[32px] leading-tight font-display font-bold tracking-tight text-[#0B1F17]">
              {data.destination}
            </h2>
          </div>
          <Badge tone={data.status === 'ok' ? 'sage' : data.status === 'warning' ? 'warn' : 'danger'}>
            {data.status === 'ok' ? 'Prêt' : data.status === 'warning' ? 'À finaliser' : 'Incomplet'}
          </Badge>
        </div>

        {/* Live Countdown in Frosted Capsule */}
        <div className="glass-sub-card p-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/70 shadow-sm border border-white flex items-center justify-center text-[#17402C]">
              <Clock size={18} />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A7064]">Compte à rebours</span>
              <div className="text-[24px] sm:text-[28px] font-mono font-bold leading-tight text-[#0B1F17]">
                <CountdownLive target={data.startsAt} />
              </div>
            </div>
          </div>
          {data.totalWeightKg !== undefined && data.totalWeightKg > 0 && (
            <div className="hidden sm:flex flex-col items-end border-l border-white/60 pl-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A7064]">Poids du kit</span>
              <div className="flex items-center gap-1.5 text-[18px] font-mono font-bold text-[#17402C]">
                <Backpack size={16} />
                <span>{data.totalWeightKg} kg</span>
              </div>
            </div>
          )}
        </div>

        {/* Progress & Quick Metrics */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#2D4A3A]">
            <span>Progression du pack</span>
            <span className="font-mono">{data.readinessPct}% préparé</span>
          </div>
          <ProgressBar
            value={data.readinessPct}
            label="Préparation du départ"
            tone={data.readinessPct >= 80 ? 'sage' : data.readinessPct >= 40 ? 'warn' : 'danger'}
          />
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[#5A7064]">
            {data.itemsCount ? `${data.itemsCount} article(s) assigné(s)` : 'Cockpit de préparation prêt'}
          </span>
          {data.id !== 'none' ? (
            <Link
              href={`/materiel/depart/${data.id}`}
              className="glass-capsule-btn primary"
            >
              <span>Ouvrir le cockpit</span>
              <ArrowRight size={15} />
            </Link>
          ) : (
            <Link
              href="/materiel/kits"
              className="glass-capsule-btn primary"
            >
              <span>Préparer</span>
              <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
