'use client';

import React from 'react';

interface GenericItem {
  weight_g?: number;
  weight?: number;
  quantity?: number;
  category?: string;
}

interface WeightDistributionCardProps {
  items: GenericItem[];
  totalWeightG?: number;
  className?: string;
}

const CATEGORY_MAP: Record<string, { label: string; bg: string; dot: string }> = {
  couchage: { label: 'Couchage & abri', bg: '#6DAA7D', dot: '#6DAA7D' },
  'couchage & tentes': { label: 'Couchage & abri', bg: '#6DAA7D', dot: '#6DAA7D' },
  vetement: { label: 'Vêtements techniques', bg: '#AECBB4', dot: '#AECBB4' },
  vêtement: { label: 'Vêtements techniques', bg: '#AECBB4', dot: '#AECBB4' },
  'vêtements & vestes': { label: 'Vêtements techniques', bg: '#AECBB4', dot: '#AECBB4' },
  portage: { label: 'Portage & sacs', bg: '#C99B5A', dot: '#C99B5A' },
  'sacs & portage': { label: 'Portage & sacs', bg: '#C99B5A', dot: '#C99B5A' },
  cuisine: { label: 'Cuisine & eau', bg: '#E4C695', dot: '#E4C695' },
  'cuisine & réchauds': { label: 'Cuisine & eau', bg: '#E4C695', dot: '#E4C695' },
  'eau & filtres': { label: 'Cuisine & eau', bg: '#E4C695', dot: '#E4C695' },
  navigation: { label: 'Navigation & élec.', bg: 'rgba(255,255,255,0.45)', dot: 'rgba(255,255,255,0.6)' },
  'navigation & gps': { label: 'Navigation & élec.', bg: 'rgba(255,255,255,0.45)', dot: 'rgba(255,255,255,0.6)' },
  'lampes & éclairage': { label: 'Navigation & élec.', bg: 'rgba(255,255,255,0.45)', dot: 'rgba(255,255,255,0.6)' },
  securite: { label: 'Sécurité & soins', bg: 'rgba(255,255,255,0.22)', dot: 'rgba(255,255,255,0.3)' },
  sécurité: { label: 'Sécurité & soins', bg: 'rgba(255,255,255,0.22)', dot: 'rgba(255,255,255,0.3)' },
  'sécurité & soins': { label: 'Sécurité & soins', bg: 'rgba(255,255,255,0.22)', dot: 'rgba(255,255,255,0.3)' },
  autre: { label: 'Accessoires & outils', bg: 'rgba(255,255,255,0.15)', dot: 'rgba(255,255,255,0.2)' },
  'accessoires & outils': { label: 'Accessoires & outils', bg: 'rgba(255,255,255,0.15)', dot: 'rgba(255,255,255,0.2)' },
};

function normalizeCategoryKey(rawCat?: string): string {
  if (!rawCat) return 'autre';
  const clean = rawCat.toLowerCase().trim();
  if (clean.includes('couchage') || clean.includes('tente') || clean.includes('abri')) return 'couchage';
  if (clean.includes('vêtement') || clean.includes('vetement') || clean.includes('veste') || clean.includes('chaussure')) return 'vêtement';
  if (clean.includes('portage') || clean.includes('sac')) return 'portage';
  if (clean.includes('cuisin') || clean.includes('rechaud') || clean.includes('réchaud') || clean.includes('eau') || clean.includes('filtr')) return 'cuisine';
  if (clean.includes('navig') || clean.includes('gps') || clean.includes('lamp') || clean.includes('elec') || clean.includes('élec')) return 'navigation';
  if (clean.includes('secur') || clean.includes('sécur') || clean.includes('soin')) return 'sécurité';
  return 'autre';
}

export default function WeightDistributionCard({
  items,
  totalWeightG: propTotalWeightG,
  className = '',
}: WeightDistributionCardProps) {
  const calculatedTotalWeightG =
    propTotalWeightG ??
    items.reduce((sum, item) => {
      const w = item.weight_g ?? item.weight ?? 0;
      const q = item.quantity || 1;
      return sum + w * q;
    }, 0);

  const totalG = calculatedTotalWeightG > 0 ? calculatedTotalWeightG : 1;

  const categoryWeights: Record<string, number> = {};
  items.forEach((item) => {
    const rawCat = item.category || 'autre';
    const normKey = normalizeCategoryKey(rawCat);
    const w = item.weight_g ?? item.weight ?? 0;
    const q = item.quantity || 1;
    categoryWeights[normKey] = (categoryWeights[normKey] || 0) + w * q;
  });

  const categoriesList = Object.entries(categoryWeights)
    .filter(([_, weightG]) => weightG > 0)
    .map(([catKey, weightG]) => {
      const meta = CATEGORY_MAP[catKey] || CATEGORY_MAP.autre;
      const pct = Math.round((weightG / totalG) * 100);
      return {
        key: catKey,
        label: meta.label,
        bg: meta.bg,
        dot: meta.dot,
        weightG,
        weightKgStr: (weightG / 1000).toLocaleString('fr-FR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }),
        percentage: pct,
      };
    })
    .sort((a, b) => b.weightG - a.weightG);

  const totalKgStr = (totalG / 1000).toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <div
      className={`relative overflow-hidden rounded-[24px] p-5 md:p-6 text-white shadow-lg border border-white/10 ${className}`}
      style={{
        background: 'linear-gradient(135deg, #1F4A3A 0%, #2E6F57 100%)',
      }}
    >
      {/* Decorative radial glow */}
      <div
        className="pointer-events-none absolute -right-12 -bottom-12 w-48 h-48 rounded-full opacity-35"
        style={{
          background: 'radial-gradient(circle, #6DAA7D 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 space-y-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h3 className="text-[19px] font-medium tracking-tight text-white leading-tight font-sans">
              Répartition <em className="font-serif italic font-normal text-[#AECBB4]">du poids</em>
            </h3>
            <p className="text-[11px] text-white/70 font-sans mt-0.5">
              {totalKgStr} kg cumulés · par catégorie
            </p>
          </div>
          <span className="font-mono text-xs font-medium text-emerald-100 bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15 shrink-0">
            {totalKgStr} kg
          </span>
        </div>

        {/* Stacked Spectrum Bar */}
        <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-black/25 p-0.5 border border-white/10">
          {categoriesList.map((c) => (
            <div
              key={c.key}
              className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
              style={{
                width: `${Math.max(c.percentage, 2)}%`,
                backgroundColor: c.bg,
              }}
              title={`${c.label}: ${c.weightKgStr} kg (${c.percentage}%)`}
            />
          ))}
        </div>

        {/* Categories List */}
        <div className="space-y-1.5 pt-1">
          {categoriesList.slice(0, 6).map((c) => (
            <div
              key={c.key}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 text-[11.5px]"
            >
              <span
                className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                style={{ backgroundColor: c.dot }}
              />
              <span className="text-white/85 truncate font-sans">{c.label}</span>
              <span className="font-mono text-white/70 text-right">
                <strong className="text-white font-sans font-medium">{c.weightKgStr}</strong> kg · {c.percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

