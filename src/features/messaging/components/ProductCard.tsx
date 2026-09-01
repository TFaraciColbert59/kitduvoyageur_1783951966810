"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { ProductMessageMeta } from '../types/messaging.types';

interface ProductCardProps {
  meta: ProductMessageMeta;
  isMine: boolean;
}

const formatPrice = (cents?: number | null): string | null => {
  if (cents == null) return null;
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
};

export const ProductCard: React.FC<ProductCardProps> = ({ meta, isMine }) => {
  const href = meta.product_slug ? `/produit/${meta.product_slug}` : '/materiel/inventaire';
  const title = meta.name || 'Équipement LKDV';
  const price = formatPrice(meta.price_cents);
  const imgSrc = meta.photo_url || '/assets/images/no_image.png';

  return (
    <Link
      href={href}
      className={`mt-2 max-w-[240px] rounded-2xl overflow-hidden flex flex-col ${
        isMine
          ? 'bg-white/15 border-white/30'
          : 'bg-white/70 border-stone-200/70'
      } border shadow-sm active:scale-[0.98] transition-transform`}
    >
      <div className="relative w-full h-24 bg-stone-100">
        <Image
          src={imgSrc}
          alt={title}
          fill
          className="object-cover"
          sizes="240px"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
          }}
        />
        <span
          className={`absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            isMine ? 'bg-[#17402C]/70 text-white' : 'bg-[#17402C]/10 text-[#17402C]'
          }`}
        >
          Équipement
        </span>
      </div>
      <div
        className={`px-3 py-2 flex items-center justify-between gap-2 ${
          isMine ? 'text-[#FAF8F5]' : 'text-[#17402C]'
        }`}
      >
        <p className="text-[13px] font-bold truncate">{title}</p>
        {price && (
          <span
            className={`text-[13px] font-bold shrink-0 ${
              isMine ? 'text-white/90' : 'text-[#2D6B4A]'
            }`}
          >
            {price}
          </span>
        )}
      </div>
    </Link>
  );
};