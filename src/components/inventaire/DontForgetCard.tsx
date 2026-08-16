'use client';

import React from 'react';
import Link from 'next/link';
import type { GearItemData } from '@/lib/mock/mon-materiel-marceline';

interface DontForgetCardProps {
  items: GearItemData[];
}

function getMissingEssentials(gearItems: { category: string }[]) {
  const hasCat = (cats: string[]) =>
    gearItems.some((i) => cats.includes((i.category || '').toLowerCase()));

  const missing: { title: string; reason: string }[] = [];

  if (!hasCat(['sécurité', 'premiers secours', 'securite'])) {
    missing.push({
      title: 'Trousse de premiers secours',
      reason: 'Recommandée pour toute sortie',
    });
  }
  if (!hasCat(['éclairage', 'lampe', 'eclairage'])) {
    missing.push({ title: 'Lampe frontale', reason: 'Essentielle pour la nuit' });
  }
  if (!hasCat(['eau', 'filtre', 'hydratation'])) {
    missing.push({ title: 'Filtre à eau', reason: 'Vital en autonomie' });
  }

  return missing;
}

export default function DontForgetCard({ items }: DontForgetCardProps) {
  const missing = getMissingEssentials(items);
  if (missing.length === 0) return null;

  return (
    <div className="bg-white rounded-[0.75rem] p-5 border border-amber-200 shadow-sm relative overflow-hidden active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
      <div className="absolute top-0 left-0 w-1 h-full bg-amber-400" />
      <h3 className="text-[11px] font-bold tracking-widest uppercase text-amber-600 mb-3">À ne pas oublier</h3>
      <ul className="space-y-4">
        {missing.map((sug) => (
          <li key={sug.title}>
            <p className="text-xs font-bold text-[#132219] flex items-center gap-1">⚠️ {sug.title}</p>
            <p className="text-[10px] text-[#132219]/60 mt-0.5 mb-2">{sug.reason}</p>
            <Link
              href="/boutique"
              className="inline-block text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full hover:bg-amber-200 transition-colors"
            >
              Voir en boutique
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
