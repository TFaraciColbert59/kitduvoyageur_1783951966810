'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { Check, Clock, ShoppingBag } from 'lucide-react';
import type { KitListItem } from '@/features/materiel/services/getKits';

interface Props {
  kits: KitListItem[];
  onSelect?: (id: string) => void;
}

/** W-K-2 + W-K-3 KitsGrid — Vue d'un kit unique (sans filtres, articles grisés si non arrivés). */
export function KitsGrid({ kits, onSelect }: Props) {
  const activeKits = kits.filter((k) => !k.is_trashed);
  const [selectedId, setSelectedId] = useState<string>(activeKits[0]?.id ?? '');

  const currentKit = activeKits.find((k) => k.id === selectedId) || activeKits[0] || null;

  if (!currentKit) {
    return (
      <GlassCard tone="sage" className="p-5 text-center">
        <Eyebrow>Mon Kit</Eyebrow>
        <p className="text-sm text-[#5A7064] mt-2 mb-3">
          Aucun kit créé pour le moment. Utilisez l&apos;assembleur ci-dessous pour composer votre premier kit sur-mesure.
        </p>
      </GlassCard>
    );
  }

  const completionPct = currentKit.item_count
    ? Math.round((currentKit.checked_count / currentKit.item_count) * 100)
    : 100;

  return (
    <GlassCard tone="sage" className="p-4 sm:p-5 flex flex-col gap-4">
      {/* Header avec sélecteur si plusieurs kits */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Eyebrow>Kit Actif</Eyebrow>
          <h2 className="font-display font-bold text-[20px] sm:text-[24px] text-[#17402C] mt-0.5">
            {currentKit.name}
          </h2>
        </div>

        {activeKits.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#5A7064]">Changer :</span>
            <select
              value={currentKit.id}
              onChange={(e) => {
                setSelectedId(e.target.value);
                onSelect?.(e.target.value);
              }}
              aria-label="Sélectionner le kit affiché"
              className="glass-input py-1 px-2.5 text-xs text-[#17402C] font-semibold"
            >
              {activeKits.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {currentKit.description && (
        <p className="text-xs sm:text-sm text-[#365233] leading-relaxed">
          {currentKit.description}
        </p>
      )}

      {/* Résumé des indicateurs du kit */}
      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-white/[0.06] border border-white/20">
        <div className="text-center">
          <span className="text-[10px] uppercase font-bold text-[#5A7064]">Poids</span>
          <p className="font-mono font-bold text-xs sm:text-sm text-[#17402C]">
            {(currentKit.total_weight_g / 1000).toFixed(1)} kg
          </p>
        </div>
        <div className="text-center border-x border-white/15">
          <span className="text-[10px] uppercase font-bold text-[#5A7064]">Articles</span>
          <p className="font-mono font-bold text-xs sm:text-sm text-[#17402C]">
            {currentKit.item_count}
          </p>
        </div>
        <div className="text-center">
          <span className="text-[10px] uppercase font-bold text-[#5A7064]">Complétude</span>
          <p className="font-mono font-bold text-xs sm:text-sm text-[#17402C]">
            {completionPct}%
          </p>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#2D6B4A] to-[#A3C4A3] transition-all duration-300"
          style={{ width: `${completionPct}%` }}
        />
      </div>

      {/* Liste des articles du kit (avec état grisé pour les non reçus) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-bold text-[#365233]">
          <span>Composition du kit ({currentKit.items.length})</span>
          <span className="text-[11px] text-[#5A7064]">
            {currentKit.season ? `Saison : ${currentKit.season}` : ''}
          </span>
        </div>

        {currentKit.items.length === 0 ? (
          <p className="text-xs text-[#5A7064] p-3 text-center">Aucun article dans ce kit.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {currentKit.items.map((item, idx) => {
              const isUnowned = !item.product_ownership_id;
              return (
                <div
                  key={`${item.name}-${idx}`}
                  className={`p-2.5 rounded-xl flex items-center justify-between gap-2 border transition-all ${
                    isUnowned
                      ? 'bg-white/[0.04] border-dashed border-white/30 opacity-65'
                      : 'glass-sub-card'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                        isUnowned
                          ? 'border-white/30 bg-white/5 text-[#5A7064]'
                          : 'bg-[#17402C]/10 border-[#17402C]/20 text-[#17402C]'
                      }`}
                    >
                      {isUnowned ? <Clock size={11} /> : <Check size={12} strokeWidth={3} />}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-semibold truncate ${
                          isUnowned ? 'text-[#5A7064] italic line-through' : 'text-[#17402C]'
                        }`}
                      >
                        {item.name}
                      </p>
                      <p className="text-[10px] text-[#5A7064]">
                        {item.category || 'Équipement'} · {item.weight_g ? `${item.weight_g}g` : '0g'}
                      </p>
                    </div>
                  </div>

                  {isUnowned && (
                    <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#17402C]/10 text-[#17402C] border border-[#17402C]/20 flex items-center gap-1">
                      <ShoppingBag size={9} />
                      En commande
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
