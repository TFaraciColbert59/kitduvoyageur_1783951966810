'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Aventure } from '@/lib/mock/compte-marceline';

interface MesAventuresCardProps {
  aventures: Aventure[];
}

export default function MesAventuresCard({ aventures }: MesAventuresCardProps) {
  const [selectedYear, setSelectedYear] = useState('2026');

  const getStatusBadge = (status: Aventure['status']) => {
    switch (status) {
      case 'En cours':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300">En cours</span>;
      case 'Terminée':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">Terminée</span>;
      case 'Brouillon':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-300">Brouillon</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-blue-900 border border-blue-300">{status}</span>;
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-[#1C2620]/5 shadow-sm space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1C2620]/5 pb-4">
        <div>
          <h3 className="font-display font-800 text-2xl text-[#1C2620]">
            Mes <span className="font-serif italic font-normal">groupes</span>
          </h3>
          <p className="text-xs font-mono text-[#1C2620]/50 mt-0.5">
            42 terminées · 1 en cours · 2 planifiées
          </p>
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 bg-[#F5F3ED] hover:bg-[#E8E4D8] text-[#1C2620] rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 border border-[#E8E4D8]">
              <Icon name="FunnelIcon" size={14} />
              <span>Filtrer</span>
            </button>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-[#F5F3ED] text-[#1C2620] text-xs font-bold px-3 py-1.5 rounded-full border border-[#E8E4D8] outline-none cursor-pointer"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>
          <Link href="/compte?tab=aventures" className="text-xs font-extrabold text-emerald-700 hover:text-emerald-900 transition-colors whitespace-nowrap">
            Tout voir →
          </Link>
        </div>
      </div>

      <p className="text-xs text-[#1C2620]/60 leading-relaxed">
        Vos derniers voyages, du plus récent au plus ancien. Cliquez pour retrouver la trace GPX et les photos.
      </p>

      {/* List */}
      <div className="space-y-4">
        {aventures.map((item) => (
          <Link
            key={item.id}
            href={`/groupes/${item.id}`}
            className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-[#F5F3ED]/50 hover:bg-[#F5F3ED] border border-[#1C2620]/5 transition-all gap-4 cursor-pointer"
          >
            <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
              <div className="w-14 h-14 rounded-xl overflow-hidden relative shrink-0 border border-[#1C2620]/10 shadow-sm">
                <Image
                  src={item.image_url || '/assets/images/no_image.png'}
                  alt={item.title}
                  fill
                  sizes="56px"
                  className="object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="min-w-0">
                <h4 className="font-extrabold text-base text-[#1C2620] truncate group-hover:text-emerald-800 transition-colors">
                  {item.title}
                </h4>
                <p className="text-xs text-[#1C2620]/60 font-medium mt-0.5 truncate">
                  {item.date_detail}
                </p>
                <div className="flex items-center gap-2 mt-1 font-mono text-[11px] font-bold text-[#1C2620]/70">
                  <span>{item.distance}</span>
                  <span>•</span>
                  <span>{item.elevation}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1C2620]/5">
              {/* Avatars */}
              <div className="flex -space-x-2 overflow-hidden">
                {item.companions.slice(0, 3).map((name, i) => (
                  <div
                    key={name + i}
                    className="w-7 h-7 rounded-full bg-[#1C2620] text-white border-2 border-white text-[10px] font-bold flex items-center justify-center"
                  >
                    {name[0]}
                  </div>
                ))}
                {item.companions.length > 3 && (
                  <div className="w-7 h-7 rounded-full bg-emerald-700 text-white border-2 border-white text-[10px] font-bold flex items-center justify-center">
                    +{item.companions.length - 3}
                  </div>
                )}
              </div>

              {getStatusBadge(item.status)}
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}
