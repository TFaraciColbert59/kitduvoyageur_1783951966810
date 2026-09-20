'use client';

import React from 'react';
import { usePreparationStore } from '../../stores/usePreparationStore';
import { Badge, Card } from '@/components/ui';

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

  const mulBadge = (() => {
    switch (mulCategory) {
      case 'ultralight':
        return { label: 'Ultra-Léger (MUL < 4.5 kg)', tone: 'sage' as const };
      case 'light':
        return { label: 'Randonnée Légère (< 9 kg)', tone: 'info' as const };
      case 'traditional':
      default:
        return { label: 'Charge Traditionnelle (> 9 kg)', tone: 'warn' as const };
    }
  })();

  // Distribution des pourcentages
  const total = totalWeightGrams > 0 ? totalWeightGrams : 1;
  const basePct = Math.round((baseWeightGrams / total) * 100);
  const consumablePct = Math.round((consumableWeightGrams / total) * 100);
  const wornPct = Math.round((wornWeightGrams / total) * 100);

  // Ventilation par catégorie des objets dans le sac
  const byCategory = new Map<string, number>();
  for (const item of items.filter((i) => i.status === 'packed' && !i.isWorn)) {
    const cat = item.category || 'misc';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + item.weightGrams * (item.quantity || 1));
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
    <div className="space-y-[var(--space-4)] animate-in fade-in duration-200">
      <Card className="space-y-[var(--space-3)]">
        <div className="flex items-center justify-between gap-[var(--space-2)]">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
              BILAN PONDÉRAL SCIENTIFIQUE
            </span>
            <h3 className="text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
              Base Weight & Poids Total
            </h3>
          </div>

          <Badge tone={mulBadge.tone}>{mulBadge.label}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-[var(--space-2)] text-center sm:grid-cols-4">
          <Card variant="compact" className="flex flex-col">
            <span className="block font-mono text-[9px] uppercase text-[color:var(--lkv-text-muted)]">
              🎒 Base Weight
            </span>
            <span className="font-mono text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-text-primary)]">
              {baseKg} <span className="text-xs font-normal">kg</span>
            </span>
            <span className="block text-[9px] text-[color:var(--lkv-text-muted)]">Sac hors vivres</span>
          </Card>

          <Card variant="compact" className="flex flex-col">
            <span className="block font-mono text-[9px] uppercase text-[color:var(--lkv-text-muted)]">
              🥫 Consommables
            </span>
            <span className="font-mono text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--sand-800)]">
              {consumableKg} <span className="text-xs font-normal">kg</span>
            </span>
            <span className="block text-[9px] text-[color:var(--lkv-text-muted)]">
              Eau, vivres, gaz
            </span>
          </Card>

          <Card variant="compact" className="flex flex-col">
            <span className="block font-mono text-[9px] uppercase text-[color:var(--lkv-text-muted)]">
              👕 Porté sur soi
            </span>
            <span className="font-mono text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--sky-800)]">
              {wornKg} <span className="text-xs font-normal">kg</span>
            </span>
            <span className="block text-[9px] text-[color:var(--lkv-text-muted)]">
              Vêtements, bâtons
            </span>
          </Card>

          <Card variant="compact" tone="sage" className="flex flex-col">
            <span className="block font-mono text-[9px] font-bold uppercase text-[color:var(--sage-800)]">
              ⚖️ Poids sur le dos
            </span>
            <span className="font-mono text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-text-primary)]">
              {totalPackKg} <span className="text-xs font-normal">kg</span>
            </span>
            <span className="block text-[9px] text-[color:var(--sage-800)]">Base + Consommables</span>
          </Card>
        </div>

        <div className="space-y-[var(--space-2)] pt-[var(--space-1)]">
          <div className="flex h-3 w-full overflow-hidden rounded-full border border-[color:var(--lkv-border-subtle)] bg-[color:var(--lkv-surface-muted)] p-0.5">
            <div
              className="h-full rounded-l-full bg-[color:var(--sage-600)] transition-all duration-500"
              style={{ width: `${Math.max(2, basePct)}%` }}
              title={`Base Weight : ${basePct}%`}
            />
            <div
              className="h-full bg-[color:var(--sand-500)] transition-all duration-500"
              style={{ width: `${Math.max(2, consumablePct)}%` }}
              title={`Consommables : ${consumablePct}%`}
            />
            <div
              className="h-full rounded-r-full bg-[color:var(--sky-500)] transition-all duration-500"
              style={{ width: `${Math.max(2, wornPct)}%` }}
              title={`Porté : ${wornPct}%`}
            />
          </div>

          <div className="flex items-center justify-between font-mono text-[10px] text-[color:var(--lkv-text-muted)]">
            <span className="flex items-center gap-[var(--space-1)]">
              <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--sage-600)]" /> Base
              ({basePct}%)
            </span>
            <span className="flex items-center gap-[var(--space-1)]">
              <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--sand-500)]" />{' '}
              Vivres ({consumablePct}%)
            </span>
            <span className="flex items-center gap-[var(--space-1)]">
              <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--sky-500)]" /> Porté (
              {wornPct}%)
            </span>
          </div>
        </div>
      </Card>

      <div className="space-y-[var(--space-2)]">
        <h4 className="px-1 text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
          Ventilation du Matériel par Poste
        </h4>

        <ul className="space-y-[var(--space-2)]">
          {categoryList.map((cat) => (
            <li key={cat.category}>
              <Card
                variant="compact"
                className="flex items-center justify-between gap-[var(--space-3)] text-[length:var(--lkv-text-footnote)]"
              >
                <div className="flex flex-1 items-center gap-[var(--space-2)]">
                  <span className="font-bold text-[color:var(--lkv-text-primary)]">{cat.label}</span>
                  <span className="text-[10px] text-[color:var(--lkv-text-muted)]">
                    ({cat.percentage}%)
                  </span>
                </div>

                <div className="flex items-center gap-[var(--space-2)] font-mono">
                  <span className="font-bold text-[color:var(--lkv-text-primary)]">
                    {cat.weightGrams} g
                  </span>
                  <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-[color:var(--lkv-surface-muted)] sm:block">
                    <div
                      className="h-full rounded-full bg-[color:var(--sage-600)]"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
