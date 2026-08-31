'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, Backpack } from 'lucide-react';
import { ArrowRightIcon as ArrowRightAnimated } from '@/components/icons/arrow-right';
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
  const router = useRouter();
  const href = data.id !== 'none' ? `/materiel/depart/${data.id}` : '/materiel/depart/none';
  const go = () => router.push(href);

  return (
    <GlassCard
      as="article"
      interactive
      tone="sage"
      ariaLabelledBy="depart-title"
      className={className}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      }}
    >
      <div className="p-3 sm:p-5 flex flex-col justify-between h-full gap-2 sm:gap-4">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2 pr-8 md:pr-12">
          <div className="space-y-0.5">
            <Eyebrow>Prochain départ</Eyebrow>
            <h2 id="depart-title" className="text-[18px] sm:text-[32px] leading-tight font-display font-bold tracking-tight text-[#17402C]">
              {data.destination}
            </h2>
          </div>
          <Badge tone={data.status === 'ok' ? 'sage' : data.status === 'warning' ? 'warn' : 'danger'}>
            <span className="text-[9.5px] sm:text-xs font-bold flex items-center gap-1">
              {data.status === 'ok' ? (
                '✓ Prêt'
              ) : data.status === 'warning' ? (
                '⚠️ À finaliser'
              ) : (
                <span className="text-red-700 font-extrabold flex items-center gap-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600 animate-ping mr-0.5" />
                  Incomplet (0%)
                </span>
              )}
            </span>
          </Badge>
        </div>

        {/* Live Countdown in Frosted Capsule */}
        <div className="glass-sub-card p-2 sm:p-3.5 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/40 shadow-2xs border border-white/60 flex items-center justify-center text-[#17402C] shrink-0">
              <Clock size={15} className="sm:hidden" />
              <Clock size={18} className="hidden sm:block" />
            </div>
            <div>
              <span className="text-[9.5px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#5A7064]">Départ dans</span>
              <div className="text-[17px] sm:text-[28px] font-mono font-bold leading-tight text-[#17402C]">
                <CountdownLive target={data.startsAt} />
              </div>
            </div>
          </div>
          {data.totalWeightKg !== undefined && data.totalWeightKg > 0 && (
            <div className="hidden sm:flex flex-col items-end border-l border-white/30 pl-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A7064]">Poids du kit</span>
              <div className="flex items-center gap-1.5 text-[18px] font-mono font-bold text-[#17402C]">
                <Backpack size={16} />
                <span>{data.totalWeightKg} kg</span>
              </div>
            </div>
          )}
        </div>

        {/* Progress & Quick Metrics */}
        <div className="space-y-1 sm:space-y-2">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-[#365233]">
            <span>Progression du pack</span>
            <span className="font-mono text-[#17402C]">{data.readinessPct}%</span>
          </div>
          <ProgressBar
            value={data.readinessPct}
            label="Préparation du départ"
            tone={data.readinessPct >= 80 ? 'sage' : data.readinessPct >= 40 ? 'warn' : 'danger'}
          />
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-0.5 sm:pt-1">
          <span className="text-[10px] sm:text-xs text-[#5A7064] truncate max-w-[130px] sm:max-w-none">
            {data.itemsCount ? `${data.itemsCount} article(s)` : 'Cockpit prêt'}
          </span>
          {data.id !== 'none' ? (
            <Link
              href={`/materiel/depart/${data.id}`}
              onClick={(e) => e.stopPropagation()}
              className="glass-capsule-btn primary !h-7 sm:!h-9 !text-[11px] sm:!text-xs !px-3 sm:!px-4"
            >
              <span>Cockpit</span>
              <ArrowRightAnimated size={13} />
            </Link>
          ) : (
            <Link
              href="/materiel/depart/none"
              onClick={(e) => e.stopPropagation()}
              className="glass-capsule-btn primary !h-7 sm:!h-9 !text-[11px] sm:!text-xs !px-3 sm:!px-4"
            >
              <span>Préparer</span>
              <ArrowRightAnimated size={13} />
            </Link>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
