'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { createClient } from '@/lib/supabase/client';

interface CarnetHeroProps {
  meta: {
    badge?: string;
    titleLine1: string;
    titleLine2?: string;
    subtitleLine1?: string;
    subtitleLine2?: string;
    voyageurs?: number;
    dateRange?: string;
    itineraire?: string;
    likesCount?: number;
    commentsCount?: number;
    authorId?: string;
    authorName?: string;
    authorAvatar?: string;
  };
  onExport: () => void;
  carnetId?: string;
  onOpenComments?: () => void;
}

export default function CarnetHero({ meta, onExport, carnetId, onOpenComments }: CarnetHeroProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSaved, setIsSaved] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(meta.likesCount || 24);
  const [commentsCount] = useState(meta.commentsCount || 8);
  const supabase = createClient();

  useEffect(() => {
    if (!user || !carnetId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('carnet_favorites')
          .select('id')
          .eq('carnet_id', carnetId)
          .eq('user_id', user.id)
          .maybeSingle();
        setIsSaved(!!data);
      } catch (err) {
        console.error('Error checking favorite:', err);
      }
    })();
  }, [user, carnetId, supabase]);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({ title: `${meta.titleLine1} ${meta.titleLine2 || ''}`, url });
      } catch (err) {}
      return;
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      toast('Lien copié dans le presse-papier !', 'success');
    }
  };

  const handleToggleLike = () => {
    if (hasLiked) {
      setHasLiked(false);
      setLikesCount(prev => Math.max(0, prev - 1));
    } else {
      setHasLiked(true);
      setLikesCount(prev => prev + 1);
      toast('Merci pour votre réaction ! 🎒', 'success');
    }
  };

  const handleToggleSave = async () => {
    if (!user) { toast('Connectez-vous pour enregistrer ce carnet', 'error'); return; }
    if (!carnetId) { toast('Carnet indisponible', 'error'); return; }
    if (isSaved) {
      await supabase.from('carnet_favorites').delete().eq('carnet_id', carnetId).eq('user_id', user.id);
      setIsSaved(false);
      toast('Retiré des favoris', 'success');
    } else {
      await supabase.from('carnet_favorites').insert({ carnet_id: carnetId, user_id: user.id });
      setIsSaved(true);
      toast('Ajouté aux favoris ⭐', 'success');
    }
  };

  // Format title gracefully
  let displayTitle1 = meta.titleLine1 || 'Trek & Récit';
  let displayTitle2 = meta.titleLine2 || '';

  if (!displayTitle2 && displayTitle1.includes(' ')) {
    const words = displayTitle1.split(' ');
    if (words.length >= 3) {
      displayTitle1 = words.slice(0, 2).join(' ');
      displayTitle2 = words.slice(2).join(' ');
    }
  }

  const voyageursCount = meta.voyageurs || 1;
  const descriptionText = [meta.subtitleLine1, meta.subtitleLine2].filter(Boolean).join(' ');

  return (
    <div className="glass bg-gradient-to-br from-[#17402C]/95 via-[#17402C]/85 to-[#33463C]/90 rounded-[28px] p-8 sm:p-10 text-[#FAF8F5] relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border border-white/20">
      {/* Subtle glowing orb */}
      <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-white opacity-5 blur-[100px] rounded-full pointer-events-none" />

      {/* Main Left Content */}
      <div className="relative z-10 max-w-2xl">
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 glass-pill text-white border-white/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#FAF8F5] font-bold">
              {meta.badge || 'CARNET D’EXPÉDITION'} · {voyageursCount} {voyageursCount > 1 ? 'VOYAGEURS' : 'VOYAGEUR'} {meta.dateRange ? `· ${meta.dateRange}` : ''}
            </span>
          </div>

          {meta.authorName && (
            <Link
              href={meta.authorId ? `/profil/${meta.authorId}` : '/communaute'}
              className="inline-flex items-center gap-1.5 px-3 py-1 glass-pill text-white border-white/30 bg-black/30 hover:bg-black/50 transition-colors cursor-pointer group"
            >
              <span className="text-[10px] font-mono text-emerald-300 font-bold">Par</span>
              <span className="text-xs font-bold text-white group-hover:underline">{meta.authorName}</span>
            </Link>
          )}
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl mb-6 leading-[1.1] text-white">
          <span className="font-display font-bold block">{displayTitle1}</span>
          {displayTitle2 && (
            <span className="font-serif italic font-normal text-[#A6C1A0]">{displayTitle2}</span>
          )}
        </h1>

        {descriptionText && (
          <p className="text-white/80 font-sans text-sm md:text-base leading-relaxed mb-8 max-w-xl">
            {descriptionText}
          </p>
        )}

        <div className="flex items-center gap-4 sm:gap-6 font-mono text-sm flex-wrap">
          {meta.itineraire && (
            <div className="flex flex-col">
              <span className="text-white/60 text-[10px] uppercase tracking-widest mb-1 font-bold">Itinéraire</span>
              <span className="font-bold text-white truncate max-w-[200px]">{meta.itineraire}</span>
            </div>
          )}
          {meta.dateRange && (
            <>
              <div className="w-px h-8 bg-white/20" />
              <div className="flex flex-col">
                <span className="text-white/60 text-[10px] uppercase tracking-widest mb-1 font-bold">Période</span>
                <span className="font-bold text-white">{meta.dateRange}</span>
              </div>
            </>
          )}
          <div className="w-px h-8 bg-white/20" />
          <div className="flex flex-col">
            <span className="text-white/60 text-[10px] uppercase tracking-widest mb-1 font-bold">Équipe</span>
            <span className="font-bold text-white">{voyageursCount} pers.</span>
          </div>
        </div>
      </div>

      {/* Right Actions & Badge */}
      <div className="relative z-10 flex flex-col items-end gap-4 w-full md:w-auto mt-8 md:mt-0">
        <div className="glass-sub-card rounded-2xl w-28 h-28 flex flex-col items-center justify-center mb-2 border-white/25 text-center px-2">
          <span className="text-3xl mb-1">📖</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/80 font-bold leading-tight">
            Récit Vérifié
          </span>
          <span className="text-[10px] text-emerald-300 font-bold mt-0.5">Certifié LKDV</span>
        </div>

        {/* Primary CTA button */}
        <button
          type="button"
          onClick={onExport}
          className="w-full md:w-auto glass-capsule-btn primary py-3 px-6 text-sm font-bold flex items-center justify-center gap-2"
        >
          <Icon name="ArrowDownTrayIcon" size={16} className="relative z-10" />
          <span className="relative z-10">Exporter le carnet</span>
        </button>

        {/* Social Reactions & Actions Bar */}
        <div className="flex items-center gap-2 mt-1 flex-wrap justify-end">
          {/* Reaction Likes */}
          <button
            type="button"
            onClick={handleToggleLike}
            className={`glass-capsule-btn px-3 py-2 flex items-center gap-1.5 text-xs font-bold transition-all ${
              hasLiked ? 'bg-emerald-600/40 text-emerald-300 border-emerald-400/50' : 'text-white'
            }`}
            title="Réagir au carnet"
          >
            <span className="text-sm relative z-10">🎒</span>
            <span className="relative z-10 font-mono">{likesCount}</span>
          </button>

          {/* Comments count & open */}
          <button
            type="button"
            onClick={onOpenComments}
            className="glass-capsule-btn px-3 py-2 flex items-center gap-1.5 text-xs font-bold text-white"
            title="Commentaires du carnet"
          >
            <Icon name="ChatBubbleLeftIcon" size={14} className="relative z-10" />
            <span className="relative z-10 font-mono">{commentsCount}</span>
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            className="glass-capsule-btn p-2.5 text-white"
            title="Partager le carnet"
          >
            <Icon name="ShareIcon" size={15} className="relative z-10" />
          </button>

          {/* Save / Favorite */}
          <button
            type="button"
            onClick={handleToggleSave}
            className={`glass-capsule-btn p-2.5 transition-colors ${
              isSaved ? 'bg-amber-500/30 text-amber-300 border-amber-300/40' : 'text-white'
            }`}
            title="Enregistrer dans les favoris"
          >
            <Icon name={isSaved ? 'BookmarkSolidIcon' : 'BookmarkIcon'} size={15} className="relative z-10" />
          </button>
        </div>
      </div>
    </div>
  );
}