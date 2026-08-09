'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface ProductRec {
  id: string;
  name: string;
  brand: string;
  reason: string;
  price_eur: number;
  image: string;
}

interface RecommendationsCardProps {
  recommendations: ProductRec[];
}

export default function RecommendationsCard({ recommendations }: RecommendationsCardProps) {
  return (
    <div className="bg-white rounded-[2rem] p-6 border border-[#E8E4D8] shadow-sm space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-[#1C2620]/5 pb-3">
        <div>
          <h4 className="font-display font-800 text-lg text-[#132219]">Recommandations <span className="font-serif italic font-normal text-[#2D5A3D]">pour vous</span></h4>
          <span className="text-[10px] font-mono text-[#132219]/50 uppercase tracking-widest block mt-0.5">SUGGESTIONS BASÉES SUR VOTRE MATÉRIEL</span>
        </div>
        <Link href="/boutique" className="text-xs font-bold text-[#2D5A3D] hover:underline">
          Boutique →
        </Link>
      </div>

      <div className="space-y-3">
        {recommendations.map((p) => (
          <Link
            key={p.id}
            href="/boutique"
            className="flex items-center justify-between p-3 rounded-2xl bg-[#F5F3ED] border border-[#E8E4D8] hover:border-[#132219]/30 hover:bg-white transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl overflow-hidden relative shrink-0 border border-[#E8E4D8] bg-white">
                <Image src={p.image || '/assets/images/no_image.png'} alt={p.name} fill className="object-cover group-hover:scale-105 transition-transform" />
              </div>
              <div className="min-w-0">
                <h5 className="font-extrabold text-xs text-[#132219] truncate group-hover:text-[#2D5A3D] transition-colors">
                  {p.name}
                </h5>
                <span className="text-[10px] text-[#132219]/60 font-medium block truncate">
                  {p.reason}
                </span>
              </div>
            </div>

            <span className="font-mono font-bold text-xs bg-white text-[#132219] px-2.5 py-1 rounded-full border border-[#E8E4D8] shrink-0">
              {p.price_eur} €
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
