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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex justify-end bg-[#17402C]/25 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 350, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="glass w-full max-w-lg h-full border-l-0 flex flex-col justify-between overflow-hidden pb-[calc(env(safe-area-inset-bottom,0px)+74px)] md:pb-0"
        style={{
          borderRadius: 0,
          borderRight: 'none',
          borderTop: 'none',
          borderBottom: 'none',
        }}
      >
        {/* Header Hero Image */}
        <div className="relative w-full h-52 sm:h-60 shrink-0 bg-stone-900">
          <img
            src={imgUrl}
            alt={trail.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Top Actions */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
            <span
              className="rounded-[9px] px-[7px] py-[2px] text-[10px] font-bold"
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
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#17402C] transition-all active:scale-90 hover:bg-white"
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
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#17402C] transition-all active:scale-90 hover:bg-white"
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
          <div className="absolute bottom-3 left-4 right-4">
            <div
              className="rounded-[12px] px-2.5 py-1.5"
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
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 no-scrollbar">
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
              className={`glass-capsule-btn shrink-0 ${
                isOfflineAvailable ? 'glass-btn-danger' : 'primary'
              }`}
            >
              {isOfflineAvailable ? 'Supprimer' : 'Télécharger'}
            </button>
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div
          className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2 shrink-0"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.30) 100%)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderTop: '1px solid rgba(255, 255, 255, 0.50)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.9)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              router.push(`/preparer-randonnee?routeId=${trail.id}`);
            }}
            className="glass-capsule-btn primary flex-1"
          >
            <Backpack size={16} />
            <span>🎒 Préparer le matériel & Kit</span>
          </button>

          <button
            type="button"
            onClick={() => {
              router.push(`/randonnee-active?routeId=${trail.id}`);
            }}
            className="glass-capsule-btn secondary flex-1"
          >
            <Compass size={16} />
            <span>📍 Guidage GPS</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}