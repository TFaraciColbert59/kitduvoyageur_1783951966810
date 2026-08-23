'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KitsKpiBar, type KitsKpi } from './KitsKpiBar';
import { KitsGrid } from './KitsGrid';
import { KitBuilder } from './KitBuilder';
import { TemplateStore } from './TemplateStore';
import { KitProductSuggestions } from './KitProductSuggestions';
import type { KitListItem } from '@/features/materiel/services/getKits';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
import type { PublicKit } from '@/features/materiel/services/getPublicKits';
import type { ProductSuggestion } from '@/features/materiel/services/getProductSuggestions';

interface Props {
  kpi: KitsKpi;
  kits: KitListItem[];
  inventory: InventoryItem[];
  publicKits: PublicKit[];
  products: ProductSuggestion[];
}

const TABS = [
  { id: 'kits', label: 'Mon Kit' },
  { id: 'builder', label: 'Assembleur & IA' },
  { id: 'store', label: 'Modèles & Boutique' },
] as const;

type TabId = typeof TABS[number]['id'];

export function KitsMobileCockpit({
  kpi,
  kits,
  inventory,
  publicKits,
  products,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('kits');

  return (
    <>
      {/* Mobile View with Animated Sliding Pill Selector (md:hidden) */}
      <div className="md:hidden flex flex-col gap-3.5">
        {/* Animated Segmented Selector */}
        <div className="p-1 rounded-full bg-white/[0.08] border border-white/25 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.4)] flex items-center justify-between gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="relative flex-1 py-1.5 px-2 rounded-full text-[11px] font-bold tracking-tight text-center transition-colors select-none"
              >
                {isActive && (
                  <motion.span
                    layoutId="kits-mobile-tab-pill"
                    className="absolute inset-0 rounded-full bg-[#17402C]/12 border border-[#17402C]/20 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.8),0_2px_8px_rgba(23,64,44,0.08)]"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <span className={`relative z-10 ${isActive ? 'text-[#17402C] font-extrabold' : 'text-[#365233]/70'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content with Smooth Fade/Scale Transition */}
        <AnimatePresence mode="wait">
          {activeTab === 'kits' && (
            <motion.div
              key="tab-kits"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-3.5"
            >
              <KitsKpiBar kpi={kpi} />
              <KitsGrid kits={kits} />
            </motion.div>
          )}

          {activeTab === 'builder' && (
            <motion.div
              key="tab-builder"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-3.5"
            >
              <KitBuilder inventory={inventory} products={products} kits={kits} initialKitItems={[]} />
            </motion.div>
          )}

          {activeTab === 'store' && (
            <motion.div
              key="tab-store"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-3.5"
            >
              <TemplateStore kits={publicKits} />
              <KitProductSuggestions products={products} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop View (hidden md:grid) */}
      <div className="hidden md:grid grid-cols-12 gap-[var(--grid-gap)]">
        <div className="col-span-12"><KitsKpiBar kpi={kpi} /></div>
        <div className="col-span-12"><KitsGrid kits={kits} /></div>
        <div className="col-span-12" aria-label="Assembleur de kit">
          <KitBuilder inventory={inventory} products={products} kits={kits} initialKitItems={[]} />
        </div>
        <div className="col-span-12"><TemplateStore kits={publicKits} /></div>
        <div className="col-span-12"><KitProductSuggestions products={products} /></div>
      </div>
    </>
  );
}
