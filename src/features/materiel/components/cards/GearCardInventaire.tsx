'use client';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface InventaireData { count: number; goodConditionPct: number; orderedCount: number; lastAddedLabel: string | null }

export function GearCardInventaire({ data, className }: { data: InventaireData; className?: string }) {
  return (
    <GlassCard as="article" interactive ariaLabelledBy="inv-title" className={className}>
      <div className="p-4 flex flex-col gap-3">
        <Eyebrow>Inventaire & catalogue</Eyebrow>
        <h2 id="inv-title" className="sr-only">Inventaire</h2>
        <Metric value={data.count} />
        <ProgressBar value={data.goodConditionPct} label="Objets en bon état" tone={data.goodConditionPct >= 80 ? 'sage' : 'warn'} />
        {data.orderedCount > 0 && <Badge tone="info">{data.orderedCount} en commande</Badge>}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[color:var(--label-quaternary)]">{data.lastAddedLabel ?? 'Inventaire vide'}</span>
          <Link href="/materiel/inventaire" className="glass interactive h-9 px-4 rounded-full flex items-center text-sm font-medium text-sage-600">
            Ajouter →
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
