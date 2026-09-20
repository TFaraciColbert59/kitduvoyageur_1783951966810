'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Button, Chip, IconButton } from '@/components/ui';

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
    <div className="mx-auto w-full max-w-3xl space-y-[var(--space-3)]">
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center gap-[var(--space-1)] rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] p-[3px] transition-all focus-within:ring-2 focus-within:ring-[color:var(--lkv-focus-ring)]"
      >
        <div className="pl-[var(--space-3)] pr-[var(--space-2)] text-[color:var(--lkv-secondary-hover)]">
          <Icon name="sparkles" size={20} className="animate-pulse" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Une phrase en entrée, un voyage complet en sortie..."
          aria-label="Décrivez votre voyage"
          className="min-w-0 flex-1 border-0 bg-transparent px-[var(--space-2)] py-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-0 md:text-[length:var(--lkv-text-body)]"
          disabled={isGenerating}
        />

        <div className="flex items-center gap-[var(--space-1)] pr-[var(--space-1)]">
          {/* Bouton Pièce jointe GPX / Photo */}
          <IconButton
            type="button"
            variant="ghost"
            onClick={handleAttachment}
            aria-label="Joindre un tracé GPX ou une photo"
          >
            <Icon name="paperclip" size={20} />
          </IconButton>

          {/* Bouton Dictée vocale (Geste 3) */}
          <IconButton
            type="button"
            variant="ghost"
            onClick={handleVoiceInput}
            aria-label="Dicter une consigne vocale"
          >
            <Icon name="mic" size={20} />
          </IconButton>

          {/* Bouton Soumettre / Générer */}
          <Button
            type="submit"
            disabled={!query.trim() || isGenerating}
            icon={<Icon name="arrow-right" size={16} />}
            iconPosition="trailing"
          >
            Générer mon voyage
          </Button>
        </div>
      </form>

      {/* Puces de suggestion rapides */}
      <div className="flex flex-wrap items-center gap-[var(--space-2)] px-1">
        <span className="text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-muted)]">
          Exemples :
        </span>
        {SUGGESTIONS.map((sugg) => (
          <Chip key={sugg.label} onClick={() => handleChipClick(sugg.query)}>
            {sugg.label}
          </Chip>
        ))}
      </div>
    </div>
  );
};
