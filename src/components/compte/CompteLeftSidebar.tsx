'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button } from '@/components/ui';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';
import { CompteTab } from '@/components/compte/TabsCompte';
import { UserProfile } from '@/lib/types/profile';
import { useTranslation } from '@/lib/i18n/context';

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
  const { t } = useTranslation();
  const fullName = `${profile.first_name} ${profile.last_name}`;
  const handle = `@${profile.first_name.toLowerCase()}${profile.last_name.toLowerCase().slice(0, 1)}`;

  const tabs = [
    { id: 'vue-d-ensemble' as CompteTab, label: t('account.overview') },
    { id: 'progression' as CompteTab, label: t('account.progression') },
    { id: 'aventures' as CompteTab, label: t('account.adventures') },
    { id: 'carnets' as CompteTab, label: t('account.journals') },
    { id: 'clubs' as CompteTab, label: t('account.clubs') },
    { id: 'commandes' as CompteTab, label: t('account.orders') },
    { id: 'fidelite' as CompteTab, label: t('account.rewards') },
    { id: 'parametres' as CompteTab, label: t('account.settings') },
  ];

  return (
    <aside className="flex h-full max-h-full w-full flex-1 select-none flex-col justify-between overflow-hidden rounded-[var(--lkv-radius-lg)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[14px] font-sans text-[color:var(--lkv-text-primary)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)]">
      {/* ── 1. ZONE HAUTE FIXE (Identité Voyageur & Actions Rapides) ── */}
      <div className="shrink-0 space-y-2.5">
        {/* User Mini Header */}
        <div className="relative flex items-center gap-3 overflow-hidden rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-3)] backdrop-blur-[var(--blur-md)]">
          <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0 bg-[color:var(--btn-tint)]">
            <Image
              src={profile.avatar_url || '/assets/images/no_image.png'}
              alt={fullName}
              fill
              sizes="44px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-display font-bold text-xs sm:text-sm text-[color:var(--lkv-primary)] truncate leading-tight">
              {profile.first_name}{' '}
              <span className="font-serif italic font-normal text-[color:var(--lkv-secondary)]">{profile.last_name}</span>
            </h4>
            <p className="text-[10px] font-mono text-[color:var(--lkv-text-muted)] truncate mt-0.5">
              {handle}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge tone="sage" className="px-[var(--space-2)] py-[2px] font-mono text-[9px] font-bold tracking-wider">
                Niv. {profile.level.number} · {profile.level.title}
              </Badge>
            </div>
          </div>
        </div>

        {/* Quick actions buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onEditProfile}
            icon={<Icon name="PencilSquareIcon" size={12} aria-hidden="true" />}
            className="px-[var(--space-2)] text-[10.5px]"
          >
            Modifier
          </Button>

          <Link
            href="/hub"
            className="inline-flex min-h-[var(--control-height-sm)] items-center justify-center gap-[var(--space-2)] rounded-full border border-transparent bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-2)] text-[10.5px] font-bold text-[color:var(--lkv-text-primary)]"
          >
            <Icon name="BriefcaseIcon" size={12} aria-hidden="true" />
            <span>Mon Matériel</span>
          </Link>
        </div>
      </div>

      {/* ── 2. ZONE CENTRALE SCROLLABLE À L'INTÉRIEUR (Navigation) ── */}
      <nav className="min-h-0 flex-1 space-y-1.5 overflow-y-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={t('account.navigationAria')}>
        <p className="mb-1 px-[var(--space-2)] font-mono text-[9.5px] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
          {t('account.navigation')}
        </p>

        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <Button
              key={t.id}
              type="button"
              variant={isActive ? 'primary' : 'secondary'}
              fullWidth
              onClick={() => onTabChange(t.id)}
              className="justify-between px-[var(--space-4)] text-[length:var(--lkv-text-footnote)]"
              aria-pressed={isActive}
            >
              <span className="truncate text-left">{t.label}</span>
              {isActive && <ChevronRightAnimated size={13} className="shrink-0 text-[color:var(--lkv-text-inverted)]/70" aria-hidden />}
            </Button>
          );
        })}
      </nav>

      {/* ── 3. ZONE BASSE FIXE (Partage & Footer) ── */}
      <div className="shrink-0 space-y-1.5 border-t border-[color:var(--lkv-primary)]/5 pt-2">
        <Button
          type="button"
          variant="secondary"
          fullWidth
          size="sm"
          onClick={onShareProfile}
          icon={<Icon name="ShareIcon" size={13} aria-hidden="true" />}
        >
          Partager mon profil
        </Button>

        <div className="text-center">
          <span className="text-[8.5px] font-mono text-[color:var(--lkv-text-muted)] tracking-wider uppercase">
            Le Kit du Voyageur · Compte Voyageur
          </span>
        </div>
      </div>
    </aside>
  );
}
