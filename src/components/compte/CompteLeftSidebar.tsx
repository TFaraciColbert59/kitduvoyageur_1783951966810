'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';
import { CompteTab } from '@/components/compte/TabsCompte';
import { UserProfile } from '@/lib/types/profile';

interface CompteLeftSidebarProps {
  activeTab: CompteTab;
  onTabChange: (tab: CompteTab) => void;
  profile: UserProfile;
  counts: {
    aventures: number;
    carnets: number;
    clubs: number;
    commandes: number;
    fidelite: number;
  };
  onEditProfile: () => void;
  onShareProfile: () => void;
}

export default function CompteLeftSidebar({
  activeTab,
  onTabChange,
  profile,
  counts,
  onEditProfile,
  onShareProfile,
}: CompteLeftSidebarProps) {
  const fullName = `${profile.first_name} ${profile.last_name}`;
  const handle = `@${profile.first_name.toLowerCase()}${profile.last_name.toLowerCase().slice(0, 1)}`;

  const tabs = [
    { id: 'vue-d-ensemble' as CompteTab, label: "Vue d'ensemble" },
    { id: 'aventures' as CompteTab, label: 'Mes Groupes' },
    { id: 'carnets' as CompteTab, label: 'Carnets de route' },
    { id: 'clubs' as CompteTab, label: 'Mes Clubs' },
    { id: 'commandes' as CompteTab, label: 'Commandes & Achats' },
    { id: 'fidelite' as CompteTab, label: 'Gains & Récompenses' },
    { id: 'parametres' as CompteTab, label: 'Paramètres' },
  ];

  return (
    <aside className="h-full max-h-full w-full flex-1 flex flex-col justify-between glass rounded-[1.5rem] p-3.5 text-[#17402C] font-sans overflow-hidden border border-white/40 shadow-sm select-none">
      {/* ── 1. ZONE HAUTE FIXE (Identité Voyageur & Actions Rapides) ── */}
      <div className="shrink-0 space-y-2.5">
        {/* User Mini Header */}
        <div className="p-3 rounded-2xl glass-sub-card flex items-center gap-3 relative overflow-hidden border border-white/50">
          <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0 bg-[#17402C]">
            <Image
              src={profile.avatar_url}
              alt={fullName}
              fill
              sizes="44px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-display font-bold text-xs sm:text-sm text-[#17402C] truncate leading-tight">
              {profile.first_name}{' '}
              <span className="font-serif italic font-normal text-[#5B7F55]">{profile.last_name}</span>
            </h4>
            <p className="text-[10px] font-mono text-[#5A7064] truncate mt-0.5">
              {handle}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="glass-pill !px-2 !py-0.5 text-[9px] font-mono font-bold tracking-wider">
                Niv. {profile.level.number} · {profile.level.title}
              </span>
            </div>
          </div>
        </div>

        {/* Quick actions buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onEditProfile}
            className="glass-capsule-btn text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1 shadow-none cursor-pointer"
          >
            <Icon name="PencilSquareIcon" size={12} />
            <span>Modifier</span>
          </button>

          <Link
            href="/materiel"
            className="glass-capsule-btn primary text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1 shadow-none cursor-pointer"
          >
            <Icon name="BriefcaseIcon" size={12} />
            <span>Mon Matériel</span>
          </Link>
        </div>
      </div>

      {/* ── 2. ZONE CENTRALE SCROLLABLE À L'INTÉRIEUR (Navigation) ── */}
      <nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2 space-y-1.5" aria-label="Navigation du compte">
        <p className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-2 mb-1">
          Navigation
        </p>

        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`w-full px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border ${
                isActive
                  ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                  : 'bg-white/80 hover:bg-white text-[#17402C] border-white/80 shadow-2xs'
              }`}
            >
              <span className="truncate text-left">{t.label}</span>
              {isActive && <ChevronRightAnimated size={13} className="text-white/70 shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* ── 3. ZONE BASSE FIXE (Partage & Footer) ── */}
      <div className="shrink-0 pt-2 border-t border-[#17402C]/5 space-y-1.5">
        <button
          type="button"
          onClick={onShareProfile}
          className="w-full glass-sub-card text-xs font-semibold text-[#365233] p-2 rounded-xl flex items-center justify-center gap-1.5 hover:bg-white/80 transition-colors cursor-pointer border border-white/40"
        >
          <Icon name="ShareIcon" size={13} />
          <span>Partager mon profil</span>
        </button>

        <div className="text-center">
          <span className="text-[8.5px] font-mono text-[#5A7064] tracking-wider uppercase">
            Le Kit du Voyageur · Compte Voyageur
          </span>
        </div>
      </div>
    </aside>
  );
}
