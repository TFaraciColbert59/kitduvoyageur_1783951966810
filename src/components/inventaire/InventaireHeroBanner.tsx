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
}: InventaireHeroBannerProps) {
  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-black/[0.06] shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#17402C] bg-[#E1EBDD] px-2.5 py-0.5 rounded-full font-bold">
              🎒 Sac & Équipements
            </span>
            <span className="text-xs font-medium text-[#6B7A72]">
              {totalItemsCount} article{totalItemsCount !== 1 ? 's' : ''} possédé{totalItemsCount !== 1 ? 's' : ''}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-[#0B1F17] tracking-tight">
            Mon Matériel
          </h1>
          <p className="text-xs text-[#6B7A72] mt-0.5">
            {totalItemsCount === 0
              ? 'Votre sac est prêt à être composé. Utilisez le configurateur IA ci-dessus ou ajoutez vos affaires.'
              : 'Vue consolidée de votre inventaire de randonnée et métriques de portage.'}
          </p>
        </div>

        <div className="flex items-center gap-4 bg-[#FBFAF6] px-4 py-3 rounded-2xl border border-black/[0.04] self-start sm:self-auto">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7A72]">
              Poids total net
            </span>
            <div className="text-xl font-bold font-mono text-[#0B1F17]">
              {formatWeight(totalWeightG)}
            </div>
          </div>
          {weightDistribution.length > 0 && (
            <div className="w-32 sm:w-44 h-2.5 bg-black/[0.06] rounded-full overflow-hidden flex">
              {weightDistribution.map((cat) => (
                <div
                  key={cat.key}
                  style={{ width: `${Math.max(cat.pct, 4)}%`, backgroundColor: cat.color }}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  title={`${cat.label}: ${formatWeight(cat.weight)} (${cat.pct}%)`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
