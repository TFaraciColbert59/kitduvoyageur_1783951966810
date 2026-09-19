'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useEquipment } from '@/hooks/useEquipment';
import ProductCard from '@/components/ui/ProductCard';
import { EquipmentSkeleton } from '../CompteSkeleton';

export default function TabEquipement() {
  const { equipment, loading, totalPackWeight, removeFromEquipment } = useEquipment();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  if (loading && equipment.length === 0) {
    return <EquipmentSkeleton />;
  }

  const formattedWeight =
    totalPackWeight >= 1000
      ? `${(totalPackWeight / 1000).toFixed(1)} kg`
      : `${totalPackWeight} g`;

  return (
    <div className="space-y-4">
      {/* Header & Synthèse du Sac */}
      <div className="glass rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#E1EBDD] flex items-center justify-center text-2xl shrink-0">
            🎒
          </div>
          <div>
            <h3 className="font-bold text-base text-[#17402C]">
              Mon Équipement & Matériel
            </h3>
            <p className="text-xs font-mono text-[#5A7064]">
              {equipment.length} article{equipment.length > 1 ? 's' : ''} possédé{equipment.length > 1 ? 's' : ''} · Poids total :{' '}
              <span className="font-bold text-[#17402C]">{formattedWeight}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/compte"
            className="glass-capsule-btn text-xs font-bold"
          >
            Mon Compte
          </Link>
          <Link
            href="/boutique"
            className="glass-capsule-btn primary text-xs font-bold"
          >
            + Compléter
          </Link>
        </div>
      </div>

      {/* Liste des équipements */}
      {equipment.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center border border-dashed border-black/10">
          <p className="text-4xl mb-3">🎒</p>
          <h4 className="font-bold text-sm text-[#17402C]">Votre sac est vide</h4>
          <p className="text-xs text-[#5A7064] max-w-sm mx-auto mt-1 mb-5">
            Ajoutez votre matériel de randonnée depuis le catalogue ou enregistrez vos propres équipements.
          </p>
          <Link
            href="/boutique"
            className="glass-capsule-btn primary inline-flex items-center gap-2 text-xs font-bold"
          >
            Explorer la boutique & équipement
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {equipment.map((item) => (
            <ProductCard
              key={item.id}
              product={{
                id: item.id,
                name: item.name,
                brand: item.brand,
                category: item.category,
                weight_g: item.weight_g,
                price_eur: item.purchase_price,
                image: item.image,
                condition: item.condition,
                quantity: item.quantity,
              }}
              context="inventory"
              viewMode="grid"
              isOwned={true}
              onRemoveFromEquipment={() => removeFromEquipment(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
