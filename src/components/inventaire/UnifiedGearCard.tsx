'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { GearItemData } from '@/lib/mock/mon-materiel-marceline';

interface UnifiedGearCardProps {
  item?: GearItemData;
  product?: {
    id: string;
    slug?: string;
    name: string;
    brand?: string;
    category?: string;
    price_eur?: number;
    weight_g?: number;
    image?: string;
    score_kdv?: number;
    description?: string;
  };
  isOwned: boolean;
  isFavorite?: boolean;
  assignedKits?: Array<{ id: string; letter: string; name: string }>;
  onOpenDetail?: () => void;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  onAddProductToInventory?: () => void;
  onAddToCart?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function formatWeight(g?: number | null): string {
  if (g == null || g <= 0) return '';
  if (g >= 1000) {
    return `${(g / 1000).toLocaleString('fr-FR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} kg`;
  }
  return `${g} g`;
}

function getConditionMeta(condition?: string): { label: string; className: string } {
  const c = condition?.toLowerCase() || '';
  if (c.includes('neuf') || c.includes('new')) {
    return { label: 'Neuf', className: 'text-[#1F4A3A] bg-white/95' };
  }
  if (c.includes('moyen') || c.includes('fair') || c.includes('use') || c.includes('usé')) {
    return { label: 'Usure moyenne', className: 'text-[#C99B5A] bg-white/95' };
  }
  if (c.includes('repar') || c.includes('répar') || c.includes('poor') || c.includes('critique')) {
    return { label: 'À réparer', className: 'text-[#C15A5A] bg-white/95' };
  }
  return { label: 'Excellent état', className: 'text-[#1F4A3A] bg-white/95' };
}

export default function UnifiedGearCard({
  item,
  product,
  isOwned,
  isFavorite: propFavorite,
  assignedKits = [],
  onOpenDetail,
  onToggleFavorite,
  onAddProductToInventory,
  onAddToCart,
  onEdit,
  onDelete,
}: UnifiedGearCardProps) {
  const [isFav, setIsFav] = useState(propFavorite ?? item?.is_favorite ?? false);
  const name = item?.name || product?.name || 'Équipement';
  const brand = item?.brand || product?.brand || '';
  const weightG = item?.weight_g ?? product?.weight_g ?? 0;
  const image = item?.image || product?.image || '/assets/images/no_image.png';
  const price = product?.price_eur ?? null;
  const weightStr = formatWeight(weightG);
  const conditionMeta = getConditionMeta(item?.condition);

  const handleFavClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFav(!isFav);
    onToggleFavorite?.(e);
  };

  // ─── Non-owned card: Suggestion from catalog ───
  if (!isOwned) {
    return (
      <motion.div
        layout="position"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
        className="group relative bg-white rounded-[16px] overflow-hidden flex flex-col justify-between border border-[#0B1F17]/[0.08] shadow-[0_2px_8px_rgba(11,31,23,0.04)] hover:shadow-[0_8px_20px_rgba(11,31,23,0.08)] transition-all"
      >
        <div className="relative aspect-[4/3] bg-[#F8FAF8] overflow-hidden flex items-center justify-center p-2.5">
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
          />
          <span className="absolute top-2 left-2 bg-[#0B1F17]/75 backdrop-blur-md text-white text-[9.5px] font-sans font-medium px-2 py-0.5 rounded-full">
            Catalogue
          </span>
          {weightStr && (
            <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-[#0B1F17]/75 backdrop-blur-md text-white rounded-full font-mono text-[9.5px]">
              {weightStr}
            </span>
          )}
        </div>

        <div className="p-3 flex flex-col flex-1 justify-between gap-2">
          <div>
            <h4 className="text-[13px] font-medium text-[#111614] leading-snug line-clamp-2">
              {name}
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-[#566159] mt-1">
              {brand && <span className="truncate">{brand}</span>}
              {price != null && (
                <span className="font-mono font-medium text-[#1F4A3A] ml-auto">
                  {price} €
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-1.5 pt-2 border-t border-[#0B1F17]/[0.06]">
            {onAddProductToInventory && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddProductToInventory();
                }}
                className="flex-1 py-1.5 px-2 bg-[#0B1F17]/[0.05] hover:bg-[#0B1F17]/[0.09] text-[#111614] rounded-lg text-[10.5px] font-medium transition-colors truncate"
              >
                + Ajouter
              </button>
            )}
            {onAddToCart && price != null && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart();
                }}
                className="flex-1 py-1.5 px-2 bg-[#1F4A3A] hover:bg-[#0B1F17] text-white rounded-lg text-[10.5px] font-medium transition-colors truncate shadow-xs"
              >
                🛒 Acheter
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // ─── Owned Card: User's gear matching Inventaire.html ───
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      onClick={onOpenDetail}
      className="group relative bg-white rounded-[16px] overflow-hidden cursor-pointer border border-[#0B1F17]/[0.06] shadow-[0_2px_8px_rgba(11,31,23,0.04)] hover:shadow-[0_8px_24px_rgba(11,31,23,0.08)] transition-all flex flex-col justify-between"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetail?.();
        }
      }}
    >
      {/* Cover */}
      <div className="relative aspect-[4/3] bg-[#F3F2ED] overflow-hidden flex items-center justify-center">
        <Image
          src={image}
          alt={name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Status pill (top-left) */}
        <span
          className={`absolute top-2 left-2 px-2.5 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-md shadow-xs ${conditionMeta.className}`}
        >
          {conditionMeta.label}
        </span>

        {/* Favorite Heart (top-right) */}
        <button
          type="button"
          onClick={handleFavClick}
          className={`absolute top-2 right-2 w-7 h-7 rounded-full backdrop-blur-md flex items-center justify-center transition-transform active:scale-90 ${
            isFav
              ? 'bg-white/95 text-[#C99B5A]'
              : 'bg-white/80 text-[#566159] hover:text-[#111614] hover:bg-white'
          }`}
          title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <svg
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill={isFav ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M12 20s-7-4.35-7-10a4 4 0 017-2.65A4 4 0 0119 10c0 5.65-7 10-7 10z" />
          </svg>
        </button>

        {/* Weight tag (bottom-right) */}
        {weightStr && (
          <span className="absolute bottom-2 right-2 px-2.5 py-0.5 bg-[#0B1F17]/75 backdrop-blur-md text-white rounded-full font-mono text-[10px]">
            {weightStr}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3 pb-3.5 flex flex-col justify-between flex-1">
        <div>
          <h4 className="text-[13.5px] font-medium text-[#111614] leading-[1.3] line-clamp-2">
            {name}
          </h4>
          <p className="text-[11px] text-[#566159] mt-0.5 truncate">
            {brand ? `${brand}` : ''}
            {item?.purchase_price ? ` · ${item.purchase_price} €` : ''}
            {item?.purchase_date ? ` · ${new Date(item.purchase_date).getFullYear()}` : ''}
          </p>
        </div>

        {/* Kits membership row */}
        <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-[#0B1F17]/[0.06] text-[11px] text-[#566159]">
          <span>Dans</span>
          {assignedKits.length > 0 ? (
            <div className="flex items-center gap-1">
              {assignedKits.slice(0, 3).map((k, idx) => {
                const bg =
                  idx === 0
                    ? 'bg-[#DDEEE5] text-[#1F4A3A]'
                    : idx === 1
                    ? 'bg-[#FBF0DE] text-[#C99B5A]'
                    : 'bg-[#1F4A3A]/10 text-[#1F4A3A]';
                return (
                  <span
                    key={k.id || idx}
                    className={`w-3.5 h-3.5 rounded-[4px] font-serif italic text-[9px] font-medium inline-flex items-center justify-center ${bg}`}
                    title={k.name}
                  >
                    {k.letter || 'K'}
                  </span>
                );
              })}
              <span className="ml-1 text-[10.5px]">
                {assignedKits.length} kit{assignedKits.length > 1 ? 's' : ''}
              </span>
            </div>
          ) : (
            <span className="text-[#566159]/70 italic text-[10.5px]">Aucun kit</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

