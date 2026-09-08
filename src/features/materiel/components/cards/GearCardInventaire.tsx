'use client';
import Link from 'next/link';
import { Plus, CheckCircle2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface InventaireData {
  count: number;
  goodConditionPct: number;
  orderedCount: number;
  lastAddedLabel: string | null;
  goodCount?: number;
}

export function GearCardInventaire({ data, className }: { data: InventaireData; className?: string }) {
  const goodItems = data.goodCount !== undefined ? data.goodCount : Math.round((data.goodConditionPct / 100) * data.count);

  return (
    <GlassCard as="article" interactive ariaLabelledBy="inv-title" className={className}>
      <div className="p-5 flex flex-col justify-between h-full gap-4">
        {/* Header with Title & Large Metric */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <Eyebrow>Catalogue personnel</Eyebrow>
            <h2 id="inv-title" className="text-[20px] font-display font-bold text-[var(--lkv-primary)]">
              Inventaire
            </h2>
          </div>
          <div className="text-right">
            <span className="text-[36px] font-mono font-bold leading-none text-[var(--lkv-primary)]">
              {data.count}
            </span>
            <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-[var(--lkv-text-muted)]">
              {data.count > 1 ? 'articles' : 'article'}
            </span>
          </div>
        </div>

        {/* Condition Split Cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="glass-sub-card p-2.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/25 flex items-center justify-center text-[var(--lkv-primary)] flex-shrink-0 shadow-inner">
              <CheckCircle2 size={15} />
            </div>
            <div className="truncate">
              <span className="block text-[10px] uppercase font-semibold text-[var(--lkv-text-muted)]">En bon état</span>
              <span className="text-[13px] font-mono font-bold text-[var(--lkv-primary)]">{goodItems}</span>
            </div>
          </div>
          <div className="glass-sub-card p-2.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/25 flex items-center justify-center text-[var(--lkv-text-muted)] flex-shrink-0 shadow-inner">
              <span className="text-[10px] font-bold font-mono">0</span>
            </div>
            <div className="truncate">
              <span className="block text-[10px] uppercase font-semibold text-[var(--lkv-text-muted)]">En commande</span>
              <span className="text-[13px] font-mono font-bold text-[var(--lkv-primary-soft)]">{data.orderedCount || 0}</span>
            </div>
          </div>
        </div>

        {/* Good Condition Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--lkv-primary-soft)]">
            <span>Santé de l&apos;inventaire</span>
            <span className="font-mono text-[var(--lkv-primary)]">{data.goodConditionPct}%</span>
          </div>
          <ProgressBar value={data.goodConditionPct} label="Objets en bon état" tone={data.goodConditionPct >= 80 ? 'sage' : 'warn'} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[var(--lkv-text-muted)] truncate max-w-[130px]">
            {data.lastAddedLabel ?? 'Inventaire opérationnel'}
          </span>
          <Link href="/hub/inventaire" className="glass-capsule-btn secondary">
            <Plus size={14} />
            <span>Ajouter</span>
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
