'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import GearCard from './GearCard';
import { GearItemData, UserKitData } from '@/lib/mock/mon-materiel-marceline';

interface MobileInventaireViewProps {
  items: GearItemData[];
  kits: UserKitData[];
  totalArticles: number;
  totalWeightKg: number;
  activeCategory: string;
  onCategoryChange: (cat: any) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (item: GearItemData) => void;
  onDelete: (id: string) => void;
  onOpenAddModal: () => void;
}

export default function MobileInventaireView({
  items,
  kits,
  totalArticles,
  totalWeightKg,
  activeCategory,
  onCategoryChange,
  onToggleFavorite,
  onEdit,
  onDelete,
  onOpenAddModal,
}: MobileInventaireViewProps) {
  const categories = [
    { id: 'all', label: 'Tous' },
    { id: 'couchage', label: 'Couchage' },
    { id: 'portage', label: 'Portage' },
    { id: 'cuisine', label: 'Cuisine' },
    { id: 'vêtement', label: 'Vêtements' },
    { id: 'navigation', label: 'Nav / Élec' },
  ];

  const filteredItems = activeCategory === 'all'
    ? items
    : items.filter((i) => i.category === activeCategory);

  return (
    <div className="block md:hidden bg-[#FAF8F5] min-h-screen pb-24 text-[#132219] font-sans">
      
      {/* 1. Mobile App Top Bar */}
      <div className="sticky top-0 z-40 bg-[#132219] text-white px-4 py-3 flex items-center justify-between shadow-md">
        <Link href="/compte" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
          <Icon name="ArrowLeftIcon" size={16} />
        </Link>
        <span className="font-extrabold text-sm tracking-tight">Mon Inventaire</span>
        <button
          onClick={onOpenAddModal}
          className="w-8 h-8 rounded-full bg-emerald-400 text-emerald-950 font-bold flex items-center justify-center text-base shadow"
        >
          +
        </button>
      </div>

      {/* 2. Reduced Hero Card */}
      <div className="relative w-full h-52 bg-[#132219] text-white overflow-hidden p-5 flex flex-col justify-between">
        <Image
          src="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80"
          alt="Bivouac"
          fill
          className="object-cover opacity-40"
        />
        <div className="relative z-10">
          <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-emerald-300 bg-black/40 px-2.5 py-0.5 rounded-full">
            INVENTAIRE · {totalArticles} ARTICLES
          </span>
          <h2 className="font-display font-900 text-2xl text-white mt-1">
            Mon <span className="font-serif italic font-normal text-emerald-200">inventaire.</span>
          </h2>
        </div>

        {/* Compact Weight Card */}
        <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-mono text-white/70 block uppercase">Poids total cumulé</span>
            <span className="font-mono font-900 text-lg text-white">{totalWeightKg.toFixed(1)} kg</span>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-300 bg-white/10 px-3 py-1 rounded-full border border-white/20">
            {kits.length} KITS
          </span>
        </div>
      </div>

      {/* 3. Horizontal Scrollable Category Tabs */}
      <div className="px-4 mt-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => onCategoryChange(c.id)}
              className={`px-4 py-2 rounded-full text-xs font-extrabold whitespace-nowrap transition-all ${
                activeCategory === c.id
                  ? 'bg-[#132219] text-white shadow-md'
                  : 'bg-white text-[#132219]/70 border border-[#E8E4D8]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Equipment List */}
      <div className="px-4 mt-4 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-[#132219]/60">
          <span>{filteredItems.length} articles affichés</span>
          <button onClick={onOpenAddModal} className="text-emerald-800 hover:underline">+ Ajouter</button>
        </div>

        {filteredItems.length === 0 ? (
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              border: '1px dashed rgba(11,31,23,0.15)',
              padding: '32px 20px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                margin: '0 auto 12px',
                borderRadius: '50%',
                background: '#EDF3ED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
              }}
            >
              🎒
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0B1F17', margin: '0 0 6px' }}>
              {items.length === 0 ? 'Mon inventaire est vide' : 'Aucun résultat'}
            </h3>
            <p style={{ fontSize: '13px', color: '#6B7A72', margin: '0 0 16px', lineHeight: 1.5 }}>
              {items.length === 0
                ? 'Ajoutez votre premier équipement pour préparer vos randonnées.'
                : "Aucun article ne correspond à cette catégorie."}
            </p>
            {items.length === 0 && (
              <button
                onClick={onOpenAddModal}
                style={{
                  padding: '12px 20px',
                  background: '#17402C',
                  color: '#fff',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Ajouter mon premier équipement
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <GearCard
                key={item.id}
                item={item}
                viewMode="list"
                onToggleFavorite={onToggleFavorite}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
