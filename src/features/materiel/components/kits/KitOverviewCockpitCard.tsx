'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Compass, Calendar, ShieldCheck } from 'lucide-react';
import type { KitListItem } from '@/features/materiel/services/getKits';

interface Props {
  kit: KitListItem | null;
}

/** Widget 2 — Aperçu Synthétique du Kit Actif (Top-Middle Slot). */
export function KitOverviewCockpitCard({ kit }: Props) {
  const name = kit?.name ?? 'Aucun kit actif';
  const weightKg = kit ? (kit.total_weight_g / 1000).toFixed(1) : '0.0';
  const season = kit?.season ? kit.season.replace('_', ' ') : 'Toute saison';

  return (
    <GlassCard as="article" tone="sage" ariaLabelledBy="overview-title" className="p-3 md:p-4 flex flex-col justify-between h-full min-h-0">
      <div className="flex items-center gap-1.5 pr-12 md:pr-14 shrink-0">
        <p className="truncate text-[10px] md:text-sm font-semibold text-[#17402C] font-body">
          Kit Actif · Synthèse
        </p>
      </div>

      <div className="my-auto flex flex-col gap-1.5 min-h-0">
        <h3 id="overview-title" className="font-display font-bold text-[#17402C] text-[14px] md:text-[18px] leading-tight truncate">
          {name}
        </h3>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge tone="sage">{season}</Badge>
          <Badge tone="stone">{kit?.items?.length ?? 0} article(s)</Badge>
        </div>
      </div>

      <div className="glass-sub-card p-2 rounded-xl flex items-center justify-between gap-2 text-[11px] font-mono shrink-0">
        <span className="text-[#365233] font-semibold">Poids du kit</span>
        <span className="font-bold text-[#17402C]">{weightKg} kg</span>
      </div>
    </GlassCard>
  );
}
