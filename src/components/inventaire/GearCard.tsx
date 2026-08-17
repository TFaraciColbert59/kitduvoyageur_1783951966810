'use client';

import React, { useState, useMemo } from 'react';
import Image from "next/image";
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { GearItemData } from '@/lib/mock/mon-materiel-marceline';

interface GearCardProps {
  item: GearItemData;
  viewMode?: 'grid' | 'list';
  onToggleFavorite: (id: string) => void;
  onEdit: (item: GearItemData) => void;
  onDelete: (id: string) => void;
  onLoan?: (item: GearItemData) => void;
}

const CONDITION_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  neuf: { label: 'Neuf', bg: 'bg-[#D8E8DC]', text: 'text-[#132219]', border: 'border-[#A3C9A8]' },
  excellent: { label: 'Excellent état', bg: 'bg-[#D8E8DC]/80', text: 'text-[#132219]', border: 'border-[#A3C9A8]' },
  bon: { label: 'Bon état', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  usé: { label: 'Usé moyen', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  à_réparer: { label: 'À réparer', bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-300' },
  à_remplacer: { label: 'À remplacer', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

export default function GearCard({
  item,
  viewMode = 'grid',
  onToggleFavorite,
  onEdit,
  onDelete,
  onLoan,
}: GearCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const cond = CONDITION_STYLES[item.condition || 'excellent'] || {
    label: item.condition || 'Excellente',
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-200',
  };

  const formattedWeight = item.weight_g && item.weight_g >= 1000
    ? `${(item.weight_g / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`
    : item.weight_g !== undefined ? `${item.weight_g} g` : '0 g';

  // Determine product slug for direct boutique page navigation
  const productSlug = useMemo(() => {
    if (!item) return null;
    if (item.ref_code && item.ref_code.startsWith('prod-')) return item.ref_code.replace('prod-', '') + '-achat';
    const name = item.name?.toLowerCase() ?? '';
    if (name.includes('farpoint')) return 'osprey-farpoint-40-achat';
    if (name.includes('atmos')) return 'osprey-atmos-ag-65-achat';
    if (name.includes('hubba')) return 'msr-hubba-hubba-nx-2-achat';
    if (name.includes('spark')) return 'sea-to-summit-spark-sp1-achat';
    if (name.includes('neoair')) return 'thermarest-neoair-xlite-achat';
    if (name.includes('torrentshell')) return 'patagonia-torrentshell-3l-achat';
    if (name.includes('actik')) return 'petzl-actik-core-achat';
    if (name.includes('sawyer')) return 'sawyer-mini-achat';
    if (name.includes('pocketrocket')) return 'msr-pocketrocket-2-achat';
    if (name.includes('inreach')) return 'garmin-inreach-mini-2-achat';
    if (name.includes('opinel')) return 'opinel-n8-inoa-achat';
    return item.product_id || null;
  }, [item]);

  if (viewMode === 'list') {
    return (
      <Link href={productSlug ? `/produit/${productSlug}` : `/mon-materiel/${item.id}`} className="block group" onClick={e => e.stopPropagation()}>
        <div className="bg-white rounded-2xl p-4 border border-[#E8E4D8] hover:border-[#132219]/30 transition-all shadow-sm flex items-center justify-between gap-4 font-sans group">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-xl overflow-hidden relative shrink-0 border border-[#E8E4D8] bg-[#F5F3ED]">
              <Image src={item.image || '/assets/images/no_image.png'} alt={item.alt || item.name} fill className="object-cover" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${cond.bg} ${cond.text} ${cond.border}`}>{cond.label}</span>
                {item.quantity && item.quantity > 1 && (
                  <span className="text-[10px] font-mono font-bold bg-[#132219] text-white px-2 py-0.5 rounded-full">×{item.quantity}</span>
                )}
              </div>
              <h4 className="font-extrabold text-sm text-[#132219] truncate mt-1">{item.name}</h4>
              <p className="text-xs text-[#132219]/60 truncate font-medium">{item.brand} {item.model}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="font-mono font-bold text-xs bg-[#F5F3ED] text-[#132219] px-3 py-1 rounded-full border border-[#E8E4D8]">{formattedWeight}</span>
            <button onClick={(e) => { e.preventDefault(); onToggleFavorite(item.id); }} className="w-8 h-8 rounded-full bg-[#F5F3ED] hover:bg-[#E8E4D8] flex items-center justify-center transition-colors">
              <Icon name="HeartIcon" size={14} variant={item.is_favorite ? 'solid' : 'outline'} className={item.is_favorite ? 'text-red-500' : 'text-[#132219]/40'} />
            </button>
            <button onClick={(e) => { e.preventDefault(); onEdit(item); }} className="px-3 py-1.5 bg-[#132219] text-white rounded-full text-xs font-bold hover:bg-[#2D5A3D] transition-colors">
              Éditer
            </button>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={productSlug ? `/produit/${productSlug}` : `/mon-materiel/${item.id}`} className="block group" onClick={e => e.stopPropagation()}>
      <div className="bg-white rounded-[0.75rem] border border-[#E8E4D8] hover:border-[#132219]/30 transition-all shadow-sm hover:shadow-md overflow-hidden flex flex-col justify-between font-sans group relative active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
        <div className="relative w-full h-44 bg-[#F5F3ED] overflow-hidden">
          <Image src={item.image || '/assets/images/no_image.png'} alt={item.alt || item.name} fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
            <span className={`text-[10px] font-mono font-bold px-3 py-1 rounded-full border shadow-sm backdrop-blur-md ${cond.bg} ${cond.text} ${cond.border}`}>{cond.label}</span>
            {item.quantity && item.quantity > 1 && (
              <span className="text-[10px] font-mono font-bold bg-[#132219] text-white px-2 py-1 rounded-full shadow-sm">×{item.quantity}</span>
            )}
          </div>
          <button onClick={(e) => { e.preventDefault(); onToggleFavorite(item.id); }} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md shadow-md flex items-center justify-center hover:scale-110 transition-transform" title="Ajouter aux favoris">
            <Icon name="HeartIcon" size={16} variant={item.is_favorite ? 'solid' : 'outline'} className={item.is_favorite ? 'text-red-500' : 'text-[#132219]/50'} />
          </button>
          <div className="absolute bottom-3 right-3 z-10 bg-[#132219]/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-mono font-bold shadow-md border border-white/20">{formattedWeight}</div>
        </div>
        <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
          <div>
            <h4 className="font-extrabold text-sm sm:text-base text-[#132219] leading-snug line-clamp-2">{item.name}</h4>
            <p className="text-xs text-[#132219]/60 font-medium mt-1">{item.brand} {item.model}</p>
          </div>
          {item.notes && (
            <p className="text-[11px] text-[#132219]/70 italic line-clamp-1 bg-[#F5F3ED] px-2.5 py-1 rounded-lg">{item.notes}</p>
          )}
          <div className="pt-2 border-t border-[#1C2620]/5 flex items-center justify-between text-xs text-[#132219]/70">
            <div className="flex items-center gap-2 text-[10px] font-mono text-[#132219]/60">
              {item.loan_status === 'prêté' ? (
                <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Prêté à {item.loan_to_name || 'un ami'}</span>
              ) : (
                <span>Prix: {item.purchase_price}€</span>
              )}
            </div>
            <div className="relative">
              <button onClick={(e) => { e.preventDefault(); setMenuOpen(!menuOpen); }} className="p-1.5 hover:bg-[#F5F3ED] rounded-full transition-colors text-[#132219]/60 hover:text-[#132219]">
                <Icon name="EllipsisHorizontalIcon" size={18} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 bottom-8 z-30 w-44 bg-white rounded-2xl shadow-xl border border-[#E8E4D8] p-1.5 space-y-1 animate-fade-in text-xs font-semibold">
                  <button onClick={(e) => { e.preventDefault(); setMenuOpen(false); onEdit(item); }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F5F3ED] flex items-center gap-2 text-[#132219]">
                    <Icon name="PencilIcon" size={14} />
                    <span>Modifier</span>
                  </button>
                  {onLoan && (
                    <button onClick={(e) => { e.preventDefault(); setMenuOpen(false); onLoan(item); }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F5F3ED] flex items-center gap-2 text-[#132219]">
                      <Icon name="ShareIcon" size={14} />
                      <span>{item.loan_status === 'prêté' ? 'Marquer restitué' : 'Prêter cet article'}</span>
                    </button>
                  )}
                  <button onClick={(e) => { e.preventDefault(); setMenuOpen(false); onDelete(item.id); }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 flex items-center gap-2">
                    <Icon name="TrashIcon" size={14} />
                    <span>Supprimer</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
