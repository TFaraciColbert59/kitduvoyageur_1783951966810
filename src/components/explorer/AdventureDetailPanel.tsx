'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useChat } from '@/lib/hooks/useChat';
import toast from 'react-hot-toast';
import type { ExploreTrail } from './AdventureScore';
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS, DIFFICULTY_BG } from './AdventureScore';

interface AdventureDetailPanelProps {
  trail: ExploreTrail;
  onClose: () => void;
}

const SEASONS: Record<string, string> = {
  spring: 'Printemps',
  summer: 'Été',
  autumn: 'Automne',
  winter: 'Hiver',
  all: 'Toute l\'année',
};

export default function AdventureDetailPanel({ trail, onClose }: AdventureDetailPanelProps) {
  const [aiResponse, setAiResponse] = useState('');
  const [aiRequested, setAiRequested] = useState(false);

  const { response, isLoading: aiLoading, error: aiError, sendMessage } = useChat(
    'GEMINI',
    'gemini/gemini-2.5-flash',
    true
  );

  useEffect(() => {
    if (aiError) toast.error(aiError.message);
  }, [aiError]);

  useEffect(() => {
    if (response) setAiResponse(response);
  }, [response]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleFindIdealAdventure = () => {
    setAiRequested(true);
    setAiResponse('');
    sendMessage([
      {
        role: 'system',
        content: `Tu es le compagnon intelligent de Le Kit du Voyageur. Tu analyses les aventures outdoor et fournis des recommandations personnalisées en français. Sois concis, enthousiaste et pratique. Maximum 3 paragraphes courts.`,
      },
      {
        role: 'user',
        content: `Analyse cette aventure pour moi et dis-moi si elle me correspond :
Nom : ${trail.name}
Difficulté : ${DIFFICULTY_LABELS[trail.difficulty] || trail.difficulty}
Distance : ${trail.distance_km > 0 ? trail.distance_km + ' km' : 'non renseignée'}
Durée : ${trail.duration_hours > 0 ? trail.duration_hours + 'h' : 'non renseignée'}
Dénivelé : ${trail.elevation_gain > 0 ? '+' + trail.elevation_gain + 'm' : 'non renseigné'}
Score aventure : ${trail.adventure_score}/100
Score nature : ${trail.nature_score}/100
Score panorama : ${trail.panorama_score}/100

Donne-moi :
1. Une analyse de cette aventure (niveau, intérêt, points forts)
2. Le profil idéal du randonneur pour cette aventure
3. Les équipements essentiels à préparer`,
      },
    ], { temperature: 0.8, max_tokens: 600 });
  };

  const diffColor = DIFFICULTY_COLORS[trail.difficulty] || '#94a3b8';
  const diffLabel = DIFFICULTY_LABELS[trail.difficulty] || trail.difficulty;
  const diffBg = DIFFICULTY_BG[trail.difficulty] || 'bg-slate-500/15 text-slate-400 border-slate-500/30';

  const stats = [
    { icon: '📏', label: 'Distance', value: trail.distance_km > 0 ? `${trail.distance_km} km` : '—' },
    { icon: '⏱', label: 'Durée', value: trail.duration_hours > 0 ? `${trail.duration_hours}h` : '—' },
    { icon: '⬆️', label: 'Dénivelé', value: trail.elevation_gain > 0 ? `+${trail.elevation_gain}m` : '—' },
    { icon: '🌡', label: 'Saison', value: trail.season ? (SEASONS[trail.season] || trail.season) : 'Variable' },
  ];

  const scores = [
    { icon: '🌲', label: 'Nature', value: trail.nature_score },
    { icon: '🏔', label: 'Panorama', value: trail.panorama_score },
    { icon: '🥾', label: 'Défi', value: trail.challenge_score },
    { icon: '💧', label: 'Services', value: trail.services_score },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1800] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — slides up from bottom on mobile, side panel on desktop */}
      <div className="fixed inset-x-0 bottom-0 z-[1900] max-h-[92vh] bg-[#0d1a12]/98 border-t border-[#2D5A27]/25 rounded-t-3xl shadow-2xl backdrop-blur-2xl flex flex-col md:inset-y-0 md:right-0 md:left-auto md:w-96 md:rounded-none md:rounded-l-3xl md:border-t-0 md:border-l md:max-h-full" style={{ animation: 'panelUp 0.4s cubic-bezier(0.32, 0.72, 0, 1)' }}>
        {/* Handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0 md:hidden">
          <div className="w-10 h-1 bg-[#2D5A27]/40 rounded-full" />
        </div>

        {/* Hero image area */}
        <div
          className="flex-shrink-0 h-44 md:h-52 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${diffColor}30 0%, #0d1a1290 50%, #0d1a12 100%)`,
          }}
        >
          {/* Decorative topo lines */}
          <div className="absolute inset-0 opacity-10">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute border border-[#8BAF7C] rounded-full"
                style={{
                  width: `${60 + i * 25}%`,
                  height: `${60 + i * 25}%`,
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}
          </div>

          {/* Big icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-7xl opacity-40">⛰</span>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-[#0d1a12]/70 border border-[#2D5A27]/30 backdrop-blur-sm flex items-center justify-center transition-all active:scale-95"
          >
            <svg className="w-4 h-4 text-[#8BAF7C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Difficulty badge */}
          <div className="absolute bottom-4 left-5">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${diffBg}`}>
              {diffLabel}
            </span>
          </div>

          {/* Score */}
          {trail.adventure_score > 0 && (
            <div className="absolute bottom-4 right-5 flex items-center gap-1.5 bg-[#0d1a12]/60 backdrop-blur-sm px-2.5 py-1 rounded-xl border border-[#2D5A27]/20">
              <span className="text-amber-400 text-sm">⭐</span>
              <span className="text-white font-mono font-bold text-sm">{trail.adventure_score}</span>
              <span className="text-[#8BAF7C]/40 text-xs">/100</span>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Title section */}
          <div className="px-5 pt-4 pb-3 border-b border-[#2D5A27]/15">
            <h2 className="text-white font-bold text-xl leading-tight">{trail.name}</h2>
            {trail.ai_description && (
              <p className="text-[#8BAF7C]/60 text-sm mt-1.5 leading-relaxed">{trail.ai_description}</p>
            )}
          </div>

          {/* Stats grid */}
          <div className="px-5 py-4 border-b border-[#2D5A27]/15">
            <p className="text-[#8BAF7C]/40 text-[9px] font-mono uppercase tracking-widest mb-3">Informations</p>
            <div className="grid grid-cols-2 gap-2.5">
              {stats.map((s) => (
                <div key={s.label} className="bg-[#111f14]/60 rounded-xl p-3 border border-[#2D5A27]/15">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{s.icon}</span>
                    <span className="text-[9px] text-[#8BAF7C]/40 font-mono uppercase tracking-wider">{s.label}</span>
                  </div>
                  <p className="text-white font-mono font-bold text-sm">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Score bars */}
          <div className="px-5 py-4 border-b border-[#2D5A27]/15">
            <p className="text-[#8BAF7C]/40 text-[9px] font-mono uppercase tracking-widest mb-3">Scores</p>
            <div className="space-y-2.5">
              {scores.map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="text-sm w-5 text-center">{s.icon}</span>
                  <span className="text-[#8BAF7C]/60 text-xs font-mono w-16">{s.label}</span>
                  <div className="flex-1 h-1.5 bg-[#2D5A27]/20 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${s.value}%`, backgroundColor: diffColor, opacity: 0.8 }}
                    />
                  </div>
                  <span className="text-[#8BAF7C]/50 text-[10px] font-mono w-6 text-right">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Section */}
          <div className="px-5 py-4 border-b border-[#2D5A27]/15">
            <p className="text-[#8BAF7C]/40 text-[9px] font-mono uppercase tracking-widest mb-3">Intelligence IA</p>

            {!aiRequested ? (
              <button
                onClick={handleFindIdealAdventure}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-gradient-to-r from-[#1a3520] to-[#2D5A27] border border-[#4A8A3F]/50 text-white font-semibold text-sm transition-all duration-200 active:scale-[0.98] hover:shadow-lg hover:shadow-[#2D5A27]/20 group"
              >
                <span className="text-lg group-hover:animate-pulse">✨</span>
                Trouver mon aventure idéale
              </button>
            ) : (
              <div className="bg-[#111f14]/60 rounded-2xl p-4 border border-[#2D5A27]/20">
                {aiLoading && !aiResponse && (
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-[#2D5A27]/30 border-t-[#2D5A27] rounded-full animate-spin flex-shrink-0" />
                    <p className="text-[#8BAF7C]/50 text-xs font-mono">Analyse en cours…</p>
                  </div>
                )}
                {aiResponse && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm">✨</span>
                      <p className="text-[#8BAF7C]/60 text-[9px] font-mono uppercase tracking-widest">Analyse IA</p>
                    </div>
                    <p className="text-[#C8D9B8] text-sm leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
                    <button
                      onClick={() => { setAiRequested(false); setAiResponse(''); }}
                      className="text-[#8BAF7C]/40 text-[10px] font-mono hover:text-[#8BAF7C]/70 transition-colors mt-2"
                    >
                      Relancer l'analyse →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex-shrink-0 px-5 pb-8 pt-4 border-t border-[#2D5A27]/15 space-y-2.5">
          <Link
            href={`/ai-configurator?trail=${encodeURIComponent(trail.name)}&difficulty=${trail.difficulty}&distance=${trail.distance_km}&elevation=${trail.elevation_gain}`}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#2D5A27] hover:bg-[#3A7035] text-white font-bold text-sm transition-all duration-200 active:scale-[0.98] shadow-lg shadow-[#2D5A27]/20"
          >
            <span>🎒</span>
            Préparer mon sac avec IA
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/carnets"
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#111f14]/60 border border-[#2D5A27]/25 text-[#8BAF7C] text-xs font-semibold transition-all active:scale-[0.97] hover:border-[#2D5A27]/50"
            >
              <span>📖</span>
              Mon carnet
            </Link>
            <button
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#111f14]/60 border border-[#2D5A27]/25 text-[#8BAF7C] text-xs font-semibold transition-all active:scale-[0.97] hover:border-[#2D5A27]/50"
            >
              <span>🧭</span>
              Navigation
            </button>
          </div>
        </div>
      </div>

    </>
  );
}
