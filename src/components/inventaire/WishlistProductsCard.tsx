'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useWishlist } from '@/contexts/WishlistContext';

export default function WishlistProductsCard() {
  const { items } = useWishlist();

  return (
    <div className="bg-white rounded-[0.75rem] p-6 border border-[#E8E4D8] shadow-sm space-y-4 font-sans active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
      <div className="flex items-center justify-between border-b border-[#1C2620]/5 pb-3">
        <div>
          <h4 className="font-display font-800 text-lg text-[#132219]">
            Produits <span className="font-serif italic font-normal text-[#2D5A3D]">favoris</span>
          </h4>
          <span className="text-[10px] font-mono text-[#132219]/50 uppercase tracking-widest block mt-0.5">
            Depuis la boutique
          </span>
        </div>
        <Link href="/boutique" className="text-xs font-bold text-[#2D5A3D] hover:underline">
          Boutique →
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-[#132219]/55 leading-relaxed py-2">
          Aucun favori pour le moment. Sur la boutique, touchez le cœur sur un produit pour le retrouver ici.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/produit/${p.slug}`}
              className="flex items-center justify-between p-3 rounded-2xl bg-[#F5F3ED] border border-[#E8E4D8] hover:border-[#132219]/30 hover:bg-white transition-all group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl overflow-hidden relative shrink-0 border border-[#E8E4D8] bg-white">
                  <Image
                    src={p.image || 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200&q=80'}
                    alt={p.imageAlt || p.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="min-w-0">
                  <h5 className="font-extrabold text-xs text-[#132219] truncate group-hover:text-[#2D5A3D] transition-colors">
                    {p.name}
                  </h5>
                  <span className="text-[10px] text-[#132219]/60 font-medium block truncate">{p.brand}</span>
                </div>
              </div>

              <span className="font-mono font-bold text-xs bg-white text-[#132219] px-2.5 py-1 rounded-full border border-[#E8E4D8] shrink-0">
                {p.priceEur} €
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
