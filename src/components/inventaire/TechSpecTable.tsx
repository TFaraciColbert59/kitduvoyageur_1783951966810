// src/components/mon-materiel/TechSpecTable.tsx
'use client';

import React from 'react';
import { GearItemData } from '@/lib/mock/mon-materiel-marceline';

interface TechSpecTableProps {
  item: GearItemData;
  onEdit?: () => void;
}

export default function TechSpecTable({ item, onEdit }: TechSpecTableProps) {
  const formattedWeight =
    item.weight_g !== undefined && item.weight_g >= 1000 ? `${item.weight_g} g (${(item.weight_g / 1000).toFixed(1)} kg)` : `${item.weight_g !== undefined ? item.weight_g : 0} g`;

  const specRows = [
    {
      label: 'Catégorie',
      customRender: (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full uppercase">
            Vêtements
          </span>
          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full uppercase">
            {item.category}
          </span>
          <span className="text-xs text-[#132219]/80 font-medium">Mid-cut — 3 saisons</span>
        </div>
      ),
    },
    {
      label: 'Poids (paire)',
      value: `${formattedWeight} (mesuré : 8 oct.)`,
    },
    {
      label: 'Taille',
      value: item.size_label || 'EU 42 - UK 8 - US 8.5 - pointure large',
    },
    {
      label: 'Matériaux',
      value: item.materials || 'Nubuck - membrane GORE-TEX - galoche ADV-C 4D',
    },
    {
      label: 'Semelle',
      value: item.sole_type || 'Contagrip TD : profondeur crampons 5 mm',
    },
    {
      label: 'Imperméabilité',
      value: item.waterproof_rating || 'GORE-TEX Performance Comfort - validé 15 min immersion',
    },
    {
      label: 'Réf. fabricant',
      value: item.ref_code ? `L47180000 / ${item.ref_code}` : 'L47180000 / QST-4-GTX-42',
    },
    {
      label: 'Date d\'achat',
      value: `${item.purchase_date || '12 Février 2025'} — ${item.purchase_vendor || 'Snowleader'} (${item.purchase_invoice_no ? `facture #${item.purchase_invoice_no}` : 'facture #SL-2025-8542'})`,
    },
    {
      label: 'Garantie',
      value: item.warranty_info || 'Jusqu\'au 12 Février 2027 • 2 ans constructeur',
    },
  ];

  return (
    <div className="bg-white rounded-[0.75rem] p-6 lg:p-8 border border-[#E8E4D8] shadow-sm space-y-4 active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E8E4D8] pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#132219] font-display">Fiche technique</h2>
          <p className="text-xs text-[#132219]/60 mt-0.5">
            Les caractéristiques fabricant + votre configuration personnelle.
          </p>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-xs font-semibold text-[#2D5A3D] hover:underline flex items-center gap-1"
          >
            <span>Modifier</span>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#E8E4D8]/50 text-xs sm:text-sm">
        {specRows.map((r, i) => (
          <div key={i} className="py-3.5 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <span className="sm:col-span-4 font-semibold text-[#132219]/70">{r.label}</span>
            <div className="sm:col-span-8 font-medium text-[#132219]">
              {r.customRender ? r.customRender : r.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
