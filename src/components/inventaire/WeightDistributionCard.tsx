'use client';

import React from 'react';
import { GearItemData } from '@/lib/mock/mon-materiel-marceline';

interface WeightDistributionCardProps {
  items: GearItemData[];
}

const CATEGORY_COLORS: Record<string, { label: string; color: string }> = {
  couchage: { label: 'Couchage & abri', color: 'bg-[#132219]' },
  vêtement: { label: 'Vêtements', color: 'bg-[#2D5A3D]' },
  portage: { label: 'Portage & sacs', color: 'bg-[#4A7C59]' },
  cuisine: { label: 'Cuisine & eau', color: 'bg-[#6B9E78]' },
  navigation: { label: 'Navigation & élec', color: 'bg-[#A3C9A8]' },
  sécurité: { label: 'Sécurité', color: 'bg-[#D4A359]' },
  autre: { label: 'Autre matériel', color: 'bg-stone-400' },
};

export default function WeightDistributionCard({ items }: WeightDistributionCardProps) {
  const totalWeightG = items.reduce((sum, item) => sum + (item.weight_g || 0) * (item.quantity || 1), 0) || 1;

  const categoryWeights: Record<string, number> = {};
  items.forEach((item) => {
    const cat = item.category || 'autre';
    categoryWeights[cat] = (categoryWeights[cat] || 0) + (item.weight_g || 0) * (item.quantity || 1);
  });

  const categoriesList = Object.entries(categoryWeights)
    .map(([cat, weightG]) => ({
      cat,
      label: CATEGORY_COLORS[cat]?.label || cat,
      color: CATEGORY_COLORS[cat]?.color || 'bg-emerald-600',
      weightKg: (weightG / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      percentage: Math.round((weightG / totalWeightG) * 100),
    }))
    .sort((a, b) => b.percentage - a.percentage);

  return (
    <div className="bg-[#132219] text-white rounded-[0.75rem] p-6 shadow-xl border border-white/10 space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-display font-800 text-lg text-white">Répartition <span className="font-serif italic font-normal text-emerald-200">du poids</span></h4>
          <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest block mt-0.5">SUR LA TOTALITÉ · PAR CATÉGORIE</span>
        </div>
        <span className="font-mono font-bold text-xs text-emerald-400 bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
          {(totalWeightG / 1000).toFixed(1)} kg
        </span>
      </div>

      {/* Multi-segmented Progress Bar */}
      <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden flex p-0.5 border border-white/10">
        {categoriesList.map((c) => (
          <div
            key={c.cat}
            className={`h-full ${c.color} first:rounded-l-full last:rounded-r-full transition-all duration-500`}
            style={{ width: `${c.percentage}%` }}
            title={`${c.label}: ${c.percentage}%`}
          />
        ))}
      </div>

      {/* Breakdown Rows */}
      <div className="space-y-2.5 pt-2">
        {categoriesList.map((c) => (
          <div key={c.cat} className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full ${c.color} shrink-0`} />
              <span className="text-white/80 font-semibold truncate">{c.label}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-white font-bold">{c.weightKg} kg</span>
              <span className="text-white/50 w-8 text-right font-normal">{c.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
