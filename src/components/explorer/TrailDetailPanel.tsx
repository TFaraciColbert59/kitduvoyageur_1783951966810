'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { MapTrail } from './types';
import { getChatCompletion, GEMINI_PROVIDER, GEMINI_DEFAULT_MODEL } from '@/lib/ai/chatCompletion';
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
  { key: 'nature_score', label: 'Nature', icon: '🌿' },
  { key: 'panorama_score', label: 'Panorama', icon: '🔭' },
];

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-[#E8E4D8] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1 bg-[#F5F2EA] rounded-xl py-3 px-2 text-center">
      <div className="text-[#1C2620]">{icon}</div>
      <span className="text-[10px] text-[#7A8A7D] font-mono uppercase tracking-wide">{label}</span>
      <span className="text-sm font-bold text-[#1C2620] leading-tight">{value}</span>
    </div>
  );
}

export default function TrailDetailPanel({ trail, onClose }: Props) {
  const imgUrl = getTrailImage(trail.id);
  const diffColor = getDifficultyColor(trail.difficulty);
  const diffLabel = getDifficultyLabel(trail.difficulty);

  const [description, setDescription] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState<boolean>(false);
  const [isOfflineAvailable, setIsOfflineAvailable] = useState<boolean>(false);

  const cacheKey = `gemini_desc_${trail.id}`;

  const offline = useOfflineDownload();

  // Vérifier si la randonnée est déjà disponible hors-ligne
  useEffect(() => {
    listOfflineRoutes().then((routes) => {
      setIsOfflineAvailable(routes.some((r) => r.routeId === String(trail.id)));
    }).catch(() => {});
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

  // Generate AI Description
  useEffect(() => {
    let isMounted = true;

    // 1. Check local storage cache first to save quota
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setDescription(cached);
        setLoadingAI(false);
        return;
      }
    } catch {}

    async function generateDescription() {
      setDescription(null);
      setLoadingAI(true);
      try {
        const prompt = `Agis comme un guide de montagne expert et passionné. Génère une description riche, détaillée et inspirante pour cette randonnée, en utilisant un formatage Markdown élégant.

Voici les données de la randonnée :
- Nom : ${trail.name}
- Distance : ${trail.distance_km || '?'} km
- Durée estimée : ${trail.duration_hours || '?'} heures
- Dénivelé positif : +${trail.elevation_gain || '?'} mètres
- Difficulté technique : ${trail.difficulty || '?'}
- Localisation/Massif : ${trail.ref || ''} ${trail.network ? ' / ' + trail.network : ''}
- Score Aventure : ${trail.adventure_score || '?'} / 100
- Score Nature : ${trail.nature_score || '?'} / 100
- Score Panorama : ${trail.panorama_score || '?'} / 100

Structure ta réponse de cette manière :
1. **L'Expérience** : Un premier paragraphe immersif et captivant qui donne envie de faire cette randonnée (ambiance, paysages, sensation).
2. **L'Effort & Le Terrain** : Un deuxième paragraphe qui analyse le ratio distance/dénivelé/durée. Explique très concrètement à quoi s'attendre (est-ce raide ? long ? familial ?). 
3. **Le Conseil du Guide** : Une phrase courte finale avec un conseil pratique (ex: eau, chaussures, météo) lié à ce type de profil.

Ne sois pas redondant, ne fais pas juste la liste des chiffres, mais utilise-les pour créer un vrai récit. N'invente pas de noms de villes ou de sommets si tu ne les connais pas, reste concentré sur l'ambiance et la typologie de l'effort.`;

        const response: any = await getChatCompletion(
          GEMINI_PROVIDER,
          GEMINI_DEFAULT_MODEL,
          [{ role: 'user', content: prompt }]
        );

        if (isMounted) {
          const text = response?.text || response?.content || response?.choices?.[0]?.message?.content;
          if (text) {
            setDescription(text);
            try { localStorage.setItem(cacheKey, text); } catch {}
          } else {
            setDescription("Description générée non disponible.");
          }
        }
      } catch (err: any) {
        console.error(err);
        if (isMounted) {
          // Fallback gracefully if API quota is reached or network fails
          if (trail.ai_description) {
            setDescription(trail.ai_description);
          } else {
            const dist = trail.distance_km ? `${trail.distance_km} km` : '';
            const elev = trail.elevation_gain ? `+${trail.elevation_gain}m de dénivelé` : '';
            const diff = trail.difficulty ? `niveau ${trail.difficulty.toLowerCase()}` : '';
            setDescription(`Magnifique itinéraire de randonnée ${dist} ${elev} (${diff}). Profitez d'un cadre naturel préservé et d'une belle immersion en plein air.`);
          }
        }
      } finally {
        if (isMounted) setLoadingAI(false);
      }
    }

    generateDescription();

    return () => { isMounted = false; };
  }, [trail, cacheKey]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[600] bg-black/30 backdrop-blur-[2px] animate-fadeIn"
        onClick={onClose}
      />

      {/* Panel — slides in from right */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[420px] z-[700] flex flex-col bg-white shadow-2xl animate-slideInRight overflow-hidden">
        {/* Hero image */}
        <div className="relative w-full h-52 flex-shrink-0 bg-[#E7E3D6]">
          <img
            src={imgUrl}
            alt={trail.name}
            className="w-full h-full object-cover"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Difficulty badge */}
          <div
            className="absolute top-4 left-4 px-2.5 py-1 rounded-full text-white text-xs font-bold shadow"
            style={{ backgroundColor: diffColor }}
          >
            {diffLabel}
          </div>

          {/* Trail name over image */}
          <div className="absolute bottom-4 left-4 right-12">
            <h2 className="text-white font-bold text-lg leading-tight drop-shadow-lg line-clamp-3">
              {trail.name}
            </h2>
            {trail.terrain_type && (
              <p className="text-white/75 text-xs mt-0.5">{trail.terrain_type}{trail.ref ? ` · ${trail.ref}` : ''}</p>
            )}
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Quick stats chips */}
          <div className="flex gap-2 p-4">
            <InfoChip
              icon={
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                </svg>
              }
              label="Distance"
              value={formatDistance(trail.distance_km)}
            />
            <InfoChip
              icon={
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              }
              label="Durée"
              value={formatDuration(trail.duration_hours)}
            />
            <InfoChip
              icon={
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <polyline points="17 3 21 3 21 7" /><polyline points="10 14 21 3" />
                  <polyline points="21 16 21 21 16 21" /><polyline points="3 21 3 3" />
                </svg>
              }
              label="Dénivelé"
              value={trail.elevation_gain !== null && trail.elevation_gain !== undefined ? `+${trail.elevation_gain} m` : '—'}
            />
          </div>

          {/* Separator */}
          <div className="h-px bg-[#E8E4D8] mx-4" />

          {/* Tags */}
          <div className="px-4 py-3 flex flex-wrap gap-2">
            {trail.season && (
              <span className="px-2.5 py-1 bg-[#F5F2EA] text-[#3A4A3D] text-xs rounded-full border border-[#E4E0D4]">
                📅 {trail.season}
              </span>
            )}
            {trail.family_friendly && (
              <span className="px-2.5 py-1 bg-[#EDF7F0] text-[#2D6A4F] text-xs rounded-full border border-[#B7E4C7]">
                👨‍👩‍👧 Famille
              </span>
            )}
            {trail.network && (
              <span className="px-2.5 py-1 bg-[#F5F2EA] text-[#3A4A3D] text-xs rounded-full border border-[#E4E0D4] font-mono uppercase">
                {trail.network}
              </span>
            )}
          </div>

          {/* AI Description */}
          {(description || loadingAI) && (
            <>
              <div className="h-px bg-[#E8E4D8] mx-4" />
              <div className="px-4 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2D5A27" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
                  </svg>
                  <h3 className="text-xs font-bold text-[#1C2620] uppercase tracking-widest">Description (IA)</h3>
                </div>
                {loadingAI ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 bg-[#E8E4D8] rounded w-full"></div>
                    <div className="h-3 bg-[#E8E4D8] rounded w-full"></div>
                    <div className="h-3 bg-[#E8E4D8] rounded w-5/6"></div>
                    <div className="h-3 bg-[#E8E4D8] rounded w-4/6 mt-4"></div>
                    <div className="h-3 bg-[#E8E4D8] rounded w-full"></div>
                    <p className="text-[10px] text-[#7A8A7D] mt-2 font-mono">Génération par Gemini en cours...</p>
                  </div>
                ) : (
                  <div className="text-sm text-[#5A6A5D] leading-relaxed">
                    {description?.split('\n').map((line, i) => (
                      <span key={i} className="block mb-2">
                        {line.split('**').map((part, j) => 
                          j % 2 === 1 ? <strong key={j} className="text-[#1C2620]">{part}</strong> : part
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Scores */}
          {SCORE_LABELS.some((s) => trail[s.key] !== null && trail[s.key] !== undefined) && (
            <>
              <div className="h-px bg-[#E8E4D8] mx-4" />
              <div className="px-4 py-4">
                <h3 className="text-xs font-bold text-[#1C2620] uppercase tracking-widest mb-3">Scores</h3>
                <div className="space-y-3">
                  {SCORE_LABELS.map((s) => {
                    const val = trail[s.key] as number | null | undefined;
                    if (val === null || val === undefined) return null;
                    const pct = Math.round(val);
                    return (
                      <div key={s.key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[#5A6A5D]">
                            {s.icon} {s.label}
                          </span>
                          <span className="text-xs font-bold text-[#1C2620]">{pct}/100</span>
                        </div>
                        <ScoreBar value={pct} color={pct >= 70 ? '#22c55e' : pct >= 40 ? '#f97316' : '#ef4444'} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Bottom padding */}
          <div className="h-6" />
        </div>

        {/* Footer CTA */}
        <div className="flex-shrink-0 p-4 border-t border-[#E8E4D8] bg-white space-y-3">
          {/* Bouton hors-ligne */}
          <div>
            {offline.status === 'downloading' ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[#5A6A5D]">
                  <span>📥 Téléchargement… {offline.downloaded}/{offline.total} tuiles</span>
                  <span>{offline.progress}%</span>
                </div>
                <div className="w-full h-2 bg-[#E8E4D8] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#2D5A27] rounded-full transition-all duration-200"
                    style={{ width: `${offline.progress}%` }}
                  />
                </div>
              </div>
            ) : offline.status === 'too_large' || offline.status === 'no_geom' || offline.status === 'error' ? (
              <div className="text-xs text-red-500 bg-red-50 rounded-xl p-3 border border-red-200">
                ⚠️ {offline.error}
                <button onClick={offline.reset} className="ml-2 underline text-red-600">Réessayer</button>
              </div>
            ) : (
              <button
                id={`offline-btn-${trail.id}`}
                onClick={handleOfflineToggle}
                disabled={offline.status === 'checking'}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 border ${
                  isOfflineAvailable
                    ? 'bg-green-50 border-green-200 text-green-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                    : 'bg-[#F5F2EA] border-[#E4E0D4] text-[#3A4A3D] hover:bg-[#EAE6D8]'
                }`}
              >
                {isOfflineAvailable ? (
                  <><span>✅</span> Disponible hors-ligne · Supprimer</>
                ) : (
                  <><span>📥</span> Télécharger pour hors-ligne</>
                )}
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 bg-[#1C2620] text-white text-sm font-semibold rounded-xl hover:bg-[#2D3F35] active:scale-[0.98] transition-all"
          >
            Retour à la carte
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease; }
        .animate-slideInRight { animation: slideInRight 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
      `}</style>
    </>
  );
}
