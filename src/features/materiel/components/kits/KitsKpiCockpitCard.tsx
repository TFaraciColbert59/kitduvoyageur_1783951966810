'use client';

import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { Package, Scale, ShoppingBag, Layers } from 'lucide-react';

interface Props {
  activeCount: number;
  totalWeightG: number;
  totalItemsCount: number;
  shopItemsCount: number;
}

/** Widget 1 — Indicateurs Clés (6 colonnes mobile / 8 colonnes desktop). */
export function KitsKpiCockpitCard({
  activeCount,
  totalWeightG,
  totalItemsCount,
  shopItemsCount,
}: Props) {
  const weightKg = (totalWeightG / 1000).toFixed(1);

  interface TileItem {
    label: string;
    value: string | number;
    unit: string;
    icon: React.ReactNode;
    muted?: boolean;
  }

  const TILES: TileItem[] = [
    { label: 'Prêts', value: activeCount, unit: 'nb', icon: <Package size={10} aria-hidden="true" /> },
    { label: 'Poids', value: weightKg, unit: 'kg', icon: <Scale size={10} aria-hidden="true" /> },
    { label: 'Articles', value: totalItemsCount, unit: 'art.', icon: <Layers size={10} aria-hidden="true" /> },
    {
      label: 'Commande',
      value: shopItemsCount,
      unit: 'art.',
      icon: <ShoppingBag size={10} aria-hidden="true" />,
      muted: shopItemsCount === 0,
    },
  ];

  return (
    <GlassCard as="article" tone="sage" ariaLabelledBy="kpi-title" className="p-2 sm:p-3 flex flex-col justify-between h-full min-h-0">
      <div className="flex items-center justify-between gap-1 pr-7 md:pr-14 shrink-0 mb-1">
        <p className="truncate text-[10px] md:text-xs font-semibold text-[#17402C] font-body">
          <span className="sm:hidden">Indicateurs</span>
          <span className="hidden sm:inline">Indicateurs · Kits</span>
        </p>
        <span className="text-[8px] sm:text-[9px] font-bold text-[#5A7064] uppercase hidden md:inline tracking-wide">
          Synthèse
        </span>
      </div>
      <h3 id="kpi-title" className="sr-only">Indicateurs clés du matériel</h3>

      {/* Métriques en grille 2x2 sur mobile et 4 colonnes sur desktop */}
      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-1 items-stretch min-h-0">
        {TILES.map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 + i * 0.04, ease: 'easeOut' }}
            className={`glass-sub-card p-1 sm:p-1.5 flex flex-col justify-center gap-0.2 ${t.muted ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[7.5px] sm:text-[8.5px] md:text-[9px] font-semibold uppercase tracking-wide text-[#365233] truncate">
                {t.label}
              </span>
              <span className="text-[#17402C]/60 shrink-0">{t.icon}</span>
            </div>
            <span className="flex items-baseline gap-0.5 mt-0.5">
              <span className="font-display font-bold text-[12px] sm:text-[14px] md:text-[16px] text-[#17402C] tabular-nums leading-none">
                {t.value}
              </span>
              <span className="text-[7.5px] sm:text-[8.5px] md:text-[9px] text-[#365233] font-medium">
                {t.unit}
              </span>
            </span>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  );
}
