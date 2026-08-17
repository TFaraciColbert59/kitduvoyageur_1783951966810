'use client';

import React from 'react';
import { Icon } from './PreparationIcons';

export interface UnifiedEqItem {
  req: any;
  status: 'missing' | 'partial' | 'ok';
  available: number;
  matching: any[];
}

interface EquipmentUnifiedListProps {
  items: UnifiedEqItem[];
  canEdit: boolean;
  targetDate?: string;
  onAdd: (label: string, cat: string) => void;
  onAddToCart?: (label: string, cat: string) => void;
  onQty: (itemId: string, delta: number) => void;
  onDelete: (itemId: string) => void;
}

const STATUS_LABEL: Record<UnifiedEqItem['status'], string> = {
  missing: 'Manquant',
  partial: 'Partiel',
  ok: 'Suffisant',
};

const STATUS_STYLE: Record<UnifiedEqItem['status'], string> = {
  missing: 'bg-[#B85838]/15 text-[#9A3412] border border-[#B85838]/30',
  partial: 'bg-amber-500/15 text-amber-950 border border-amber-500/30',
  ok: 'bg-emerald-600/15 text-emerald-950 border border-emerald-600/30',
};

/**
 * Liste d'équipement UNIQUE et triée : « manquant » en haut, « possédé » en bas.
 * Chaque carte permet d'ajouter à l'équipement ou de mettre dans le panier si non possédé.
 */
export const EquipmentUnifiedList: React.FC<EquipmentUnifiedListProps> = ({
  items,
  canEdit,
  targetDate,
  onAdd,
  onAddToCart,
  onQty,
  onDelete,
}) => {
  const daysUntilDeparture = targetDate
    ? Math.ceil((new Date(targetDate).getTime() - Date.now()) / (1000 * 3600 * 24))
    : null;
  const isDeliveryTight = daysUntilDeparture !== null && daysUntilDeparture <= 3 && daysUntilDeparture >= 0;

  if (items.length === 0) {
    return (
      <div className="bg-white/20 backdrop-blur-md p-6 rounded-2xl border border-white/30 border-dashed text-center">
        <div className="text-2xl mb-1">🎒</div>
        <p className="text-xs font-black text-[#1C2620]">Aucun équipement à préparer.</p>
        <p className="text-[10px] text-[#1C2620]/70 font-bold">Ajoute tes affaires depuis ton inventaire.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Alerte de conflit de livraison si départ imminent */}
      {isDeliveryTight && (
        <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-xs text-amber-950 flex items-center gap-2 font-bold">
          <span>⚠️</span>
          <span>Départ dans {daysUntilDeparture} jour{daysUntilDeparture > 1 ? 's' : ''} : les commandes passées aujourd'hui risquent d'arriver après votre départ (délai standard 48h).</span>
        </div>
      )}

      {items.map((it, idx) => {
        const { req, status, available, matching } = it;
        const unit = req.unit || 'unité';
        return (
          <div key={`${req.id}-${idx}`} className="bg-white/20 backdrop-blur-md p-4 rounded-2xl border border-white/40 shadow-sm transition-all hover:bg-white/35 hover:border-white/60 hover:shadow-md">
            {/* Header */}
            <div className="flex items-start gap-2.5">
              <span className={`mt-0.5 shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_STYLE[status]}`}>
                {STATUS_LABEL[status]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-sm text-[#1C2620] truncate">{req.label}</p>
                  {req.priority === 'vital' && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-white bg-[#9A3412] px-1.5 py-0.5 rounded">Vital</span>
                  )}
                </div>
                <p className="text-[11px] font-bold text-[#1C2620]/80 mt-0.5 leading-relaxed">{req.reason}</p>
              </div>
            </div>

            {/* Quantités */}
            <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-white/30">
              <span className="text-[10px] font-mono uppercase font-black text-[#1C2620]/80">
                Requis : <span className="text-[#1C2620]">{req.required} {unit}</span>
              </span>
              <span className="text-[10px] font-mono uppercase font-black text-[#1C2620]/80">
                Possédé : <span className={available >= req.required ? 'text-emerald-700' : available > 0 ? 'text-amber-700' : 'text-[#B85838]'}>{available} {unit}</span>
              </span>
              {req.needsRefill && (
                <span className="ml-auto text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-600/15 text-sky-800 border border-sky-600/30" title="Contenance maximale atteinte">
                  💧 Prévoir ravitaillement
                </span>
              )}
            </div>

            {/* Articles possédés associés */}
            {(matching || []).length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2.5">
                {matching.map((d) => {
                  const item = d.item;
                  const qty = item?.quantity ?? 1;
                  return (
                    <div key={item?.id || d.reason} className="flex items-center gap-2 bg-white/25 border border-white/30 rounded-xl px-2.5 py-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black text-[#1C2620] truncate">{item?.name || 'Équipement'}</p>
                        <p className="text-[9px] font-mono text-[#1C2620]/60">{item?.condition || 'bon'} · {qty} {unit}{item?.weight_g ? ` · ${item.weight_g}g` : ''}</p>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onQty(item?.id, -1)}
                            disabled={qty <= 1}
                            className="w-6 h-6 rounded-md bg-[#1C2620]/10 hover:bg-[#1C2620]/20 text-[#1C2620] text-xs font-black disabled:opacity-40 cursor-pointer"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-[11px] font-mono font-black text-[#1C2620]">{qty}</span>
                          <button
                            type="button"
                            onClick={() => onQty(item?.id, 1)}
                            className="w-6 h-6 rounded-md bg-[#1C2620]/10 hover:bg-[#1C2620]/20 text-[#1C2620] text-xs font-black cursor-pointer"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(item?.id)}
                            className="w-6 h-6 rounded-md ml-1 text-[#B85838] hover:bg-[#B85838]/10 text-xs font-black cursor-pointer"
                            title="Supprimer cet équipement"
                          >
                            🗑
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Actions : Ajouter à mon équipement OU Mettre dans le panier */}
            {canEdit && status !== 'ok' && (
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => onAdd(req.label, req.categoryKeywords[0] || 'Autre')}
                  className="bg-[#1C2620] hover:bg-[#2D4034] text-white text-[11px] font-black px-3.5 py-1.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Icon name="plus" className="w-3.5 h-3.5" /> J'ai déjà cet équipement
                </button>
                {onAddToCart && (
                  <button
                    type="button"
                    onClick={() => onAddToCart(req.label, req.categoryKeywords[0] || 'Autre')}
                    className="bg-white/80 hover:bg-white text-[#1C2620] text-[11px] font-black px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-black/10 shadow-xs"
                  >
                    <Icon name="bag" className="w-3.5 h-3.5" /> Mettre dans le panier (Livraison 48h)
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};