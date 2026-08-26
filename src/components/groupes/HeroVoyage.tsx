'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { useToast } from '@/contexts/ToastContext';

interface HeroVoyageProps {
  data: any;
  groupId?: string;
  inviteCode?: string;
  onOpenChat?: () => void;
}

export default function HeroVoyage({ data, groupId, inviteCode, onOpenChat }: HeroVoyageProps) {
  const { toast } = useToast();

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/groupes/${inviteCode || groupId}`
    : '';

  const handleInvite = async () => {
    if (inviteCode) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        toast(`Code d'invitation : ${inviteCode}`, 'success');
      } catch {
        toast(`Code d'invitation : ${inviteCode}`, 'success');
      }
    } else {
      toast('Aucun code d&apos;invitation disponible', 'error');
    }
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({ title: `${data.meta.titlePrefix} ${data.meta.titleSuffix}`, url });
      } catch (err) {}
      return;
    }
    navigator.clipboard.writeText(url);
    toast('Lien copié dans le presse-papier !', 'success');
  };

  return (
    <div className="glass bg-gradient-to-br from-[#17402C]/95 via-[#17402C]/85 to-[#33463C]/90 rounded-[28px] p-8 sm:p-10 text-[#FAF8F5] relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border border-white/20">
      {/* Decors */}
      <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-white opacity-5 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 glass-pill mb-6 text-white border-white/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#FAF8F5] font-bold">{data.meta.type} · {data.meta.participantsCount} PERSONNES · {data.meta.season}</span>
        </div>
        
        <h1 className="text-4xl sm:text-5xl md:text-6xl mb-6 leading-[1.1] text-white">
          <span className="font-display font-bold block">{data.meta.titlePrefix}</span>
          <span className="font-serif italic font-normal text-[#A6C1A0]">{data.meta.titleSuffix}</span>
        </h1>
        
        <p className="text-white/80 font-sans text-sm md:text-base leading-relaxed mb-8 max-w-xl">
          {data.meta.description}
        </p>
        
        <div className="flex items-center gap-4 sm:gap-6 font-mono text-sm flex-wrap">
          <div className="flex flex-col">
            <span className="text-white/60 text-[10px] uppercase tracking-widest mb-1 font-bold">Durée</span>
            <span className="font-bold text-white">{data.meta.durationDays} jours</span>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="flex flex-col">
            <span className="text-white/60 text-[10px] uppercase tracking-widest mb-1 font-bold">Distance</span>
            <span className="font-bold text-white">{data.meta.distanceKm} km</span>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="flex flex-col">
            <span className="text-white/60 text-[10px] uppercase tracking-widest mb-1 font-bold">Dénivelé +</span>
            <span className="font-bold text-white">{data.meta.elevationGain} m</span>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="flex flex-col">
            <span className="text-white/60 text-[10px] uppercase tracking-widest mb-1 font-bold">Voyageurs</span>
            <span className="font-bold text-white">{data.meta.participantsCount}</span>
          </div>
        </div>
      </div>
      
      <div className="relative z-10 flex flex-col items-end gap-4 w-full md:w-auto mt-8 md:mt-0">
        <div className="glass-sub-card rounded-2xl w-24 h-24 flex flex-col items-center justify-center mb-2 border-white/25">
          <span className="font-display text-2xl font-bold text-white">J-{data.meta.daysLeft}</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/70 text-center px-2 font-bold">avant le<br/>départ</span>
        </div>
        
        <button
          onClick={handleInvite}
          className="w-full md:w-auto glass-capsule-btn primary py-3 px-6 text-sm font-bold flex items-center justify-center gap-2"
        >
          <Icon name="PlusIcon" size={16} className="relative z-10" />
          <span className="relative z-10">Inviter un ami</span>
        </button>
        
        <div className="flex items-center gap-2.5 mt-2">
          <button
            onClick={onOpenChat}
            className="glass-capsule-btn p-2.5"
            title="Ouvrir la discussion"
          >
            <Icon name="ChatBubbleLeftIcon" size={16} className="relative z-10" />
          </button>
          <button
            onClick={handleShare}
            className="glass-capsule-btn p-2.5"
            title="Partager"
          >
            <Icon name="ShareIcon" size={16} className="relative z-10" />
          </button>
          <button
            onClick={handleInvite}
            className="glass-capsule-btn p-2.5"
            title="Options"
          >
            <Icon name="EllipsisHorizontalIcon" size={16} className="relative z-10" />
          </button>
        </div>
      </div>
    </div>
  );
}
