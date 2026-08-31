'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  MapPin,
  Clock,
  TrendingUp,
  Backpack,
  Compass,
  Download,
  Check,
  Sparkles,
  Share2,
  Navigation,
  Play,
  Mountain,
} from 'lucide-react';
import { XAnimated } from '@/components/icons';
import type { MapTrail } from './types';
import { useOfflineDownload } from '@/hooks/useOfflineDownload';
import { listOfflineRoutes } from '@/lib/offlineStorage';
import {
  getTrailImage,
  getDifficultyColor,
  getDifficultyLabel,
  formatDistance,
  formatDuration,
} from './types';

interface Props {
  trail: MapTrail;
  onClose: () => void;
}

const SCORE_LABELS: { key: keyof MapTrail; label: string; icon: string }[] = [
  { key: 'adventure_score', label: 'Aventure', icon: '⛰️' },
  { key: 'nature_score', label: 'Immersion Nature', icon: '🌿' },
  { key: 'panorama_score', label: 'Points de vue', icon: '🔭' },
];

const SUB_CARD_INSET = 'inset 0 1px 1px rgba(255, 255, 255, 0.6)';

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="glass-progress w-full">
      <div
        className="glass-progress-fill"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className="p-2.5 rounded-[18px] flex flex-col items-center justify-center text-center gap-0.5"
      style={{
        background: 'rgba(255, 255, 255, 0.45)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.55)',
        boxShadow: SUB_CARD_INSET,
      }}
    >
      <div className="text-[#17402C]">{icon}</div>
      <span className="text-[10px] uppercase tracking-wider text-[#5A7064] font-semibold">{label}</span>
      <span className="text-xs sm:text-sm font-mono font-bold text-[#17402C]">{value}</span>
    </div>
  );
}

export default function TrailDetailPanel({ trail, onClose }: Props) {
  const router = useRouter();
  const imgUrl = getTrailImage(trail.id);
  const diffColor = getDifficultyColor(trail.difficulty);
  const diffLabel = getDifficultyLabel(trail.difficulty);

  const [description, setDescription] = useState<string | null>(trail.ai_description || null);
  const [isOfflineAvailable, setIsOfflineAvailable] = useState<boolean>(false);
  const offline = useOfflineDownload();

  // Check offline status
  useEffect(() => {
    listOfflineRoutes()
      .then((routes) => {
        setIsOfflineAvailable(routes.some((r) => r.routeId === String(trail.id)));
      })
      .catch(() => {});
  }, [trail.id]);

  const handleOfflineToggle = useCallback(async () => {
    if (isOfflineAvailable) {
      await offline.deleteOffline(String(trail.id));
      setIsOfflineAvailable(false);
      offline.reset();
    } else {
      await offline.downloadForOffline(trail);
      setIsOfflineAvailable(true);
    }
  }, [isOfflineAvailable, offline, trail]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: trail.name,
        text: `Découvre ce sentier de randonnée sur Le Kit du Voyageur : ${trail.name}`,
        url: window.location.href,
      }).catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-end p-2.5 sm:p-4 md:p-6 pointer-events-none">
      {/* Dimmed backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[#0B1F17]/35 backdrop-blur-[3px] pointer-events-auto"
        onClick={onClose}
      />

      {/* Floating Bento Card — True Translucent Liquid Glass */}
      <motion.div
        initial={{ x: '110%', opacity: 0, scale: 0.96 }}
        animate={{ x: 0, opacity: 1, scale: 1 }}
        exit={{ x: '110%', opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="relative pointer-events-auto w-full max-w-[460px] sm:max-w-[480px] h-[calc(100vh-20px)] sm:h-[calc(100vh-32px)] md:h-[calc(100vh-48px)] flex flex-col justify-between overflow-hidden rounded-[26px] sm:rounded-[32px] border border-white/80 shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.70) 0%, rgba(251, 250, 246, 0.40) 100%)',
          backdropFilter: 'blur(28px) saturate(190%)',
          WebkitBackdropFilter: 'blur(28px) saturate(190%)',
          boxShadow: '0 24px 64px -12px rgba(23, 64, 44, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.6), inset 0 1.5px 2px rgba(255, 255, 255, 0.95)',
        }}
      >
        {/* Header Hero Image */}
        <div className="relative w-full h-48 sm:h-56 shrink-0 bg-stone-900 overflow-hidden">
          <img
            src={imgUrl}
            alt={trail.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

          {/* Top Actions — Refined Apple Glass Pills */}
          <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-10">
            <span
              className="glass-capsule-btn text-[11px] font-bold !py-1 !px-3"
              style={{ color: diffColor }}
            >
              {diffLabel}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="glass-circle-btn w-9 h-9"
                aria-label="Partager le sentier"
                title="Partager"
              >
                <Share2 size={15} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="glass-circle-btn w-9 h-9"
                aria-label="Fermer la fiche détaillée"
                title="Fermer"
              >
                <XAnimated size={16} />
              </button>
            </div>
          </div>

          {/* Title on Hero */}
          <div className="absolute bottom-3 left-3.5 right-3.5">
            <div
              className="rounded-[16px] px-3.5 py-2.5 shadow-xs"
              style={{
                background: 'rgba(255, 255, 255, 0.65)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.70)',
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#365233] flex items-center gap-1 mb-0.5">
                <MapPin size={11} className="text-[#17402C]" />
                <span>{trail.network || trail.terrain_type || 'Massif Alpin'}</span>
              </p>
              <h2 className="text-lg sm:text-xl font-display font-bold leading-tight line-clamp-2 text-[#17402C]">
                {trail.name}
              </h2>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3.5 no-scrollbar">
          {/* Key Stats Row */}
          <div className="grid grid-cols-3 gap-2">
            <StatPill
              icon={<TrendingUp size={16} />}
              label="Distance"
              value={formatDistance(trail.distance_km)}
            />
            <StatPill
              icon={<Mountain size={16} />}
              label="Dénivelé +"
              value={
                trail.elevation_gain !== null && trail.elevation_gain !== undefined
                  ? `+${Math.round(trail.elevation_gain)} m`
                  : '—'
              }
            />
            <StatPill
              icon={<Clock size={16} />}
              label="Durée estimée"
              value={formatDuration(trail.duration_hours)}
            />
          </div>

          {/* Scores Breakdown */}
          <div
            className="p-3.5 rounded-[20px] flex flex-col gap-2.5"
            style={{
              background: 'rgba(255, 255, 255, 0.40)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.50)',
              boxShadow: SUB_CARD_INSET,
            }}
          >
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#5A7064]">
              Indicateurs d'expérience
            </h3>
            {SCORE_LABELS.map(({ key, label, icon }) => {
              const val = typeof trail[key] === 'number' ? (trail[key] as number) : 75;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#365233]">
                    <span className="flex items-center gap-1.5">
                      <span>{icon}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
                    </span>
                    <span className="font-mono text-[#17402C]">{Math.round(val)}/100</span>
                  </div>
                  <ScoreBar value={val} />
                </div>
              );
            })}
          </div>

          {/* AI Description / Insights */}
          <div
            className="p-3.5 rounded-[20px] flex flex-col gap-2"
            style={{
              background: 'rgba(255, 255, 255, 0.40)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.50)',
              boxShadow: SUB_CARD_INSET,
            }}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#5A7064]">
              <Sparkles size={13} className="text-[#17402C]" />
              <span>Guide & Points d'intérêt</span>
            </div>
            <p className="text-xs sm:text-sm text-[#365233] leading-relaxed font-normal">
              {description ||
                `Cet itinéraire de ${formatDistance(trail.distance_km)} offre une immersion complète au cœur de panoramas remarquables. Idéal pour les randonneurs en quête d'air pur et de sentiers balisés.`}
            </p>
          </div>

          {/* Offline Storage Card */}
          <div
            className="p-3 rounded-[20px] flex items-center justify-between gap-3"
            style={{
              background: 'rgba(255, 255, 255, 0.40)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.50)',
              boxShadow: SUB_CARD_INSET,
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#17402C]/10 flex items-center justify-center text-[#17402C] shrink-0">
                {isOfflineAvailable ? <Check size={16} /> : <Download size={16} />}
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold text-[12px] text-[#17402C] truncate">
                  {isOfflineAvailable ? 'Disponible hors-ligne' : 'Mode hors-ligne'}
                </p>
                <p className="text-[11px] text-[#5A7064] truncate">
                  {isOfflineAvailable
                    ? 'Tracé GPS & carte préchargés'
                    : 'Télécharger pour naviguer sans réseau'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOfflineToggle}
              className={
                isOfflineAvailable
                  ? 'h-8 px-3.5 rounded-full text-xs font-bold bg-rose-50/90 text-rose-700 border border-rose-200 cursor-pointer active:scale-95 shrink-0 transition-all'
                  : 'glass-capsule-btn text-xs font-bold !py-1.5 !px-3.5 shrink-0'
              }
            >
              {isOfflineAvailable ? 'Supprimer' : 'Télécharger'}
            </button>
          </div>
        </div>

        {/* Sticky Action Footer — Apple Liquid Glass (Icon-Free Clean Typography) */}
        <div
          className="p-3.5 sm:p-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] sm:pb-4 flex flex-col sm:flex-row gap-2.5 shrink-0"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.65) 0%, rgba(251, 250, 246, 0.40) 100%)',
            backdropFilter: 'blur(24px) saturate(190%)',
            WebkitBackdropFilter: 'blur(24px) saturate(190%)',
            borderTop: '1px solid rgba(255, 255, 255, 0.70)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.95)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              router.push(`/materiel/depart/none?route=${trail.id}`);
            }}
            className="flex-1 h-12 glass-capsule-btn text-xs sm:text-sm font-bold shadow-xs active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Préparer le matériel</span>
          </button>

          <button
            type="button"
            onClick={() => {
              router.push(`/randonnee-active?routeId=${trail.id}`);
            }}
            className="flex-1 h-12 glass-capsule-btn primary text-xs sm:text-sm font-bold shadow-md active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Commencer tout de suite</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}