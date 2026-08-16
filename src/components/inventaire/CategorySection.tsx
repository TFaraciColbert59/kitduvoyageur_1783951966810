'use client';

import React from 'react';
import GearCard from './GearCard';
import { GearItemData } from '@/lib/mock/mon-materiel-marceline';

interface CategorySectionProps {
  title: string;
  categoryKey: string;
  items: GearItemData[];
  recommendationTag?: string;
  viewMode?: 'grid' | 'list';
  onToggleFavorite: (id: string) => void;
  onEdit: (item: GearItemData) => void;
  onDelete: (id: string) => void;
  onLoan?: (item: GearItemData) => void;
  onAddCategoryItem?: () => void;
}

export default function CategorySection({
  title,
  items,
  recommendationTag,
  viewMode = 'grid',
  onToggleFavorite,
  onEdit,
  onDelete,
  onLoan,
  onAddCategoryItem,
}: CategorySectionProps) {
  if (items.length === 0) return null;

  const totalWeightG = items.reduce((sum, item) => sum + ((item.weight_g || item.weight * 1000) * (item.quantity || 1)), 0);
  const totalWeightKg = (totalWeightG / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const avgWeightG = Math.round(totalWeightG / items.length);

  return (
    <div className="space-y-4 mb-10 font-sans">
      {/* Category Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1C2620]/10 pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="font-display font-900 text-xl sm:text-2xl text-[#132219]">
            {title}
          </h3>
          <span className="text-xs font-mono text-[#132219]/60 font-semibold bg-[#F5F3ED] px-3 py-1 rounded-full border border-[#E8E4D8]">
            {items.length} article{items.length > 1 ? 's' : ''} · {totalWeightKg} kg
          </span>
        </div>

        {/* Sub-tag / Recommendation */}
        <div className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-[#132219]/60">
          {recommendationTag ? (
            <span className="text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              {recommendationTag}
            </span>
          ) : (
            <span>POIDS MOYEN : {avgWeightG} G</span>
          )}
        </div>
      </div>

      {/* Cards Display Grid / List */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5' : 'space-y-3'}>
        {items.map((item) => (
          <GearCard
            key={item.id}
            item={item}
            viewMode={viewMode}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDelete={onDelete}
            onLoan={onLoan}
          />
        ))}

        {/* Optional empty CTA Card for category */}
        {onAddCategoryItem && viewMode === 'grid' && (
          <button
            onClick={onAddCategoryItem}
            className="border-2 border-dashed border-[#E8E4D8] hover:border-[#132219]/40 rounded-[0.75rem] p-6 min-h-[220px] flex flex-col items-center justify-center text-center gap-3 transition-colors bg-[#FAF8F5]/50 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-[#132219] text-white flex items-center justify-center text-xl font-bold group-hover:scale-110 transition-transform shadow-md">
              +
            </div>
            <div>
              <span className="font-extrabold text-sm text-[#132219] block">Ajouter un équipement</span>
              <span className="text-xs text-[#132219]/50 block mt-0.5">dans {title}</span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
