'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { UserProfile } from '@/lib/types/profile';
import UserFieldSignature from '@/components/identity/UserFieldSignature';

interface HeroProfilProps {
  profile: UserProfile;
  onEditProfile?: () => void;
  onShareProfile?: () => void;
}

export default function HeroProfil({ profile, onEditProfile, onShareProfile }: HeroProfilProps) {
  return (
    <div className="relative w-full rounded-[1.75rem] overflow-hidden border border-white/50 shadow-md min-h-[300px] flex flex-col justify-between p-5 sm:p-7 font-sans">
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
        <div className="absolute inset-0 bg-gradient-to-t from-[#17402C]/90 via-[#17402C]/40 to-black/20" />
      </div>

      {/* Top Header Row inside Hero */}
      <div className="relative z-10 flex items-center justify-between gap-4">
        {/* Badge Pill — pill verre */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/85 backdrop-blur-md border border-white/60 text-[10px] font-mono font-bold uppercase tracking-widest text-[#17402C] shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#C89A3B]" />
          <span>{profile.role_badge}</span>
        </div>

        {/* Action Buttons Top Right */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onEditProfile}
            className="glass-capsule-btn !bg-white/85 backdrop-blur-md text-xs font-bold !py-1.5 !px-3.5 shadow-sm hover:!bg-white cursor-pointer"
          >
            <Icon name="PencilSquareIcon" size={14} />
            <span>Modifier profil</span>
          </button>

          <button
            onClick={onShareProfile}
            className="glass-capsule-btn primary !bg-[#17402C]/90 backdrop-blur-md text-xs font-bold !py-1.5 !px-3.5 shadow-sm cursor-pointer"
          >
            <Icon name="ShareIcon" size={14} />
            <span>Partager</span>
          </button>
        </div>
      </div>

      {/* Bottom Main Identity Card — Single unified glass container */}
      <div className="glass relative z-10 mt-6 rounded-2xl p-5 sm:p-6 border border-white/60 shadow-lg text-[#17402C]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          
          <div className="flex items-start sm:items-center gap-4.5 max-w-2xl">
            {/* Avatar with Camera action */}
            <div className="relative shrink-0">
              <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-white shadow-md bg-[#17402C] relative">
                <Image
                  src={profile.avatar_url || '/assets/images/no_image.png'}
                  alt={`${profile.first_name} ${profile.last_name}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
              <button
                onClick={onEditProfile}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#C89A3B] text-white flex items-center justify-center border border-white hover:scale-110 transition-transform shadow cursor-pointer"
                title="Changer de photo"
              >
                <Icon name="CameraIcon" size={12} />
              </button>
            </div>

            {/* Names & Bio */}
            <div className="space-y-1.5">
              <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-[#17402C] leading-tight">
                {profile.first_name}{' '}
                <span className="font-serif italic font-normal text-[#8C6418]">
                  {profile.last_name}
                </span>
              </h1>

              <p className="text-xs sm:text-sm text-[#365233] leading-relaxed font-medium">
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
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono text-[#5A7064]">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#17402C]/5 border border-[#17402C]/5 font-sans font-medium text-xs text-[#365233]">
                  <Icon name="MapPinIcon" size={12} className="text-[#8C6418]" />
                  {profile.location}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#17402C]/5 border border-[#17402C]/5 font-sans font-medium text-xs text-[#365233]">
                  <Icon name="CalendarIcon" size={12} className="text-[#5B7F55]" />
                  {profile.tenure}
                </span>
                <Link
                  href="/profil"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#5B7F55]/10 border border-[#5B7F55]/20 hover:bg-[#5B7F55]/20 transition-colors text-xs font-bold text-[#17402C] cursor-pointer"
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
              href="/materiel"
              className="glass-capsule-btn primary text-xs font-bold !py-2.5 !px-4 flex items-center gap-2 shadow-sm"
            >
              <span>🎒</span>
              <span>Mon Matériel</span>
              <Icon name="ArrowRightIcon" size={12} />
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
