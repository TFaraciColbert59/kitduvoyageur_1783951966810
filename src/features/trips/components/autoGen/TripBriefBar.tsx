'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface TripBriefBarProps {
  onGenerate: (query: string) => void;
  initialValue?: string;
  isGenerating?: boolean;
}

const SUGGESTIONS = [
  {
    label: 'Maroc 10j',
    query: '10 jours au Maroc en octobre, budget serré, randonnée et bivouac, on est 3',
  },
  {
    label: 'Mont-Blanc 7j',
    query: '7 jours autour du Mont-Blanc début juillet, en couple, nuits en refuges',
  },
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
        className="relative flex items-center bg-white/80  backdrop-blur-xl border border-[var(--lkv-stone-200)]  rounded-2xl shadow-lg p-1.5 transition-all focus-within:ring-2 focus-within:ring-[var(--lkv-secondary)]"
      >
        <div className="pl-3 pr-2 text-[var(--lkv-secondary-hover)] ">
          <Icon name="sparkles" className="w-5 h-5 animate-pulse" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Une phrase en entrée, un voyage complet en sortie..."
          aria-label="Décrivez votre voyage"
          className="flex-1 bg-transparent border-0 text-[var(--lkv-text-primary)]  placeholder-[var(--lkv-text-subtle)]  text-sm md:text-base focus:outline-none focus:ring-0 px-2 py-3"
          disabled={isGenerating}
        />

        <div className="flex items-center space-x-1 pr-1">
          {/* Bouton Pièce jointe GPX / Photo */}
          <button
            type="button"
            onClick={handleAttachment}
            aria-label="Joindre un tracé GPX ou une photo"
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--lkv-text-subtle)] hover:text-[var(--lkv-text-muted)]  rounded-xl hover:bg-[var(--lkv-surface-muted)]  transition-colors"
          >
            <Icon name="paperclip" className="w-5 h-5" />
          </button>

          {/* Bouton Dictée vocale (Geste 3) */}
          <button
            type="button"
            onClick={handleVoiceInput}
            aria-label="Dicter une consigne vocale"
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--lkv-text-subtle)] hover:text-[var(--lkv-secondary-hover)]  rounded-xl hover:bg-[var(--lkv-surface-muted)]  transition-colors"
          >
            <Icon name="mic" className="w-5 h-5" />
          </button>

          {/* Bouton Soumettre / Générer */}
          <button
            type="submit"
            disabled={!query.trim() || isGenerating}
            className="px-4 py-2.5 min-h-[44px] bg-[var(--lkv-secondary-hover)] hover:bg-[var(--lkv-primary-soft)] disabled:opacity-50 text-white font-medium text-sm rounded-xl flex items-center space-x-1.5 shadow-sm transition-transform active:scale-95"
          >
            <span>Générer mon voyage</span>
            <Icon name="arrow-right" className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Puces de suggestion rapides */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-xs text-[var(--lkv-text-subtle)] font-medium">Exemples :</span>
        {SUGGESTIONS.map((sugg) => (
          <button
            key={sugg.label}
            type="button"
            onClick={() => handleChipClick(sugg.query)}
            className="px-3 py-1 min-h-[var(--lkv-touch-min)] text-xs bg-[var(--lkv-surface-muted)]  text-[var(--lkv-text-muted)]  hover:bg-[var(--lkv-success-bg)]  hover:text-[var(--lkv-secondary-hover)]  rounded-full transition-colors active:scale-95"
          >
            {sugg.label}
          </button>
        ))}
      </div>
    </div>
  );
};
