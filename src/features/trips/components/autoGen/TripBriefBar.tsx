'use client';

import React, { useState } from 'react';
import { Sparkles, Mic, Paperclip, ArrowRight } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface TripBriefBarProps {
  onGenerate: (query: string) => void;
  initialValue?: string;
  isGenerating?: boolean;
}

const SUGGESTIONS = [
  { label: 'Maroc 10j', query: '10 jours au Maroc en octobre, budget serré, randonnée et bivouac, on est 3' },
  { label: 'Mont-Blanc 7j', query: '7 jours autour du Mont-Blanc début juillet, en couple, nuits en refuges' },
  { label: 'Sancy 3j', query: '3 jours dans le Sancy en train, départ vendredi soir, budget 100€' },
  { label: 'Islande bivouac', query: 'Islande Laugavegur 5 jours en bivouac et autonomie totale' },
];

export const TripBriefBar: React.FC<TripBriefBarProps> = ({
  onGenerate,
  initialValue = '',
  isGenerating = false,
}) => {
  const [query, setQuery] = useState(initialValue);
  const { haptic } = useHapticFeedback();

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isGenerating) return;
    haptic('medium');
    onGenerate(query.trim());
  };

  const handleChipClick = (suggestionQuery: string) => {
    setQuery(suggestionQuery);
    haptic('selection');
    onGenerate(suggestionQuery);
  };

  const handleVoiceInput = () => {
    haptic('light');
    // Déclencheur vocal / dictée Geste 3
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      try {
        const SpeechRecognition = (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'fr-FR';
        recognition.onresult = (event: any) => {
          const transcript = event.results?.[0]?.[0]?.transcript;
          if (transcript) {
            setQuery(transcript);
            haptic('success');
          }
        };
        recognition.start();
      } catch {
        // Fallback silencieux
      }
    }
  };

  const handleAttachment = () => {
    haptic('light');
    // Ouvre le sélecteur de fichier GPX / Photo
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-lg p-1.5 transition-all focus-within:ring-2 focus-within:ring-emerald-500/50"
      >
        <div className="pl-3 pr-2 text-emerald-600 dark:text-emerald-400">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Une phrase en entrée, un voyage complet en sortie..."
          aria-label="Décrivez votre voyage"
          className="flex-1 bg-transparent border-0 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 text-sm md:text-base focus:outline-none focus:ring-0 px-2 py-3"
          disabled={isGenerating}
        />

        <div className="flex items-center space-x-1 pr-1">
          {/* Bouton Pièce jointe GPX / Photo */}
          <button
            type="button"
            onClick={handleAttachment}
            aria-label="Joindre un tracé GPX ou une photo"
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Bouton Dictée vocale (Geste 3) */}
          <button
            type="button"
            onClick={handleVoiceInput}
            aria-label="Dicter une consigne vocale"
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Mic className="w-5 h-5" />
          </button>

          {/* Bouton Soumettre / Générer */}
          <button
            type="submit"
            disabled={!query.trim() || isGenerating}
            className="px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-sm rounded-xl flex items-center space-x-1.5 shadow-sm transition-transform active:scale-95"
          >
            <span>Générer mon voyage</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Puces de suggestion rapides */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-xs text-zinc-400 font-medium">Exemples :</span>
        {SUGGESTIONS.map((sugg) => (
          <button
            key={sugg.label}
            type="button"
            onClick={() => handleChipClick(sugg.query)}
            className="px-3 py-1 min-h-[32px] text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-full transition-colors active:scale-95"
          >
            {sugg.label}
          </button>
        ))}
      </div>
    </div>
  );
};
