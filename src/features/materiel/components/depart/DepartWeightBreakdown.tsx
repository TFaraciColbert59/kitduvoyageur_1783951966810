'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Scale,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Backpack,
  Shirt,
  Droplets,
  Sliders,
  RotateCcw,
  Users,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatWeight } from '@/features/materiel/domain/departCalculations';
import { cn } from '@/lib/utils';
import type { ChecklistItem, Participant } from '@/features/materiel/types/trekHub';

interface DepartWeightBreakdownProps {
  breakdown: { category: string; value: number }[];
  totalWeightG: number;
  baseWeightG?: number;
  wornWeightG?: number;
  consumablesWeightG?: number;
  items?: ChecklistItem[];
  participants?: Participant[];
  comparableTripName?: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  Bivouac: '#2D6B4A',
  Portage: '#17402C',
  Couchage: '#3D5A45',
  Cuisine: '#8C6418',
  Hydratation: '#2C4857',
  'Vivres & Eau': '#2D6B4A',
  Vêtements: '#5A7064',
  Sécurité: '#8A241B',
  Hygiène: '#6B8E78',
  Électronique: '#4B6B7C',
  Autre: '#7A7365',
};

export function DepartWeightBreakdown({
  breakdown,
  totalWeightG,
  baseWeightG,
  wornWeightG = 0,
  consumablesWeightG = 0,
  items = [],
  participants = [],
  comparableTripName,
}: DepartWeightBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simulatedRemovedIds, setSimulatedRemovedIds] = useState<Set<string>>(new Set());
  const shouldReduceMotion = useReducedMotion();

  const activeBaseG = baseWeightG ?? totalWeightG;

  // Calcul dynamique avec le simulateur d'allègement (§Phase 4)
  const simulatedSavedG = useMemo(() => {
    let saved = 0;
    for (const item of items) {
      const key = item.id ?? item.name;
      if (simulatedRemovedIds.has(key)) {
        saved += (item.weight_g || 0) * (item.quantity || 1);
      }
    }
    return saved;
  }, [items, simulatedRemovedIds]);

  const effectiveBaseG = Math.max(0, activeBaseG - simulatedSavedG);
  const effectiveTotalPackG = effectiveBaseG + consumablesWeightG;

  const sorted = [...breakdown]
    .map((item) => ({
      ...item,
      percentage: Math.max(1, Math.round((item.value / (totalWeightG || 1)) * 100)),
    }))
    .sort((a, b) => b.value - a.value);

  // Top 5 des articles les plus lourds pour le simulateur
  const heaviestItems = useMemo(() => {
    return [...items]
      .filter((i) => !i.is_worn && !i.is_consumable)
      .sort((a, b) => (b.weight_g * (b.quantity || 1)) - (a.weight_g * (a.quantity || 1)))
      .slice(0, 5);
  }, [items]);

  // Positionnement sur l'échelle de portage
  const weightCategoryLabel =
    effectiveBaseG < 5000
      ? 'Ultraléger (< 5 kg)'
      : effectiveBaseG < 8000
      ? 'Standard 3 saisons (5-8 kg)'
      : effectiveBaseG < 12000
      ? 'Confort / 4 saisons (8-12 kg)'
      : 'Charge lourde (> 12 kg)';

  const heaviestCategory = sorted[0];
  const autoInsight = heaviestCategory
    ? `Poste principal « ${heaviestCategory.category} » : ${heaviestCategory.percentage}% (${formatWeight(heaviestCategory.value)}).`
    : `Sac optimisé : poids de base sous contrôle.`;

  const toggleSimulateItem = (key: string) => {
    setSimulatedRemovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <GlassCard tone="neutral" as="article" ariaLabelledBy="weight-breakdown-heading">
      <div className="p-4 sm:p-5 space-y-3">
        {/* En-tête principal avec bouton accordéon */}
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#17402C] rounded-xl"
          aria-expanded={isOpen}
          aria-controls="weight-breakdown-accordion"
        >
          <div className="flex items-center gap-2">
            <Scale size={15} className="text-[#2D6B4A]" aria-hidden="true" />
            <h2 id="weight-breakdown-heading" className="text-xs sm:text-[13px] font-bold text-[#17402C]">
              Analyse du poids & Décision
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#17402C]">
              {formatWeight(effectiveTotalPackG)}
            </span>
            <motion.span
              animate={shouldReduceMotion ? {} : { rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.18 }}
            >
              <ChevronDown size={14} className="text-[#5A7064]" />
            </motion.span>
          </div>
        </button>

        {/* ════ 3 PILIERS DU POIDS (Base, Consommables, Porté) ════ */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs pt-0.5">
          <div className="p-2 rounded-xl bg-white/40 border border-white/60">
            <span className="text-[9.5px] uppercase tracking-wider text-[#5A7064] block font-semibold">
              Poids de Base
            </span>
            <span className="font-mono font-bold text-[#17402C] text-xs sm:text-[13px]">
              {(effectiveBaseG / 1000).toFixed(2)} kg
            </span>
          </div>

          <div className="p-2 rounded-xl bg-white/40 border border-white/60">
            <span className="text-[9.5px] uppercase tracking-wider text-[#5A7064] block font-semibold">
              Consommables
            </span>
            <span className="font-mono font-bold text-[#17402C] text-xs sm:text-[13px]">
              {(consumablesWeightG / 1000).toFixed(2)} kg
            </span>
          </div>

          <div className="p-2 rounded-xl bg-white/40 border border-white/60">
            <span className="text-[9.5px] uppercase tracking-wider text-[#5A7064] block font-semibold">
              Porté sur soi
            </span>
            <span className="font-mono font-bold text-[#5A7064] text-xs sm:text-[13px]">
              {(wornWeightG / 1000).toFixed(2)} kg
            </span>
          </div>
        </div>

        {/* Repère de charge */}
        <div className="flex items-center justify-between text-[10.5px] text-[#5A7064] px-1">
          <span>Échelle de portage :</span>
          <span className="font-semibold text-[#17402C]">{weightCategoryLabel}</span>
        </div>

        {/* Barre segmentée compacte */}
        <div
          className="h-2.5 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden flex shadow-2xs"
          role="progressbar"
          aria-label="Répartition du poids par catégorie"
          aria-valuenow={100}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {sorted.map((item) => {
            const color = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Autre;
            return (
              <div
                key={item.category}
                style={{
                  width: `${(item.value / (totalWeightG || 1)) * 100}%`,
                  backgroundColor: color,
                }}
                title={`${item.category} : ${item.percentage}% (${formatWeight(item.value)})`}
              />
            );
          })}
        </div>

        {/* Insight + Bouton Simulateur */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/50 text-[#17402C] text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={13} className="text-[#2D6B4A] shrink-0" />
            <span className="truncate">{autoInsight}</span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsSimulatorOpen((v) => !v)}
              className="text-[11px] font-bold text-[#2D6B4A] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sliders size={11} />
              <span>{isSimulatorOpen ? 'Masquer simulation' : 'Simuler allègement'}</span>
            </button>
          </div>
        </div>

        {/* ════ SIMULATEUR D'ALLÈGEMENT INTERACTIF (§Phase 4) ════ */}
        <AnimatePresence>
          {isSimulatorOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 rounded-2xl bg-white/60 dark:bg-white/5 border border-[#17402C]/15 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#17402C] flex items-center gap-1.5">
                  <Sliders size={12} className="text-[#2D6B4A]" />
                  <span>Simulateur d’allègement (Top 5 articles lourds)</span>
                </span>
                {simulatedSavedG > 0 && (
                  <button
                    type="button"
                    onClick={() => setSimulatedRemovedIds(new Set())}
                    className="text-[10px] font-semibold text-[#8A241B] hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <RotateCcw size={10} />
                    <span>Réinitialiser</span>
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                {heaviestItems.map((item) => {
                  const key = item.id ?? item.name;
                  const isRemoved = simulatedRemovedIds.has(key);
                  const itemWeight = (item.weight_g || 0) * (item.quantity || 1);

                  return (
                    <label
                      key={key}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-colors',
                        isRemoved
                          ? 'bg-red-50/60 border-red-200 text-red-900 line-through'
                          : 'bg-white/80 border-black/5 text-[#17402C]'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isRemoved}
                          onChange={() => toggleSimulateItem(key)}
                          className="rounded accent-[#8A241B]"
                        />
                        <span className="truncate font-medium">{item.name}</span>
                      </div>
                      <span className="font-mono font-bold shrink-0 text-[11px]">
                        {formatWeight(itemWeight)}
                      </span>
                    </label>
                  );
                })}
              </div>

              {simulatedSavedG > 0 && (
                <div className="p-2 rounded-xl bg-emerald-100/70 text-[#17402C] text-xs font-semibold flex items-center justify-between">
                  <span>Gain simulé :</span>
                  <span className="font-mono font-bold text-[#2D6B4A]">
                    -{formatWeight(simulatedSavedG)} (Base : {(effectiveBaseG / 1000).toFixed(2)} kg)
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ════ RÉPARTITION DÉTAILLÉE PAR CATÉGORIE ════ */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              id="weight-breakdown-accordion"
              initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
              className="overflow-hidden pt-1"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sorted.map((item) => {
                  const color = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Autre;
                  return (
                    <div
                      key={item.category}
                      className="p-2 rounded-xl bg-white/30 dark:bg-white/5 border border-white/40 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[11px] font-medium text-[#17402C] truncate">
                          {item.category}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-[#5A7064] shrink-0">
                        {formatWeight(item.value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassCard>
  );
}
