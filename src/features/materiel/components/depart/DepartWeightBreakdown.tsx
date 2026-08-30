'use client';
import { PieChart, Scale } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatWeight } from '@/features/materiel/domain/departCalculations';

interface DepartWeightBreakdownProps {
  breakdown: { category: string; value: number }[];
  totalWeightG: number;
}

// Couleurs sémantiques raffinées par catégorie (nuances naturelles forêt, minéral, terre, eau)
const CATEGORY_COLORS: Record<string, string> = {
  Bivouac: '#2D6B4A',
  Portage: '#17402C',
  Couchage: '#3D5A45',
  Cuisine: '#8C6418',
  Hydratation: '#2C4857',
  Vêtements: '#5A7064',
  Sécurité: '#8A241B',
  Hygiène: '#6B8E78',
  Électronique: '#4B6B7C',
  Autre: '#7A7365',
};

export function DepartWeightBreakdown({ breakdown, totalWeightG }: DepartWeightBreakdownProps) {
  if (!breakdown || breakdown.length === 0 || totalWeightG <= 0) return null;

  // Calcul des pourcentages et tri décroissant
  const sorted = [...breakdown]
    .map((item) => ({
      ...item,
      percentage: Math.max(1, Math.round((item.value / totalWeightG) * 100)),
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <GlassCard tone="neutral" ariaLabelledBy="weight-breakdown-heading">
      <div className="p-4 sm:p-5 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            id="weight-breakdown-heading"
            className="text-[13px] sm:text-sm font-semibold text-[#17402C] flex items-center gap-2"
          >
            <Scale size={15} className="text-[#5A7064]" aria-hidden="true" />
            Répartition du poids
          </h2>
          <span className="text-xs font-mono font-bold text-[#17402C]">
            Total : {formatWeight(totalWeightG)}
          </span>
        </div>

        {/* Barre segmentée multi-catégories */}
        <div
          className="h-3 w-full rounded-full bg-white/40 border border-white/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] overflow-hidden flex"
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
                className="h-full transition-[width] duration-500 first:rounded-l-full last:rounded-r-full"
                title={`${item.category} : ${formatWeight(item.value)} (${item.percentage}%)`}
              />
            );
          })}
        </div>

        {/* Liste détaillée des catégories */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
          {sorted.map((item) => {
            const color = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Autre;
            return (
              <div
                key={item.category}
                className="glass-sub-card p-2.5 flex items-center justify-between gap-1.5"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span className="text-[11px] sm:text-xs font-medium text-[#17402C] truncate">
                    {item.category}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 text-right shrink-0">
                  <span className="text-[11px] sm:text-xs font-mono font-bold text-[#17402C]">
                    {formatWeight(item.value)}
                  </span>
                  <span className="text-[9.5px] font-mono text-[#5A7064]">
                    ({item.percentage}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}
