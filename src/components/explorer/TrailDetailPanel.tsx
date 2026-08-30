'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  X,
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

const SUB_CARD_INSET = 'inset 0 1px 1px rgba(255, 255, 255, 0.4)';

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
    <div className="glass-sub-card p-2.5 flex flex-col items-center justify-center text-center gap-0.5" style={{ boxShadow: SUB_CARD_INSET }}>
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-end p-2.5 sm:p-4 md:p-6 pointer-events-none">
      {/* Dimmed backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[#0B1F17]/35 backdrop-blur-[2px] pointer-events-auto"
        onClick={onClose}
      />

      {/* Floating Bento Card */}
      <motion.div
        initial={{ x: '110%', opacity: 0, scale: 0.96 }}
        animate={{ x: 0, opacity: 1, scale: 1 }}
        exit={{ x: '110%', opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="relative pointer-events-auto w-full max-w-[460px] sm:max-w-[480px] h-[calc(100vh-20px)] sm:h-[calc(100vh-32px)] md:h-[calc(100vh-48px)] flex flex-col justify-between overflow-hidden rounded-[26px] sm:rounded-[32px] border border-white/85 shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(251, 250, 246, 0.92) 100%)',
          backdropFilter: 'blur(30px) saturate(190%)',
          WebkitBackdropFilter: 'blur(30px) saturate(190%)',
          boxShadow: '0 24px 64px -12px rgba(23, 64, 44, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.7), inset 0 1.5px 2px rgba(255, 255, 255, 1)',
        }}
      >
        {/* Header Hero Image */}
        <div className="relative w-full h-48 sm:h-56 shrink-0 bg-stone-900 overflow-hidden">
          <img
            src={imgUrl}
            alt={trail.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Top Actions */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
            <span
              className="rounded-[10px] px-2.5 py-1 text-[11px] font-bold shadow-xs"
              style={{
                background: 'rgba(255, 255, 255, 0.92)',
                border: '1px solid rgba(255, 255, 255, 0.60)',
                color: diffColor,
              }}
            >
              {diffLabel}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleShare}
                className="w-8.5 h-8.5 rounded-full flex items-center justify-center text-[#17402C] transition-all active:scale-90 hover:bg-white cursor-pointer shadow-xs"
                style={{
                  background: 'rgba(255, 255, 255, 0.92)',
                  border: '1px solid rgba(255, 255, 255, 0.60)',
                }}
                aria-label="Partager le sentier"
              >
                <Share2 size={14} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8.5 h-8.5 rounded-full flex items-center justify-center text-[#17402C] transition-all active:scale-90 hover:bg-white cursor-pointer shadow-xs"
                style={{
                  background: 'rgba(255, 255, 255, 0.92)',
                  border: '1px solid rgba(255, 255, 255, 0.60)',
                }}
                aria-label="Fermer la fiche détaillée"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Title on Hero */}
          <div className="absolute bottom-3 left-3.5 right-3.5">
            <div
              className="rounded-[14px] px-3 py-2 shadow-xs"
              style={{
                background: 'rgba(255, 255, 255, 0.92)',
                border: '1px solid rgba(255, 255, 255, 0.60)',
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
          <div className="glass-sub-card p-3.5 flex flex-col gap-2.5" style={{ boxShadow: SUB_CARD_INSET }}>
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
          <div className="glass-sub-card p-3.5 flex flex-col gap-2" style={{ boxShadow: SUB_CARD_INSET }}>
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
          <div className="glass-sub-card p-3 flex items-center justify-between gap-3" style={{ boxShadow: SUB_CARD_INSET }}>
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
              className={`h-8 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 shrink-0 ${
                isOfflineAvailable
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  : 'bg-white/80 hover:bg-white text-[#17402C] border border-white/80 shadow-2xs'
              }`}
            >
              {isOfflineAvailable ? 'Supprimer' : 'Télécharger'}
            </button>
          </div>
        </div>

        {/* Sticky Action Footer — Apple Liquid Glass */}
        <div
          className="p-3.5 sm:p-4 flex flex-col sm:flex-row gap-2.5 shrink-0 border-t border-white/60"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.75) 0%, rgba(251, 250, 246, 0.60) 100%)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.9)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              router.push(`/preparer-randonnee?routeId=${trail.id}`);
            }}
            className="flex-1 h-11 rounded-2xl bg-white/80 hover:bg-white text-[#17402C] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-white/80 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
          >
            <Backpack size={16} />
            <span>Préparer le matériel</span>
          </button>

          <button
            type="button"
            onClick={() => {
              router.push(`/randonnee-active?routeId=${trail.id}`);
            }}
            className="flex-1 h-11 rounded-2xl bg-gradient-to-b from-[#17402C] to-[#2D5A27] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(23,64,44,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Play size={15} className="fill-current" />
            <span>Commencer tout de suite</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}