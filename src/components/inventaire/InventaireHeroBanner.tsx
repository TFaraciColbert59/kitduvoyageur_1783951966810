'use client';

import React from 'react';

interface InventaireHeroBannerProps {
  totalItemsCount: number;
  totalWeightG: number;
  weightDistribution: Array<{
    key: string;
    label: string;
    color: string;
    pct: number;
    weight: number;
  }>;
  onFilterCategory: (key: string) => void;
}

function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
  return `${g} g`;
}

export default function InventaireHeroBanner({
  totalItemsCount,
  totalWeightG,
  weightDistribution,
  onFilterCategory,
}: InventaireHeroBannerProps) {
  return (
    <header className="pb-8">
      {/* Title row */}
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-[#0B1F17] leading-tight">
          Mon matériel
        </h1>
        <p className="text-sm font-medium text-[#5C6B63] tabular-nums shrink-0">
          {totalItemsCount} article{totalItemsCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Weight summary — only show when there's weight data */}
      {totalWeightG > 0 && (
        <div className="mt-4 flex items-center gap-5">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[#5C6B63] font-medium mb-0.5">
              Poids total
            </p>
            <p className="text-xl font-bold text-[#0B1F17] tabular-nums tracking-tight">
              {formatWeight(totalWeightG)}
            </p>
          </div>

          {/* Weight bar — compact, inline */}
          {weightDistribution.length > 0 && (
            <div className="flex-1 min-w-0">
              <div className="w-full h-2 bg-black/[0.04] rounded-full overflow-hidden flex">
                {weightDistribution.map((cat) => (
                  <button
                    key={cat.key}
                    style={{ width: `${Math.max(cat.pct, 2)}%`, backgroundColor: cat.color }}
                    className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 hover:opacity-70 cursor-pointer border-none p-0"
                    title={`${cat.label}: ${formatWeight(cat.weight)} (${cat.pct}%)`}
                    onClick={() => onFilterCategory(cat.key)}
                    aria-label={`Filtrer ${cat.label}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
