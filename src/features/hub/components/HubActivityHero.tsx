'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { Check, MapPin, Share2, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * UX Hub — Hero de l'activité active. Même langage que TripHero (cover,
 * voile dégradé, actions capsule) mais compact : le hub n'est pas une fiche,
 * c'est un cockpit. Le titre EST le h1 de la vue.
 */
export interface HubActivityHeroProps {
  title: string;
  subtitle?: string | null;
  /** undefined → image de repli · null → fond dégradé (sans photo). */
  coverUrl?: string | null;
  /** Compte à rebours en jours (null = pas de date). */
  daysUntil?: number | null;
  phaseLabel?: string | null;
  /** Libellé du badge de nature (Voyage · Randonnée · Matériel · Groupe). */
  badgeLabel?: string;
  assistantContextLabel?: string;
  /** Partage réel (TripShareModal) — remplace le Web Share simple si fourni. */
  onShareClick?: () => void;
}

export function HubActivityHero({
  title,
  subtitle,
  coverUrl,
  daysUntil,
  phaseLabel,
  badgeLabel,
  assistantContextLabel,
  onShareClick,
}: HubActivityHeroProps) {
  const [copied, setCopied] = useState(false);
  const reduceMotion = useReducedMotion();
  const withImage = coverUrl !== null;
  const imageUrl = coverUrl || '/assets/images/no_image.png';

  const handleShare = async () => {
    if (onShareClick) {
      onShareClick();
      return;
    }
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* fallback presse-papier */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* presse-papier indisponible */
    }
  };

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full min-h-[190px] sm:min-h-[230px] rounded-2xl overflow-hidden shadow-xl"
      aria-label="Activité active"
    >
      {withImage ? (
        <AppImage
          src={imageUrl}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 800px"
          priority
          className="object-cover scale-105"
          fallbackSrc="/assets/images/no_image.png"
        />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-[var(--lkv-primary)] via-[var(--lkv-forest-700)] to-[var(--lkv-forest-950)]"
          aria-hidden="true"
        />
      )}
      {/* Voiles de lisibilité (pattern TripHero) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/15" />
      <div className="absolute inset-0 backdrop-blur-[1.5px]" />

      <div className="relative h-full min-h-[190px] sm:min-h-[230px] p-4 sm:p-6 flex flex-col justify-between text-white">
        {/* Rangée haute : badge nature + phase + compte à rebours */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {badgeLabel && (
              <span className="glass-pill text-[9px] font-mono font-bold uppercase tracking-widest text-white">
                {badgeLabel}
              </span>
            )}
            {phaseLabel && (
              <span className="rounded-full bg-white/20 backdrop-blur-sm border border-white/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                {phaseLabel}
              </span>
            )}
          </div>
          {daysUntil !== null && daysUntil !== undefined && (
            <span
              className="rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 px-3 py-1.5 text-center"
              aria-label={daysUntil >= 0 ? `Départ dans ${daysUntil} jours` : 'Activité en cours ou passée'}
            >
              <span className="block text-lg font-extrabold font-mono leading-none">
                {daysUntil >= 0 ? `J-${daysUntil}` : 'En cours'}
              </span>
            </span>
          )}
        </div>

        {/* Rangée basse : titre + actions */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-white drop-shadow-sm truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-white/85 mt-0.5 flex items-center gap-1.5">
                <MapPin size={13} aria-hidden="true" />
                <span className="truncate">{subtitle}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {assistantContextLabel && (
              <Link
                href="/copilote"
                aria-label={`Assistant IA — ${assistantContextLabel}`}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-full bg-white/15 border border-white/30 backdrop-blur-sm text-xs font-bold text-white cursor-pointer active:scale-95 transition-transform"
              >
                <Sparkles size={14} aria-hidden="true" />
                <span className="truncate max-w-[140px]">Assistant IA</span>
              </Link>
            )}
            <GlassCapsuleBtn
              variant="secondary"
              size="sm"
              onClick={handleShare}
              icon={copied ? <Check size={15} /> : <Share2 size={15} />}
              className="!bg-white/15 !border-white/30 !text-white"
            >
              {copied ? 'Copié !' : 'Partager'}
            </GlassCapsuleBtn>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

export default HubActivityHero;
