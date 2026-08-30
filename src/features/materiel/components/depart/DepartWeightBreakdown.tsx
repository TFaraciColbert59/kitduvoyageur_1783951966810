'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Scale, ChevronDown, Sparkles, ArrowRight, Backpack, Shirt, Droplets } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatWeight } from '@/features/materiel/domain/departCalculations';
import { cn } from '@/lib/utils';

interface DepartWeightBreakdownProps {
  breakdown: { category: string; value: number }[];
  totalWeightG: number;
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

export function DepartWeightBreakdown({ breakdown, totalWeightG }: DepartWeightBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  if (!breakdown || breakdown.length === 0 || totalWeightG <= 0) return null;

  const sorted = [...breakdown]
    .map((item) => ({
      ...item,
      percentage: Math.max(1, Math.round((item.value / totalWeightG) * 100)),
    }))
    .sort((a, b) => b.value - a.value);

  // Génération d'un insight automatique unique et pertinent (§4D)
  const heaviestCategory = sorted[0];
  const autoInsight = heaviestCategory
    ? `Votre poste « ${heaviestCategory.category} » représente ${heaviestCategory.percentage}% (${formatWeight(heaviestCategory.value)}) du poids au dos.`
    : `Sac optimisé : poids de base sous contrôle.`;

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
              Analyse du poids & Répartition
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#17402C]">
              {formatWeight(totalWeightG)}
            </span>
            <motion.span
              animate={shouldReduceMotion ? {} : { rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.18 }}
            >
              <ChevronDown size={14} className="text-[#5A7064]" />
            </motion.span>
          </div>
        </button>

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
                  width: `${(item.value / totalWeightG) * 100}%`,
                  backgroundColor: color,
                }}
                title={`${item.category} : ${item.percentage}% (${formatWeight(item.value)})`}
              />
            );
          })}
        </div>

        {/* Insight automatique unique (§4D) */}
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/50 text-[#17402C] text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={13} className="text-[#2D6B4A] shrink-0" />
            <span className="truncate">{autoInsight}</span>
          </div>
          <Link
            href="/materiel/inventaire"
            className="text-[11px] font-bold text-[#2D6B4A] hover:underline flex items-center gap-0.5 shrink-0"
          >
            <span>Alléger</span>
            <ArrowRight size={10} />
          </Link>
        </div>

        {/* Contenu détaillé dans l'accordéon */}
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
