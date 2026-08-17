'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import { GearItemData } from '@/lib/mock/mon-materiel-marceline';
import { evaluateGearAlerts } from '@/lib/equipmentAdapter';

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
  onOpenDetail?: () => void;
  onAddProductToInventory?: () => void;
  onAddToCart?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function formatWeight(g?: number | null): string {
  if (g == null || g <= 0) return '';
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`;
  return `${g} g`;
}

export default function UnifiedGearCard({
  item,
  product,
  isOwned,
  onOpenDetail,
  onAddProductToInventory,
  onAddToCart,
  onEdit,
  onDelete,
}: UnifiedGearCardProps) {
  const name = item?.name || product?.name || 'Équipement';
  const brand = item?.brand || product?.brand || '';
  const weightG = item?.weight_g ?? product?.weight_g ?? 0;
  const image = item?.image || product?.image || '/assets/images/no_image.png';
  const price = product?.price_eur ?? null;
  const weight = formatWeight(weightG);

  // Single most important alert — not a list of all alerts
  const alert = item
    ? (() => {
        const a = evaluateGearAlerts({
          id: item.id,
          user_id: '',
          name: item.name,
          category: item.category,
          weight_g: item.weight_g || 0,
          condition: item.condition as any,
          loan_status: item.loan_status,
          loan_to_name: item.loan_to_name,
          notes: item.notes,
          usage_count: item.sorties_count,
        });
        if (a.isLent) return { label: `Prêté`, color: 'bg-amber-500' };
        if (a.hasMaintenanceDue) return { label: 'Entretien', color: 'bg-rose-500' };
        if (a.hasExpired) return { label: 'Expiré', color: 'bg-rose-500' };
        return null;
      })()
    : null;

  // ─── Non-owned card: suggestion from catalog ───
  if (!isOwned) {
    return (
      <motion.div
        layout="position"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="group relative bg-white rounded-2xl overflow-hidden flex flex-col justify-between border border-black/[0.05]"
        style={{ boxShadow: '0 1px 3px rgba(11,31,23,0.06)' }}
      >
        {/* Image */}
        <div className="relative aspect-[4/3] bg-[#FBFAF6] overflow-hidden">
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover opacity-75 group-hover:opacity-100 transition-opacity duration-300"
          />
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[9px] font-mono px-2 py-0.5 rounded-md">
            À compléter
          </div>
        </div>

        {/* Content */}
        <div className="p-3 pb-3.5 flex flex-col flex-1 justify-between">
          <div>
            {brand && (
              <p className="text-[11px] text-[#6B7A72] mb-0.5 truncate">{brand}</p>
            )}
            <h4 className="text-[13px] font-semibold text-[#0B1F17] leading-snug line-clamp-2 mb-1.5">
              {name}
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-[#6B7A72] mb-2.5">
              {weight && <span>{weight}</span>}
              {price != null && weight && <span>·</span>}
              {price != null && <span className="font-bold text-[#0B1F17] font-mono">{price} €</span>}
            </div>
          </div>

          {/* 2 Actions : J'ai déjà / Mettre au panier */}
          <div className="flex gap-1.5 pt-1 border-t border-black/[0.04]">
            {onAddProductToInventory && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddProductToInventory();
                }}
                className="flex-1 py-1.5 px-2 bg-black/[0.04] hover:bg-black/[0.08] text-[#0B1F17] rounded-lg text-[10px] font-semibold transition-colors truncate"
                title="Ajouter à mon matériel possédé"
              >
                + J'ai déjà
              </button>
            )}
            {onAddToCart && price != null && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart();
                }}
                className="flex-1 py-1.5 px-2 bg-[#17402C] hover:bg-[#0B1F17] text-white rounded-lg text-[10px] font-bold transition-colors truncate shadow-2xs"
                title="Mettre dans le panier"
              >
                🛒 Acheter
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // ─── Owned card: user's gear ───
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="group relative bg-white rounded-2xl overflow-hidden cursor-pointer"
      style={{ boxShadow: '0 1px 3px rgba(11,31,23,0.06)' }}
      onClick={onOpenDetail}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetail?.();
        }
      }}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-[#FBFAF6] overflow-hidden">
        <Image
          src={image}
          alt={name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
        />

        {/* Single priority indicator dot */}
        {alert && (
          <div className="absolute top-2.5 right-2.5">
            <span
              className={`block w-2 h-2 rounded-full ${alert.color}`}
              title={alert.label}
            />
          </div>
        )}
      </div>

      {/* Content — minimal: brand, name, weight */}
      <div className="p-3 pb-3.5">
        {brand && (
          <p className="text-[11px] text-[#6B7A72] mb-0.5 truncate">{brand}</p>
        )}
        <h4 className="text-[13px] font-semibold text-[#0B1F17] leading-snug line-clamp-2 mb-1">
          {name}
        </h4>
        <div className="flex items-center justify-between">
          {weight && (
            <span className="text-[11px] text-[#6B7A72] tabular-nums">{weight}</span>
          )}
          {alert && (
            <span className="text-[10px] font-medium text-[#6B7A72]">
              {alert.label}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
