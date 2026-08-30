'use client';
import { Droplets, Flame, Utensils, Zap, Clock } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

interface DepartConsumablesProps {
  consumables: Record<string, number>;
  durationDays: number;
  participantsCount: number;
}

export function DepartConsumables({
  consumables,
  durationDays,
  participantsCount,
}: DepartConsumablesProps) {
  const waterLiters = consumables.water ?? 0;
  const gasGrams = consumables.gas ?? 0;
  const mealsCount = consumables.meals ?? 0;
  const snacksCount = consumables.snacks ?? 0;

  const hasAny = waterLiters > 0 || gasGrams > 0 || mealsCount > 0 || snacksCount > 0;
  if (!hasAny) return null;

  const tiles = [
    {
      id: 'water',
      label: 'Eau estimée',
      value: `${waterLiters} L`,
      detail: `${durationDays}j · ${participantsCount} pers.`,
      icon: Droplets,
      color: 'text-[#2C4857] bg-[rgba(75,107,124,0.12)]',
    },
    {
      id: 'gas',
      label: 'Gaz réchaud',
      value: `${gasGrams} g`,
      detail: `${Math.ceil(gasGrams / 100)} cartouche(s)`,
      icon: Flame,
      color: 'text-[#8C6418] bg-[rgba(200,154,59,0.14)]',
    },
    {
      id: 'meals',
      label: 'Repas bivouac',
      value: `${mealsCount}`,
      detail: 'Lyophilisés / chauds',
      icon: Utensils,
      color: 'text-[#2D6B4A] bg-[rgba(45,107,74,0.12)]',
    },
    {
      id: 'snacks',
      label: 'En-cas & énergie',
      value: `${snacksCount}`,
      detail: 'Barres / fruits secs',
      icon: Zap,
      color: 'text-[#17402C] bg-[rgba(23,64,44,0.10)]',
    },
  ];

  return (
    <GlassCard tone="neutral" ariaLabelledBy="consumables-heading">
      <div className="p-4 sm:p-5 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2
              id="consumables-heading"
              className="text-[13px] sm:text-sm font-semibold text-[#17402C] flex items-center gap-2"
            >
              <Droplets size={15} className="text-[#5A7064]" aria-hidden="true" />
              Consommables estimés
            </h2>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-[#5A7064]">
            <Clock size={12} aria-hidden="true" />
            <span>Autonomie {durationDays} jours</span>
          </div>
        </div>

        {/* Grille 4 tuiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
          {tiles.map((tile) => {
            const IconComp = tile.icon;
            return (
              <div
                key={tile.id}
                className="glass-sub-card p-3 flex flex-col justify-between gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#5A7064]">
                    {tile.label}
                  </span>
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center ${tile.color}`}
                    aria-hidden="true"
                  >
                    <IconComp size={13} />
                  </div>
                </div>

                <div>
                  <div className="text-base sm:text-lg font-mono font-bold text-[#17402C]">
                    {tile.value}
                  </div>
                  <p className="text-[10px] text-[#5A7064] mt-0.5 truncate">
                    {tile.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}
