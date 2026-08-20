'use client';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface KitsData { count: number; avgCompletionPct: number; trashCount: number; assignedKitName: string | null }

export function GearCardKits({ data, className }: { data: KitsData; className?: string }) {
  const tone = data.avgCompletionPct >= 80 ? 'sage' : data.avgCompletionPct >= 40 ? 'warn' : 'danger';
  return (
    <GlassCard as="article" interactive ariaLabelledBy="kits-title" className={className}>
      <div className="p-4 flex flex-col gap-3">
        <Eyebrow>Mes kits</Eyebrow>
        <h2 id="kits-title" className="sr-only">Mes kits</h2>
        <Metric value={data.count} />
        <ProgressBar value={data.avgCompletionPct} label="Complétude moyenne des kits" tone={tone} />
        {data.trashCount > 0 && <Badge tone="stone">{data.trashCount} en corbeille</Badge>}
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-[color:var(--label-tertiary)]">{data.assignedKitName ?? 'Aucun kit assigné'}</span>
          <Link href="/materiel/kits" className="text-sm font-medium text-sage-600">Gérer les kits →</Link>
        </div>
      </div>
    </GlassCard>
  );
}
