'use client';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CountdownLive } from './CountdownLive';

interface DepartData {
  id: string; destination: string; startsAt: string; readinessPct: number; status: 'ok' | 'warning' | 'critical';
}

export function GearCardDepart({ data, className }: { data: DepartData; className?: string }) {
  return (
    <GlassCard as="article" interactive tone="sage" ariaLabelledBy="depart-title" className={className}>
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <h2 id="depart-title" className="text-[32px] leading-[38px] font-display font-semibold tracking-tight text-[color:var(--label)]">
            {data.destination}
          </h2>
          <Badge tone={data.status === 'ok' ? 'sage' : data.status === 'warning' ? 'warn' : 'danger'}>
            {data.status === 'ok' ? 'Prêt' : data.status === 'warning' ? 'À finaliser' : 'Incomplet'}
          </Badge>
        </div>
        <Eyebrow>Prochain départ</Eyebrow>
        <Metric value={<CountdownLive target={data.startsAt} />} size="lg" />
        <ProgressBar value={data.readinessPct} label="Préparation du départ" tone={data.readinessPct >= 80 ? 'sage' : data.readinessPct >= 40 ? 'warn' : 'danger'} />
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[color:var(--label-tertiary)]">{data.readinessPct}% préparé</span>
          {data.id !== 'none' ? (
            <Link
              href={`/materiel/depart/${data.id}`}
              className="glass interactive h-9 px-4 rounded-full flex items-center text-sm font-medium text-sage-600"
            >
              Ouvrir le cockpit →
            </Link>
          ) : (
            <Link
              href="/materiel/kits"
              className="glass interactive h-9 px-4 rounded-full flex items-center text-sm font-medium text-sage-600"
            >
              Préparer →
            </Link>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
