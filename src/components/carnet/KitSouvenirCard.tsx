'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { CarnetKitItem } from '@/lib/mock/carnet-chartreuse';

interface KitSouvenirCardProps {
  intro?: string;
  items: CarnetKitItem[];
}

export default function KitSouvenirCard({ intro, items }: KitSouvenirCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [selectedFilter, setSelectedFilter] = useState('all');

  const toggleCheck = (id: string) => {
    triggerHaptic('selection');
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const categories = ['all', 'Couchage', 'Vêtements', 'Cuisine', 'Hydratation'];

  const filteredItems = items.filter((item) => {
    if (selectedFilter === 'all') return true;
    const nameLow = item.name.toLowerCase();
    const detailLow = (item.detail || '').toLowerCase();
    if (selectedFilter === 'Couchage') return nameLow.includes('duvet') || nameLow.includes('sac') || detailLow.includes('confort');
    if (selectedFilter === 'Vêtements') return nameLow.includes('veste') || nameLow.includes('hardshell') || detailLow.includes('portée');
    if (selectedFilter === 'Cuisine') return nameLow.includes('réchaud') || detailLow.includes('combustible');
    if (selectedFilter === 'Hydratation') return nameLow.includes('gourde') || detailLow.includes('eau');
    return true;
  });

  return (
    <div className="glass bg-white/90 backdrop-blur-xl rounded-3xl p-4 sm:p-6 space-y-4 border border-white shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#17402C]/10">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🎒</span>
          <div>
            <h3 className="font-display font-bold text-base sm:text-lg text-[#17402C]">
              Dans le sac <span className="font-serif italic text-emerald-800 font-normal">de l’expédition</span>
            </h3>
            <span className="text-[10px] font-mono text-[#5C6B5E]">
              {items.length} indispensables archivés · Poids estimé 4.8 kg
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/ai-configurator"
            onClick={() => triggerHaptic('light')}
            className="glass-capsule-btn primary !min-h-[34px] !py-1 !px-3.5 !text-xs !font-bold !gap-1.5"
          >
            <Icon name="SparklesIcon" size={13} className="relative z-10" />
            <span className="relative z-10">Reconfigurer IA</span>
          </Link>
        </div>
      </div>

      {intro && (
        <p className="text-xs text-[#365233] leading-relaxed font-sans italic bg-[#17402C]/5 p-3 rounded-2xl border border-[#17402C]/5">
          {intro}
        </p>
      )}

      {/* Category Pills */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => {
          const isSelected = selectedFilter === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setSelectedFilter(cat);
              }}
              className={`glass-capsule-btn !min-h-[30px] !py-1 !px-3 !text-[11px] !font-bold transition-all ${
                isSelected ? 'primary' : ''
              }`}
            >
              <span>{cat === 'all' ? 'Tout le sac' : cat}</span>
            </button>
          );
        })}
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        {filteredItems.map((item) => {
          const isChecked = checkedItems[item.id];
          return (
            <div
              key={item.id}
              onClick={() => toggleCheck(item.id)}
              className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                isChecked
                  ? 'bg-emerald-50/90 border-emerald-300 shadow-2xs'
                  : 'bg-white/80 border-white/80 hover:bg-white shadow-2xs'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  isChecked ? 'bg-[#17402C] text-white shadow-2xs' : 'border border-[#17402C]/20 bg-white'
                }`}
              >
                {isChecked && '✓'}
              </div>

              <div
                className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                style={{ backgroundColor: item.color || '#17402C' }}
                aria-hidden="true"
              />

              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold truncate ${isChecked ? 'text-emerald-950 line-through opacity-80' : 'text-[#17402C]'}`}>
                  {item.name}
                </p>
                {item.detail && (
                  <p className="text-[10px] text-[#5C6B5E] truncate font-mono">{item.detail}</p>
                )}
              </div>

              {item.weight && (
                <span className="font-mono text-[10px] font-bold text-[#17402C] shrink-0 bg-[#17402C]/5 px-2 py-0.5 rounded-lg border border-[#17402C]/5">
                  {item.weight}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
