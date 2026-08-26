'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

interface CommunityHeroOverviewProps {
  carnetsCount: number;
  clubsCount: number;
  groupsCount: number;
  onNavigateTab: (tab: any) => void;
}

export default function CommunityHeroOverview({
  carnetsCount,
  clubsCount,
  groupsCount,
  onNavigateTab,
}: CommunityHeroOverviewProps) {
  const stats = [
    { label: 'VOYAGEURS', val: '12.4k', sub: 'Membres actifs' },
    { label: 'CARNETS', val: carnetsCount, sub: 'Récits archivés' },
    { label: 'CLUBS', val: clubsCount, sub: 'Collectifs vivants' },
    { label: 'EXPÉDITIONS', val: groupsCount, sub: 'En préparation' },
  ];

  return (
    <div className="glass rounded-[1.5rem] p-6 sm:p-8 border border-white/60 shadow-sm overflow-hidden font-sans text-[#17402C]">
      <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
        <div className="max-w-2xl space-y-3">
          {/* Badge */}
          <div className="flex items-center gap-2">
            <span className="glass-pill text-[9.5px] font-mono font-bold text-[#17402C]">
              🌲 LE HUB DES VOYAGEURS LKDV
            </span>
            <span className="glass-pill text-[9.5px] font-mono font-bold text-[#5B7F55]">
              SANS ALGORITHME
            </span>
          </div>

          {/* Title & Slogan */}
          <div>
            <h1 className="font-display font-bold text-3xl sm:text-4xl text-[#17402C] tracking-tight leading-tight">
              Ceux qui marchent,{' '}
              <span className="font-serif italic font-normal text-[#8C6418] block sm:inline">
                parlent doucement.
              </span>
            </h1>
            <p className="font-serif italic text-[#5A7064] text-base sm:text-lg mt-2 leading-relaxed">
              Des récits d&apos;expédition, des traces GPX partagées et des refuges recommandés de bouche à oreille.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <Link
              href="/carnets/nouveau"
              className="glass-capsule-btn primary text-xs font-bold !py-2 !px-4"
            >
              <Icon name="PlusIcon" size={14} />
              <span>Publier un récit</span>
            </Link>

            <button
              onClick={() => onNavigateTab('carnets')}
              className="glass-capsule-btn text-xs font-bold !py-2 !px-4"
            >
              <span>Lire les carnets récents →</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-[#17402C]/5">
        {stats.map((s, idx) => (
          <div key={idx} className="glass-sub-card p-3 rounded-xl border border-white/50 space-y-1">
            <span className="text-[9px] font-mono font-bold text-[#5A7064] tracking-widest uppercase block">
              {s.label}
            </span>
            <div className="font-mono font-bold text-xl text-[#17402C] leading-none">
              {s.val}
            </div>
            <span className="text-[10px] text-[#5A7064] block truncate">
              {s.sub}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
