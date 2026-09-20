'use client';
import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDownIcon as ChevronDown } from '@/components/icons/chevron-down';
import { Button, Card } from '@/components/ui';
import { formatWeight } from '@/features/materiel/domain/departCalculations';
import { cn } from '@/lib/utils';

export interface WeightBreakdownItem {
  category: string;
  value: number;
  percentage?: number;
}

interface DepartWeightBreakdownProps {
  breakdown: WeightBreakdownItem[];
  totalWeightG: number;
  baseWeightG?: number;
  wornWeightG?: number;
  consumablesWeightG?: number;
  items?: any[];
  participants?: any[];
  comparableTripName?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Bivouac: 'var(--lkv-primary)',
  Couchage: 'var(--lkv-primary-hover)',
  Cuisine: 'var(--lkv-secondary)',
  Vêtements: 'var(--lkv-text-muted)',
  Hydratation: 'var(--lkv-info)',
  'Vivres & Eau': 'var(--lkv-primary-hover)',
  Sécurité: 'var(--lkv-danger)',
  Hygiène: 'var(--lkv-secondary)',
  Électronique: 'var(--lkv-info)',
  Autre: 'var(--stone-600)',
};

export function DepartWeightBreakdown({
  breakdown = [],
  totalWeightG = 0,
  baseWeightG = 0,
  wornWeightG = 0,
  consumablesWeightG = 0,
  items = [],
  participants = [],
  comparableTripName,
}: DepartWeightBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const effectiveBaseG = baseWeightG || totalWeightG;
  const totalCarriedG = effectiveBaseG + consumablesWeightG + wornWeightG;

  const sorted = [...breakdown]
    .map((item) => ({
      ...item,
      percentage:
        totalWeightG > 0 ? Math.round((item.value / totalWeightG) * 100) : item.percentage,
    }))
    .sort((a, b) => b.value - a.value);

  const heaviestCategory = sorted[0];
  const autoInsight = heaviestCategory
    ? `Poste principal : ${heaviestCategory.category} (~${heaviestCategory.percentage}% · ${formatWeight(heaviestCategory.value)})`
    : `Sac optimisé : poids de base sous contrôle.`;

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      {/* ════ HEADER : TITRE & POIDS TOTAL ════ */}
      <Button
        variant="ghost"
        onClick={() => setIsOpen((v) => !v)}
        className="h-auto w-full justify-between gap-3 whitespace-normal rounded-none border-b border-black/5 px-0 pb-3 pt-0 text-left font-normal hover:bg-transparent"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[var(--lkv-primary-hover)]/10 border border-[var(--lkv-primary-hover)]/20 flex items-center justify-center text-[var(--lkv-primary-hover)] shadow-2xs shrink-0">
            <Icon name="scale" size={18} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[var(--lkv-primary)]">
              Analyse du poids & Décision
            </h3>
            <span className="text-[11px] text-[var(--lkv-text-muted)]">
              Évaluation du portage et synthèse globale
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs sm:text-sm font-mono font-bold text-[var(--lkv-primary)]">
            {formatWeight(totalCarriedG)}
          </span>
          <motion.div
            animate={shouldReduceMotion ? {} : { rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.18 }}
          >
            <ChevronDown size={15} className="text-[var(--lkv-text-muted)]" />
          </motion.div>
        </div>
      </Button>

      {/* ════ 3 PILIERS DU POIDS : PASTILLES BLANC ÉCLATANT LIQUID GLASS (Images 1 & 2) ════ */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
        <Card variant="compact" className="space-y-0.5 rounded-full px-3 py-2.5 text-center">
          <span className="block text-[8.5px] font-mono font-bold uppercase tracking-wider text-[var(--lkv-text-muted)] sm:text-[9.5px]">
            Poids de base
          </span>
          <span className="block text-xs font-mono font-bold text-[var(--lkv-primary)] sm:text-sm">
            {formatWeight(effectiveBaseG)}
          </span>
        </Card>

        <Card variant="compact" className="space-y-0.5 rounded-full px-3 py-2.5 text-center">
          <span className="block text-[8.5px] font-mono font-bold uppercase tracking-wider text-[var(--lkv-text-muted)] sm:text-[9.5px]">
            Consommables
          </span>
          <span className="block text-xs font-mono font-bold text-[var(--lkv-primary)] sm:text-sm">
            {formatWeight(consumablesWeightG)}
          </span>
        </Card>

        <Card variant="compact" className="space-y-0.5 rounded-full px-3 py-2.5 text-center">
          <span className="block text-[8.5px] font-mono font-bold uppercase tracking-wider text-[var(--lkv-text-muted)] sm:text-[9.5px]">
            Porté sur soi
          </span>
          <span className="block text-xs font-mono font-bold text-[var(--lkv-primary)] sm:text-sm">
            {formatWeight(wornWeightG)}
          </span>
        </Card>
      </div>

      {/* ════ JAUGE D'ÉVALUATION DU PORTAGE ════ */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10.5px]">
          <span className="text-[var(--lkv-text-muted)] font-medium">Échelle de portage :</span>
          <span className="font-bold text-[var(--lkv-primary)]">
            {effectiveBaseG < 5000
              ? 'Ultraléger (< 5 kg)'
              : effectiveBaseG < 9000
                ? 'Standard 3 saisons (5 - 9 kg)'
                : 'Lourd (> 9 kg)'}
          </span>
        </div>

        {/* Barre segmentée avec repères visuels */}
        <div className="h-2 w-full rounded-full bg-black/10 overflow-hidden flex">
          <div className="h-full bg-[var(--lkv-forest-600)] w-[35%]" title="Ultraléger (<5kg)" />
          <div className="h-full bg-[var(--lkv-forest-900)] w-[35%]" title="Standard 3 saisons (5-9kg)" />
          <div className="h-full bg-[var(--lkv-warning)] w-[15%]" title="Lourd (>9kg)" />
          <div className="h-full bg-[var(--lkv-danger)] w-[15%]" title="Très lourd (>12kg)" />
        </div>
      </div>

      {/* Accordéon détaillé des catégories */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            className="overflow-hidden pt-1 space-y-2 border-t border-black/5"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {sorted.map((item) => {
                const color = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Autre;
                return (
                  <Card
                    key={item.category}
                    variant="compact"
                    className="flex items-center justify-between gap-2 p-2"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate text-[11px] font-medium text-[var(--lkv-primary)]">
                        {item.category}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] font-mono font-bold text-[var(--lkv-text-muted)]">
                      {formatWeight(item.value)}
                    </span>
                  </Card>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
