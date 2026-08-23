'use client';

import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { ShoppingBag, Check, Clock } from 'lucide-react';
import type { KitListItem } from '@/features/materiel/services/getKits';

interface Props {
  kit: KitListItem | null;
}

/** Widget 5 — Composition du Kit Actif avec entrée staggerée des articles et état vide amélioré. */
export function KitsActiveCockpitCard({ kit }: Props) {
  const items = kit?.items ?? [];
  const weightKg = kit ? (kit.total_weight_g / 1000).toFixed(1) : '0.0';

  return (
    <GlassCard as="article" tone="sage" ariaLabelledBy="active-kit-title" className="p-3 md:p-4 flex flex-col justify-between h-full min-h-0">
      <div className="flex items-center justify-between gap-1.5 pr-12 md:pr-14 shrink-0">
        <p className="truncate text-[10px] md:text-sm font-semibold text-[#17402C] font-body">
          Mon Kit Actif
        </p>
        <span
          className="shrink-0 px-1.5 py-0.5 rounded-full bg-[#17402C]/10 text-[#17402C] text-[9px] md:text-[10px] font-bold"
          aria-label={`${items.length} articles dans ce kit`}
        >
          {items.length} art.
        </span>
      </div>

      <h3
        id="active-kit-title"
        className="font-display font-bold text-[#17402C] text-[13px] md:text-[16px] leading-tight truncate shrink-0 mt-0.5"
      >
        {kit?.name ?? 'Mon Kit'}
      </h3>

      {/* Liste des équipements avec état vide amélioré */}
      <div
        className="my-1.5 flex-1 min-h-[90px] max-h-[140px] md:max-h-[160px] overflow-y-auto no-scrollbar flex flex-col gap-1"
        role="list"
        aria-label="Articles du kit actif"
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-5">
            <span className="text-xl opacity-30" aria-hidden="true">🎒</span>
            <p className="text-[10px] text-[#5A7064] font-medium">Kit vide</p>
            <p className="text-[8.5px] text-[#5A7064]/70 text-center leading-relaxed">
              Utilisez l'Assembleur ci-dessus<br />pour ajouter des articles.
            </p>
          </div>
        ) : (
          items.map((item, idx) => {
            const isUnowned = !item.product_ownership_id;
            return (
              <motion.div
                key={`${item.name}-${idx}`}
                role="listitem"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
                className={`p-1.5 rounded-lg flex items-center justify-between gap-1.5 text-[11px] transition-all ${
                  isUnowned
                    ? 'bg-white/[0.04] border border-dashed border-white/30 opacity-70'
                    : 'glass-sub-card'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ${
                      isUnowned
                        ? 'border-white/30 bg-white/5 text-[#5A7064]'
                        : 'bg-[#17402C]/10 border-[#17402C]/20 text-[#17402C]'
                    }`}
                    aria-hidden="true"
                  >
                    {isUnowned ? <Clock size={9} /> : <Check size={10} strokeWidth={3} />}
                  </div>
                  <span
                    className={`truncate ${isUnowned ? 'text-[#5A7064] italic' : 'font-semibold text-[#17402C]'}`}
                    aria-label={`${item.name}${isUnowned ? ' — en commande' : ' — prêt'}`}
                  >
                    {item.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isUnowned ? (
                    <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#17402C]/10 text-[#17402C] flex items-center gap-0.5">
                      <ShoppingBag size={8} aria-hidden="true" />
                      En commande
                    </span>
                  ) : (
                    <span className="text-[9px] text-[#5A7064] font-mono">
                      {item.weight_g ? `${item.weight_g}g` : '—'}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Capsule inférieure Poids Total */}
      <div className="glass-sub-card shrink-0 px-2.5 py-1.5 flex items-center justify-between text-[11px]">
        <span className="text-[9px] md:text-[10px] font-semibold uppercase tracking-wider text-[#365233]">
          Poids total
        </span>
        <motion.span
          key={weightKg}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="font-mono font-bold text-[#17402C]"
          aria-label={`Poids total : ${weightKg} kg`}
        >
          {weightKg} kg
        </motion.span>
      </div>
    </GlassCard>
  );
}
