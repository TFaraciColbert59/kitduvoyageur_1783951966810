'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { UserProfile } from '@/lib/mock/compte-marceline';

interface HeroProfilProps {
  profile: UserProfile;
  onEditProfile?: () => void;
  onShareProfile?: () => void;
}

export default function HeroProfil({ profile, onEditProfile, onShareProfile }: HeroProfilProps) {
  return (
    <div className="relative w-full rounded-[2.5rem] sm:rounded-[3rem] overflow-hidden shadow-2xl min-h-[440px] sm:min-h-[500px] flex flex-col justify-between p-6 sm:p-10 lg:p-14 text-white font-sans border border-white/10">
      {/* Photographic Mountain Hero Background */}
      <div className="absolute inset-0 z-0">
        <Image
          src={profile.hero_image_url}
          alt="Montagnes alpins"
          fill
          priority
          sizes="(max-width: 1200px) 100vw, 1200px"
          className="object-cover"
        />
        {/* Dark Gradient Overlay for optimal readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[#132219]/60 to-[#132219]/95" />
      </div>

      {/* Top Header Row inside Hero */}
      <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start gap-4">
        {/* Badge Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#132219]/80 backdrop-blur-md rounded-full text-xs font-mono font-bold uppercase tracking-widest text-[#A3C9A8] border border-white/15 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-[#D4A359] animate-pulse" />
          <span>{profile.role_badge}</span>
        </div>

        {/* Action Buttons Top Right (Only Modifier & Partager) */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={onEditProfile}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full text-xs font-extrabold text-white transition-all flex items-center justify-center gap-2"
          >
            <Icon name="PencilIcon" size={14} />
            <span>Modifier profil</span>
          </button>
          
          <button
            onClick={onShareProfile}
            className="px-4 py-2 bg-[#2D5A3D] hover:bg-[#132219] text-white rounded-full text-xs font-extrabold transition-all shadow-lg flex items-center justify-center gap-2 hover:scale-105"
          >
            <Icon name="ShareIcon" size={14} />
            <span>Partager</span>
          </button>
        </div>
      </div>

      {/* Bottom Content Area */}
      <div className="relative z-10 mt-8 flex flex-col lg:flex-row items-start lg:items-end justify-between gap-8">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 max-w-3xl">
          {/* Avatar with Edit Camera Badge */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl bg-[#132219] relative">
              <Image
                src={profile.avatar_url}
                alt={`${profile.first_name} ${profile.last_name}`}
                fill
                sizes="128px"
                className="object-cover"
              />
            </div>
            <button
              onClick={onEditProfile}
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-[#D4A359] text-white flex items-center justify-center shadow-lg border-2 border-[#132219] hover:scale-110 transition-transform"
              title="Changer de photo"
            >
              <Icon name="CameraIcon" size={16} />
            </button>
          </div>

          {/* Title & Bio */}
          <div className="space-y-3">
            <h1 className="font-display font-900 text-4xl sm:text-6xl text-white tracking-tight leading-none">
              {profile.first_name}{' '}
              <span className="font-serif italic font-normal text-[#E6C587]">
                {profile.last_name}
              </span>
            </h1>

            <p className="text-sm sm:text-base text-white/90 font-medium leading-relaxed max-w-xl">
              {profile.bio}
            </p>

            {/* Meta Row */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-white/80 pt-1">
              <span className="flex items-center gap-1.5 bg-[#132219]/60 px-3.5 py-1 rounded-full border border-white/10">
                <Icon name="MapPinIcon" size={14} className="text-[#D4A359]" />
                {profile.location}
              </span>
              <span className="flex items-center gap-1.5 bg-[#132219]/60 px-3.5 py-1 rounded-full border border-white/10">
                <Icon name="CalendarIcon" size={14} className="text-[#A3C9A8]" />
                {profile.tenure}
              </span>
              <span className="flex items-center gap-1.5 bg-[#132219]/60 px-3.5 py-1 rounded-full border border-white/10">
                <Icon name="ClockIcon" size={14} className="text-[#A3C9A8]" />
                {profile.last_active}
              </span>
            </div>
          </div>
        </div>

        {/* SINGLE INVENTORY BUTTON - GREENISH LIQUID GLASS EFFECT */}
        <div className="w-full lg:w-auto flex justify-end shrink-0">
          <Link
            href="/inventaire"
            className="group relative w-full sm:w-auto px-6 py-3 bg-emerald-950/40 hover:bg-emerald-900/50 backdrop-blur-xl border border-emerald-400/30 hover:border-emerald-300/60 text-emerald-100 font-display font-800 text-xs sm:text-sm rounded-full shadow-lg shadow-emerald-950/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 overflow-hidden"
          >
            {/* Shimmer light glass shine */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-300/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center text-xs shrink-0">
              🎒
            </div>
            <span className="tracking-wide">Mon Inventaire</span>
            <div className="w-6 h-6 rounded-full bg-emerald-400/20 group-hover:bg-emerald-400/30 flex items-center justify-center text-emerald-300 transition-colors shrink-0">
              <Icon name="ArrowRightIcon" size={12} />
            </div>
          </Link>
        </div>

      </div>
    </div>
  );
}
