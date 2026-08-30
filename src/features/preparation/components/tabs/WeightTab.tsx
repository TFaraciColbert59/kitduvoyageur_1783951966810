'use client';

import React from 'react';
import { usePreparationStore } from '../../stores/usePreparationStore';
import { Scale, Package, Shirt, Droplet, Check } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  shelter: 'Abri & Tente',
  sleep: 'Couchage',
  cook: 'Cuisine & Popote',
  clothing: 'Vêtements',
  water: 'Eau & Traitement',
  safety: 'Sécurité & Soins',
  tech: 'Tech & Électronique',
  navigation: 'Navigation',
  misc: 'Divers',
};

export function WeightTab() {
  const { items, getWeightBreakdown } = usePreparationStore();
  const breakdown = getWeightBreakdown();

  const {
    baseWeightGrams,
    wornWeightGrams,
    consumableWeightGrams,
    totalPackWeightGrams,
    totalWeightGrams,
    mulCategory,
  } = breakdown;

  const baseKg = (baseWeightGrams / 1000).toFixed(2);
  const wornKg = (wornWeightGrams / 1000).toFixed(2);
  const consumableKg = (consumableWeightGrams / 1000).toFixed(2);
  const totalPackKg = (totalPackWeightGrams / 1000).toFixed(2);
  const totalKg = (totalWeightGrams / 1000).toFixed(2);

  const getMulBadge = () => {
    switch (mulCategory) {
      case 'ultralight':
        return { label: 'Ultra-Léger (MUL < 4.5 kg)', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
      case 'light':
        return { label: 'Randonnée Légère (< 9 kg)', bg: 'bg-blue-100 text-blue-900 border-blue-300' };
      case 'traditional':
      default:
        return { label: 'Charge Traditionnelle (> 9 kg)', bg: 'bg-amber-100 text-amber-900 border-amber-300' };
    }
  };

  const badge = getMulBadge();

  // Distribution des pourcentages
  const total = totalWeightGrams > 0 ? totalWeightGrams : 1;
  const basePct = Math.round((baseWeightGrams / total) * 100);
  const consumablePct = Math.round((consumableWeightGrams / total) * 100);
  const wornPct = Math.round((wornWeightGrams / total) * 100);

  // Ventilation par catégorie des objets dans le sac
  const byCategory = new Map<string, number>();
  for (const item of items.filter((i) => i.status === 'packed' && !i.isWorn)) {
    const cat = item.category || 'misc';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + (item.weightGrams * (item.quantity || 1)));
  }

  const categoryList = Array.from(byCategory.entries())
    .map(([cat, weight]) => ({
      category: cat,
      label: CATEGORY_LABELS[cat] || cat,
      weightGrams: weight,
      weightKg: (weight / 1000).toFixed(2),
      percentage: baseWeightGrams > 0 ? Math.round((weight / baseWeightGrams) * 100) : 0,
    }))
    .sort((a, b) => b.weightGrams - a.weightGrams);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Visual Weight Summary Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/90 dark:bg-[#17402C]/90 backdrop-blur-xl border border-white/80 dark:border-white/20 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#5A7064] dark:text-[#9AAD9E]">
              BILAN PONDÉRAL SCIENTIFIQUE
            </span>
            <h3 className="text-sm sm:text-base font-bold text-[#17402C] dark:text-white">
              Base Weight & Poids Total
            </h3>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border shadow-2xs ${badge.bg}`}>
            {badge.label}
          </span>
        </div>

        {/* 4 Cards de répartition */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="p-2.5 rounded-2xl bg-white/80 dark:bg-white/10 border border-white/60 dark:border-white/10 shadow-2xs">
            <span className="text-[9px] uppercase font-mono text-[#5A7064] dark:text-[#9AAD9E] block">
              🎒 Base Weight
            </span>
            <span className="text-xl font-extrabold font-mono text-[#17402C] dark:text-white">
              {baseKg} <span className="text-xs font-normal">kg</span>
            </span>
            <span className="text-[9px] text-[#5A7064] dark:text-[#9AAD9E] block">Sac hors vivres</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white/80 dark:bg-white/10 border border-white/60 dark:border-white/10 shadow-2xs">
            <span className="text-[9px] uppercase font-mono text-[#5A7064] dark:text-[#9AAD9E] block">
              🥫 Consommables
            </span>
            <span className="text-xl font-extrabold font-mono text-amber-800 dark:text-amber-300">
              {consumableKg} <span className="text-xs font-normal">kg</span>
            </span>
            <span className="text-[9px] text-[#5A7064] dark:text-[#9AAD9E] block">Eau, vivres, gaz</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white/80 dark:bg-white/10 border border-white/60 dark:border-white/10 shadow-2xs">
            <span className="text-[9px] uppercase font-mono text-[#5A7064] dark:text-[#9AAD9E] block">
              👕 Porté sur soi
            </span>
            <span className="text-xl font-extrabold font-mono text-blue-800 dark:text-blue-300">
              {wornKg} <span className="text-xs font-normal">kg</span>
            </span>
            <span className="text-[9px] text-[#5A7064] dark:text-[#9AAD9E] block">Vêtements, bâtons</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/30 shadow-2xs">
            <span className="text-[9px] uppercase font-mono text-emerald-900 dark:text-emerald-300 font-bold block">
              ⚖️ Poids sur le dos
            </span>
            <span className="text-xl font-extrabold font-mono text-emerald-950 dark:text-white">
              {totalPackKg} <span className="text-xs font-normal">kg</span>
            </span>
            <span className="text-[9px] text-emerald-800 dark:text-emerald-300 block">Base + Consommables</span>
          </div>
        </div>

        {/* Barre segmentée Liquid Glass */}
        <div className="space-y-1.5 pt-1">
          <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-3 flex overflow-hidden border border-white/60 dark:border-white/10 p-0.5">
            <div
              className="bg-emerald-600 h-full rounded-l-full transition-all duration-500"
              style={{ width: `${Math.max(2, basePct)}%` }}
              title={`Base Weight : ${basePct}%`}
            />
            <div
              className="bg-amber-500 h-full transition-all duration-500"
              style={{ width: `${Math.max(2, consumablePct)}%` }}
              title={`Consommables : ${consumablePct}%`}
            />
            <div
              className="bg-sky-500 h-full rounded-r-full transition-all duration-500"
              style={{ width: `${Math.max(2, wornPct)}%` }}
              title={`Porté : ${wornPct}%`}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-[#5A7064] dark:text-[#9AAD9E]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" /> Base ({basePct}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Vivres ({consumablePct}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" /> Porté ({wornPct}%)
            </span>
          </div>
        </div>
      </div>

      {/* Ventilation du Base Weight par Catégorie */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#17402C] dark:text-white px-1">
          Ventilation du Matériel par Poste
        </h4>

        <div className="space-y-1.5">
          {categoryList.map((cat) => (
            <div
              key={cat.category}
              className="p-3.5 rounded-2xl bg-white/90 dark:bg-[#17402C]/90 backdrop-blur-xl border border-white/80 dark:border-white/20 flex items-center justify-between gap-3 text-xs shadow-xs"
            >
              <div className="flex items-center gap-2 flex-1">
                <span className="font-bold text-[#17402C] dark:text-white">{cat.label}</span>
                <span className="text-[10px] text-[#5A7064] dark:text-[#9AAD9E]">({cat.percentage}%)</span>
              </div>

              <div className="flex items-center gap-2 font-mono">
                <span className="font-bold text-[#17402C] dark:text-white">{cat.weightGrams} g</span>
                <div className="w-16 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden hidden sm:block">
                  <div
                    className="h-full bg-emerald-600 rounded-full"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
