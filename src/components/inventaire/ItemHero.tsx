// src/components/inventaire/ItemHero.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';

import { GearItemData } from '@/lib/mock/inventaire-marceline';

interface ItemHeroProps {
  item: GearItemData;
  onEdit: () => void;
  onAddToKit: () => void;
  onLend: () => void;
  onToggleFavorite: () => void;
}

export default function ItemHero({
  item,
  onEdit,
  onAddToKit,
  onLend,
  onToggleFavorite,
}: ItemHeroProps) {
  const images = item.images && item.images.length > 0 ? item.images : [item.image];
  const [selectedImage, setSelectedImage] = useState(images[0]);

  const formattedWeight =
    item.weight_g >= 1000
      ? `${(item.weight_g / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`
      : `${item.weight_g} g`;

  const wearPercent = item.wear_percentage || 68;

  return (
    <section className="bg-white rounded-3xl p-6 lg:p-8 border border-[#E8E4D8] shadow-sm mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        
        {/* Left Column: Image Gallery */}
        <div className="lg:col-span-5 space-y-4">
          <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[#F5F2EA] border border-[#E8E4D8] group">
            <Image
              src={selectedImage || item.image || '/assets/images/no_image.png'}
              alt={item.alt || item.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              priority
            />

            {/* Top Left Badge */}
            <div className="absolute top-3 left-3 bg-[#132219]/80 backdrop-blur-md text-white text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
              {item.category === 'vêtement' ? 'K1 C • Bivouac 3 saisons' : `Cat. ${item.category}`}
            </div>

            {/* Top Right Weight Pill */}
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-[#132219] font-bold text-xs px-3 py-1 rounded-full shadow-sm border border-[#E8E4D8]">
              {formattedWeight}
            </div>

            {/* Bottom Right Favorite Toggle */}
            <button
              onClick={onToggleFavorite}
              className="absolute bottom-3 right-3 w-9 h-9 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-[#132219] hover:scale-110 transition-transform shadow-md"
              title="Ajouter aux favoris"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={item.is_favorite ? '#E53E3E' : 'none'}
                stroke={item.is_favorite ? '#E53E3E' : 'currentColor'}
                strokeWidth="2"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </button>
          </div>

          {/* Thumbnails Row */}
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {images.map((imgUrl, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(imgUrl)}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                    selectedImage === imgUrl ? 'border-[#132219] ring-2 ring-[#132219]/20 scale-105' : 'border-[#E8E4D8] opacity-75 hover:opacity-100'
                  }`}
                >
                  <Image src={imgUrl} alt={`${item.name} thumb ${idx}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Details & Actions */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div>
            {/* Category Tag Pill */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-extrabold tracking-widest text-[#2D5A3D] uppercase bg-[#E8F3EC] px-3 py-1 rounded-full">
                VÊTEMENTS TECHNIQUES • {item.category.toUpperCase()}
              </span>
            </div>

            {/* Title with serif styling */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#132219] tracking-tight font-display">
              {item.name.includes(item.brand) ? (
                <>
                  {item.name.split(item.brand)[0]}
                  <span className="italic font-serif font-normal text-[#2D5A3D]">{item.brand}</span>
                  {item.name.split(item.brand)[1]}
                </>
              ) : (
                item.name
              )}
            </h1>

            {/* Subheader / References */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-medium text-[#132219]/70">
              <span>{item.brand}</span>
              <span>•</span>
              <span>Réf. {item.ref_code || 'QST-4-GTX-42'}</span>
              <span>•</span>
              <div className="flex items-center gap-1 text-amber-600 font-bold">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
                <span>{item.rating || 4.6} / 5</span>
              </div>
            </div>

            {/* Description Paragraph */}
            <p className="mt-4 text-sm text-[#132219]/80 leading-relaxed font-sans">
              {item.description ||
                'Matériel de randonnée technique vérifié. Idéal pour les sorties exigeantes en bivouac et trekking.'}
            </p>
          </div>

          {/* KPI Grid (6 Stats Cards) */}
          <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
            <div className="bg-[#F5F2EA] rounded-2xl p-3 sm:p-4 border border-[#E8E4D8]/60">
              <span className="block text-[10px] font-bold tracking-wider text-[#132219]/60 uppercase">POIDS (PAIRE)</span>
              <span className="text-base sm:text-lg font-extrabold text-[#132219] mt-0.5 block">{formattedWeight}</span>
            </div>

            <div className="bg-[#F5F2EA] rounded-2xl p-3 sm:p-4 border border-[#E8E4D8]/60">
              <span className="block text-[10px] font-bold tracking-wider text-[#132219]/60 uppercase">TAILLE</span>
              <span className="text-base sm:text-lg font-extrabold text-[#132219] mt-0.5 block">{item.size_label?.split('-')[0] || 'EU 42'}</span>
            </div>

            <div className="bg-[#F5F2EA] rounded-2xl p-3 sm:p-4 border border-[#E8E4D8]/60">
              <span className="block text-[10px] font-bold tracking-wider text-[#132219]/60 uppercase">ACHAT</span>
              <span className="text-base sm:text-lg font-extrabold text-[#132219] mt-0.5 block">{item.purchase_price ? `${item.purchase_price} €` : '-'}</span>
            </div>

            <div className="bg-[#F5F2EA] rounded-2xl p-3 sm:p-4 border border-[#E8E4D8]/60">
              <span className="block text-[10px] font-bold tracking-wider text-[#132219]/60 uppercase">KM PARCOURUS</span>
              <span className="text-base sm:text-lg font-extrabold text-[#132219] mt-0.5 block">{item.km_parcourus || 380} km</span>
            </div>

            <div className="bg-[#F5F2EA] rounded-2xl p-3 sm:p-4 border border-[#E8E4D8]/60">
              <span className="block text-[10px] font-bold tracking-wider text-[#132219]/60 uppercase">SORTIES</span>
              <span className="text-base sm:text-lg font-extrabold text-[#132219] mt-0.5 block">{item.sorties_count || 24} sorties</span>
            </div>

            <div className="bg-[#F5F2EA] rounded-2xl p-3 sm:p-4 border border-[#E8E4D8]/60">
              <span className="block text-[10px] font-bold tracking-wider text-[#132219]/60 uppercase">RESTE AVANT REMPL.</span>
              <span className="text-base sm:text-lg font-extrabold text-[#132219] mt-0.5 block">~{item.reste_km || 180} km</span>
            </div>
          </div>

          {/* Wear / Condition Visual Indicator */}
          <div className="bg-[#FAF7F0] rounded-2xl p-4 border border-[#E8E4D8] space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#132219]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                État d'usure — {item.wear_part_name || 'semelle Contagrip'}
              </span>
              <span className="font-extrabold text-amber-700">{wearPercent}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-[#E8E4D8] rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-amber-600 rounded-full transition-all duration-1000"
                style={{ width: `${wearPercent}%` }}
              />
            </div>

            {/* Notes */}
            <p className="text-xs text-[#132219]/70 pt-1 leading-relaxed">
              <strong className="text-[#132219]">Usure moyenne à forte.</strong>{' '}
              {item.wear_notes || "D'après les photos de semelle du 5 oct., il reste environ 180 km avant remplacement conseillé."}
            </p>
          </div>

          {/* Main Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onEdit}
              className="flex-1 min-w-[160px] bg-[#132219] hover:bg-[#23382B] text-white font-semibold text-xs px-5 py-3.5 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 group"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span>Modifier la fiche</span>
            </button>

            <button
              onClick={onAddToKit}
              className="flex-1 min-w-[140px] bg-white border border-[#E8E4D8] hover:border-[#132219]/40 text-[#132219] font-semibold text-xs px-4 py-3.5 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Ajouter à un kit</span>
            </button>

            <button
              onClick={onLend}
              className="flex-1 min-w-[120px] bg-white border border-[#E8E4D8] hover:border-[#132219]/40 text-[#132219] font-semibold text-xs px-4 py-3.5 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
              <span>Prêter</span>
            </button>

            <button
              className="w-12 h-12 bg-white border border-[#E8E4D8] hover:border-[#132219]/40 text-[#132219] rounded-2xl transition-all shadow-sm flex items-center justify-center"
              title="Plus d'actions"
            >
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="2" />
                <circle cx="6" cy="12" r="2" />
                <circle cx="18" cy="12" r="2" />
              </svg>
            </button>
          </div>

        </div>

      </div>
    </section>
  );
}
