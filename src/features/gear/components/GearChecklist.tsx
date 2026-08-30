'use client';

import React from 'react';
import { GearItem, GearCategory, GearStatus } from '../types/gear.types';

interface GearChecklistProps {
  items: GearItem[];
  categoryFilter: GearCategory | 'all';
  statusFilter: GearStatus | 'all';
  onSetCategoryFilter: (cat: GearCategory | 'all') => void;
  onSetStatusFilter: (status: GearStatus | 'all') => void;
  onSetItemStatus: (id: string, status: GearStatus) => void;
  onToggleItemWorn: (id: string) => void;
  onRemoveItem: (id: string) => void;
}

const CATEGORIES: { key: GearCategory | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: 'Tout', icon: '🎒' },
  { key: 'shelter', label: 'Abri', icon: '⛺' },
  { key: 'sleep', label: 'Couchage', icon: '🛏️' },
  { key: 'cook', label: 'Cuisine', icon: '🍳' },
  { key: 'clothing', label: 'Vêtements', icon: '🧥' },
  { key: 'water', label: 'Eau', icon: '💧' },
  { key: 'safety', label: 'Sécurité', icon: '🛡️' },
  { key: 'tech', label: 'Tech', icon: '⚡' },
  { key: 'misc', label: 'Divers', icon: '🧭' },
];

export const GearChecklist: React.FC<GearChecklistProps> = ({
  items,
  categoryFilter,
  statusFilter,
  onSetCategoryFilter,
  onSetStatusFilter,
  onSetItemStatus,
  onToggleItemWorn,
  onRemoveItem,
}) => {
  const filteredItems = items.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  const getStatusBadge = (status: GearStatus) => {
    switch (status) {
      case 'packed':
        return { label: 'Dans le sac', bg: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
      case 'owned':
        return { label: 'Possédé', bg: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30' };
      case 'to_buy':
      default:
        return { label: 'À acheter', bg: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30' };
    }
  };

  const cycleStatus = (current: GearStatus): GearStatus => {
    if (current === 'to_buy') return 'owned';
    if (current === 'owned') return 'packed';
    return 'to_buy';
  };

  return (
    <div className="space-y-4">
      {/* Category Horizontal Filter Scroller */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => onSetCategoryFilter(cat.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              categoryFilter === cat.key
                ? 'bg-[#17402C] text-white shadow-sm'
                : 'bg-black/5 dark:bg-white/5 text-[#5A7064] dark:text-[#9AAD9E] hover:bg-black/10'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-2xl">
        <button
          onClick={() => onSetStatusFilter('all')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
            statusFilter === 'all'
              ? 'bg-white dark:bg-white/15 text-[#17402C] dark:text-white shadow-sm'
              : 'text-[#5A7064] dark:text-[#9AAD9E]'
          }`}
        >
          Tous ({items.length})
        </button>
        <button
          onClick={() => onSetStatusFilter('packed')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
            statusFilter === 'packed'
              ? 'bg-white dark:bg-white/15 text-emerald-700 dark:text-emerald-300 shadow-sm'
              : 'text-[#5A7064] dark:text-[#9AAD9E]'
          }`}
        >
          Dans le sac ({items.filter((i) => i.status === 'packed').length})
        </button>
        <button
          onClick={() => onSetStatusFilter('owned')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
            statusFilter === 'owned'
              ? 'bg-white dark:bg-white/15 text-blue-700 dark:text-blue-300 shadow-sm'
              : 'text-[#5A7064] dark:text-[#9AAD9E]'
          }`}
        >
          Possédés ({items.filter((i) => i.status === 'owned').length})
        </button>
        <button
          onClick={() => onSetStatusFilter('to_buy')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
            statusFilter === 'to_buy'
              ? 'bg-white dark:bg-white/15 text-amber-700 dark:text-amber-300 shadow-sm'
              : 'text-[#5A7064] dark:text-[#9AAD9E]'
          }`}
        >
          À acheter ({items.filter((i) => i.status === 'to_buy').length})
        </button>
      </div>

      {/* Items List */}
      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white/40 dark:bg-white/5 border border-black/5 text-center text-xs text-[#5A7064]">
            Aucun équipement dans cette sélection.
          </div>
        ) : (
          filteredItems.map((item) => {
            const badge = getStatusBadge(item.status);

            return (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-sm flex items-center justify-between gap-3 hover:shadow-md transition-all"
              >
                {/* Left: Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-[#17402C] dark:text-[#E7E3D6] truncate">
                      {item.name}
                    </h4>
                    {item.isVital && (
                      <span className="px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-600 dark:text-red-400 text-[9px] font-bold border border-red-500/30 flex-shrink-0">
                        VITAL
                      </span>
                    )}
                    {item.isConsumable && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] font-bold flex-shrink-0">
                        VIVRES
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-[11px] text-[#5A7064] dark:text-[#9AAD9E] font-mono">
                    <span className="font-bold text-[#17402C] dark:text-[#E7E3D6]">
                      {item.weightGrams} g
                    </span>
                    {item.brand && <span>· {item.brand}</span>}
                    {item.quantity > 1 && <span>· Qté: {item.quantity}</span>}
                  </div>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Worn checkbox */}
                  <label
                    title="Cocher si cet objet est porté sur vous et non dans le sac"
                    className="flex items-center gap-1 text-[10px] font-mono font-medium cursor-pointer select-none text-[#5A7064] dark:text-[#9AAD9E]"
                  >
                    <input
                      type="checkbox"
                      checked={item.isWorn}
                      onChange={() => onToggleItemWorn(item.id)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="hidden sm:inline">Porté 👕</span>
                  </label>

                  {/* Status cycle button */}
                  <button
                    onClick={() => onSetItemStatus(item.id, cycleStatus(item.status))}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all active:scale-95 ${badge.bg}`}
                  >
                    {badge.label}
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="text-black/30 dark:text-white/30 hover:text-red-500 p-1 text-xs"
                    title="Supprimer l'équipement"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
