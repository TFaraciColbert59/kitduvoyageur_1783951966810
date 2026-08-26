'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
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
    { id: 'vue-d-ensemble' as CompteTab, label: "Vue d'ensemble", icon: 'HomeIcon' },
    { id: 'aventures' as CompteTab, label: 'Mes Groupes', icon: 'UserGroupIcon', count: counts.aventures },
    { id: 'carnets' as CompteTab, label: 'Carnets de route', icon: 'BookOpenIcon', count: counts.carnets },
    { id: 'clubs' as CompteTab, label: 'Mes Clubs', icon: 'SparklesIcon', count: counts.clubs },
    { id: 'commandes' as CompteTab, label: 'Commandes & Achats', icon: 'ShoppingBagIcon', count: counts.commandes },
    { id: 'fidelite' as CompteTab, label: 'Gains & Récompenses', icon: 'CurrencyEuroIcon', badge: `${counts.fidelite} pts` },
    { id: 'parametres' as CompteTab, label: 'Paramètres', icon: 'Cog6ToothIcon' },
  ];

  return (
    <aside className="h-full flex flex-col justify-between glass rounded-[1.5rem] p-4 text-[#17402C] font-sans overflow-hidden border border-white/40 shadow-sm">
      {/* Top User Card & Navigation */}
      <div className="space-y-3 overflow-y-auto no-scrollbar pr-0.5">
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
            <h4 className="font-display font-bold text-sm text-[#17402C] truncate leading-tight">
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
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onEditProfile}
            className="glass-capsule-btn text-[11px] font-bold !py-1.5 !px-2.5 flex items-center justify-center gap-1.5 shadow-none"
          >
            <Icon name="PencilSquareIcon" size={13} />
            <span>Modifier</span>
          </button>

          <Link
            href="/materiel"
            className="glass-capsule-btn primary text-[11px] font-bold !py-1.5 !px-2.5 flex items-center justify-center gap-1.5 shadow-none"
          >
            <Icon name="BriefcaseIcon" size={13} />
            <span>Mon Matériel</span>
          </Link>
        </div>

        {/* Navigation Tabs */}
        <nav className="space-y-1 pt-1.5">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-2 mb-1.5">
            Navigation
          </p>
          {tabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`w-full px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border ${
                  isActive
                    ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                    : 'bg-white/80 hover:bg-white text-[#17402C] border-white/80 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`shrink-0 transition-colors ${isActive ? 'text-[#A6C1A0]' : 'text-[#5A7064] group-hover:text-[#17402C]'}`}>
                    <Icon name={t.icon as any} size={16} />
                  </span>
                  <span className="truncate text-left">{t.label}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {t.count !== undefined && (
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'glass-pill'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                  {t.badge && (
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-[#5B7F55] text-white' : 'glass-pill pill-warn'
                      }`}
                    >
                      {t.badge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom info & share */}
      <div className="pt-2 border-t border-[#17402C]/5 space-y-2 shrink-0">
        <button
          onClick={onShareProfile}
          className="w-full glass-sub-card text-xs font-semibold text-[#365233] p-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-white/80 transition-colors cursor-pointer border border-white/40"
        >
          <Icon name="ShareIcon" size={14} />
          <span>Partager mon profil</span>
        </button>

        <div className="text-center">
          <span className="text-[9px] font-mono text-[#5A7064] tracking-wider uppercase">
            Le Kit du Voyageur · Cockpit v2.0
          </span>
        </div>
      </div>
    </aside>
  );
}
