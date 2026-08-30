'use client';

import React, { useState } from 'react';
import type { GearCategory, GearStatus } from '../../types/preparation.types';
import { usePreparationStore } from '../../stores/usePreparationStore';
import { AddGearModal } from '../modals/AddGearModal';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Plus, CheckCircle2, Shield, Flame, Trash2, Shirt } from 'lucide-react';

const CATEGORIES: { key: GearCategory | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: 'Tout', icon: '🎒' },
  { key: 'shelter', label: 'Abri', icon: '⛺' },
  { key: 'sleep', label: 'Couchage', icon: '🛏️' },
  { key: 'cook', label: 'Cuisine', icon: '🍳' },
  { key: 'clothing', label: 'Vêtements', icon: '🧥' },
  { key: 'water', label: 'Eau', icon: '💧' },
  { key: 'safety', label: 'Sécurité', icon: '🛡️' },
  { key: 'tech', label: 'Tech', icon: '⚡' },
  { key: 'navigation', label: 'Navigation', icon: '🧭' },
  { key: 'misc', label: 'Divers', icon: '📦' },
];

export function GearTab() {
  const {
    items,
    categoryFilter,
    statusFilter,
    setCategoryFilter,
    setStatusFilter,
    setItemStatus,
    toggleItemWorn,
    removeItem,
  } = usePreparationStore();
  const { triggerHaptic } = useHapticFeedback();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const filteredItems = items.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  const getStatusBadge = (status: GearStatus) => {
    switch (status) {
      case 'packed':
        return {
          label: 'Dans le sac',
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        };
      case 'owned':
        return {
          label: 'Possédé',
          bg: 'bg-blue-100 text-blue-900 border-blue-300',
        };
      case 'to_buy':
      default:
        return {
          label: 'À acheter',
          bg: 'bg-amber-100 text-amber-900 border-amber-300',
        };
    }
  };

  const cycleStatus = (current: GearStatus): GearStatus => {
    triggerHaptic('selection');
    if (current === 'to_buy') return 'owned';
    if (current === 'owned') return 'packed';
    return 'to_buy';
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* Category Horizontal Filter Scroller */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setCategoryFilter(cat.key);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              categoryFilter === cat.key
                ? 'bg-[#17402C] text-white shadow-xs'
                : 'bg-white/85 dark:bg-black/50 text-[#17402C] dark:text-[#E7E3D6] border border-white/80 dark:border-white/10 shadow-2xs hover:bg-white'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Status Filter Tabs & Add CTA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-1 bg-white/85 dark:bg-black/50 backdrop-blur-md rounded-2xl border border-white/80 dark:border-white/10 shadow-2xs overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
              statusFilter === 'all'
                ? 'bg-[#17402C] text-white shadow-xs'
                : 'text-[#17402C] dark:text-[#E7E3D6]'
            }`}
          >
            Tous ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('packed')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
              statusFilter === 'packed'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-[#17402C] dark:text-[#E7E3D6]'
            }`}
          >
            Dans le sac ({items.filter((i) => i.status === 'packed').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('owned')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
              statusFilter === 'owned'
                ? 'bg-blue-800 text-white shadow-xs'
                : 'text-[#17402C] dark:text-[#E7E3D6]'
            }`}
          >
            Possédés ({items.filter((i) => i.status === 'owned').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('to_buy')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
              statusFilter === 'to_buy'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-[#17402C] dark:text-[#E7E3D6]'
            }`}
          >
            À acheter ({items.filter((i) => i.status === 'to_buy').length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setIsAddModalOpen(true);
          }}
          className="h-8.5 px-4 rounded-full bg-[#17402C] hover:bg-[#1f543a] text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 shrink-0 active:scale-95 transition-all"
        >
          <Plus size={14} />
          <span>Ajouter un équipement</span>
        </button>
      </div>

      {/* Items List */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white/90 dark:bg-[#17402C]/90 backdrop-blur-xl border border-white/80 text-center text-xs text-[#5A7064] space-y-2 shadow-xs">
            <p>Aucun équipement dans cette sélection.</p>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="text-emerald-700 font-bold hover:underline"
            >
              + Ajouter un premier équipement
            </button>
          </div>
        ) : (
          filteredItems.map((item) => {
            const badge = getStatusBadge(item.status);

            return (
              <div
                key={item.id}
                className="p-3.5 sm:p-4 rounded-2xl bg-white/90 dark:bg-[#17402C]/90 backdrop-blur-xl border border-white/80 dark:border-white/20 flex items-center justify-between gap-3 shadow-xs hover:shadow-sm transition-all"
              >
                {/* Left: Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-bold text-[#17402C] dark:text-[#E7E3D6] truncate">
                      {item.name}
                    </h4>

                    {item.isVital && (
                      <span className="px-1.5 py-0.5 rounded-md bg-red-100 text-red-800 text-[9px] font-bold border border-red-300 flex items-center gap-0.5">
                        <Shield size={10} /> VITAL
                      </span>
                    )}

                    {item.isConsumable && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[9px] font-bold border border-amber-300 flex items-center gap-0.5">
                        <Flame size={10} /> VIVRES
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 mt-1 text-[11px] text-[#365233] dark:text-[#9AAD9E] font-mono">
                    <span className="font-extrabold text-[#17402C] dark:text-white">
                      {item.weightGrams} g
                    </span>
                    {item.brand && <span className="text-[#5A7064]">· {item.brand}</span>}
                    {item.quantity > 1 && <span className="text-[#5A7064]">· Qté: {item.quantity}</span>}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Worn checkbox */}
                  <label
                    title="Cocher si cet objet est porté sur vous (non pesé dans le Base Weight)"
                    className="flex items-center gap-1 text-[10px] font-mono font-semibold cursor-pointer select-none text-[#17402C] dark:text-[#E7E3D6] hover:opacity-80"
                  >
                    <input
                      type="checkbox"
                      checked={item.isWorn}
                      onChange={() => {
                        triggerHaptic('light');
                        toggleItemWorn(item.id);
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="hidden sm:inline">Porté 👕</span>
                  </label>

                  {/* Status cycle button */}
                  <button
                    type="button"
                    onClick={() => setItemStatus(item.id, cycleStatus(item.status))}
                    className={`px-3 py-1 rounded-xl text-[10px] font-bold border shadow-2xs active:scale-95 transition-all ${badge.bg}`}
                  >
                    {badge.label}
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      removeItem(item.id);
                    }}
                    className="text-[#5A7064] hover:text-red-600 p-1 text-xs transition-colors"
                    title="Supprimer l'équipement"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <AddGearModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
