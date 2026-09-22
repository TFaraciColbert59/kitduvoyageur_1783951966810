'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Button, Card, IconButton } from '@/components/ui';
import { UserProfile } from '@/lib/types/profile';
import UserFieldSignature from '@/components/identity/UserFieldSignature';

interface HeroProfilProps {
  profile: UserProfile;
  onEditProfile?: () => void;
  onShareProfile?: () => void;
}

export default function HeroProfil({ profile, onEditProfile, onShareProfile }: HeroProfilProps) {
  return (
    <div className="relative w-full rounded-[var(--lkv-radius-card)] overflow-hidden border border-white/50 shadow-md min-h-[300px] flex flex-col justify-between p-5 sm:p-7 font-sans">
      {/* Photographic Mountain Hero Background */}
      <div className="absolute inset-0 z-0">
        <Image
          src={profile.hero_image_url || '/assets/images/no_image.png'}
          alt="Montagnes alpins"
          fill
          priority
          sizes="(max-width: 1400px) 100vw, 1400px"
          className="object-cover"
        />
        {/* Soft Multi-stop Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--lkv-primary)]/90 via-[color:var(--lkv-primary)]/40 to-black/20" />
      </div>

      {/* Top Header Row inside Hero */}
      <div className="relative z-[var(--z-dropdown)] flex items-center justify-between gap-4">
        {/* Badge Pill — pill verre */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/85 backdrop-blur-md border border-white/60 text-[10px] font-mono font-bold uppercase tracking-widest text-[color:var(--lkv-primary)] shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[color:var(--lkv-warning)]" />
          <span>{profile.role_badge}</span>
        </div>

        {/* Action Buttons Top Right */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={onEditProfile}
            icon={<Icon name="PencilSquareIcon" size={14} aria-hidden="true" />}
          >
            Modifier profil
          </Button>

          <Button
            size="sm"
            onClick={onShareProfile}
            icon={<Icon name="ShareIcon" size={14} aria-hidden="true" />}
          >
            Partager
          </Button>
        </div>
      </div>

      {/* Bottom Main Identity Card — MÊME STYLE que le bouton unique, posée sur la photo */}
      <Card className="relative z-[var(--z-dropdown)] mt-6 px-[var(--space-6)] py-[20px]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          
          <div className="flex items-start sm:items-center gap-4.5 max-w-2xl">
            {/* Avatar with Camera action */}
            <div className="relative shrink-0">
              <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-white shadow-md bg-[color:var(--btn-tint)] relative">
                <Image
                  src={profile.avatar_url || '/assets/images/no_image.png'}
                  alt={`${profile.first_name} ${profile.last_name}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
              <IconButton
                variant="glass"
                size="sm"
                onClick={onEditProfile}
                aria-label="Changer de photo"
                className="absolute -bottom-1 -right-1"
              >
                <Icon name="image-plus" size={12} aria-hidden="true" />
              </IconButton>
            </div>

            {/* Names & Bio */}
            <div className="space-y-1.5">
              <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-white leading-tight [text-shadow:var(--btn-text-shadow)]">
                {profile.first_name}{' '}
                <span className="font-serif italic font-normal text-[color:var(--lkv-warm-300)]">
                  {profile.last_name}
                </span>
              </h1>

              <p className="text-xs sm:text-sm text-white/85 leading-relaxed font-medium [text-shadow:var(--btn-text-shadow)]">
                {profile.bio}
              </p>

              {/* Empreinte terrain (ADR-010, Lot C.4) — dérivée, jamais choisie */}
              <div className="pt-1">
                <UserFieldSignature
                  userId={profile.id}
                  sealSize={40}
                  ariaLabel={profile.first_name ? `Empreinte terrain de ${profile.first_name}` : 'Empreinte terrain'}
                />
              </div>

              {/* Meta tags */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono text-[color:var(--lkv-text-muted)]">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn border border-[color:var(--lkv-primary)]/5 font-sans font-medium text-xs text-[color:var(--lkv-forest-600)]">
                  <Icon name="MapPinIcon" size={12} className="text-[color:var(--lkv-warning-dark)]" />
                  {profile.location}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn border border-[color:var(--lkv-primary)]/5 font-sans font-medium text-xs text-[color:var(--lkv-forest-600)]">
                  <Icon name="CalendarIcon" size={12} className="text-[color:var(--lkv-secondary)]" />
                  {profile.tenure}
                </span>
                <Link
                  href="/profil"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[color:var(--lkv-secondary)]/10 border border-[color:var(--lkv-secondary)]/20 hover:bg-[color:var(--lkv-secondary)]/20 transition-colors text-xs font-bold text-[color:var(--lkv-primary)] cursor-pointer"
                  title="Trust Score de confiance certifié LKDV"
                >
                  <span>🛡️</span>
                  <span>Trust Score : {profile.trust_score ?? 50}/100</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Quick CTA Matériel */}
          <div className="shrink-0 self-end md:self-center">
            <Link
              href="/hub"
              className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--lkv-touch-min)] rounded-full px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold backdrop-blur-[var(--btn-blur)] border border-transparent bg-[color:var(--btn-tint)] saturate-[var(--btn-saturate)] text-[color:var(--lkv-text-primary)] shadow-elevation-1 text-xs font-bold !py-2.5 !px-4 flex items-center gap-2 shadow-sm"
            >
              <span>🎒</span>
              <span>Mon Matériel</span>
              <Icon name="ArrowRightIcon" size={12} />
            </Link>
          </div>

        </div>
      </Card>
    </div>
  );
}
