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
        return <span className="glass-pill pill-warn">En cours</span>;
      case 'Terminée':
        return <span className="glass-pill">Terminée</span>;
      case 'Brouillon':
        return <span className="glass-pill" style={{ background: 'rgba(90,112,100,0.10)', color: '#5A7064', borderColor: 'rgba(90,112,100,0.25)' }}>Brouillon</span>;
      default:
        return <span className="glass-pill pill-info">{status}</span>;
    }
  };

  return (
    <div className="glass rounded-[1.25rem] p-6 space-y-6 active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#17402C]/5 pb-4">
        <div>
          <h3 className="font-display font-bold text-2xl text-[#17402C] tracking-tight">
            Mes <span className="font-serif italic font-normal">groupes</span>
          </h3>
          <p className="text-xs font-mono text-[#5A7064] mt-0.5">
            42 terminées · 1 en cours · 2 planifiées
          </p>
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <button className="glass-capsule-btn !py-1.5 !px-3 !min-h-[0] text-xs font-bold">
              <Icon name="FunnelIcon" size={14} />
              <span>Filtrer</span>
            </button>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="glass-input !py-1.5 !px-3 !min-h-[0] rounded-full text-xs font-bold cursor-pointer"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>
          <Link href="/compte?tab=aventures" className="text-xs font-bold text-[#365233] hover:text-[#17402C] transition-colors whitespace-nowrap">
            Tout voir →
          </Link>
        </div>
      </div>

      <p className="text-xs text-[#365233]/70 leading-relaxed">
        Vos derniers voyages, du plus récent au plus ancien. Cliquez pour retrouver la trace GPX et les photos.
      </p>

      {/* List */}
      <div className="space-y-3">
        {aventures.map((item) => (
          <Link
            key={item.id}
            href={`/groupes/${item.id}`}
            className="glass-sub-card group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 transition-all gap-4 cursor-pointer rounded-2xl"
          >
            <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
              <div className="w-14 h-14 rounded-xl overflow-hidden relative shrink-0 border border-[#17402C]/10">
                <Image
                  src={item.image_url || '/assets/images/no_image.png'}
                  alt={item.title}
                  fill
                  sizes="56px"
                  className="object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-base text-[#17402C] truncate group-hover:text-[#365233] transition-colors">
                  {item.title}
                </h4>
                <p className="text-xs text-[#365233]/60 font-medium mt-0.5 truncate">
                  {item.date_detail}
                </p>
                <div className="flex items-center gap-2 mt-1 font-mono text-[11px] font-bold text-[#365233]/70">
                  <span>{item.distance}</span>
                  <span>•</span>
                  <span>{item.elevation}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#17402C]/5">
              {/* Avatars */}
              <div className="flex -space-x-2 overflow-hidden">
                {item.companions.slice(0, 3).map((name, i) => (
                  <div
                    key={name + i}
                    className="w-7 h-7 rounded-full bg-[#17402C] text-white border-2 border-white text-[10px] font-bold flex items-center justify-center"
                  >
                    {name[0]}
                  </div>
                ))}
                {item.companions.length > 3 && (
                  <div className="w-7 h-7 rounded-full bg-[#5B7F55] text-white border-2 border-white text-[10px] font-bold flex items-center justify-center">
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
