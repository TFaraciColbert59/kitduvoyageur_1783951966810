'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import type { CompteUserProfile, CompteProchainVoyage } from '@/lib/supabase/queries-compte';
import { CompteTab } from './TabsCompte';

interface MobileCompteViewProps {
  profile: CompteUserProfile;
  prochainVoyage: CompteProchainVoyage | null;
  activeTab: CompteTab;
  onTabChange: (tab: CompteTab) => void;
  onOpenEdit: () => void;
}

export default function MobileCompteView({
  profile,
  prochainVoyage,
  activeTab,
  onTabChange,
  onOpenEdit,
}: MobileCompteViewProps) {
  const { stats } = profile;
  const constance = (profile as any).constance;

  const tabs: { id: CompteTab; label: string }[] = [
    { id: 'vue-d-ensemble', label: 'Vue d\'ensemble' },
    { id: 'aventures', label: `Groupes ${profile.stats.sorties}` },
    { id: 'carnets', label: `Carnets de route ${(profile.stats as any).kilometres || 0}` },
    { id: 'clubs', label: `Clubs ${profile.stats.clubs}` },
    { id: 'commandes', label: 'Commandes' },
    { id: 'fidelite', label: 'Fidélité' },
    { id: 'parametres', label: 'Paramètres' },
  ];

  return (
    <div className="block md:hidden bg-[#F5F3ED] min-h-screen pb-24 text-[#1C2620] font-sans">
      
      {/* 1. Compact App Header */}
      <div className="sticky top-0 z-40 bg-[#1C2620] text-white px-4 py-3 flex items-center justify-between shadow-md">
        <Link href="/" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
          <Icon name="ArrowLeftIcon" size={16} />
        </Link>
        <span className="font-extrabold text-sm tracking-tight">Mon Dashboard</span>
        <div className="flex items-center gap-2">
          <button onClick={onOpenEdit} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white" title="Modifier profil">
            <Icon name="PencilIcon" size={16} />
          </button>
          <button onClick={onOpenEdit} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
            <Icon name="EllipsisHorizontalIcon" size={16} />
          </button>
        </div>
      </div>

      {/* 2. Reduced Photo Hero */}
      <div className="relative w-full h-60 bg-[#1C2620] text-white overflow-hidden p-5 flex flex-col justify-end">
        <Image
          src={profile.hero_image_url || '/assets/images/no_image.png'}
          alt="Hero"
          fill
          className="object-cover opacity-40"
        />
        <div className="relative z-10 flex items-center gap-4">
          <div className="relative shrink-0" onClick={onOpenEdit}>
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white relative shadow-md bg-emerald-900 cursor-pointer">
              <Image
                src={profile.avatar_url || '/assets/images/no_image.png'}
                alt="Avatar"
                fill
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-400 text-emerald-950 flex items-center justify-center border border-[#1C2620] shadow">
              <Icon name="CameraIcon" size={12} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-900 text-xl sm:text-2xl text-white truncate">
                {profile.first_name} <span className="font-serif italic font-normal text-emerald-300">{profile.last_name}</span>
              </h2>
              <button
                onClick={onOpenEdit}
                className="px-2.5 py-1 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-[10px] font-extrabold text-white shrink-0 border border-white/20"
              >
                Éditer
              </button>
            </div>
            <p className="text-xs text-white/80 font-medium mt-0.5 truncate">
              {profile.location} · {profile.sorties_count} sorties · niveau {profile.level.number}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Condensed Level Card & Inventory CTA */}
      <div className="px-4 -mt-4 relative z-20 space-y-3">
        <div className="bg-[#1C2620] text-white rounded-2xl p-4 shadow-xl border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-400 text-emerald-950 font-black font-mono text-xs flex items-center justify-center">
              {profile.level.number}
            </div>
            <div>
              <span className="font-extrabold text-sm text-white block">{profile.level.title}</span>
              <span className="text-[10px] font-mono text-white/60">{profile.level.current_pts} / {profile.level.max_pts} pts</span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30">
            560 PTS AVANT GUIDE
          </span>
        </div>

        {/* Big Inventory Button on Mobile */}
        <Link
          href="/compte"
          className="w-full py-3 bg-[#17402C] hover:bg-[#cc3d10] text-white font-black text-xs rounded-2xl shadow-lg flex items-center justify-center gap-2 border border-white/10"
        >
          <span>🎒 Mon Compte</span>
          <Icon name="ArrowRightIcon" size={14} />
        </Link>
      </div>

      {/* 4. Sticky Horizontal Scrollable Tabs */}
      <div className="sticky top-0 z-30 bg-[#F5F3ED]/95 backdrop-blur-md px-4 py-3 border-b border-[#1C2620]/10 shadow-xs transition-all">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {tabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`px-4 py-2 rounded-full text-xs font-extrabold whitespace-nowrap transition-all touch-manipulation min-h-[44px] flex items-center justify-center shrink-0 ${
                  isActive
                    ? 'bg-[#1C2620] text-white shadow-md'
                    : 'bg-white text-[#1C2620]/75 border border-[#1C2620]/12 hover:bg-[#EAE7DC] active:bg-[#E2DEC5]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Condensed Prochain Voyage Card */}
      {prochainVoyage && (
      <div className="px-4 mt-4">
        <div className="bg-gradient-to-br from-[#1C2620] to-[#23332A] text-white rounded-2xl p-4 shadow-md border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider">
              PROCHAIN VOYAGE
            </span>
            <span className="font-mono font-bold text-emerald-400 text-sm">J-{prochainVoyage.days_left}</span>
          </div>

          <div>
            <h3 className="font-display font-800 text-lg text-white">
              {prochainVoyage.title}<span className="font-serif italic font-normal text-emerald-200">{prochainVoyage.title_highlight}</span>
            </h3>
            <p className="text-xs text-white/70 mt-0.5">
              {prochainVoyage.date_range} · {prochainVoyage.companions}
            </p>
          </div>

          <div className="space-y-1 pt-1 border-t border-white/10">
            <div className="flex justify-between text-[10px] font-mono text-white/80">
              <span>Prépa {prochainVoyage.preparation_percentage}%</span>
              <span>{prochainVoyage.tasks_left} tâches restantes</span>
            </div>
            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${prochainVoyage.preparation_percentage}%` }} />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 6. 2x2 Condensed Stats Grid */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-[#1C2620]/5 shadow-sm">
          <span className="text-[9px] font-mono font-bold text-[#1C2620]/50 uppercase block">DISTANCE 2026</span>
          <span className="font-mono font-900 text-xl text-[#1C2620] block mt-0.5">{stats.distance_2026.value}</span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-[#1C2620]/5 shadow-sm">
          <span className="text-[9px] font-mono font-bold text-[#1C2620]/50 uppercase block">DÉNIVELÉ</span>
          <span className="font-mono font-900 text-xl text-[#1C2620] block mt-0.5">{stats.elevation_gain.value}</span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-[#1C2620]/5 shadow-sm">
          <span className="text-[9px] font-mono font-bold text-[#1C2620]/50 uppercase block">NUITS REFUGE</span>
          <span className="font-mono font-900 text-xl text-[#1C2620] block mt-0.5">{stats.refuge_nights.value}</span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-[#1C2620]/5 shadow-sm">
          <span className="text-[9px] font-mono font-bold text-[#1C2620]/50 uppercase block">CONSTANCE</span>
          <span className="font-mono font-900 text-xl text-[#1C2620] block mt-0.5">🔥 6 sem.</span>
        </div>
      </div>
    </div>
  );
}
