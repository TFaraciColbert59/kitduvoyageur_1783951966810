'use client';

/**
 * LKDV — Mon Matériel • Plein écran « À ne pas oublier ».
 * Checklist contextualisée (kit assigné + alertes + règles génériques explicites),
 * filtres par niveau, coche persistée, poids restant et validation de préparation.
 */

import React, { useMemo, useState } from 'react';
import type { DepartureChecklistItem } from '../domain/departure-readiness';
import { SectionCard } from '../components/SectionCard';
import { IconCheck, IconChecklist } from '../components/icons';
import { formatWeight } from '../domain/gear-format';

export interface NotToForgetFullscreenProps {
  checklist: DepartureChecklistItem[];
  checkedSet: Set<string>;
  onToggleChecked: (id: string) => void;
  weightRemainingG?: number | null;
  departureName?: string | null;
  onValidate: () => void;
  onOpenGear?: (gearId: string) => void;
  /** Ouvre le plein écran « Inventaire & catalogue » pré-filtré sur un objet. */
  onNeedStock?: (query: string) => void;
}

type LevelFilter = 'all' | 'critique' | 'verifier' | 'conseille' | 'done';

const LEVEL_META: Record<DepartureChecklistItem['level'], { label: string; cls: string }> = {
  critique: { label: 'Critique', cls: 'bg-[#9B2C2C]/10 text-[#9B2C2C] border-[#9B2C2C]/30' },
  verifier: { label: 'À vérifier', cls: 'bg-[#8C6A1A]/10 text-[#8C6A1A] border-[#8C6A1A]/30' },
  conseille: { label: 'Conseillé', cls: 'bg-[#2D5A3D]/10 text-[#2D5A3D] border-[#2D5A3D]/25' },
  pret: { label: 'Prêt', cls: 'bg-[#2D5A3D]/10 text-[#235030] border-[#2D5A3D]/30' },
};

export function NotToForgetFullscreen({
  checklist,
  checkedSet,
  onToggleChecked,
  weightRemainingG,
  departureName,
  onValidate,
  onOpenGear,
  onNeedStock,
}: NotToForgetFullscreenProps) {
  const [filter, setFilter] = useState<LevelFilter>('all');

  const criticalCount = useMemo(
    () => checklist.filter((c) => c.level === 'critique').length,
    [checklist]
  );
  const toCheckCount = useMemo(
    () => checklist.filter((c) => c.level === 'verifier').length,
    [checklist]
  );
  const doneCount = useMemo(
    () => checklist.filter((c) => checkedSet.has(c.id)).length,
    [checklist, checkedSet]
  );

  const categories = useMemo(() => {
    const map = new Map<string, DepartureChecklistItem[]>();
    for (const item of checklist) {
      const key = item.category;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, [checklist]);

  const matchesFilter = (item: DepartureChecklistItem): boolean => {
    if (filter === 'done') return checkedSet.has(item.id);
    if (filter === 'all') return true;
    if (checkedSet.has(item.id)) return false;
    return item.level === filter;
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Checklist intelligente — vos données + règles génériques">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className={`text-5xl font-extrabold font-mono leading-none ${criticalCount > 0 ? 'text-[#8C6A1A]' : 'text-[#2D5A3D]'}`}>
              {criticalCount + toCheckCount}
            </div>
            <p className="text-xs text-[#1C2620]/70 mt-2">
              {departureName ? `Pour « ${departureName} »` : 'À traiter avant départ'}
            </p>
          </div>
          <div className="space-y-3 text-right">
            <p className="text-xs text-[#1C2620]/70">
              {doneCount}/{checklist.length} cochés
            </p>
            {typeof weightRemainingG === 'number' && weightRemainingG > 0 && (
              <p className="text-xs font-mono font-bold text-[#2D5A3D]">
                Poids restant estimé : {formatWeight(weightRemainingG)}
              </p>
            )}
            <button
              type="button"
              onClick={onValidate}
              className="mt-2 px-4 py-2 rounded-full bg-[#2D5A3D] hover:bg-[#235030] text-white text-xs font-bold transition-all active:scale-95"
            >
              Valider ma préparation
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'Tous'],
              ['critique', 'Bloquants'],
              ['verifier', 'À vérifier'],
              ['conseille', 'Conseillé'],
              ['done', 'Déjà prêt'],
            ] as [LevelFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                filter === key
                  ? 'bg-[#2D5A3D] text-white'
                  : 'bg-white/50 text-[#1C2620]/80 border border-[#1C2620]/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </SectionCard>

{categories.length === 0 && (
        <SectionCard title="Checklist">
          <p className="text-xs text-[#1C2620]/60">Rien à signaler pour le moment.</p>
        </SectionCard>
      )}

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        {categories.map(([cat, items]) => {
          const shown = items.filter(matchesFilter);
          if (shown.length === 0) return null;
          return (
            <SectionCard key={cat} title={`${cat} (${items.length})`}>
              <div className="space-y-2">
              {shown.map((it) => {
                const checked = checkedSet.has(it.id);
                const meta = LEVEL_META[it.level];
                const hasStockInfo = typeof it.availableQty === 'number' && typeof it.requiredQty === 'number';
                const outOfStock = hasStockInfo && it.availableQty === 0;
                return (
                  <div
                    key={it.id}
                    data-checklist-item={it.id}
                    className="p-2.5 rounded-xl bg-white/40 border border-[#1C2620]/7 text-xs flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className={`font-semibold truncate ${checked ? 'text-[#1C2620]/45 line-through' : 'text-[#1C2620]/90'}`}>
                        {it.label}
                      </p>
                      <p className="text-[#1C2620]/60">{it.reason}</p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        <span className={`px-2 py-0.5 rounded-full border font-mono font-bold ${meta.cls}`}>{meta.label}</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#1C2620]/5 border border-[#1C2620]/8 font-mono text-[#1C2620]/60">
                          {it.source === 'donnée' ? 'Vos données' : 'Règle générique'}
                        </span>
                        {hasStockInfo && (
                          <span
                            data-stock-count
                            className={`px-2 py-0.5 rounded-full border font-mono font-bold ${
                              outOfStock
                                ? 'bg-[#9B2C2C]/8 border-[#9B2C2C]/25 text-[#9B2C2C]'
                                : 'bg-[#2D5A3D]/8 border-[#2D5A3D]/25 text-[#2D5A3D]'
                            }`}
                          >
                            {it.availableQty}/{it.requiredQty}
                          </span>
                        )}
                        {it.gearId && onOpenGear && (
                          <button
                            type="button"
                            onClick={() => onOpenGear(it.gearId!)}
                            className="px-2 py-0.5 rounded-full bg-[#2D5A3D]/10 border border-[#2D5A3D]/30 text-[#2D5A3D] font-bold"
                          >
                            Ouvrir la fiche
                          </button>
                        )}
                        {outOfStock && onNeedStock && (
                          <button
                            type="button"
                            onClick={() => onNeedStock(it.searchQuery || it.label)}
                            aria-label={`Ajouter à l’inventaire ${it.label}`}
                            className="px-2 py-0.5 rounded-full bg-[#9B2C2C]/10 border border-[#9B2C2C]/30 text-[#9B2C2C] font-bold"
                          >
                            Aucun article en stock — ajouter
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleChecked(it.id)}
                      aria-pressed={checked}
                      aria-label={checked ? `Décocher ${it.label}` : `Cocher ${it.label}`}
                      className={`w-11 h-11 rounded-lg border shrink-0 flex items-center justify-center transition-all ${
                        checked
                          ? 'bg-[#2D5A3D] border-[#2D5A3D] text-white'
                          : 'border-[#1C2620]/30 text-transparent hover:border-[#1C2620]/60 hover:bg-white/60'
                      }`}
                    >
                      <IconCheck size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        );
      })}
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onValidate}
          className="px-6 py-3 rounded-full bg-[#2D5A3D] hover:bg-[#235030] text-white text-sm font-bold transition-all active:scale-95 inline-flex items-center gap-2"
        >
          <IconChecklist size={16} /> Valider la préparation
        </button>
      </div>
    </div>
  );
}