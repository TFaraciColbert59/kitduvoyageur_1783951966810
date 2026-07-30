'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useChat } from '@/lib/hooks/useChat';
import toast from 'react-hot-toast';
import type { MapRefuge } from './types';

interface AdventureDetailPanelProps {
  trail: MapRefuge;
  onClose: () => void;
}

export default function AdventureDetailPanel({ trail, onClose }: AdventureDetailPanelProps) {
  const [aiResponse, setAiResponse] = useState('');
  const [aiRequested, setAiRequested] = useState(false);

  const { response, isLoading: aiLoading, error: aiError, sendMessage } = useChat(
    'GEMINI',
    'gemini/gemini-2.0-flash',
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
        content: `Tu es le compagnon intelligent de Le Kit du Voyageur. Tu analyses les lieux d'hébergements et fournis des recommandations personnalisées en français. Sois concis, enthousiaste et pratique. Maximum 3 paragraphes courts.`,
      },
      {
        role: 'user',
        content: `Analyse ce lieu pour moi :
Nom : ${trail.name}
Région : ${trail.region || 'non renseignée'}
Altitude : ${trail.altitude_m > 0 ? trail.altitude_m + 'm' : 'non renseigné'}
Capacité : ${trail.capacity || 'non renseignée'} places
Gardé : ${trail.is_staffed ? 'Oui' : 'Non'}

Donne-moi :
1. Une analyse de ce lieu (intérêt, points forts)
2. Le profil idéal du randonneur pour y passer la nuit
3. Les équipements essentiels à préparer`,
      },
    ], { temperature: 0.8, max_tokens: 600 });
  };

  const diffColor = '#4A8A3F';
  const diffLabel = trail.is_staffed ? 'Refuge gardé' : 'Bivouac / Cabane';
  const diffBg = 'bg-[#17402C]/15 text-[#17402C] border-[#17402C]/30';

  const stats = [
    { icon: '🏔', label: 'Altitude', value: trail.altitude_m > 0 ? `${trail.altitude_m} m` : '—' },
    { icon: '🛏', label: 'Capacité', value: trail.capacity > 0 ? `${trail.capacity} pers` : '—' },
    { icon: '🍽', label: 'Repas', value: trail.has_meals ? 'Oui' : 'Non' },
    { icon: '🗓', label: 'Ouverture', value: trail.open_months?.length ? trail.open_months.slice(0,2).join(', ') + '...' : 'Variable' },
  ];

  const scores = [
    { icon: '💰', label: 'Tarif', value: trail.price_per_night ? `${trail.price_per_night} €` : 'Gratuit' },
    { icon: '🔥', label: 'Chauffé', value: trail.has_blankets ? 'Oui' : 'Non' },
  ];

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[1800] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — max 50vh on mobile, side panel on desktop */}
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-x-0 bottom-0 z-[1900] bg-[#0d1a12]/98 border-t border-[#2D5A27]/25 rounded-t-3xl shadow-2xl backdrop-blur-2xl flex flex-col md:inset-y-0 md:right-0 md:left-auto md:w-96 md:rounded-none md:rounded-l-3xl md:border-t-0 md:border-l md:max-h-full"
        style={{ maxHeight: '50vh' }}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0 md:hidden">
          <div className="w-10 h-1 bg-[#2D5A27]/40 rounded-full" />
        </div>

        {/* Header — always visible */}
        <div className="flex-shrink-0 px-5 pt-3 pb-3 border-b border-[#2D5A27]/15 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${diffBg} inline-block mb-1.5`}>
              {diffLabel}
            </span>
            <h2 className="text-white font-bold text-base leading-tight line-clamp-2">{trail.name}</h2>
            {trail.description && (
              <p className="text-[#8BAF7C]/60 text-xs mt-1 leading-relaxed line-clamp-2">{trail.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#0d1a12]/70 border border-[#2D5A27]/30 flex items-center justify-center transition-all active:scale-95 mt-1"
            aria-label="Fermer"
          >
            <svg className="w-4 h-4 text-[#8BAF7C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content — fills remaining 50vh */}
        <div className="flex-1 overflow-y-auto">
          {/* Stats grid */}
          <div className="px-5 py-3 border-b border-[#2D5A27]/15">
            <div className="grid grid-cols-2 gap-2">
              {stats.map((s) => (
                <div key={s.label} className="bg-[#111f14]/60 rounded-xl p-2.5 border border-[#2D5A27]/15">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm">{s.icon}</span>
                    <span className="text-[9px] text-[#8BAF7C]/40 font-mono uppercase tracking-wider">{s.label}</span>
                  </div>
                  <p className="text-white font-mono font-bold text-sm">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Score bars */}
          <div className="px-5 py-3 border-b border-[#2D5A27]/15">
            <p className="text-[#8BAF7C]/40 text-[9px] font-mono uppercase tracking-widest mb-2">Scores</p>
            <div className="space-y-2">
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
          <div className="px-5 py-3 border-b border-[#2D5A27]/15">
            {!aiRequested ? (
              <button
                onClick={handleFindIdealAdventure}
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl bg-gradient-to-r from-[#1a3520] to-[#2D5A27] border border-[#4A8A3F]/50 text-white font-semibold text-sm transition-all duration-200 active:scale-[0.98] hover:shadow-lg hover:shadow-[#2D5A27]/20 group"
              >
                <span className="text-base group-hover:animate-pulse">✨</span>
                Trouver mon aventure idéale
              </button>
            ) : (
              <div className="bg-[#111f14]/60 rounded-2xl p-3 border border-[#2D5A27]/20">
                {aiLoading && !aiResponse && (
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-[#2D5A27]/30 border-t-[#2D5A27] rounded-full animate-spin flex-shrink-0" />
                    <p className="text-[#8BAF7C]/50 text-xs font-mono">Analyse en cours…</p>
                  </div>
                )}
                {aiResponse && (
                  <div className="space-y-2">
                    <p className="text-[#C8D9B8] text-xs leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
                    <button
                      onClick={() => { setAiRequested(false); setAiResponse(''); }}
                      className="text-[#8BAF7C]/40 text-[10px] font-mono hover:text-[#8BAF7C]/70 transition-colors"
                    >
                      Relancer →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="px-5 py-4">
            <Link
              href={`/ai-configurator?trail=${encodeURIComponent(trail.name)}&altitude=${trail.altitude_m || 0}`}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#17402C] hover:bg-[#cc3d10] text-white font-semibold text-sm transition-all duration-200 hover:shadow-lg hover:shadow-[#17402C]/25 active:scale-[0.98]"
            >
              <span>🎒</span>
              Préparer cette aventure
            </Link>
          </div>
        </div>
      </motion.div>
    </>
  );
}
